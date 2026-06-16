"use strict";

const fs = require("fs");
const path = require("path");

function parseS3Uri(uri) {
  if (!uri || !uri.startsWith("s3://")) return null;
  const rest = uri.slice(5);
  const slash = rest.indexOf("/");
  if (slash < 0) return { bucket: rest, prefix: "" };
  return { bucket: rest.slice(0, slash), prefix: rest.slice(slash + 1) };
}

function parseJsonLines(text, limit) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line));
      if (rows.length >= limit) break;
    } catch {
      // skip bad lines
    }
  }
  return rows;
}

async function sampleS3Object({ bucket, key, limit }) {
  const { S3Client, GetObjectCommand, ListObjectsV2Command } = require("@aws-sdk/client-s3");
  const region = process.env.AWS_REGION || "us-east-1";
  const client = new S3Client({ region });

  let objectKey = key;
  if (!objectKey || objectKey.endsWith("/")) {
    const listed = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: key || "", MaxKeys: 5 })
    );
    const first = listed.Contents?.find((o) => !o.Key?.endsWith("/"));
    if (!first?.Key) return { rows: [], note: "No objects found under prefix" };
    objectKey = first.Key;
  }

  const obj = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
  const body = await obj.Body.transformToString();
  const ext = path.extname(objectKey).toLowerCase();

  if (ext === ".json" || body.trimStart().startsWith("{") || body.trimStart().startsWith("[")) {
    const parsed = JSON.parse(body.startsWith("[") ? body : `[${body.split("\n").filter(Boolean).join(",")}]`);
    const rows = Array.isArray(parsed) ? parsed.slice(0, limit) : [parsed];
    return { rows, objectKey, format: "json" };
  }

  if (ext === ".csv" || body.includes(",")) {
    const lines = body.split(/\r?\n/).filter(Boolean);
    const headers = lines[0].split(",").map((h) => h.trim());
    const rows = lines.slice(1, limit + 1).map((line) => {
      const vals = line.split(",");
      const row = {};
      headers.forEach((h, i) => {
        row[h] = vals[i]?.trim() ?? "";
      });
      return row;
    });
    return { rows, objectKey, format: "csv" };
  }

  const rows = parseJsonLines(body, limit);
  if (rows.length) return { rows, objectKey, format: "jsonl" };

  return { rows: [{ preview: body.slice(0, 500) }], objectKey, format: "text" };
}

function sampleLocalFile(filePath, limit) {
  const resolved = path.resolve(filePath.replace(/^file:\/\//, ""));
  const body = fs.readFileSync(resolved, "utf8");
  const ext = path.extname(resolved).toLowerCase();
  if (ext === ".json") {
    const parsed = JSON.parse(body);
    const rows = Array.isArray(parsed) ? parsed.slice(0, limit) : [parsed];
    return { rows, objectKey: resolved, format: "json" };
  }
  if (ext === ".csv") {
    const lines = body.split(/\r?\n/).filter(Boolean);
    const headers = lines[0].split(",").map((h) => h.trim());
    const rows = lines.slice(1, limit + 1).map((line) => {
      const vals = line.split(",");
      const row = {};
      headers.forEach((h, i) => {
        row[h] = vals[i]?.trim() ?? "";
      });
      return row;
    });
    return { rows, objectKey: resolved, format: "csv" };
  }
  const rows = parseJsonLines(body, limit);
  return { rows, objectKey: resolved, format: "jsonl" };
}

async function sampleAthenaTable({ database, table, limit = 10 }) {
  const {
    AthenaClient,
    StartQueryExecutionCommand,
    GetQueryExecutionCommand,
    GetQueryResultsCommand,
  } = require("@aws-sdk/client-athena");
  const region = process.env.AWS_REGION || "us-east-1";
  const workgroup = process.env.ATHENA_WORKGROUP || "primary";
  const output = process.env.ATHENA_OUTPUT_LOCATION;
  if (!output) {
    throw new Error("ATHENA_OUTPUT_LOCATION required (s3://bucket/prefix/)");
  }

  const client = new AthenaClient({ region });
  const sql = `SELECT * FROM "${database}"."${table}" LIMIT ${Math.min(limit, 50)}`;
  const started = await client.send(
    new StartQueryExecutionCommand({
      QueryString: sql,
      QueryExecutionContext: { Database: database },
      ResultConfiguration: { OutputLocation: output },
      WorkGroup: workgroup,
    })
  );
  const qid = started.QueryExecutionId;

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const status = await client.send(new GetQueryExecutionCommand({ QueryExecutionId: qid }));
    const state = status.QueryExecution?.Status?.State;
    if (state === "SUCCEEDED") break;
    if (state === "FAILED" || state === "CANCELLED") {
      throw new Error(status.QueryExecution?.Status?.StateChangeReason || `Athena ${state}`);
    }
  }

  const results = await client.send(
    new GetQueryResultsCommand({ QueryExecutionId: qid, MaxResults: limit + 1 })
  );
  const rows = results.ResultSet?.Rows || [];
  if (rows.length < 2) return { rows: [], columns: [], sql };

  const columns = rows[0].Data.map((d) => d.VarCharValue || "col");
  const dataRows = rows.slice(1, limit + 1).map((row) => {
    const obj = {};
    row.Data.forEach((cell, idx) => {
      obj[columns[idx]] = cell.VarCharValue ?? "";
    });
    return obj;
  });

  return { rows: dataRows, columns, sql, format: "athena" };
}

async function livePreviewSource(contract, { limit = 10 } = {}) {
  const source = contract?.spec?.source || {};
  const connection = source.connection || {};
  const endpoint = connection.endpoint || connection.bucket || connection.host || "";
  const type = source.type || "unknown";
  const database = connection.database || connection.catalog?.database;
  const table = connection.table || connection.catalog?.table;

  if (database && table && (type === "rds" || type === "mysql" || source.catalog || process.env.DATA_PREVIEW_ATHENA === "true")) {
    try {
      const sampled = await sampleAthenaTable({ database, table, limit });
      return {
        sourceType: type,
        live: true,
        connection: { database, table },
        columns: sampled.columns,
        rows: sampled.rows,
        rowCount: sampled.rows.length,
        note: `Live Athena sample · ${sampled.sql}`,
      };
    } catch (err) {
      if (process.env.DATA_PREVIEW_LIVE !== "true") throw err;
    }
  }

  if (endpoint.startsWith("file://") || (endpoint && fs.existsSync(endpoint.replace(/^file:\/\//, "")))) {
    const sampled = sampleLocalFile(endpoint, limit);
    const columns = sampled.rows[0] ? Object.keys(sampled.rows[0]) : [];
    return {
      sourceType: type,
      live: true,
      connection: { path: sampled.objectKey },
      columns,
      rows: sampled.rows,
      rowCount: sampled.rows.length,
      note: `Live local file sample (${sampled.format})`,
    };
  }

  const s3 = parseS3Uri(endpoint.startsWith("s3://") ? endpoint : connection.bucket?.startsWith("s3://") ? connection.bucket : null);
  if (s3) {
    const sampled = await sampleS3Object({ bucket: s3.bucket, key: s3.prefix, limit });
    const columns = sampled.rows[0] ? Object.keys(sampled.rows[0]) : [];
    return {
      sourceType: type,
      live: true,
      connection: { bucket: s3.bucket, key: sampled.objectKey },
      columns,
      rows: sampled.rows,
      rowCount: sampled.rows.length,
      note: `Live S3 sample (${sampled.format || "object"})`,
    };
  }

  return null;
}

module.exports = { livePreviewSource, parseS3Uri, sampleAthenaTable };
