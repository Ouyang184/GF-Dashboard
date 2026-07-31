const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const { randomUUID } = require("node:crypto");
const { execFile } = require("node:child_process");
const path = require("node:path");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const startupLogDirectory = path.join(
  process.env.LOCALAPPDATA || process.env.TEMP || __dirname,
  "Mastercard Agent",
  "logs",
);
const startupLogPath = path.join(startupLogDirectory, "startup.log");

function startupLog(message, error) {
  try {
    fsSync.mkdirSync(startupLogDirectory, { recursive: true });
    const details = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : error ? String(error) : "";
    fsSync.appendFileSync(startupLogPath, `${new Date().toISOString()} ${message}${details ? `\n${details}` : ""}\n`);
  } catch {
    // Logging must never prevent the caller (desktop window or web request) from proceeding.
  }
}

// Config is read from the environment with the original hardcoded values as
// defaults, so the Electron app (which sets none of these) behaves exactly
// as before, while the web server can override them via its own .env --
// each entry point is responsible for loading its own .env before
// requiring this module (see server/mastercard-agent-server.cjs).
const SEARCH_ROOTS = process.env.MASTERCARD_SEARCH_ROOTS
  ? JSON.parse(process.env.MASTERCARD_SEARCH_ROOTS)
  : [
      { name: "Molding Mastercards", path: "I:\\Department Files\\Molding\\Molding Mastercards" },
      {
        name: "Engineer NTQ",
        path: "I:\\Department Files\\Molding\\Process Engineering folder NTQs\\Engineer setups folder",
      },
    ];
const OLLAMA_HOST = process.env.MASTERCARD_OLLAMA_HOST || "http://127.0.0.1:11434";
const OLLAMA_URL = `${OLLAMA_HOST}/api/chat`;
const OLLAMA_GENERATE_URL = `${OLLAMA_HOST}/api/generate`;
const OLLAMA_MODEL = process.env.MASTERCARD_OLLAMA_MODEL || "qwen3.5:9b";
const ONFLOOR_DESTINATION = process.env.MASTERCARD_ONFLOOR_DESTINATION || "Teams · MasterCard_OnFloor.xlsx · Table2";
const OLLAMA_NUM_CTX = 8192;

const pendingLogActions = new Map();
const pendingPrintActions = new Map();
const PENDING_ACTION_TTL_MS = 10 * 60 * 1000;

// A confirmation prepared several minutes ago may reference files that have
// since moved, changed, or been logged/printed by someone else in the
// meantime -- honoring it unconditionally, however late it's confirmed,
// would act on stale information. registerPendingAction/takePendingAction
// enforce a 10-minute lifetime and keep both Maps from growing unbounded
// over a long-running session. These Maps are intentionally process-wide
// (not per chat session) -- a pending print/log action is a real-world
// action identified by an unguessable id, independent of who's asking.
function registerPendingAction(map, action) {
  action.createdAt = Date.now();
  map.set(action.id, action);
  for (const [key, value] of map) {
    if (Date.now() - value.createdAt > PENDING_ACTION_TTL_MS) map.delete(key);
  }
  return action;
}

function takePendingAction(map, actionId) {
  const action = map.get(String(actionId));
  if (!action) return null;
  if (Date.now() - action.createdAt > PENDING_ACTION_TTL_MS) {
    map.delete(action.id);
    return null;
  }
  return action;
}

const workbookKnowledgeCache = new Map();
const SUPPORTED_EXTENSIONS = new Set([".xlsx", ".xlsm", ".xls", ".pdf"]);

const SYSTEM_PROMPT = {
  role: "system",
  content:
    "You are Qwen AI, a concise assistant for AMG Molding Mastercards. " +
    "Understand natural language and use search_mastercards whenever the user wants to find, locate, or check a part number. " +
    "Never invent files, paths, machines, molds, or search results. Only state file facts returned by the tool. " +
    "For questions about material, setup values, cycle time, special instructions, reproducibility, notes, parameters, or any other " +
    "content inside a Mastercard, use read_mastercard_knowledge, and pass machine_number and/or mold_base_number whenever the user " +
    "named one, in this message or earlier in the conversation -- the same part number can exist as separate Mastercards on " +
    "different machines or molds with different values, so omitting them risks answering from the wrong one. Base the answer only " +
    "on its returned evidence and mention the source workbook and worksheet. If matchedRequestedContext is false, tell the user " +
    "their requested machine/mold was not found for that part and list availableCombinations instead of answering from a " +
    "different one. If the evidence does not contain the answer, say that clearly. " +
    "When the user asks for one or a few specific values (cycle time, a temperature, a pressure, etc.), lead with the direct " +
    "answer in short 'Label: value' lines -- for example 'Cycle time: 24.5 sec' -- not a narrative paragraph and not a table. " +
    "The interface renders file details in result cards, so do not repeat raw paths and do not use Markdown (no tables, no " +
    "headings, no bullet symbols) -- plain short lines only. " +
    "After a search, give one short plain-text summary with the match count and machines found. " +
    "When the user asks to log, add, record, or put Mastercard files in Mastercard OnFloor, MasterCard_OnFloor, " +
    "MastercardONfloor, or a similarly misspelled name, use request_onfloor_log. Never claim logging is complete before confirmation. " +
    "When the user asks to print a Mastercard, use request_print_mastercard. If the tool reports that a printer or machine is missing, " +
    "ask one short follow-up question using the choices returned by the tool. Never claim a file printed before confirmation. " +
    "When the user asks which printers are available or asks to list printers, use list_printers and present every returned printer on its own line. " +
    "If a request is ambiguous, ask one short clarifying question.",
};

// One independent conversation history per caller. The Electron app creates
// exactly one of these at startup (one desktop window == one user), but the
// web server serves multiple concurrent browser sessions from a single
// process -- sharing one history between them would leak one user's
// question/context into another user's answer. Each entry point owns its
// own session(s); this module never keeps global chat state.
function createChatSession() {
  return { conversation: [{ ...SYSTEM_PROMPT }] };
}

function normalize(value) {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function convertMarkdownTables(text) {
  // The system prompt asks the model not to use Markdown, but a local model
  // doesn't reliably follow that -- same lesson as machine/mold. When it
  // produces a table anyway, "| Field | Value |" rendered as literal text
  // is unreadable. Drop the "| :--- | :--- |" separator row entirely, and
  // turn each remaining row into a plain line -- "Field: Value" for the
  // common two-column case, "a  ·  b  ·  c" for wider tables.
  const lines = text.split("\n");
  const output = [];
  for (const line of lines) {
    const isSeparatorRow = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line) && line.includes("-");
    if (isSeparatorRow) continue;
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const cells = line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0);
      if (cells.length === 0) continue;
      output.push(cells.length === 2 ? `${cells[0]}: ${cells[1]}` : cells.join("  ·  "));
      continue;
    }
    output.push(line);
  }
  return output.join("\n");
}

function cleanAssistantContent(value) {
  return convertMarkdownTables(String(value ?? ""))
    .replace(/\*{1,3}/g, "")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/^\s*[•●]\s*/gm, "- ")
    .replace(/[ \t]+$/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// The model is only *told* (via the system prompt) to flag a requested
// machine/mold that wasn't found and to cite its source -- and, same as the
// machine/mold argument-passing bug, it doesn't always follow that
// reliably. This makes both outcomes structural instead of prompt-dependent:
// a not-found banner is force-prepended so a wrong-context answer can't
// slip through silently, and a one-line evidence trace is force-appended
// when the answer came from a single, specifically-matched Mastercard so
// it's always possible to see which file/machine/mold it came from without
// reopening Excel.
function buildFinalContent(rawContent, knowledge) {
  const cleaned = cleanAssistantContent(rawContent);

  if (!knowledge) return cleaned || "I’m ready.";

  if (!knowledge.matchedRequestedContext && knowledge.availableCombinations) {
    const requested = [
      knowledge.requestedMachineNumber ? `machine ${knowledge.requestedMachineNumber}` : null,
      knowledge.requestedMoldBaseNumber ? `mold ${knowledge.requestedMoldBaseNumber}` : null,
    ]
      .filter(Boolean)
      .join(" / ");
    const options = knowledge.availableCombinations.length > 0
      ? knowledge.availableCombinations.join(", ")
      : "none found for this part";
    const banner = `Not found: no Mastercard for ${knowledge.partNumber} matches ${requested}.\nAvailable for this part: ${options}`;
    return cleaned ? `${banner}\n\n${cleaned}` : banner;
  }

  if (knowledge.matchedRequestedContext && knowledge.sources?.length === 1) {
    const source = knowledge.sources[0];
    const trace = `Matched: machine ${source.machineNumber || "?"} / mold ${source.moldBaseNumber || "?"} — ${source.fileName}`;
    return cleaned ? `${cleaned}\n\n${trace}` : trace;
  }

  return cleaned || "I’m ready.";
}

async function findMastercards(partNumber) {
  const needle = normalize(partNumber);
  if (!needle) return [];

  const results = [];
  const pending = SEARCH_ROOTS.map((root) => ({ folder: root.path, sourceName: root.name }));

  while (pending.length > 0 && results.length < 25) {
    const { folder, sourceName } = pending.pop();
    let entries;
    try {
      entries = await fs.readdir(folder, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const filePath = path.join(folder, entry.name);
      if (entry.isDirectory()) {
        pending.push({ folder: filePath, sourceName });
        continue;
      }

      // "~$..." files are transient Office lock markers created while
      // someone has the real file open -- never valid Mastercards, and
      // they'd otherwise clutter search results and fail if ever opened.
      if (entry.name.startsWith("~$")) continue;

      const extension = path.extname(entry.name).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(extension) || !normalize(entry.name).includes(needle)) continue;

      const stats = await fs.stat(filePath).catch(() => null);
      const machineMatch =
        entry.name.match(/(?:^|[_\s-])MA[ _-]?(\d+)(?:[_\s.-]|$)/i) ??
        filePath.match(/IMM[ _-]?(\d+)/i);
      const moldMatch = entry.name.match(/(?:^|[_\s-])(?:MB|MOLD)[ _-]?([A-Z0-9]+)/i);
      results.push({
        id: filePath,
        partNumber,
        moldBaseNumber: moldMatch?.[1] ?? "—",
        machineNumber: machineMatch?.[1] ?? "—",
        material: "",
        processDate: "",
        sourceFolder: `${sourceName} · ${path.dirname(filePath)}`,
        fileType: extension.slice(1),
        filePath,
        matchType: "Exact",
        validationStatus: "unknown",
        printedStatus: false,
        loggedStatus: false,
        modifiedDate: stats?.mtime.toISOString() ?? new Date(0).toISOString(),
      });
    }
  }

  return results.sort((a, b) => b.modifiedDate.localeCompare(a.modifiedDate));
}

// Extracts machine/mold directly from the user's own words, independent of
// whatever the LLM does or doesn't pass as tool-call arguments. The system
// prompt asks the model to relay machine_number/mold_base_number to
// read_mastercard_knowledge, but a local model doesn't reliably do this --
// asking it nicer isn't enough. When the user's own text plainly names a
// machine/mold, that must always win over the model's tool-call arguments.
function extractContextFromText(text) {
  const machineMatch = text.match(/\b(?:machine|MA)\s*[-:#]?\s*(\d+)\b/i);
  const moldMatch =
    text.match(/\bmold(?:\s*base)?(?:\s*number)?\s*(?:of|is|#|:)?\s*(\d+[a-z]?)\b/i) ??
    text.match(/\bmb[-\s]?(\d+[a-z]?)\b/i);
  return {
    machineNumber: machineMatch?.[1] ?? "",
    moldBaseNumber: moldMatch?.[1] ?? "",
  };
}

const KNOWLEDGE_STOP_WORDS = new Set([
  "about", "and", "are", "can", "could", "does", "for", "from", "have", "how", "its",
  "mastercard", "me", "of", "part", "please", "tell", "that", "the", "this", "what",
  "where", "which", "with", "would", "you",
]);

function knowledgeTerms(question) {
  const terms = question
    .match(/[A-Za-z0-9]{3,}/g)
    ?.map((term) => term.toLowerCase())
    .filter((term) => !KNOWLEDGE_STOP_WORDS.has(term)) ?? [];
  const lower = question.toLowerCase();
  if (/material|resin|plastic|pvc|cpvc/.test(lower)) terms.push("material", "resin", "pvc", "cpvc");
  if (/special|instruction|note/.test(lower)) terms.push("special", "instruction", "note");
  if (/repro|repeat/.test(lower)) terms.push("repro", "reproducibility", "repeat");
  if (/temperature|temp/.test(lower)) terms.push("temperature", "temp", "melt", "barrel", "mold");
  if (/pressure/.test(lower)) terms.push("pressure", "hold", "pack", "transfer", "back");
  if (/cycle|time/.test(lower)) terms.push("cycle", "time");
  // Plant-floor vocabulary that doesn't literally appear on the sheet --
  // "tonnage" is always printed as "Clamping force", never "tonnage"; "rpm"
  // questions are about the "Screw speed" row. Confirmed against real
  // Mastercards, not guessed.
  if (/tonnage|clamp/.test(lower)) terms.push("clamp", "clamping", "tonnage", "force");
  if (/\brpm\b|screw\s*speed/.test(lower)) terms.push("screw", "speed", "rpm");
  if (/shot\s*weight|part\s*weight|fill\s*weight/.test(lower)) terms.push("shot", "weight", "fill", "part");
  if (/cooling/.test(lower)) terms.push("cooling", "cool");
  if (/nozzle/.test(lower)) terms.push("nozzle");
  if (/purge/.test(lower)) terms.push("purge");
  return [...new Set(terms)];
}

const WORKBOOK_CACHE_LIMIT = 40;

function cacheWorkbookCells(filePath, modifiedDate, cells) {
  workbookKnowledgeCache.set(filePath, { modifiedDate, cells });
  // Unbounded growth over a long-running session -- each entry can hold up
  // to 6000 cell objects (see read-mastercard.ps1's cap). A simple FIFO cap
  // is enough here; this doesn't need to be a true LRU.
  while (workbookKnowledgeCache.size > WORKBOOK_CACHE_LIMIT) {
    const oldestKey = workbookKnowledgeCache.keys().next().value;
    workbookKnowledgeCache.delete(oldestKey);
  }
}

async function extractWorkbookCells(filePath, modifiedDate) {
  const cached = workbookKnowledgeCache.get(filePath);
  if (cached?.modifiedDate === modifiedDate) return cached.cells;

  const payload = Buffer.from(filePath, "utf8").toString("base64");
  const scriptPath = path.join(__dirname, "read-mastercard.ps1");
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-FilePathBase64", payload],
    { windowsHide: true, timeout: 120000, maxBuffer: 8 * 1024 * 1024 },
  );
  const resultLine = stdout.trim().split(/\r?\n/).findLast((line) => line.trim().startsWith("{"));
  if (!resultLine) {
    throw new Error("The Mastercard reader script did not return a result.");
  }
  const result = JSON.parse(resultLine);
  if (!result.success) throw new Error(result.message || "Excel could not read the Mastercard.");
  const cells = Array.isArray(result.cells) ? result.cells : [];
  cacheWorkbookCells(filePath, modifiedDate, cells);
  return cells;
}

async function readMastercardKnowledge(partNumber, question, machineNumber = "", moldBaseNumber = "") {
  const allMatches = (await findMastercards(partNumber)).filter((match) =>
    [".xlsx", ".xlsm", ".xls"].includes(path.extname(match.filePath).toLowerCase()),
  );

  // The same part number commonly exists as separate Mastercards on several
  // machines/molds with different setup values (cycle time included) -- so
  // "read whatever the first 3 matches are" can silently answer from the
  // wrong one. When the user names a machine and/or mold (this message or
  // earlier in the conversation), narrow to that specific Mastercard
  // instead of guessing across several.
  const wantedMachine = normalize(machineNumber).replace(/^MA/, "");
  const wantedMold = normalize(moldBaseNumber).replace(/^MB/, "");
  let matches = allMatches;
  let matchedRequestedContext = false;

  if (wantedMachine || wantedMold) {
    const narrowed = allMatches.filter((match) => {
      const matchMachine = normalize(match.machineNumber).replace(/^MA/, "");
      const matchMold = normalize(match.moldBaseNumber).replace(/^MB/, "");
      return (!wantedMachine || matchMachine === wantedMachine) && (!wantedMold || matchMold === wantedMold);
    });
    if (narrowed.length > 0) {
      matches = narrowed;
      matchedRequestedContext = true;
    }
  }

  const terms = knowledgeTerms(question);
  const sources = [];

  for (const match of matches.slice(0, 3)) {
    const cells = await extractWorkbookCells(match.filePath, match.modifiedDate);
    const selectedIndexes = new Set();
    cells.forEach((cell, index) => {
      const searchable = `${cell.sheet} ${cell.cell} ${cell.value}`.toLowerCase();
      if (terms.some((term) => searchable.includes(term))) {
        for (let nearby = Math.max(0, index - 4); nearby <= Math.min(cells.length - 1, index + 6); nearby += 1) {
          if (cells[nearby].sheet === cell.sheet) selectedIndexes.add(nearby);
        }
      }
    });
    if (selectedIndexes.size === 0) {
      for (let index = 0; index < Math.min(cells.length, 80); index += 1) selectedIndexes.add(index);
    }
    const evidence = [...selectedIndexes]
      .sort((a, b) => a - b)
      .slice(0, 180)
      .map((index) => cells[index]);
    sources.push({
      fileName: path.basename(match.filePath),
      filePath: match.filePath,
      machineNumber: match.machineNumber,
      moldBaseNumber: match.moldBaseNumber,
      evidence,
    });
  }

  const requestedContextNotFound = (wantedMachine || wantedMold) && !matchedRequestedContext;
  return {
    partNumber,
    requestedMachineNumber: machineNumber || undefined,
    requestedMoldBaseNumber: moldBaseNumber || undefined,
    matchedRequestedContext,
    count: sources.length,
    // Only populated when the caller asked for a specific machine/mold that
    // wasn't found -- lets the model say what's actually available instead
    // of silently answering from a different machine/mold's Mastercard.
    availableCombinations: requestedContextNotFound
      ? [...new Set(allMatches.map((m) => `machine ${m.machineNumber || "unknown"} / mold ${m.moldBaseNumber || "unknown"}`))]
      : undefined,
    sources,
  };
}

async function getAvailablePrinters() {
  // Degrades to an empty list instead of throwing -- this is called from
  // fast-path chat branches that (unlike the Qwen tool-loop) aren't wrapped
  // in their own try/catch, so a PowerShell/PrintManagement hiccup here
  // must not surface as a raw unhandled exception. Callers already handle
  // an empty printer list with a clear "which printer?" style message.
  const command =
    "Get-Printer | Where-Object { $_.Name -notmatch 'OneNote|Print to PDF' } | Select-Object -ExpandProperty Name | ConvertTo-Json -Compress";
  try {
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", command], {
      windowsHide: true,
      timeout: 15000,
    });
    const parsed = stdout.trim() ? JSON.parse(stdout.trim()) : [];
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    startupLog("Could not list printers", error);
    return [];
  }
}

function resolvePrinter(requested, available) {
  const wanted = normalize(requested);
  if (!wanted) return null;
  const alias =
    wanted.includes("MANUFACTURING") || wanted.includes("MANF")
      ? "MANF"
      : wanted.includes("FOLLOWME")
        ? "FOLLOWME"
        : wanted.includes("PIC")
          ? "PIC"
          : wanted.includes("PLANTMANAGER")
            ? "PLANTMANAGER"
            : null;
  return (
    available.find((printer) => normalize(printer) === wanted) ??
    available.find((printer) => normalize(printer).includes(wanted) || wanted.includes(normalize(printer))) ??
    (alias ? available.find((printer) => normalize(printer).includes(alias)) : null) ??
    null
  );
}

const mastercardSearchTool = {
  type: "function",
  function: {
    name: "search_mastercards",
    description: "Search the real AMG Mastercard file library for a specific part number.",
    parameters: {
      type: "object",
      properties: {
        part_number: {
          type: "string",
          description: "The exact part number to search for, including any letters or hyphens.",
        },
      },
      required: ["part_number"],
    },
  },
};

const onFloorLogTool = {
  type: "function",
  function: {
    name: "request_onfloor_log",
    description:
      "Prepare matching Mastercard files for the Teams workbook MasterCard_OnFloor.xlsx. This requires user confirmation before writing.",
    parameters: {
      type: "object",
      properties: {
        part_number: {
          type: "string",
          description: "The part number whose matching Mastercard files should be logged.",
        },
      },
      required: ["part_number"],
    },
  },
};

const printMastercardTool = {
  type: "function",
  function: {
    name: "request_print_mastercard",
    description:
      "Prepare a Mastercard file for printing. A printer and an unambiguous file are required, and the user must confirm before printing.",
    parameters: {
      type: "object",
      properties: {
        part_number: { type: "string", description: "The Mastercard part number." },
        machine_number: {
          type: "string",
          description: "Optional machine number used to select one file when several files match.",
        },
        printer_name: {
          type: "string",
          description: "The requested Windows printer name or a recognizable alias such as manufacturing or follow-me.",
        },
      },
      required: ["part_number"],
    },
  },
};

const listPrintersTool = {
  type: "function",
  function: {
    name: "list_printers",
    description: "List all approved physical Windows printers currently installed for this user.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
};

const mastercardKnowledgeTool = {
  type: "function",
  function: {
    name: "read_mastercard_knowledge",
    description:
      "Read actual cells from matching Excel Mastercards to answer questions about materials, instructions, setup values, cycle time, notes, reproducibility, and other workbook content. Always pass machine_number and/or mold_base_number when the user named one (in this message or earlier in the conversation) -- the same part number can exist as separate Mastercards on different machines/molds with different values, so without this the tool may read the wrong one.",
    parameters: {
      type: "object",
      properties: {
        part_number: { type: "string", description: "The exact Mastercard part number." },
        machine_number: {
          type: "string",
          description: "The machine number to read the specific Mastercard for, if the user named or previously established one.",
        },
        mold_base_number: {
          type: "string",
          description: "The mold base number to read the specific Mastercard for, if the user named or previously established one.",
        },
        question: { type: "string", description: "The user's complete question about the Mastercard." },
      },
      required: ["part_number", "question"],
    },
  },
};

async function callQwen(messages, onToken = () => {}) {
  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      tools: [mastercardSearchTool, mastercardKnowledgeTool, onFloorLogTool, printMastercardTool, listPrintersTool],
      stream: true,
      think: false,
      keep_alive: -1,
      options: {
        // read_mastercard_knowledge can return up to 180 evidence cells per
        // source (and up to 3 sources when a question isn't narrowed to one
        // specific machine/mold) -- that alone can run several thousand
        // tokens, on top of the system prompt and conversation history.
        // 4096 risked silently truncating exactly the evidence a question
        // like "what's the cycle time" needs the model to see. 8192 matches
        // what the sibling Python implementation already uses successfully
        // for the same tool-calling workload.
        num_ctx: OLLAMA_NUM_CTX,
        // -1 = generate until the model naturally stops instead of getting
        // cut off mid-answer -- same reasoning as keep_alive: -1, the user
        // would rather wait than get a truncated response.
        num_predict: -1,
        temperature: 0.2,
      },
    }),
  });
  if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
  if (!response.body) throw new Error("Ollama returned no response body.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  const toolCalls = [];

  const consumeLine = (line) => {
    if (!line.trim()) return;
    const chunk = JSON.parse(line);
    if (chunk.error) throw new Error(chunk.error);
    if (chunk.message?.content) {
      content += chunk.message.content;
      onToken(cleanAssistantContent(content));
    }
    if (chunk.message?.tool_calls) toolCalls.push(...chunk.message.tool_calls);
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) consumeLine(line);
    if (done) break;
  }
  consumeLine(buffer);
  return { message: { role: "assistant", content: cleanAssistantContent(content), tool_calls: toolCalls } };
}

// `session` (from createChatSession()) owns the conversation history that
// gets mutated across calls -- callers must keep one session per
// independent user/window so concurrent conversations never mix.
async function handleAgentChat(session, userText, onToken = () => {}) {
  const rawText = String(userText).trim();
  if (/^(?:list|show|what|which).{0,30}printers?/i.test(rawText)) {
    const printers = await getAvailablePrinters();
    return {
      content: printers.length > 0 ? `Available printers:\n${printers.join("\n")}` : "No approved printers were found.",
      matches: [],
      model: "direct",
    };
  }

  const partMatch = rawText.match(/\b(?=[A-Za-z0-9-]*\d)[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*\b/);
  const isPrintRequest = /\bprint(?:ing)?\b/i.test(rawText);
  const isLogRequest = /\b(?:log|record|onfloor|on floor)\b/i.test(rawText);

  if (partMatch && isLogRequest) {
    const matches = await findMastercards(partMatch[0]);
    if (matches.length === 0) {
      return { content: `No Mastercard files were found for ${partMatch[0]}.`, matches: [], model: "direct" };
    }
    const logAction = registerPendingAction(pendingLogActions, {
      id: randomUUID(),
      destination: ONFLOOR_DESTINATION,
      records: matches,
    });
    return {
      content: `I found ${matches.length} file${matches.length === 1 ? "" : "s"} for ${partMatch[0]}. Review and confirm the OnFloor entries below.`,
      matches,
      model: "direct",
      logAction,
    };
  }

  if (partMatch && isPrintRequest) {
    let matches = await findMastercards(partMatch[0]);
    if (matches.length === 0) {
      return { content: `No Mastercard files were found for ${partMatch[0]}.`, matches: [], model: "direct" };
    }
    const machineMatch = rawText.match(/\b(?:machine|MA)\s*[-:#]?\s*(\d+)\b/i);
    const machineNumber = machineMatch?.[1] ?? "";
    if (machineNumber) {
      matches = matches.filter(
        (match) => normalize(match.machineNumber).replace(/^MA/, "") === normalize(machineNumber),
      );
    }
    const availablePrinters = await getAvailablePrinters();
    const printer = resolvePrinter(rawText, availablePrinters);
    if (!printer) {
      return {
        content: `Which printer should I use?\n${availablePrinters.join("\n")}`,
        matches,
        model: "direct",
      };
    }
    if (matches.length !== 1) {
      const machines = [...new Set(matches.map((match) => match.machineNumber))];
      return {
        content:
          matches.length === 0
            ? `No ${partMatch[0]} file was found for machine ${machineNumber}.`
            : `Which machine should I print? Available machines: ${machines.join(", ")}.`,
        matches,
        model: "direct",
      };
    }
    const printAction = registerPendingAction(pendingPrintActions, {
      id: randomUUID(),
      printer,
      records: matches,
    });
    return {
      content: `Review the file and printer below, then confirm printing.`,
      matches,
      model: "direct",
      printAction,
    };
  }

  const isActionRequest = isPrintRequest || isLogRequest;
  // A question that fails to match this never reaches read_mastercard_knowledge
  // at all -- it falls through to isSimpleLookup below and just gets an
  // existence/match-count answer instead of the actual question being
  // answered. tonnage/rpm/nozzle/hold/pack/transfer/purge/mold/melt/barrel
  // were missing here even though real Mastercards have all of these
  // fields, so questions using that vocabulary were silently unanswerable.
  const asksAboutWorkbookContent =
    /\b(?:material|resin|plastic|instruction|note|setup|setting|temperature|pressure|speed|time|cycle|weight|reproducibility|repro|cooling|heating|clamp|eject|cavity|shot|barrel|zone|tonnage|rpm|nozzle|hold|pack|transfer|purge|mold\s*temp|melt)\b/i.test(
      rawText,
    );
  const isSimpleLookup =
    partMatch &&
    !isActionRequest &&
    !asksAboutWorkbookContent &&
    (/^\s*[A-Za-z0-9-]+\s*$/.test(rawText) ||
      /^(?:find|locate|search|show|check|look\s*up)\b/i.test(rawText));
  if (isSimpleLookup) {
    const matches = await findMastercards(partMatch[0]);
    const machines = [...new Set(matches.map((match) => match.machineNumber))].filter(Boolean);
    return {
      content:
        matches.length > 0
          ? `Found ${matches.length} match${matches.length === 1 ? "" : "es"} for ${partMatch[0]} on machine${machines.length === 1 ? "" : "s"} ${machines.join(", ")}.`
          : `No Mastercard files were found for ${partMatch[0]}.`,
      matches,
      model: "direct",
    };
  }

  const conversation = session.conversation;
  const userMessage = { role: "user", content: rawText };
  conversation.push(userMessage);
  let matches = [];
  let logAction;
  let printAction;
  let lastKnowledge;

  try {
    for (let turn = 0; turn < 3; turn += 1) {
      const response = await callQwen(conversation, onToken);
      const assistantMessage = response.message;
      conversation.push(assistantMessage);
      const toolCalls = assistantMessage.tool_calls ?? [];

      if (toolCalls.length === 0) {
        if (conversation.length > 14) conversation.splice(1, conversation.length - 13);
        return {
          content: buildFinalContent(assistantMessage.content, lastKnowledge),
          matches,
          model: OLLAMA_MODEL,
          logAction,
          printAction,
        };
      }

      for (const toolCall of toolCalls) {
        const toolName = toolCall.function?.name;
        if (
          toolName !== "search_mastercards" &&
          toolName !== "read_mastercard_knowledge" &&
          toolName !== "request_onfloor_log" &&
          toolName !== "request_print_mastercard" &&
          toolName !== "list_printers"
        ) continue;

        if (toolName === "list_printers") {
          const availablePrinters = await getAvailablePrinters();
          conversation.push({
            role: "tool",
            tool_name: toolName,
            content: JSON.stringify({ printers: availablePrinters, count: availablePrinters.length }),
          });
          continue;
        }

        const partNumber = String(toolCall.function.arguments?.part_number ?? "").trim();
        if (!partNumber) continue;
        matches = await findMastercards(partNumber);

        if (toolName === "read_mastercard_knowledge") {
          const question = String(toolCall.function.arguments?.question ?? rawText).trim();
          const textContext = extractContextFromText(rawText);
          // The user's own words win over the model's tool-call arguments,
          // not the other way around -- see extractContextFromText's comment.
          const machineArg = textContext.machineNumber || String(toolCall.function.arguments?.machine_number ?? "").trim();
          const moldArg = textContext.moldBaseNumber || String(toolCall.function.arguments?.mold_base_number ?? "").trim();
          const knowledge = await readMastercardKnowledge(partNumber, question, machineArg, moldArg);
          lastKnowledge = knowledge;
          if (knowledge.matchedRequestedContext) {
            // Show only the specific Mastercard(s) the answer actually came
            // from, not every match for the bare part number -- otherwise a
            // precisely-scoped question ("part X, machine Y, mold Z") still
            // dumps a dozen unrelated result cards.
            const sourcePaths = new Set(knowledge.sources.map((source) => source.filePath));
            matches = matches.filter((match) => sourcePaths.has(match.filePath));
          }
          conversation.push({
            role: "tool",
            tool_name: toolName,
            content: JSON.stringify(knowledge),
          });
          continue;
        }

        if (toolName === "request_onfloor_log" && matches.length > 0) {
          logAction = registerPendingAction(pendingLogActions, {
            id: randomUUID(),
            destination: ONFLOOR_DESTINATION,
            records: matches,
          });
        }

        let printPreparation;
        if (toolName === "request_print_mastercard") {
          const machineNumber = normalize(String(toolCall.function.arguments?.machine_number ?? "")).replace(/^MA/, "");
          const requestedPrinter = String(toolCall.function.arguments?.printer_name ?? "").trim();
          const availablePrinters = await getAvailablePrinters();
          const printer = resolvePrinter(requestedPrinter, availablePrinters);
          const eligibleMatches = machineNumber
            ? matches.filter((match) => normalize(match.machineNumber).replace(/^MA/, "") === machineNumber)
            : matches;

          if (!requestedPrinter || !printer) {
            printPreparation = {
              ready: false,
              reason: requestedPrinter ? "Printer not found." : "Printer required.",
              availablePrinters,
            };
          } else if (eligibleMatches.length !== 1) {
            printPreparation = {
              ready: false,
              reason: eligibleMatches.length === 0 ? "No matching file for that machine." : "Machine required.",
              machines: [...new Set(matches.map((match) => match.machineNumber))],
              printer,
            };
          } else {
            printAction = registerPendingAction(pendingPrintActions, {
              id: randomUUID(),
              printer,
              records: eligibleMatches,
            });
            printPreparation = { ready: true, confirmationRequired: true, printer };
            matches = eligibleMatches;
          }
        }

        conversation.push({
          role: "tool",
          tool_name: toolName,
          content: JSON.stringify({
            partNumber,
            count: matches.length,
            confirmationRequired: toolName === "request_onfloor_log" && matches.length > 0,
            destination: toolName === "request_onfloor_log" ? ONFLOOR_DESTINATION : undefined,
            printPreparation,
            results: matches.slice(0, 10).map((match) => ({
              filePath: match.filePath,
              machineNumber: match.machineNumber,
              moldBaseNumber: match.moldBaseNumber,
              modifiedDate: match.modifiedDate,
            })),
          }),
        });
      }
    }
    return { content: "I couldn’t complete that request.", matches, model: OLLAMA_MODEL, logAction, printAction };
  } catch (error) {
    conversation.pop();
    throw new Error(`Qwen is unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function parseScriptResult(stdout) {
  const resultLine = stdout.trim().split(/\r?\n/).at(-1);
  if (!resultLine) {
    throw new Error("The script did not return a result.");
  }
  return JSON.parse(resultLine);
}

async function confirmOnFloorLog(actionId) {
  const action = takePendingAction(pendingLogActions, actionId);
  if (!action) throw new Error("This logging request expired. Ask Qwen to prepare it again.");

  const payload = Buffer.from(JSON.stringify(action.records), "utf8").toString("base64");
  const scriptPath = path.join(__dirname, "log-onfloor.ps1");
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-RecordsBase64", payload],
    { windowsHide: true, timeout: 120000, maxBuffer: 1024 * 1024 },
  );
  const result = parseScriptResult(stdout);
  if (result.success) pendingLogActions.delete(action.id);
  return result;
}

async function confirmPrint(actionId) {
  const action = takePendingAction(pendingPrintActions, actionId);
  if (!action) throw new Error("This print request expired. Ask Qwen to prepare it again.");

  const recordsPayload = Buffer.from(JSON.stringify(action.records), "utf8").toString("base64");
  const printerPayload = Buffer.from(action.printer, "utf8").toString("base64");
  const scriptPath = path.join(__dirname, "print-mastercard.ps1");
  const { stdout } = await execFileAsync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      "-RecordsBase64",
      recordsPayload,
      "-PrinterBase64",
      printerPayload,
    ],
    { windowsHide: true, timeout: 120000, maxBuffer: 1024 * 1024 },
  );
  const result = parseScriptResult(stdout);
  if (result.success) pendingPrintActions.delete(action.id);
  return result;
}

async function preparePrint(record) {
  // Lets a result card's Print button skip straight to the same confirmation
  // flow the chat "print this" path uses, without needing the user to type
  // anything -- still requires explicit confirmation before anything prints.
  const filePath = String(record?.filePath ?? "").trim();
  if (!filePath) throw new Error("No file was specified.");
  const availablePrinters = await getAvailablePrinters();
  if (availablePrinters.length === 0) {
    throw new Error("No approved printers were found. Check that a printer is installed.");
  }
  const printAction = registerPendingAction(pendingPrintActions, {
    id: randomUUID(),
    printer: availablePrinters[0],
    records: [record],
  });
  return { printAction, availablePrinters };
}

// Ollama unloads an idle model after ~10 minutes by default; keep_alive: -1
// on every real request already prevents that, but the first request after
// a cold Ollama start still pays the full model-load latency. Warming it at
// process startup (called by both the Electron app and the web server) means
// that cost is paid once, before anyone is waiting on it.
async function warmOllama() {
  const response = await fetch(OLLAMA_GENERATE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: "",
      stream: false,
      keep_alive: -1,
      // Must match callQwen's num_ctx -- Ollama reloads the model whenever
      // a request asks for a different context size, so a mismatch here
      // would make this warm-up pointless: the first real chat message
      // would trigger its own reload anyway.
      options: { num_ctx: OLLAMA_NUM_CTX },
    }),
  });
  if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
}

module.exports = {
  SEARCH_ROOTS,
  OLLAMA_MODEL,
  ONFLOOR_DESTINATION,
  startupLog,
  createChatSession,
  handleAgentChat,
  findMastercards,
  readMastercardKnowledge,
  getAvailablePrinters,
  resolvePrinter,
  registerPendingAction,
  takePendingAction,
  pendingLogActions,
  pendingPrintActions,
  parseScriptResult,
  preparePrint,
  confirmPrint,
  confirmOnFloorLog,
  warmOllama,
};
