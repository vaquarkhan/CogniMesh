"use strict";

const { getLineage, listLineageCatalog } = require("../lineage-catalog");

function analyzeDeployImpact(contract, { changedColumns = [] } = {}) {
  const domain = contract.metadata?.domain;
  const name = contract.metadata?.name;
  const productId = `${domain}-${name}-${contract.metadata?.version}`;
  const lineage = getLineage(productId) || listLineageCatalog(domain).find((g) => g.name === name);

  const consumers = lineage?.consumers || [
    { id: "analytics-team", type: "athena", risk: "medium" },
    { id: "ml-feature-store", type: "glue_job", risk: "high" },
  ];

  const schema = contract.spec?.source?.schema || [];
  const columns = changedColumns.length
    ? changedColumns
    : schema.map((c) => c.name).filter(Boolean);

  const affected = consumers.map((c) => ({
    consumerId: c.id || c.name,
    type: c.type || "unknown",
    risk: c.risk || (columns.length > 3 ? "high" : "medium"),
    reason: columns.length
      ? `May break on column changes: ${columns.slice(0, 5).join(", ")}`
      : "Schema or transform change",
  }));

  const blastRadius = affected.length === 0 ? "low" : affected.length <= 2 ? "medium" : "high";

  return {
    pipelineName: name,
    domain,
    blastRadius,
    changedColumns: columns,
    affectedConsumers: affected,
    recommendation:
      blastRadius === "high"
        ? "Run impact review with downstream owners before deploy"
        : "Safe to proceed with standard integrity gate",
    deployBlocked: blastRadius === "high" && contract.spec?.schemaEvolution?.policy === "strict",
  };
}

module.exports = { analyzeDeployImpact };
