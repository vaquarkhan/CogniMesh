"use strict";

const fs = require("fs");
const path = require("path");
const { writeParquetRecords, readParquetRecords } = require("./parquet-chunk");

function stagingRoot() {
  return process.env.PVDM_STAGING_DIR || path.join(process.cwd(), ".pvdm-staging");
}

/**
 * Persist chunk rows as Parquet, optionally upload to S3 lakehouse path.
 */
async function writeChunkRecords(chunkId, records, stagingUri, options = {}) {
  const root = path.join(stagingRoot(), options.isolationId || "default");
  fs.mkdirSync(root, { recursive: true });
  const fileName = `chunk-${String(chunkId).padStart(6, "0")}.parquet`;
  const localPath = path.join(root, fileName);
  const parquetUri = `${stagingUri}/${fileName}`;

  const written = await writeParquetRecords(localPath, records);

  if (process.env.VRP_UPLOAD_PARQUET === "true" && parquetUri.startsWith("s3://")) {
    const { putBinaryObject } = require("../aws/s3-proof-io");
    await putBinaryObject(parquetUri, written.bytes, { contentType: "application/vnd.apache.parquet" });
  }

  return {
    localPath,
    bytes: written.bytes,
    sha256: written.footer_sha256,
    full_sha256: written.sha256,
    footer_sha256: written.footer_sha256,
    digest_type: written.digest_type || "parquet_footer",
    parquetUri,
    fileName,
  };
}

/** Read committed Parquet back from storage — sink side is independently materialized. */
async function readChunkRecords(localPath) {
  const read = await readParquetRecords(localPath);
  return {
    rows: read.rows,
    bytes: read.bytes,
    sha256: read.footer_sha256,
    full_sha256: read.sha256,
    footer_sha256: read.footer_sha256,
    digest_type: read.digest_type || "parquet_footer",
  };
}

module.exports = { writeChunkRecords, readChunkRecords, stagingRoot };
