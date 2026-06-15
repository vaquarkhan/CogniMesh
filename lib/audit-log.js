"use strict";

const fs = require("fs");
const path = require("path");

const enabled = () => process.env.AUDIT_LOG_ENABLED !== "false";
const logPath = () =>
  process.env.AUDIT_LOG_PATH || path.join(process.cwd(), "logs", "audit.jsonl");

const memory = [];

function ensureLogDir() {
  const dir = path.dirname(logPath());
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function record(event) {
  if (!enabled()) return null;

  const entry = {
    ts: new Date().toISOString(),
    ...event,
  };

  memory.push(entry);
  if (memory.length > 500) memory.shift();

  try {
    ensureLogDir();
    fs.appendFileSync(logPath(), `${JSON.stringify(entry)}\n`, "utf8");
  } catch {
    // non-fatal in dev
  }

  return entry;
}

function listRecent(limit = 50) {
  return memory.slice(-limit);
}

module.exports = { record, listRecent, enabled };
