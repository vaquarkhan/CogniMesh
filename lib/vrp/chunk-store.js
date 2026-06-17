"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function stagingRoot() {
  return process.env.PVDM_STAGING_DIR || path.join(process.cwd(), ".pvdm-staging");
}

/**
 * Persist chunk rows as durable bytes (NDJSON stand-in for Parquet in local/dev).
 * Returns paths and content hash for independent read-back verification.
 */
function writeChunkRecords(chunkId, records, stagingUri, options = {}) {
  const root = path.join(stagingRoot(), options.isolationId || "default");
  fs.mkdirSync(root, { recursive: true });
  const fileName = `chunk-${String(chunkId).padStart(6, "0")}.ndjson`;
  const localPath = path.join(root, fileName);
  const payload = records.map((r) => JSON.stringify(r)).join("\n") + (records.length ? "\n" : "");
  const bytes = Buffer.from(payload, "utf8");
  fs.writeFileSync(localPath, bytes);
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const parquetUri = `${stagingUri}/${fileName.replace(".ndjson", ".parquet")}`;
  return { localPath, bytes, sha256, parquetUri, fileName };
}

/** Read committed chunk bytes back from storage — sink side is independently materialized. */
function readChunkRecords(localPath) {
  if (!fs.existsSync(localPath)) {
    throw new Error(`sink read-back failed: missing ${localPath}`);
  }
  const bytes = fs.readFileSync(localPath);
  const text = bytes.toString("utf8");
  const rows = text.trim() ? text.trim().split("\n").map((line) => JSON.parse(line)) : [];
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  return { rows, bytes, sha256 };
}

module.exports = { writeChunkRecords, readChunkRecords, stagingRoot };
