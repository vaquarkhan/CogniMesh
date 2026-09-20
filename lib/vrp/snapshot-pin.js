"use strict";

const { resolveCatalogHost } = require("./catalog-host");

/**
 * Snapshot-pinned read helpers for Iceberg / Athena / Spark consumers.
 * Proofs bind iceberg_snapshot_id; queries must pin to that snapshot.
 */
function buildSnapshotPinSql(catalog, snapshotId, options = {}) {
  const database = catalog.database || catalog.catalog_database || "default";
  const table = catalog.table || catalog.catalog_table || "output";
  const host = resolveCatalogHost(options);
  const engine = options.engine || host.engine;

  if (!snapshotId) {
    return { sql: null, reason: "missing iceberg_snapshot_id", catalog_host: host.host };
  }

  if (engine === "spark" || host.host === "polaris" || host.host === "iceberg-rest") {
    return {
      sql: `SELECT * FROM ${database}.${table} FOR SYSTEM_VERSION AS OF ${snapshotId}`,
      snapshot_id: snapshotId,
      engine: "spark",
      catalog_host: host.host,
      rest_uri: host.restUri,
    };
  }

  return {
    sql: `-- Pin to proven snapshot ${snapshotId}\nSELECT * FROM "${database}"."${table}" /* snapshot_id=${snapshotId} */`,
    snapshot_id: snapshotId,
    engine: "athena",
    catalog_host: host.host,
    note: "Use Iceberg snapshot metadata or time travel with snapshot_id from proof",
  };
}

function attachSnapshotPin(proof, catalog) {
  const snapshotId = proof.commit_receipt?.iceberg_snapshot_id || proof.iceberg_snapshot_id;
  return {
    ...proof,
    snapshot_pin: buildSnapshotPinSql(catalog || proof.table, snapshotId),
  };
}

module.exports = { buildSnapshotPinSql, attachSnapshotPin };
