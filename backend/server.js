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

function computeSummary(rows) {
  const totalRows = rows.length;
  let mastercardYes = 0;
  let mastercardComparable = 0;
  let mastercardNo = 0;
  let complianceYes = 0;
  let complianceNo = 0;

  for (const r of rows) {
    const mc = (r.masterCard || "").toLowerCase();
    if (mc === "yes") mastercardYes++;
    else if (mc.startsWith("compar")) mastercardComparable++;
    else mastercardNo++; // blank/null counts as No/missing

    const acc = (r.overallAcceptance || "").toLowerCase();
    if (acc === "yes") complianceYes++;
    else complianceNo++;
  }

  const availabilityCount = mastercardYes + mastercardComparable;
  const complianceCount = complianceYes;
  const pct = (n) => (totalRows === 0 ? 0 : Math.round((n / totalRows) * 100));

  const latestRows = [...rows]
    .sort((a, b) => {
      if (a.dateCreated === b.dateCreated) return b.id - a.id;
      return a.dateCreated < b.dateCreated ? 1 : -1;
    })
    .slice(0, 25);

  const latestDate = rows.length
    ? rows.reduce((max, r) => (r.dateCreated > max ? r.dateCreated : max), rows[0].dateCreated)
    : "";

  return {
    updatedAt: new Date().toLocaleString(),
    latestDate,
    totalRows,
    availabilityCount,
    availabilityPercent: pct(availabilityCount),
    mastercardYes,
    mastercardComparable,
    mastercardNo,
    complianceCount,
    compliancePercent: pct(complianceCount),
    complianceYes,
    complianceNo,
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