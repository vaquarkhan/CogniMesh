/** Helpers to build common pipeline graph layouts for the pattern library. */

export function linearPipeline({ sources, transforms, sinks, startX = 80, gapX = 280, y = 140 }) {
  const nodes = [];
  const edges = [];
  const chain = [...sources, ...transforms, ...sinks];
  let x = startX;
  chain.forEach((spec, i) => {
    const id = spec.id || `node-${i + 1}`;
    nodes.push({
      id,
      type: "pipeline",
      position: { x, y: spec.y ?? y },
      data: { ...spec.data },
    });
    if (i > 0) {
      edges.push({
        id: `e-${i}`,
        source: chain[i - 1].id || `node-${i}`,
        target: id,
        animated: true,
      });
    }
    x += gapX;
  });
  return { nodes, edges };
}

/** Classic medallion: Source → Bronze SQL → Silver SQL → Gold Sink */
export function medallionPattern({
  id,
  name,
  domain,
  source,
  bronzeSql,
  silverSql,
  goldLocation,
  goldTable,
  schedule = "0 */6 * * *",
}) {
  return {
    pipelineMeta: { name, domain, version: "1.0.0", schemaEvolutionPolicy: "compatible", piiClassification: "medium" },
    nodes: [
      { id: "src", type: "pipeline", position: { x: 60, y: 140 }, data: { label: "Source", blockType: "source", ...source, detail: source.sourceType } },
      { id: "bronze", type: "pipeline", position: { x: 320, y: 140 }, data: { label: "Bronze", blockType: "transform", transformType: "spark_sql", executionMode: "batch", schedule, sparkSql: bronzeSql, sparkRulesEnabled: true, qualityPolicyId: "strict-zero-drop", detail: "bronze layer" } },
      { id: "silver", type: "pipeline", position: { x: 580, y: 140 }, data: { label: "Silver", blockType: "transform", transformType: "spark_sql", executionMode: "batch", schedule, sparkSql: silverSql, sparkRulesEnabled: true, qualityPolicyId: "strict-zero-drop", detail: "silver layer" } },
      { id: "gold", type: "pipeline", position: { x: 840, y: 140 }, data: { label: "Gold Iceberg", blockType: "sink", targetType: "iceberg", location: goldLocation, catalogDatabase: `${domain}_gold`, catalogTable: goldTable, detail: "gold · Iceberg" } },
    ],
    edges: [
      { id: "e1", source: "src", target: "bronze", animated: true },
      { id: "e2", source: "bronze", target: "silver", animated: true },
      { id: "e3", source: "silver", target: "gold", animated: true },
    ],
  };
}

export const ARCHITECTURE_LABELS = {
  datamesh: "Data Mesh — domain data products · Lake Formation · federated governance",
  datalake: "Data Lake — raw / curated / consumption zones · schema-on-read",
  lakehouse: "Lakehouse — Iceberg ACID · medallion · open table format",
  kappa: "Kappa (κ) — stream-only · replay from log · no batch layer",
  lambda_arch: "Lambda (λ) — batch layer + speed layer · merge at query",
  streaming: "Streaming — Kinesis · MSK · Flink · real-time",
  medallion: "Medallion — Bronze → Silver → Gold curation",
  workflow: "Step Functions — Parallel · Choice · Merge orchestration",
  cognitive: "AI / Bedrock agentic pipeline",
  warehouse: "ELT warehouse — Redshift / Snowflake-style marts",
  compliance: "Governance-first with integrity gates",
};
