/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const XLSX = require("xlsx");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const PORT = Number(process.env.PORT) || 3001;
const DATA_PATH = process.env.SHAREPOINT_EXPORT_PATH;
const ESCALATIONS_EXPORT_PATH = process.env.ESCALATIONS_EXPORT_PATH;

if (!DATA_PATH) {
  console.warn(
    "[backend] SHAREPOINT_EXPORT_PATH is not set. Copy backend/.env.example to backend/.env and set the path to the OneDrive JSON file."
  );
}

if (!ESCALATIONS_EXPORT_PATH) {
  console.warn(
    "[backend] ESCALATIONS_EXPORT_PATH is not set. /api/escalations will error until it's configured in backend/.env."
  );
}

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || true, credentials: false }));
app.use(express.json());

function readMoldingScrap() {
  const filePath = process.env.TEAMS_EXCEL_PATH;
  if (!filePath || !fs.existsSync(filePath)) throw new Error("TEAMS_EXCEL_PATH is missing or inaccessible");
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets.Molding ?? wb.Sheets[wb.SheetNames[0]];
  const numberAt = (address) => Number(String(ws[address]?.v ?? ws[address]?.w ?? 0).replace(/[^0-9.-]/g, "")) || 0;
  const rateAt = (address) => typeof ws[address]?.v === "number"
    ? (ws[address].v > 1 ? ws[address].v / 100 : ws[address].v)
    : numberAt(address) / 100;
  const textAt = (address) => String(ws[address]?.w ?? ws[address]?.v ?? "").trim();
  return {
    sheetName: ws === wb.Sheets.Molding ? "Molding" : wb.SheetNames[0],
    cellTotal: { yield: numberAt("C3"), scrap: numberAt("D3"), scrapRate: rateAt("E3") },
    weeklyScrap: [4, 5, 6, 7, 8].map((row) => ({ cell: textAt(`N${row}`), yield: numberAt(`O${row}`), scrap: numberAt(`P${row}`), scrapRate: rateAt(`Q${row}`) })).filter((item) => item.cell),
    topProducts: [7, 8, 9, 10, 11].map((row) => ({ product: textAt(`B${row}`), yield: numberAt(`C${row}`), scrap: numberAt(`D${row}`), scrapRate: rateAt(`E${row}`) })).filter((item) => item.product),
    topProductsTotal: { yield: numberAt("C12"), scrap: numberAt("D12"), scrapRate: rateAt("E12") },
    topReasons: [7, 8, 9, 10, 11].map((row) => ({ reason: textAt(`H${row}`), scrap: numberAt(`I${row}`), pctOfTotal: rateAt(`J${row}`) })).filter((item) => item.reason),
    topReasonsTotal: { scrap: numberAt("I12"), totalScrap: numberAt("J12") },
  };
}

// ---------- Normalization helpers ----------

function normalizeValue(v) {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(normalizeValue).filter(Boolean).join(", ");
  if (typeof v === "object") {
    if ("Value" in v) return normalizeValue(v.Value);
    if ("value" in v) return normalizeValue(v.value);
    if ("Title" in v) return normalizeValue(v.Title);
    if ("DisplayName" in v) return normalizeValue(v.DisplayName);
    if ("LookupValue" in v) return normalizeValue(v.LookupValue);
    return "";
  }
  return String(v).trim();
}

function pick(row, ...names) {
  const keys = Object.keys(row);
  for (const name of names) {
    const hit = keys.find((k) => k.toLowerCase() === name.toLowerCase());
    if (hit != null && row[hit] != null && row[hit] !== "") return row[hit];
  }
  return null;
}

function parseDate(v) {
  if (!v) return null;
  const s = normalizeValue(v);
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function toBool(v) {
  if (typeof v === "boolean") return v;
  const s = normalizeValue(v).toLowerCase();
  return ["yes", "y", "true", "1"].includes(s);
}

function toYesNo(v) {
  const s = normalizeValue(v).toLowerCase();
  if (!s) return "";
  if (["yes", "y", "true", "1", "pass", "ok"].includes(s)) return "Yes";
  if (["no", "n", "false", "0", "fail"].includes(s)) return "No";
  if (s.startsWith("compar")) return "Comparable";
  return normalizeValue(v);
}

function normalizeRow(raw) {
  const dateVal = pick(raw, "DateCreated", "Created", "CreatedDate", "Date");
  const parsedDate = parseDate(dateVal);
  return {
    id: Number(pick(raw, "ID", "Id") ?? 0) || 0,
    dateCreated: parsedDate ? parsedDate.toISOString().slice(0, 10) : "",
    dateCreatedRaw: parsedDate ? parsedDate.toISOString() : "",
    _ts: parsedDate ? parsedDate.getTime() : 0,
    workOrder: normalizeValue(pick(raw, "WorkOrder", "Work_x0020_Order", "WO")),
    machine: normalizeValue(pick(raw, "Machine")),
    partNumber: normalizeValue(pick(raw, "PartNumber", "Part_x0020_Number", "Part")),
    partDescription: normalizeValue(
      pick(raw, "PartDescription", "Part_x0020_Description", "Description")
    ),
    restartMoldChange: normalizeValue(
      pick(raw, "RestartMoldChange", "Restart_x0020_Mold_x0020_Change", "RestartOrMoldChange")
    ),
    productionTech: normalizeValue(
      pick(raw, "ProductionTech", "Production_x0020_Tech", "Technician")
    ),
    overallAcceptance: toYesNo(
      pick(raw, "OverallAcceptance", "Overall_x0020_Acceptance", "Acceptance")
    ),
    masterCard: toYesNo(pick(raw, "MasterCard", "Master_x0020_Card", "MC")),
  };
}

// ---------- Escalations / Long Term Actions ----------

function normalizeEscalationType(v) {
  const s = normalizeValue(v).toLowerCase();
  if (s.startsWith("long")) return "LongTermAction";
  if (s.startsWith("escal")) return "Escalation";
  return normalizeValue(v);
}

function normalizeEscalationRow(raw) {
  const dueDate = parseDate(pick(raw, "DueDate", "Due_x0020_Date", "Due Date"));
  const created = parseDate(pick(raw, "Created", "DateCreated"));
  return {
    id: Number(pick(raw, "ID", "Id") ?? 0) || 0,
    title: normalizeValue(pick(raw, "Title")),
    type: normalizeEscalationType(pick(raw, "Type")),
    status: normalizeValue(pick(raw, "Status")) || "Open",
    owner: normalizeValue(pick(raw, "Owner")),
    dueDate,
    dateCreated: created ? fmtDate(created) : "",
    details: normalizeValue(pick(raw, "Details", "Comments")),
    manualOverdue: toBool(pick(raw, "OverdueFlag", "Overdue", "ManualOverdue")),
  };
}

function isAutoOverdue(status, dueDate) {
  if (!dueDate) return false;
  if ((status || "").toLowerCase() === "completed") return false;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return dueDate.getTime() < startOfToday.getTime();
}

// Overdue if the due date has passed (and it isn't Completed) OR someone
// manually checked the OverdueFlag column in SharePoint.
function isOverdue(status, dueDate, manualOverdue) {
  return Boolean(manualOverdue) || isAutoOverdue(status, dueDate);
}

function readEscalationsFile() {
  if (!ESCALATIONS_EXPORT_PATH) {
    throw new Error("ESCALATIONS_EXPORT_PATH is not set. Configure backend/.env before calling the API.");
  }
  if (!fs.existsSync(ESCALATIONS_EXPORT_PATH)) {
    throw new Error(`Escalations data file not found at ${ESCALATIONS_EXPORT_PATH}`);
  }
  const text = fs.readFileSync(ESCALATIONS_EXPORT_PATH, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Failed to parse escalations JSON file: ${err.message}`);
  }
  const rows = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.value)
      ? parsed.value
      : Array.isArray(parsed?.data)
        ? parsed.data
        : Array.isArray(parsed?.rows)
          ? parsed.rows
          : [];
  return rows.map(normalizeEscalationRow);
}

function computeEscalationsSummary(rows) {
  const withOverdue = rows.map((r) => ({ ...r, overdue: isOverdue(r.status, r.dueDate, r.manualOverdue) }));
  const cleanRow = ({ dueDate, ...rest }) => ({ ...rest, dueDate: dueDate ? fmtDate(dueDate) : "" });

  const items = withOverdue.map(cleanRow).sort((a, b) => (b.overdue === a.overdue ? 0 : b.overdue ? 1 : -1));
  const escalations = withOverdue.filter((r) => r.type === "Escalation").map(cleanRow);
  const longTermActions = withOverdue.filter((r) => r.type === "LongTermAction").map(cleanRow);

  return {
    updatedAt: new Date().toLocaleString(),
    items,
    escalations,
    longTermActions,
    openCount: withOverdue.filter((r) => r.status.toLowerCase() !== "completed").length,
    overdueCount: withOverdue.filter((r) => r.overdue).length,
  };
}

// ---------- File reading ----------

function readDataFile() {
  if (!DATA_PATH) {
    throw new Error(
      "SHAREPOINT_EXPORT_PATH is not set. Configure backend/.env before calling the API."
    );
  }
  if (!fs.existsSync(DATA_PATH)) {
    throw new Error(`Data file not found at ${DATA_PATH}`);
  }
  const text = fs.readFileSync(DATA_PATH, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Failed to parse JSON file: ${err.message}`);
  }
  const rows = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.value)
      ? parsed.value
      : Array.isArray(parsed?.data)
        ? parsed.data
        : Array.isArray(parsed?.rows)
          ? parsed.rows
          : [];
  return rows.map(normalizeRow);
}

// ---------- KPI computation ----------

function getProductionWindow(now = new Date()) {
  // Monday shows the previous calendar week. Other days show the latest
  // completed 7:00 AM -> 7:00 AM production day.
  const isMonday = now.getDay() === 1;
  const end = new Date(now);
  if (isMonday) {
    end.setHours(0, 0, 0, 0);
  } else {
    end.setHours(7, 0, 0, 0);
    if (now < end) end.setDate(end.getDate() - 1);
  }
  const start = new Date(end);
  start.setDate(start.getDate() - (isMonday ? 7 : 1));
  return { start, end, isMonday };
}

function fmtTime(d) {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

function computeSummary(rows) {
  const now = new Date();
  const { start, end, isMonday } = getProductionWindow(now);

  // Filter to the last completed Monday -> Sunday calendar week.
  const inWindow = rows.filter((r) => {
    if (!r._ts) return false;
    return r._ts >= start.getTime() && r._ts < end.getTime();
  });

  // Dedupe by Machine + PartNumber, keep the latest record (by timestamp, then id).
  const byKey = new Map();
  for (const r of inWindow) {
    const machine = (r.machine || "").trim();
    const part = (r.partNumber || "").trim();
    if (!machine || !part) continue;
    const key = `${machine}||${part}`;
    const prev = byKey.get(key);
    if (!prev || r._ts > prev._ts || (r._ts === prev._ts && r.id > prev.id)) {
      byKey.set(key, r);
    }
  }
  const uniqueJobs = [...byKey.values()];
  const machinesRunning = uniqueJobs.length;

  // Buy Offs = unique Machine + Part jobs where Overall Acceptance is explicitly "Yes".
  // Blank/missing Overall Acceptance is intentionally NOT counted here.
  const buyOffJobs = uniqueJobs.filter((r) => (r.overallAcceptance || "").toLowerCase() === "yes");
  const buyOffCount = buyOffJobs.length;

  // MasterCard breakdown, MC Available, and Compliance are all scoped to Buy Off
  // jobs only — a job that was never accepted isn't part of these stats, so the
  // denominator here is buyOffCount, not the total machinesRunning.
  let matching = 0;      // MasterCard === "Yes"
  let comparable = 0;    // MasterCard === "Comparable"
  let missing = 0;       // "No", blank, null, missing

  for (const r of buyOffJobs) {
    const mc = (r.masterCard || "").toLowerCase();
    if (mc === "yes") matching++;
    else if (mc.startsWith("compar")) comparable++;
    else missing++;
  }

  const mcAvailableCount = matching + comparable; // MC Available = MasterCard "Yes" or "Comparable"
  // Compliance is now the same figure as MC Available, since the base population
  // (Buy Off jobs) is already Overall Accepted = Yes. Kept as its own stat for continuity.
  const complianceCount = mcAvailableCount;
  const complianceDenominator = buyOffCount;
  const compliancePercent =
    complianceDenominator === 0 ? 0 : Math.round((complianceCount / complianceDenominator) * 100);
  const pct = (n) =>
    buyOffCount === 0 ? 0 : Math.round((n / buyOffCount) * 100);

  // Floor map = every unique Machine + Part job in the production window,
  // regardless of Buy Off status (it reflects real-time floor activity, WIP included).
  const machineJobs = [...uniqueJobs]
    .sort((a, b) => (b._ts - a._ts) || (b.id - a.id))
    .map(({ _ts, dateCreatedRaw, ...rest }) => rest);

  // Latest Records and Missing MasterCard are scoped to Buy Off jobs only, so
  // their row counts stay consistent with the buyOffCount-based stats above.
  const buyOffJobRows = [...buyOffJobs]
    .sort((a, b) => (b._ts - a._ts) || (b.id - a.id))
    .map(({ _ts, dateCreatedRaw, ...rest }) => rest);
  const latestRows = buyOffJobRows;

  const missingRows = buyOffJobRows.filter((r) => {
    const mc = (r.masterCard || "").toLowerCase();
    // Mirror the count logic: anything that isn't "yes" or "comparable" is missing.
    return mc !== "yes" && !mc.startsWith("compar");
  });

  // Normalize a Machine value like "301IM30" / "443IM" to floor-tile "301" / "443".
  const normalizeMachine = (m) =>
    String(m || "").replace(/(IM|EM|AM)\d*$/i, "").trim();

  // Group jobs by normalized machine number for the floor map.
  const floorMap = {};
  for (const j of machineJobs) {
    const key = normalizeMachine(j.machine);
    if (!key) continue;
    const mc = (j.masterCard || "").toLowerCase();
    let status;
    if (mc === "yes") status = "matching";
    else if (mc.startsWith("compar")) status = "comparable";
    else status = "missing";
    if (!floorMap[key]) {
      floorMap[key] = { machine: key, jobCount: 0, worstStatus: "matching", jobs: [] };
    }
    floorMap[key].jobCount += 1;
    floorMap[key].jobs.push({
      machine: j.machine,
      partNumber: j.partNumber,
      partDescription: j.partDescription,
      workOrder: j.workOrder,
      productionTech: j.productionTech,
      masterCard: j.masterCard,
      status,
      dateCreated: j.dateCreated,
    });
    // worst status: missing > comparable > matching
    const rank = { matching: 0, comparable: 1, missing: 2 };
    if (rank[status] > rank[floorMap[key].worstStatus]) {
      floorMap[key].worstStatus = status;
    }
  }

  const latestDate = uniqueJobs.length
    ? uniqueJobs.reduce((max, r) => (r.dateCreated > max ? r.dateCreated : max), uniqueJobs[0].dateCreated)
    : "";

  // -------- Monthly MasterCards production (fiscal year: Nov..Oct) --------
  const fyMonths = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];
  const nowFY = new Date();
  const fiscalYearStart = nowFY.getMonth() >= 10 ? nowFY.getFullYear() : nowFY.getFullYear() - 1;
  const monthCounts = new Array(12).fill(0);
  for (const r of rows) {
    if (!r._ts) continue;
    const d = new Date(r._ts);
    const y = d.getFullYear();
    const m = d.getMonth();
    let idx = -1;
    if (y === fiscalYearStart && m === 10) idx = 0;
    else if (y === fiscalYearStart && m === 11) idx = 1;
    else if (y === fiscalYearStart + 1 && m <= 9) idx = m + 2;
    if (idx >= 0) monthCounts[idx] += 1;
  }
  const monthlyMastercards = fyMonths.map((month, i) => ({ month, count: monthCounts[i] }));
  const ytdProduced = monthCounts.reduce((s, n) => s + n, 0);

  return {
    updatedAt: new Date().toLocaleString(),
    productionDate: isMonday
      ? `${fmtDate(start)} - ${fmtDate(new Date(end.getTime() - 1))}`
      : fmtDate(start),
    reportingPeriod: isMonday ? "week" : "production-day",
    productionWindowStart: fmtTime(start),
    productionWindowEnd: fmtTime(end),
    latestDate,

    // Row counts
    totalRows: inWindow.length, // raw rows in the window (before dedupe)
    machinesRunning,             // unique Machine + PartNumber pairs

    // Buy Offs = unique Machine + Part jobs with Overall Acceptance === "Yes"
    buyOffCount,

    // MC Available (Yes or Comparable)
    mcAvailableCount,
    mcAvailablePercent: pct(mcAvailableCount),

    // Breakdown (count + percent of buyOffCount)
    matchingCount: matching,
    matchingPercent: pct(matching),
    comparableCount: comparable,
    comparablePercent: pct(comparable),
    missingCount: missing,
    missingPercent: pct(missing),

    // Compliance (Yes OR Comparable)
    complianceCount,
    complianceDenominator,
    compliancePercent,
    complianceSubtitle: `${complianceCount} of ${complianceDenominator} available MC · Overall Accepted`,

    // Repro Complete — manual input, not derived from SharePoint yet.
    reproComplete: null,

    // Legacy aliases kept for backward compatibility with the frontend.
    availabilityCount: complianceCount,
    availabilityPercent: pct(complianceCount),
    mastercardYes: matching,
    mastercardComparable: comparable,
    mastercardNo: missing,
    complianceYes: matching,
    complianceNo: missing,
    matching,
    comparable,
    missing,

    latestRows,
    missingRows,
    machineJobs,
    floorMap,
    monthlyMastercards,
    ytdProduced,
    fiscalYearStart,
  };
}

// ---------- Routes ----------

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    dataPath: DATA_PATH || null,
    dataPathExists: DATA_PATH ? fs.existsSync(DATA_PATH) : false,
  });
});

app.get("/api/dashboard", (_req, res) => {
  try {
    const rows = readDataFile();
    res.json(computeSummary(rows));
  } catch (err) {
    console.error("[backend] /api/dashboard failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/rows", (_req, res) => {
  try {
    const rows = readDataFile();
    res.json({ rows, totalRows: rows.length, updatedAt: new Date().toLocaleString() });
  } catch (err) {
    console.error("[backend] /api/rows failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[backend] AMG dashboard API listening on http://localhost:${PORT}`);
  console.log(`[backend] Reading: ${DATA_PATH || "(SHAREPOINT_EXPORT_PATH not set)"}`);
});

app.get("/api/t2-scrap", (_req, res) => {
  try {
    res.json(readMoldingScrap());
  } catch (err) {
    console.error("[backend] /api/t2-scrap failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/escalations", (_req, res) => {
  try {
    const rows = readEscalationsFile();
    res.json(computeEscalationsSummary(rows));
  } catch (err) {
    console.error("[backend] /api/escalations failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});
