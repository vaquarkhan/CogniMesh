"use strict";

/** Build Amazon Athena console deep link for a Glue catalog table. */

function athenaConsoleUrl({ database, table, region, workgroup } = {}) {
  const r = region || process.env.AWS_REGION || "us-east-1";
  const wg = workgroup || process.env.ATHENA_WORKGROUP || "primary";
  const q = `SELECT * FROM "${database}"."${table}" LIMIT 10`;
  const params = new URLSearchParams({
    region: r,
    workgroup: wg,
    sql: q,
  });
  return `https://${r}.console.aws.amazon.com/athena/home?${params.toString()}`;
}

function parseSchemaFromManifest(manifestYaml) {
  if (!manifestYaml) return [];
  const cols = [];
  const schemaBlock = manifestYaml.match(/schema:\s*\n((?:\s+-\s+name:.+\n?)+)/);
  if (!schemaBlock) {
    return [
      { name: "id", type: "string" },
      { name: "loaded_at", type: "timestamp" },
    ];
  }
  const lines = schemaBlock[1].match(/-\s+name:\s*(\S+)/g) || [];
  return lines.map((l) => ({ name: l.replace(/-\s+name:\s*/, ""), type: "string" }));
}

function sampleRowsFromSchema(schema, n = 3) {
  return Array.from({ length: n }, (_, i) => {
    const row = {};
    for (const col of schema) {
      row[col.name] = col.type === "timestamp" ? new Date().toISOString() : `${col.name}_${i + 1}`;
    }
    return row;
  });
}

module.exports = { athenaConsoleUrl, parseSchemaFromManifest, sampleRowsFromSchema };
