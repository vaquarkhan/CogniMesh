"use strict";

function parseJdbcUrl(url) {
  if (!url || typeof url !== "string") return null;
  const raw = url.replace(/^jdbc:/i, "");
  const match = raw.match(/^(\w+):\/\/([^/]+)\/([^?]+)/i);
  if (!match) return null;
  const [, driver, hostPort, database] = match;
  const [host, port] = hostPort.split(":");
  return { driver, host, port: port || null, database };
}

async function previewJdbcSource(connection, { limit = 10 } = {}) {
  const jdbcUrl = connection.jdbcUrl || connection.url || connection.endpoint;
  const parsed = parseJdbcUrl(jdbcUrl);
  const database = connection.database || parsed?.database;
  const table = connection.table;
  const host = connection.host || parsed?.host;

  if (!database || !table) {
    return {
      success: false,
      errors: ["JDBC preview requires database and table (or jdbcUrl with path)"],
    };
  }

  if (process.env.DATA_PREVIEW_JDBC === "true" && process.env.AWS_RDS_CLUSTER_ARN) {
    try {
      const { RDSDataClient, ExecuteStatementCommand } = require("@aws-sdk/client-rds-data");
      const client = new RDSDataClient({ region: process.env.AWS_REGION || "us-east-1" });
      const sql = `SELECT * FROM ${table} LIMIT ${Math.min(limit, 50)}`;
      const result = await client.send(
        new ExecuteStatementCommand({
          resourceArn: process.env.AWS_RDS_CLUSTER_ARN,
          secretArn: connection.secretArn || process.env.AWS_RDS_SECRET_ARN,
          database,
          sql,
          includeResultMetadata: true,
        })
      );

      const columns = result.columnMetadata?.map((c) => c.name) || [];
      const rows = (result.records || []).slice(0, limit).map((rec) => {
        const row = {};
        rec.forEach((cell, i) => {
          const key = columns[i] || `col${i}`;
          const val = cell.stringValue ?? cell.longValue ?? cell.doubleValue ?? cell.booleanValue ?? null;
          row[key] = val;
        });
        return row;
      });

      return {
        success: true,
        live: true,
        driver: parsed?.driver || "rds-data-api",
        connection: { database, table, host },
        columns,
        rows,
        rowCount: rows.length,
        note: "Live RDS Data API sample",
      };
    } catch (err) {
      if (process.env.DATA_PREVIEW_LIVE !== "true") {
        return { success: false, errors: [err.message] };
      }
    }
  }

  const columns = ["id", "updated_at", "payload"];
  const rows = Array.from({ length: Math.min(limit, 10) }, (_, i) => ({
    id: `${1000 + i}`,
    updated_at: new Date(Date.now() - i * 3600000).toISOString(),
    payload: `jdbc-sample-${table}-${i}`,
  }));

  return {
    success: true,
    live: false,
    simulated: true,
    driver: parsed?.driver || connection.driver || "jdbc",
    connection: { database, table, host: host || "configured-host" },
    columns,
    rows,
    rowCount: rows.length,
    note:
      process.env.DATA_PREVIEW_JDBC === "true"
        ? "Set AWS_RDS_CLUSTER_ARN + AWS_RDS_SECRET_ARN for live RDS Data API"
        : "Set DATA_PREVIEW_JDBC=true for JDBC/RDS Data API preview",
  };
}

module.exports = { parseJdbcUrl, previewJdbcSource };
