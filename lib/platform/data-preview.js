"use strict";

const { livePreviewSource } = require("./data-preview-live");
const { previewJdbcSource } = require("./data-preview-jdbc");

/** Sample rows from contract source config (connection proof before deploy). */
async function previewSourceData(contract, { limit = 10 } = {}) {
  const connection = contract?.spec?.source?.connection || {};
  const sourceType = contract?.spec?.source?.type || "unknown";

  if (
    process.env.DATA_PREVIEW_JDBC === "true" ||
    sourceType === "rds" ||
    sourceType === "mysql" ||
    connection.jdbcUrl ||
    connection.url?.startsWith("jdbc:")
  ) {
    const jdbc = await previewJdbcSource(connection, { limit });
    if (jdbc.success) {
      return {
        sourceType,
        live: jdbc.live,
        simulated: jdbc.simulated,
        connection: jdbc.connection,
        columns: jdbc.columns,
        rows: jdbc.rows,
        rowCount: jdbc.rowCount,
        note: jdbc.note,
      };
    }
    if (jdbc.errors && process.env.DATA_PREVIEW_LIVE !== "true") {
      return simulatedSample(contract, limit);
    }
  }

  if (process.env.DATA_PREVIEW_LIVE === "true") {
    try {
      const live = await livePreviewSource(contract, { limit });
      if (live) return live;
    } catch (err) {
      return {
        sourceType: contract?.spec?.source?.type || "unknown",
        live: false,
        error: err.message,
        columns: [],
        rows: [],
        rowCount: 0,
        note: `Live preview failed: ${err.message}. Falling back to simulated sample.`,
        fallback: simulatedSample(contract, limit),
      };
    }
  }

  return simulatedSample(contract, limit);
}

function simulatedSample(contract, limit = 10) {
  const spec = contract?.spec || {};
  const source = spec.source || {};
  const schema = source.schema || [];
  const connection = source.connection || {};
  const type = source.type || "unknown";

  const columns = schema.length
    ? schema.map((c) => c.name || c.field || "col")
    : ["id", "updated_at", "payload"];

  const rows = [];
  for (let i = 0; i < Math.min(limit, 10); i++) {
    const row = {};
    for (const col of columns) {
      if (/id$/i.test(col)) row[col] = `${1000 + i}`;
      else if (/date|time|at$/i.test(col)) row[col] = new Date(Date.now() - i * 86400000).toISOString();
      else if (/amount|revenue|price|score/i.test(col)) row[col] = (Math.random() * 1000).toFixed(2);
      else row[col] = `sample-${col}-${i}`;
    }
    rows.push(row);
  }

  return {
    sourceType: type,
    live: false,
    simulated: true,
    connection: {
      table: connection.table || connection.topic || connection.bucket || null,
      host: connection.host || connection.endpoint || null,
    },
    columns,
    rows,
    rowCount: rows.length,
    note: "Simulated sample — set DATA_PREVIEW_LIVE=true for S3/local file connectors",
  };
}

module.exports = { previewSourceData };
