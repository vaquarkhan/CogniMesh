"use strict";

/**
 * Marketplace schema / contract diff — consumer-protection compatibility checker.
 */

const { diffContracts } = require("../platform/version-diff");
const { parseSchemaFromManifest } = require("../athena-link");

/** Wider → narrower (or incompatible) is breaking for consumers. */
const TYPE_RANK = {
  boolean: 1,
  bool: 1,
  int: 2,
  integer: 2,
  smallint: 2,
  bigint: 3,
  long: 3,
  float: 4,
  double: 5,
  decimal: 5,
  number: 5,
  string: 6,
  varchar: 6,
  text: 6,
  timestamp: 7,
  timestamptz: 7,
  date: 7,
  binary: 8,
  bytes: 8,
};

function normalizeType(t) {
  return String(t || "string")
    .toLowerCase()
    .replace(/\(.*\)$/, "")
    .trim();
}

function isNullable(col) {
  if (col == null) return true;
  if (typeof col.nullable === "boolean") return col.nullable;
  if (typeof col.required === "boolean") return !col.required;
  if (col.nullability === "required") return false;
  if (col.nullability === "optional" || col.nullability === "nullable") return true;
  return true;
}

function columnsFromSchema(schema) {
  return (schema || []).map((c) => {
    if (typeof c === "string") return { name: c, type: "string", nullable: true };
    return {
      name: c.name || c.field,
      type: normalizeType(c.type || c.dataType || "string"),
      nullable: isNullable(c),
      raw: c,
    };
  }).filter((c) => c.name);
}

function schemaArrayToContract(schema, meta = {}) {
  const cols = columnsFromSchema(schema).map((c) => ({
    name: c.name,
    type: c.type,
    nullable: c.nullable,
  }));
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

function typeChangeBreaking(fromType, toType) {
  if (fromType === toType) return false;
  const fromRank = TYPE_RANK[fromType];
  const toRank = TYPE_RANK[toType];
  if (fromRank == null || toRank == null) return fromType !== toType;
  // Narrowing numeric precision / incompatible families = breaking
  if (fromRank > toRank) return true;
  // string → non-string, timestamp → date-ish mismatches
  if (fromType === "string" && toType !== "string" && toType !== "varchar" && toType !== "text") {
    return true;
  }
  return fromType !== toType && !(fromRank < toRank && fromRank >= 2 && toRank <= 5);
}

function diffProductSchemas({ left, right, leftManifest, rightManifest } = {}) {
  const leftContract = normalizeSide(left ?? leftManifest);
  const rightContract = normalizeSide(right ?? rightManifest);
  const base = diffContracts(leftContract, rightContract);

  const leftCols = columnsFromSchema(leftContract.spec?.source?.schema);
  const rightCols = columnsFromSchema(rightContract.spec?.source?.schema);
  const leftByName = Object.fromEntries(leftCols.map((c) => [c.name, c]));
  const rightByName = Object.fromEntries(rightCols.map((c) => [c.name, c]));

  const typeChanges = [];
  const nullabilityChanges = [];
  for (const name of base.schema.commonColumns || []) {
    const l = leftByName[name];
    const r = rightByName[name];
    if (!l || !r) continue;
    if (l.type !== r.type) {
      const breaking = typeChangeBreaking(l.type, r.type);
      typeChanges.push({ column: name, from: l.type, to: r.type, breaking });
    }
    if (l.nullable === true && r.nullable === false) {
      nullabilityChanges.push({
        column: name,
        from: "nullable",
        to: "required",
        breaking: true,
      });
    } else if (l.nullable === false && r.nullable === true) {
      nullabilityChanges.push({
        column: name,
        from: "required",
        to: "nullable",
        breaking: false,
      });
    }
  }

  const removed = base.schema?.removedColumns || [];
  const added = base.schema?.addedColumns || [];

  // Possible semantic renames: same type removed+added pairs
  const possibleRenames = [];
  for (const rem of removed) {
    const l = leftByName[rem];
    const candidates = added.filter((a) => rightByName[a]?.type === l?.type);
    if (candidates.length === 1) {
      possibleRenames.push({ from: rem, to: candidates[0], type: l.type, note: "possible rename — treat as breaking until confirmed" });
    }
  }

  const breakingType = typeChanges.filter((t) => t.breaking);
  const breakingNull = nullabilityChanges.filter((n) => n.breaking);
  const breaking =
    removed.length > 0 || breakingType.length > 0 || breakingNull.length > 0;

  let compatibility = "compatible";
  if (breaking) compatibility = "breaking";
  else if (added.length > 0 || typeChanges.length > 0 || nullabilityChanges.length > 0) {
    compatibility = "additive";
  }

  const reasons = [];
  if (removed.length) reasons.push(`${removed.length} column(s) removed`);
  if (breakingType.length) reasons.push(`${breakingType.length} breaking type change(s)`);
  if (breakingNull.length) reasons.push(`${breakingNull.length} nullability tighten(s)`);
  if (!reasons.length && added.length) reasons.push(`${added.length} column(s) added`);
  if (!reasons.length && possibleRenames.length) reasons.push(`${possibleRenames.length} possible rename(s)`);

  return {
    ...base,
    schema: {
      ...base.schema,
      typeChanges,
      nullabilityChanges,
      possibleRenames,
    },
    breaking,
    compatibility,
    summary: reasons.length
      ? `${compatibility}: ${reasons.join("; ")}`
      : base.summary || "No material differences",
  };
}

module.exports = {
  diffProductSchemas,
  normalizeSide,
  schemaArrayToContract,
  columnsFromSchema,
  typeChangeBreaking,
};
