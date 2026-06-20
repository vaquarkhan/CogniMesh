"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { writeParquetRecords, readParquetRecords } = require("./parquet-chunk");

function stagingRoot() {
  // Default to the OS temp dir (writable everywhere — /tmp on Lambda; process.cwd() is the
  // read-only /var/task on Lambda which caused ENOENT/rolled_back runtime failures).
  return process.env.PVDM_STAGING_DIR || path.join(os.tmpdir(), "cognimesh-pvdm-staging");
}

/**
 * Persist chunk rows as Parquet, optionally upload to S3 lakehouse path.
 */
async function writeChunkRecords(chunkId, records, stagingUri, options = {}) {
  const root = path.join(stagingRoot(), options.isolationId || "default");
  fs.mkdirSync(root, { recursive: true });
  const parquetFileName = `chunk-${String(chunkId).padStart(6, "0")}.parquet`;
  const parquetLocalPath = path.join(root, parquetFileName);
  const parquetUri = `${stagingUri}/${parquetFileName}`;

  const written = await writeParquetRecords(parquetLocalPath, records);
  const localPath =
    written.format === "ndjson"
      ? parquetLocalPath.replace(/\.parquet$/i, ".ndjson")
      : parquetLocalPath;
  const artifactUri =
    written.format === "ndjson"
      ? `${stagingUri}/${path.basename(localPath)}`
      : parquetUri;

  if (
    written.format === "parquet" &&
    process.env.VRP_UPLOAD_PARQUET === "true" &&
    artifactUri.startsWith("s3://")
  ) {
    const { putBinaryObject } = require("../aws/s3-proof-io");
    await putBinaryObject(artifactUri, written.bytes, { contentType: "application/vnd.apache.parquet" });
  }

  return {
    localPath,
    bytes: written.bytes,
    sha256: written.footer_sha256,
    full_sha256: written.sha256,
    footer_sha256: written.footer_sha256,
    digest_type: written.digest_type || "parquet_footer",
    format: written.format || "parquet",
    parquetUri: artifactUri,
    fileName: path.basename(localPath),
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
    format: read.format || "parquet",
  };
}

module.exports = { writeChunkRecords, readChunkRecords, stagingRoot };
