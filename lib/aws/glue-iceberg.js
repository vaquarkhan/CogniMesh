"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { parseS3Uri } = require("./s3-uri");

const STATE_PATH =
  process.env.ICEBERG_SNAPSHOT_STATE || path.join(process.cwd(), "data", "iceberg-snapshots.json");

function loadState() {
  if (!fs.existsSync(STATE_PATH)) return {};
  try {
    const raw = fs.readFileSync(STATE_PATH, "utf8").trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  const tmp = `${STATE_PATH}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
  fs.renameSync(tmp, STATE_PATH);
}

function tableKey(catalog) {
  return `${catalog.database || catalog.catalog_database}.${catalog.table || catalog.catalog_table}`;
}

async function readSnapshotFromGlueMetadata(database, table) {
  if (process.env.GLUE_ICEBERG_ENABLED === "false") return null;
  try {
    const { GlueClient, GetTableCommand } = require("@aws-sdk/client-glue");
    const glue = new GlueClient({ region: process.env.AWS_REGION || "us-east-1" });
    const res = await glue.send(new GetTableCommand({ DatabaseName: database, Name: table }));
    const params = res.Table?.Parameters || {};
    if ((params.table_type || "").toUpperCase() !== "ICEBERG") return null;
    const metadataLocation = params.metadata_location;
    if (!metadataLocation) return null;

    const { getObjectBytes } = require("./s3-proof-io");
    const metaBytes = await getObjectBytes(metadataLocation);
    const meta = JSON.parse(metaBytes.toString("utf8"));
    const snapshotId = meta["current-snapshot-id"] ?? meta.current_snapshot_id;
    return snapshotId != null ? String(snapshotId) : null;
  } catch {
    return null;
  }
}

/**
 * Commit metadata after VRP PASS: prefer live Glue Iceberg snapshot; else monotonic state per table.
 */
async function commitIcebergSnapshot(catalog, proof) {
  const key = tableKey(catalog);
  const glueSnapshot = await readSnapshotFromGlueMetadata(catalog.database, catalog.table);
  const state = loadState();
  const prev = state[key]?.snapshot_id ? BigInt(state[key].snapshot_id) : 0n;
  const next = glueSnapshot ? BigInt(glueSnapshot) : prev + 1n;
  const snapshotId = String(next);

  state[key] = {
    snapshot_id: snapshotId,
    proof_ref: proof?.multiset?.source_hash || proof?.proof_id,
    pipeline_run_id: proof?.pipeline_run_id,
    committed_at: new Date().toISOString(),
    source: glueSnapshot ? "glue_metadata" : "catalog_state",
  };
  saveState(state);

  const manifestDigest = crypto
    .createHash("sha256")
    .update(`${key}|${snapshotId}|${proof?.multiset?.sink_hash || ""}`)
    .digest("hex");

  return { snapshotId, manifestDigest, source: state[key].source };
}

async function resolveSnapshotForRead(catalog, snapshotId) {
  if (snapshotId) return String(snapshotId);
  const glueSnapshot = await readSnapshotFromGlueMetadata(catalog.database, catalog.table);
  if (glueSnapshot) return glueSnapshot;
  const state = loadState();
  return state[tableKey(catalog)]?.snapshot_id || null;
}

module.exports = {
  commitIcebergSnapshot,
  readSnapshotFromGlueMetadata,
  resolveSnapshotForRead,
  loadState,
  tableKey,
};
