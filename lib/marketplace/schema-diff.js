"use strict";

/**
 * Marketplace schema / contract diff — reuses platform version-diff.
 */

const { diffContracts } = require("../platform/version-diff");
const { parseSchemaFromManifest } = require("../athena-link");

function schemaArrayToContract(schema, meta = {}) {
  const cols = (schema || []).map((c) =>
    typeof c === "string" ? { name: c, type: "string" } : { name: c.name || c.field, type: c.type || "string" }
  );
  return {
    metadata: {
      version: meta.version || null,
      name: meta.name || null,
      schemaEvolutionPolicy: meta.schemaEvolutionPolicy,
    },
    spec: {
      source: { schema: cols },
      transform: meta.transform ? { type: meta.transform } : undefined,
      target: meta.table ? { catalog: { table: meta.table } } : undefined,
    },
  };
}

function normalizeSide(side) {
  if (!side) return schemaArrayToContract([]);
  if (typeof side === "string") {
    return schemaArrayToContract(parseSchemaFromManifest(side));
  }
  if (Array.isArray(side)) {
    return schemaArrayToContract(side);
  }
  if (side.spec || side.metadata) {
    return side;
  }
  if (side.schema || side.columns) {
    return schemaArrayToContract(side.schema || side.columns, {
      version: side.version,
      name: side.name,
    });
  }
  if (side.manifestYaml) {
    return schemaArrayToContract(parseSchemaFromManifest(side.manifestYaml), {
      version: side.version,
      name: side.name,
    });
  }
  return schemaArrayToContract([]);
}

function diffProductSchemas({ left, right, leftManifest, rightManifest } = {}) {
  const leftContract = normalizeSide(left ?? leftManifest);
  const rightContract = normalizeSide(right ?? rightManifest);
  const diff = diffContracts(leftContract, rightContract);
  const removed = diff.schema?.removedColumns || [];
  const added = diff.schema?.addedColumns || [];
  return {
    ...diff,
    breaking: removed.length > 0,
    compatibility: removed.length > 0 ? "breaking" : added.length > 0 ? "additive" : "compatible",
  };
}

module.exports = { diffProductSchemas, normalizeSide, schemaArrayToContract };
