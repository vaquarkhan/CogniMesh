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

async function writeParquetRecords(localPath, records) {
  if (!records.length) {
    fs.writeFileSync(localPath, Buffer.concat([PARQUET_MAGIC, PARQUET_MAGIC]));
    const bytes = fs.readFileSync(localPath);
    return { bytes, sha256: fullFileSha256(bytes), footer_sha256: parquetFooterSha256(bytes) };
  }

  let parquet;
  try {
    parquet = require("parquetjs");
  } catch {
    throw new Error("parquetjs required for Parquet sink materialization (npm install parquetjs)");
  }

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
  };
}

async function readParquetRecords(localPath) {
  const bytes = fs.readFileSync(localPath);
  if (!bytes.length) return { rows: [], bytes, sha256: fullFileSha256(bytes), footer_sha256: parquetFooterSha256(bytes) };

  let parquet;
  try {
    parquet = require("parquetjs");
  } catch {
    throw new Error("parquetjs required for Parquet sink read-back");
  }

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
  };
}

module.exports = {
  writeParquetRecords,
  readParquetRecords,
  parquetFooterSha256,
  fullFileSha256,
  FOOTER_DIGEST_BYTES,
};
