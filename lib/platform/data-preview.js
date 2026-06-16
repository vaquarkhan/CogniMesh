"use strict";

/** Sample rows from contract source config (connection proof before deploy). */
function previewSourceData(contract, { limit = 10 } = {}) {
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
    connection: {
      table: connection.table || connection.topic || connection.bucket || null,
      host: connection.host || connection.endpoint || null,
    },
    columns,
    rows,
    rowCount: rows.length,
    note:
      process.env.DATA_PREVIEW_LIVE === "true"
        ? "Live connector sampling"
        : "Simulated sample — set DATA_PREVIEW_LIVE=true for JDBC/Live connectors",
  };
}

module.exports = { previewSourceData };
