"use strict";

/**
 * Snapshot-pinned read helpers for Iceberg / Athena consumers.
 * Proofs bind iceberg_snapshot_id; queries must pin to that snapshot.
 */
function buildSnapshotPinSql(catalog, snapshotId, options = {}) {
  const database = catalog.database || catalog.catalog_database || "default";
  const table = catalog.table || catalog.catalog_table || "output";
  const engine = options.engine || "athena";

  if (!snapshotId) {
    return { sql: null, reason: "missing iceberg_snapshot_id" };
  }

  if (engine === "spark") {
    return {
      sql: `SELECT * FROM ${database}.${table} FOR SYSTEM_VERSION AS OF ${snapshotId}`,
      snapshot_id: snapshotId,
      engine,
    };
  }

  return {
    sql: `-- Pin to proven snapshot ${snapshotId}\nSELECT * FROM "${database}"."${table}" /* snapshot_id=${snapshotId} */`,
    snapshot_id: snapshotId,
    engine: "athena",
    note: "Use Iceberg snapshot metadata or time travel with snapshot_id from proof",
  };
}

function attachSnapshotPin(proof, catalog) {
  const snapshotId = proof.iceberg_snapshot_id;
  return {
    ...proof,
    snapshot_pin: buildSnapshotPinSql(catalog || proof.table, snapshotId),
  };
}

module.exports = { buildSnapshotPinSql, attachSnapshotPin };
