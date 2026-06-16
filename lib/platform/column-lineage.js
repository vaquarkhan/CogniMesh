"use strict";

/** Column-level lineage from contract schema + transform hints. */
function buildColumnLineage(contract) {
  const schema = contract.spec?.source?.schema || [];
  const targetTable = contract.spec?.target?.catalog?.table || contract.metadata?.name;
  const transform = contract.spec?.transform?.type || "map";
  const layers = contract.spec?.transform?.layers || ["bronze", "silver", "gold"];

  const columns = schema.map((col) => {
    const name = col.name || col.field || "unknown";
    const path = ["source", ...layers, targetTable, name];
    return {
      column: name,
      type: col.type || "string",
      upstream: path.slice(0, -1).join(" → "),
      downstream: [`${targetTable}.${name}`, "marketplace consumers", "athena views"],
      transform,
      pii: col.pii || contract.metadata?.piiClassification || "none",
    };
  });

  return {
    pipeline: contract.metadata?.name,
    domain: contract.metadata?.domain,
    columns,
    graph: columns.map((c) => ({
      id: c.column,
      label: c.column,
      upstream: c.upstream,
      downstream: c.downstream.join(", "),
    })),
  };
}

module.exports = { buildColumnLineage };
