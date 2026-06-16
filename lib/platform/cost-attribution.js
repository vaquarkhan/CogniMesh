"use strict";

/** Estimated monthly AWS cost per pipeline (heuristic for CFO dashboard). */
const UNIT_COSTS = {
  glue_dpu_hour: 0.44,
  sfn_transition: 0.000025,
  s3_gb_month: 0.023,
  lambda_gb_second: 0.0000166667,
  bedrock_1k_tokens: 0.003,
  kinesis_shard_hour: 0.015,
};

function estimatePipelineCost(contract) {
  const spec = contract?.spec || {};
  const source = (spec.source?.type || "").toLowerCase();
  const transform = (spec.transform?.type || "").toLowerCase();
  const pattern = spec.execution?.pattern || "standard";
  const layers = spec.transform?.layers?.length || 3;

  let glue = transform.includes("glue") || transform.includes("spark") ? 12 * UNIT_COSTS.glue_dpu_hour * 30 : 0;
  let sfn = 5000 * UNIT_COSTS.sfn_transition * 30;
  let s3 = layers * 50 * UNIT_COSTS.s3_gb_month;
  let streaming = /kinesis|msk|kafka/.test(source) ? 2 * UNIT_COSTS.kinesis_shard_hour * 24 * 30 : 0;
  let bedrock = pattern === "vaquar" || spec.transform?.pvdm ? 100 * UNIT_COSTS.bedrock_1k_tokens : 0;

  const total = glue + sfn + s3 + streaming + bedrock;

  return {
    currency: "USD",
    period: "month",
    estimatedTotal: Math.round(total * 100) / 100,
    breakdown: {
      glue: Math.round(glue * 100) / 100,
      stepFunctions: Math.round(sfn * 100) / 100,
      s3: Math.round(s3 * 100) / 100,
      streaming: Math.round(streaming * 100) / 100,
      bedrock: Math.round(bedrock * 100) / 100,
    },
    comparison: {
      glueOnly: Math.round((glue + s3) * 100) / 100,
      note: "Heuristic estimate — connect AWS Cost Explorer for actuals",
    },
  };
}

function listDomainCosts(domain) {
  const { listLineageCatalog } = require("../lineage-catalog");
  const graphs = listLineageCatalog(domain);
  return graphs.map((g) => ({
    name: g.name,
    domain: g.domain || domain,
    cost: estimatePipelineCost({
      metadata: { name: g.name, domain: g.domain, version: g.version },
      spec: { source: { type: "s3" }, transform: { type: "glue", layers: ["bronze", "silver", "gold"] } },
    }),
  }));
}

module.exports = { estimatePipelineCost, listDomainCosts, UNIT_COSTS };
