const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = express();
app.use(cors());

const PORT = 3001;
const LOGIC_VERSION = "server_2026_07_14_compliance_overall_acceptance_missing_rows_fiscal_ytd";

const DATA_PATHS = [
  process.env.SHAREPOINT_EXPORT_PATH,
  process.env.SECOND_SHAREPOINT_EXPORT_PATH,
].filter(Boolean);

// ======================= helpers =======================

function readJsonArray(filePath) {
  if (!filePath) return [];

  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    return [];
  }

  const raw = fs.readFileSync(filePath, "utf8");
  if (!raw.trim()) return [];

  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function cleanText(value) {
  if (value === null || value === undefined) return "";

  // SharePoint choice/lookup/person objects like { Value: "Yes" }
  if (typeof value === "object") {
    if (value.Value !== undefined) return cleanText(value.Value);
    if (value.Title !== undefined) return cleanText(value.Title);
    if (value.DisplayName !== undefined) return cleanText(value.DisplayName);
    if (value.Email !== undefined) return cleanText(value.Email);
    return "";
  }

  return String(value).trim();
}

function parseDate(value) {
  if (value === null || value === undefined || value === "") return null;

  // Excel serial date
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(Math.round((value - 25569) * 86400 * 1000));
  }

  const text = String(value).trim();
  if (!text) return null;

  // yyyy-mm-dd only: local date, not UTC
  const dateOnlyMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const y = Number(dateOnlyMatch[1]);
    const m = Number(dateOnlyMatch[2]) - 1;
    const d = Number(dateOnlyMatch[3]);
    return new Date(y, m, d, 0, 0, 0);
  }

  const d = new Date(text);
  if (isNaN(d)) return null;
  return d;
}

function formatDateOnly(d) {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateTime(d) {
  if (!d) return "";
  return d.toLocaleString("en-US");
}

function pct(count, total) {
  return total ? Math.round((count / total) * 100) : 0;
}

function isMissingMC(mc) {
  const v = String(mc || "").trim().toLowerCase();
  return (
    v === "" ||
    v === "no" ||
    v === "n" ||
    v === "missing" ||
    v === "null" ||
    v === "undefined"
  );
}

function isAvailableMC(mc) {
  const v = String(mc || "").trim().toLowerCase();
  return v === "yes" || v === "comparable";
}

function isMatchingMC(mc) {
  return String(mc || "").trim().toLowerCase() === "yes";
}

function isComparableMC(mc) {
  return String(mc || "").trim().toLowerCase() === "comparable";
}

function isOverallAccepted(value) {
  const v = String(value || "").trim().toLowerCase();

  // Your SharePoint list may export Overall Acceptance as Yes/No,
  // Accepted/Rejected, or Overall Accepted.
  return (
    v === "yes" ||
    v === "y" ||
    v === "true" ||
    v === "accepted" ||
    v === "overall accepted" ||
    v === "overall acceptance" ||
    v === "pass" ||
    v === "passed"
  );
}

function normalizeMachineLabel(machine) {
  return String(machine || "")
    .toUpperCase()
    .replace(/IMM?/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function stripPrivateFields(row) {
  if (!row) return row;
  const { _createdDateObj, ...rest } = row;
  return rest;
}

// ======================= production window =======================

// Monday shows the previous calendar week. Other days show the latest
// completed 7:00 AM -> 7:00 AM production day.
function getCompletedProductionWindow(now = new Date()) {
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

  return {
    start,
    end,
    productionDate: isMonday
      ? `${formatDateOnly(start)} - ${formatDateOnly(new Date(end.getTime() - 1))}`
      : formatDateOnly(start),
    reportingPeriod: isMonday ? "week" : "production-day",
  };
}

// ======================= Teams Excel / T2 Scrap =======================

function readTeamsExcelRows(sheetName = "Molding") {
  const filePath = process.env.TEAMS_EXCEL_PATH;

  if (!filePath) {
    throw new Error("TEAMS_EXCEL_PATH is missing in backend/.env");
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`TEAMS_EXCEL_PATH file not found: ${filePath}`);
  }

  const wb = XLSX.readFile(filePath);
  const finalSheetName = wb.SheetNames.includes(sheetName)
    ? sheetName
    : wb.SheetNames[0];

  const ws = wb.Sheets[finalSheetName];

  const rows = XLSX.utils.sheet_to_json(ws, {
    defval: "",
    raw: false,
  });

  const numberAt = (address) => {
    const value = ws[address]?.v ?? ws[address]?.w ?? 0;
    return Number(String(value).replace(/[^0-9.-]/g, "")) || 0;
  };
  const rateAt = (address) => {
    const cell = ws[address];
    if (!cell) return 0;
    if (typeof cell.v === "number") return cell.v > 1 ? cell.v / 100 : cell.v;
    return numberAt(address) / 100;
  };
  const textAt = (address) => String(ws[address]?.w ?? ws[address]?.v ?? "").trim();
  const molding = finalSheetName === "Molding" ? {
    cellTotal: { yield: numberAt("C3"), scrap: numberAt("D3"), scrapRate: rateAt("E3") },
    weeklyScrap: [4, 5, 6, 7, 8].map((row) => ({
      cell: textAt(`N${row}`), yield: numberAt(`O${row}`), scrap: numberAt(`P${row}`), scrapRate: rateAt(`Q${row}`),
    })).filter((item) => item.cell),
    topProducts: [7, 8, 9, 10, 11].map((row) => ({
      product: textAt(`B${row}`), yield: numberAt(`C${row}`), scrap: numberAt(`D${row}`), scrapRate: rateAt(`E${row}`),
    })).filter((item) => item.product),
    topProductsTotal: { yield: numberAt("C12"), scrap: numberAt("D12"), scrapRate: rateAt("E12") },
    topReasons: [7, 8, 9, 10, 11].map((row) => ({
      reason: textAt(`H${row}`), scrap: numberAt(`I${row}`), pctOfTotal: rateAt(`J${row}`),
    })).filter((item) => item.reason),
    topReasonsTotal: { scrap: numberAt("I12"), totalScrap: numberAt("J12") },
  } : null;

  return {
    filePath,
    sheetName: finalSheetName,
    rowCount: rows.length,
    rows,
    molding,
  };
}

// ======================= main production rows =======================

function readRows() {
  const filePath = process.env.SHAREPOINT_EXPORT_PATH;

  if (!filePath) {
    throw new Error("SHAREPOINT_EXPORT_PATH is missing in backend/.env");
  }

  const rows = readJsonArray(filePath);

  return rows.map((r) => {
    const createdRaw =
      r.CreatedDateTime ||
      r.Created ||
      r.DateCreated ||
      r["Date Created"];

    const createdDate = parseDate(createdRaw);

    return {
      id: r.ID || r.Id || r.id,
      runId: cleanText(r.RunID || r["Run ID"]),
      dateCreated: cleanText(r.DateCreated || r["Date Created"]),
      createdDateTime: createdDate ? createdDate.toISOString() : "",

      workOrder: cleanText(r.WorkOrder || r["Work Order #"]),
      machine: cleanText(r.Machine || r["Machine #"]),
      partNumber: cleanText(r.PartNumber || r["Part #"]),
      partDescription: cleanText(r.PartDescription || r["Part Description"]),
      restartMoldChange: cleanText(
        r.RestartMoldChange || r["Restart/Mold Change"]
      ),
      productionTech: cleanText(
        r.ProductionTech || r["Production Tech"] || r.MoldingTech
      ),
      overallAcceptance: cleanText(
        r.OverallAcceptance ||
          r["Overall Acceptance"] ||
          r["OverallAcceptance"]
      ),
      masterCard: cleanText(r.MasterCard || r.Mastercard || r["MasterCard"]),

      source: cleanText(r.Source),

      _createdDateObj: createdDate,
    };
  });
}

// ======================= Mastercard production rows =======================

// Keep the old fiscal-year behavior so YTD does not drop from the previous
// dashboard number. Prefer ProcDate when present, but fall back to Created.
function readMastercardProductionRows() {
  const filePath = process.env.SECOND_SHAREPOINT_EXPORT_PATH;

  if (!filePath) {
    return [];
  }

  const rows = readJsonArray(filePath);

  return rows
    .map((r) => {
      const dateRaw =
        r.ProcDate ||
        r["Proc Date"] ||
        r.Proc_Date ||
        r["Proc_Date"] ||
        r.CreatedDateTime ||
        r.Created ||
        r["Created"] ||
        r.DateCreated ||
        r["Date Created"];

      const dateObj = parseDate(dateRaw);

      return {
        id: r.ID || r.Id || r.id,
        createdDate: dateObj,
        partNumber: cleanText(
          r.PartNumber ||
            r["Part Number"] ||
            r.Part_No ||
            r["Part No"] ||
            r["Part_No"]
        ),
        moldBaseNumber: cleanText(
          r.MoldBaseNumber ||
            r["MoldBase Number"] ||
            r.Mold_Base_Number ||
            r["Mold Base Number"] ||
            r["Mold_Base_Number"]
        ),
        rawDate: cleanText(dateRaw),
      };
    })
    .filter((r) => r.createdDate);
}

function buildMastercardMonthlyProduction() {
  const rows = readMastercardProductionRows();

  const now = new Date();

  // Fiscal year Nov -> Oct, matching your chart labels.
  const fiscalStartMonth = 10; // November, 0-indexed
  const fiscalStartYear =
    now.getMonth() >= fiscalStartMonth
      ? now.getFullYear()
      : now.getFullYear() - 1;

  const fiscalStart = new Date(fiscalStartYear, fiscalStartMonth, 1);
  const fiscalEnd = new Date(fiscalStartYear + 1, fiscalStartMonth, 1);

  const months = [];

  for (let i = 0; i < 12; i++) {
    const monthStart = new Date(fiscalStart);
    monthStart.setMonth(fiscalStart.getMonth() + i);

    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthStart.getMonth() + 1);

    const count = rows.filter(
      (r) => r.createdDate >= monthStart && r.createdDate < monthEnd
    ).length;

    months.push({
      month: monthStart.toLocaleString("en-US", { month: "short" }),
      year: monthStart.getFullYear(),
      count,
    });
  }

  const ytdProduced = rows.filter(
    (r) => r.createdDate >= fiscalStart && r.createdDate < fiscalEnd
  ).length;

  return {
    ytdProduced,
    monthlyMastercards: months,

    fiscalStart: formatDateOnly(fiscalStart),
    fiscalEnd: formatDateOnly(new Date(fiscalEnd.getTime() - 1)),

    rawMastercardRowsWithValidDate: rows.length,
    debugLatestMastercardDates: rows
      .slice()
      .sort((a, b) => b.createdDate - a.createdDate)
      .slice(0, 5)
      .map((r) => ({
        id: r.id,
        date: formatDateOnly(r.createdDate),
        partNumber: r.partNumber,
        moldBaseNumber: r.moldBaseNumber,
      })),
  };
}

// ======================= dashboard =======================

function buildDashboardData() {
  const allRows = readRows().filter((r) => r._createdDateObj);

  const { start, end, productionDate, reportingPeriod } = getCompletedProductionWindow(new Date());
  const mastercardProduction = buildMastercardMonthlyProduction();

  const rowsInWindow = allRows.filter((r) => {
    const d = r._createdDateObj;
    return d >= start && d < end;
  });

  // Unique Machine + PartNumber = one running machine/job.
  // If duplicate records exist in the window, keep the latest one.
  const latestByMachinePart = new Map();

  rowsInWindow
    .slice()
    .sort((a, b) => a._createdDateObj - b._createdDateObj)
    .forEach((r) => {
      const machine = String(r.machine || "").trim();
      const part = String(r.partNumber || "").trim();

      if (!machine || !part) return;

      const key = `${machine}|${part}`;
      latestByMachinePart.set(key, r);
    });

  const jobRows = Array.from(latestByMachinePart.values());

  const machineMap = new Map();

  jobRows.forEach((r) => {
    const machineLabel = normalizeMachineLabel(r.machine);

    if (!machineLabel) return;

    if (!machineMap.has(machineLabel)) {
      machineMap.set(machineLabel, []);
    }

    machineMap.get(machineLabel).push(r);
  });

  const floorMap = Array.from(machineMap.entries()).map(([machine, jobs]) => {
    const hasMissing = jobs.some((r) => isMissingMC(r.masterCard));
    const hasComparable = jobs.some((r) => isComparableMC(r.masterCard));
    const allMatching = jobs.every((r) => isMatchingMC(r.masterCard));

    let status = "Matching";
    let color = "green";

    if (hasMissing) {
      status = "Missing MC";
      color = "red";
    } else if (hasComparable) {
      status = "Comparable";
      color = "yellow";
    } else if (allMatching) {
      status = "Matching";
      color = "green";
    }

    return {
      machine,
      jobCount: jobs.length,
      status,
      color,
      jobs: jobs.map(stripPrivateFields),
    };
  });

  // These counts are per JOB: unique Machine + Part.
  const machinesRunning = jobRows.length;

  const matchingRows = jobRows.filter((r) => isMatchingMC(r.masterCard));
  const comparableRows = jobRows.filter((r) => isComparableMC(r.masterCard));
  const missingRows = jobRows.filter((r) => isMissingMC(r.masterCard));
  const mcAvailableRows = jobRows.filter((r) => isAvailableMC(r.masterCard));

  const matchingCount = matchingRows.length;
  const comparableCount = comparableRows.length;
  const missingCount = missingRows.length;
  const mcAvailableCount = mcAvailableRows.length;

  // Compliance is Overall Acceptance among available MC rows.
  const compliantRows = mcAvailableRows.filter((r) =>
    isOverallAccepted(r.overallAcceptance)
  );
  const complianceCount = compliantRows.length;

  const latestRows = [...jobRows]
   .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
   .map(stripPrivateFields);

  const latestRecordDate = allRows.length
    ? allRows
        .slice()
        .sort((a, b) => b._createdDateObj - a._createdDateObj)[0]
        ._createdDateObj
    : null;

  return {
    logicVersion: LOGIC_VERSION,
    updatedAt: new Date().toLocaleString("en-US"),

    productionWindowStart: formatDateTime(start),
    productionWindowEnd: formatDateTime(end),
    productionDate,
    reportingPeriod,

    latestRecord: latestRecordDate ? formatDateTime(latestRecordDate) : "",
    latestDate: latestRecordDate ? formatDateOnly(latestRecordDate) : "",

    rawRowsInWindow: rowsInWindow.length,

    machinesRunning,
    totalRows: machinesRunning,
    uniqueMachines: machineMap.size,

    floorMap,

    // MC Available = Yes + Comparable / total jobs
    availabilityCount: mcAvailableCount,
    availabilityPercent: pct(mcAvailableCount, machinesRunning),

    mcAvailableCount,
    mcAvailablePercent: pct(mcAvailableCount, machinesRunning),

    matchingCount,
    matchingPercent: pct(matchingCount, machinesRunning),

    comparableCount,
    comparablePercent: pct(comparableCount, machinesRunning),

    missingCount,
    missingPercent: pct(missingCount, machinesRunning),

    // Compliance = Overall Accepted / MC Available
    complianceCount,
    complianceDenominator: mcAvailableCount,
    compliancePercent: pct(complianceCount, mcAvailableCount),
    complianceSubtitle: `${complianceCount} of ${mcAvailableCount} available MC · Overall Accepted`,

    ytdProduced: mastercardProduction.ytdProduced,
    monthlyMastercards: mastercardProduction.monthlyMastercards,

    fiscalStart: mastercardProduction.fiscalStart,
    fiscalEnd: mastercardProduction.fiscalEnd,
    rawMastercardRowsWithValidDate:
      mastercardProduction.rawMastercardRowsWithValidDate,
    debugLatestMastercardDates:
      mastercardProduction.debugLatestMastercardDates,

    // These arrays make the frontend table match the card count exactly.
    // Missing table should use data.missingRows, not latestRows or floorMap.
    missingRows: missingRows.map(stripPrivateFields),
    mcAvailableRows: mcAvailableRows.map(stripPrivateFields),
    compliantRows: compliantRows.map(stripPrivateFields),

    latestRows,
  };
}

// ======================= routes =======================

app.get("/api/dashboard", (req, res) => {
  try {
    res.json(buildDashboardData());
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({
      error: "Could not build dashboard data",
      details: err.message,
      paths: DATA_PATHS,
    });
  }
});

app.get("/api/rows", (req, res) => {
  try {
    const rows = readRows().map(stripPrivateFields);
    res.json(rows);
  } catch (err) {
    console.error("Rows error:", err);
    res.status(500).json({
      error: "Could not read rows",
      details: err.message,
      path: process.env.SHAREPOINT_EXPORT_PATH,
    });
  }
});

app.get("/api/mastercard-production", (req, res) => {
  try {
    res.json(buildMastercardMonthlyProduction());
  } catch (err) {
    console.error("Mastercard production error:", err);
    res.status(500).json({
      error: "Could not read Mastercard production data",
      details: err.message,
      path: process.env.SECOND_SHAREPOINT_EXPORT_PATH,
    });
  }
});

app.get("/api/t2-scrap", (req, res) => {
  try {
    const sheetName = req.query.sheet || "Molding";
    const data = readTeamsExcelRows(sheetName);
    res.json(data);
  } catch (err) {
    console.error("Failed to read Teams Excel:", err);
    res.status(500).json({
      error: "Failed to read Teams Excel",
      details: err.message,
      path: process.env.TEAMS_EXCEL_PATH,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
  console.log(`Logic version: ${LOGIC_VERSION}`);
  console.log("SHAREPOINT_EXPORT_PATH:", process.env.SHAREPOINT_EXPORT_PATH);
  console.log(
    "SECOND_SHAREPOINT_EXPORT_PATH:",
    process.env.SECOND_SHAREPOINT_EXPORT_PATH
  );
  console.log("TEAMS_EXCEL_PATH:", process.env.TEAMS_EXCEL_PATH || "(not set)");
});
