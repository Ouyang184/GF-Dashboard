/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const PORT = Number(process.env.PORT) || 3001;
const DATA_PATH = process.env.SHAREPOINT_EXPORT_PATH;

if (!DATA_PATH) {
  console.warn(
    "[backend] SHAREPOINT_EXPORT_PATH is not set. Copy backend/.env.example to backend/.env and set the path to the OneDrive JSON file."
  );
}

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || true, credentials: false }));
app.use(express.json());

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
  // 7:00 AM local -> next day 7:00 AM local
  const start = new Date(now);
  start.setHours(7, 0, 0, 0);
  if (now.getTime() < start.getTime()) {
    start.setDate(start.getDate() - 1);
  }
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function fmtTime(d) {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

function computeSummary(rows) {
  const now = new Date();
  const { start, end } = getProductionWindow(now);

  // Filter to the current 7 AM -> 7 AM production window.
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

  let matching = 0;      // MasterCard === "Yes"
  let comparable = 0;    // MasterCard === "Comparable"
  let missing = 0;       // "No", blank, null, missing

  for (const r of uniqueJobs) {
    const mc = (r.masterCard || "").toLowerCase();
    if (mc === "yes") matching++;
    else if (mc.startsWith("compar")) comparable++;
    else missing++;
  }

  const machinesRunning = uniqueJobs.length;
  const mcAvailableCount = matching; // MC Available = MasterCard "Yes"
  const complianceCount = matching + comparable; // Compliant if MC exists
  const pct = (n) =>
    machinesRunning === 0 ? 0 : Math.round((n / machinesRunning) * 100);

  const latestRows = [...uniqueJobs]
    .sort((a, b) => (b._ts - a._ts) || (b.id - a.id))
    .slice(0, 25)
    .map(({ _ts, dateCreatedRaw, ...rest }) => rest);

  const latestDate = uniqueJobs.length
    ? uniqueJobs.reduce((max, r) => (r.dateCreated > max ? r.dateCreated : max), uniqueJobs[0].dateCreated)
    : "";

  return {
    updatedAt: new Date().toLocaleString(),
    productionDate: fmtDate(start),
    productionWindowStart: fmtTime(start),
    productionWindowEnd: fmtTime(end),
    latestDate,

    // Row counts
    totalRows: inWindow.length, // raw rows in the window (before dedupe)
    machinesRunning,             // unique Machine + PartNumber pairs

    // MC Available (exact match)
    mcAvailableCount,
    mcAvailablePercent: pct(mcAvailableCount),

    // Breakdown
    matching,
    comparable,
    missing,

    // Compliance (Yes OR Comparable)
    complianceCount,
    compliancePercent: pct(complianceCount),

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

    latestRows,
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