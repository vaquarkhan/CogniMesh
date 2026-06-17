"use strict";

const crypto = require("crypto");
const fs = require("fs");

const PARQUET_MAGIC = Buffer.from("PAR1");
const FOOTER_DIGEST_BYTES = Number(process.env.VRP_PARQUET_FOOTER_BYTES || 4096);

function parquetFooterSha256(bytes) {
  const start = Math.max(0, bytes.length - FOOTER_DIGEST_BYTES);
  return crypto.createHash("sha256").update(bytes.subarray(start)).digest("hex");
}

function fullFileSha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

/** Prefer maintained fork; fall back to legacy parquetjs. Returns null when unavailable. */
function loadParquetLib() {
  if (process.env.VRP_FORCE_NDJSON === "true" || process.env.VRP_SINK_FORMAT === "ndjson") {
    return null;
  }
  for (const name of ["@dsnp/parquetjs", "parquetjs"]) {
    try {
      return require(name);
    } catch {
      /* try next */
    }
  }
  return null;
}

function inferParquetSchema(records) {
  const sample = records[0] || {};
  const fields = {};
  for (const [name, value] of Object.entries(sample)) {
    if (typeof value === "number") fields[name] = { type: "DOUBLE", optional: true };
    else if (typeof value === "boolean") fields[name] = { type: "BOOLEAN", optional: true };
    else fields[name] = { type: "UTF8", optional: true };
  }
  return fields;
}

function writeNdjsonRecords(localPath, records) {
  const payload = records.map((r) => JSON.stringify(r)).join("\n") + (records.length ? "\n" : "");
  const bytes = Buffer.from(payload, "utf8");
  fs.writeFileSync(localPath, bytes);
  const sha256 = fullFileSha256(bytes);
  return {
    bytes,
    sha256,
    footer_sha256: sha256,
    digest_type: "full_file",
    format: "ndjson",
  };
}

function readNdjsonRecords(localPath) {
  const bytes = fs.readFileSync(localPath);
  const text = bytes.toString("utf8");
  const rows = text.trim() ? text.trim().split("\n").map((line) => JSON.parse(line)) : [];
  const sha256 = fullFileSha256(bytes);
  return {
    rows,
    bytes,
    sha256,
    footer_sha256: sha256,
    digest_type: "full_file",
    format: "ndjson",
  };
}

function isParquetBytes(bytes) {
  return bytes.length >= 4 && bytes.subarray(bytes.length - 4).equals(PARQUET_MAGIC);
}

async function writeParquetRecords(localPath, records) {
  const parquet = loadParquetLib();
  if (!parquet) {
    const ndjsonPath = localPath.replace(/\.parquet$/i, ".ndjson");
    return writeNdjsonRecords(ndjsonPath, records);
  }

  if (!records.length) {
    fs.writeFileSync(localPath, Buffer.concat([PARQUET_MAGIC, PARQUET_MAGIC]));
    const bytes = fs.readFileSync(localPath);
    return {
      bytes,
      sha256: fullFileSha256(bytes),
      footer_sha256: parquetFooterSha256(bytes),
      digest_type: "parquet_footer",
      format: "parquet",
    };
  }

  try {
    const schema = new parquet.ParquetSchema(inferParquetSchema(records));
    const writer = await parquet.ParquetWriter.openFile(schema, localPath);
    for (const row of records) {
      await writer.appendRow(row);
    }
    await writer.close();

    const bytes = fs.readFileSync(localPath);
    if (!bytes.subarray(bytes.length - 4).equals(PARQUET_MAGIC)) {
      throw new Error("Parquet write failed: missing PAR1 footer magic");
    }
    return {
      bytes,
      sha256: fullFileSha256(bytes),
      footer_sha256: parquetFooterSha256(bytes),
      digest_type: "parquet_footer",
      format: "parquet",
    };
  } catch (err) {
    if (process.env.VRP_PARQUET_REQUIRED === "true") {
      throw new Error(`Parquet sink materialization failed: ${err.message}`);
    }
    const ndjsonPath = localPath.replace(/\.parquet$/i, ".ndjson");
    const fallback = writeNdjsonRecords(ndjsonPath, records);
    return { ...fallback, parquet_fallback_reason: err.message };
  }
}

async function readParquetRecords(localPath) {
  if (!fs.existsSync(localPath)) {
    const ndjsonPath = localPath.replace(/\.parquet$/i, ".ndjson");
    if (fs.existsSync(ndjsonPath)) {
      return readNdjsonRecords(ndjsonPath);
    }
    throw new Error(`sink read-back failed: missing ${localPath}`);
  }

  const bytes = fs.readFileSync(localPath);
  if (!bytes.length) {
    return {
      rows: [],
      bytes,
      sha256: fullFileSha256(bytes),
      footer_sha256: parquetFooterSha256(bytes),
      digest_type: "parquet_footer",
      format: "parquet",
    };
  }

  if (localPath.endsWith(".ndjson") || !isParquetBytes(bytes)) {
    return readNdjsonRecords(localPath.endsWith(".ndjson") ? localPath : localPath.replace(/\.parquet$/i, ".ndjson"));
  }

  const parquet = loadParquetLib();
  if (!parquet) {
    const ndjsonPath = localPath.replace(/\.parquet$/i, ".ndjson");
    if (fs.existsSync(ndjsonPath)) {
      return readNdjsonRecords(ndjsonPath);
    }
    throw new Error("Parquet read-back unavailable and no NDJSON fallback file found");
  }

  try {
    const reader = await parquet.ParquetReader.openFile(localPath);
    const cursor = reader.getCursor();
    const rows = [];
    let record;
    while ((record = await cursor.next())) {
      rows.push(record);
    }
    await reader.close();
    return {
      rows,
      bytes,
      sha256: fullFileSha256(bytes),
      footer_sha256: parquetFooterSha256(bytes),
      digest_type: "parquet_footer",
      format: "parquet",
    };
  } catch (err) {
    const ndjsonPath = localPath.replace(/\.parquet$/i, ".ndjson");
    if (fs.existsSync(ndjsonPath)) {
      return readNdjsonRecords(ndjsonPath);
    }
    throw new Error(`Parquet read-back failed: ${err.message}`);
  }
}

module.exports = {
  writeParquetRecords,
  readParquetRecords,
  writeNdjsonRecords,
  readNdjsonRecords,
  loadParquetLib,
  parquetFooterSha256,
  fullFileSha256,
  FOOTER_DIGEST_BYTES,
};
