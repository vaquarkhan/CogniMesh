/**
 * Step Functions–style block palette — Flow / Data / Governance categories.
 * Drag any number of sources, transforms, and sinks onto the canvas.
 */

export const BLOCK_CATEGORIES = [
  { id: "flow", label: "Flow control", hint: "Parallel, Choice, Merge — like AWS Step Functions" },
  { id: "data", label: "Data blocks", hint: "Sources, transforms, sinks — add as many as you need" },
  { id: "governance", label: "Governance", hint: "Integrity gates and checkpoints" },
];

export const WORKFLOW_BLOCKS = [
  // ── Flow control ──────────────────────────────────────────────
  {
    category: "flow",
    type: "start",
    label: "Start",
    defaults: {
      label: "Start",
      blockType: "start",
      detail: "Entry point",
    },
  },
  {
    category: "flow",
    type: "parallel",
    label: "Parallel",
    defaults: {
      label: "Parallel",
      blockType: "parallel",
      branchCount: 2,
      detail: "Run branches concurrently",
    },
  },
  {
    category: "flow",
    type: "merge",
    label: "Merge",
    defaults: {
      label: "Merge",
      blockType: "merge",
      detail: "Join parallel branches",
    },
  },
  {
    category: "flow",
    type: "choice",
    label: "Choice",
    defaults: {
      label: "Choice",
      blockType: "choice",
      detail: "Route by condition",
    },
  },
  {
    category: "flow",
    type: "map",
    label: "Map",
    defaults: {
      label: "Map",
      blockType: "map",
      itemsPath: "$.items",
      maxConcurrency: 10,
      detail: "Iterate over items",
    },
  },
  {
    category: "flow",
    type: "pass",
    label: "Pass",
    defaults: {
      label: "Pass",
      blockType: "pass",
      detail: "No-op / placeholder",
    },
  },

  // ── Sources ───────────────────────────────────────────────────
  {
    category: "data",
    type: "source-rds",
    label: "RDS Source",
    defaults: {
      label: "RDS Source",
      blockType: "source",
      sourceType: "rds",
      database: "orders_db",
      table: "orders",
      cdcEnabled: true,
      primaryKey: "order_id",
      detail: "rds · CDC",
    },
  },
  {
    category: "data",
    type: "source-s3",
    label: "S3 Source",
    defaults: {
      label: "S3 Source",
      blockType: "source",
      sourceType: "s3",
      endpoint: "s3://cognimesh-landing/raw/",
      detail: "s3 · batch",
    },
  },
  {
    category: "data",
    type: "source-kafka",
    label: "Kafka Source",
    defaults: {
      label: "Kafka Source",
      blockType: "source",
      sourceType: "kafka",
      endpoint: "events.raw",
      detail: "kafka · stream",
    },
  },
  {
    category: "data",
    type: "source-media",
    label: "Media Source",
    defaults: {
      label: "Media Source",
      blockType: "source",
      sourceType: "media_url",
      endpoint: "s3://cognimesh-media-ingest/raw/",
      detail: "media_url",
    },
  },

  // ── Transforms ────────────────────────────────────────────────
  {
    category: "data",
    type: "transform-spark",
    label: "Spark SQL",
    defaults: {
      label: "Spark SQL",
      blockType: "transform",
      transformType: "spark_sql",
      executionMode: "batch",
      schedule: "0 */6 * * *",
      sparkSql: "SELECT * FROM bronze.input",
      sparkRulesEnabled: true,
      qualityPolicyId: "strict-zero-drop",
      pvdmContentFields: "",
      maxNullPct: 100,
      detail: "spark_sql · DQ",
    },
  },
  {
    category: "data",
    type: "transform-agentic",
    label: "AI Transform",
    defaults: {
      label: "AI Transform",
      blockType: "transform",
      transformType: "agentic",
      executionMode: "stream",
      modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
      promptTemplate: "Extract structured entities from the provided media.",
      compensationHandler: "cognimesh.compensation.media-rollback",
      detail: "agentic · Bedrock",
    },
  },
  {
    category: "data",
    type: "transform-passthrough",
    label: "Passthrough",
    defaults: {
      label: "Passthrough",
      blockType: "transform",
      transformType: "passthrough",
      executionMode: "stream",
      sparkSql: "SELECT * FROM source",
      detail: "passthrough",
    },
  },

  // ── Sinks ─────────────────────────────────────────────────────
  {
    category: "data",
    type: "sink-iceberg",
    label: "Iceberg Sink",
    defaults: {
      label: "Iceberg Sink",
      blockType: "sink",
      targetType: "iceberg",
      location: "s3://cognimesh-dev-gold/output/",
      catalogDatabase: "portal_gold",
      catalogTable: "output",
      detail: "iceberg",
    },
  },
  {
    category: "data",
    type: "sink-redshift",
    label: "Redshift Sink",
    defaults: {
      label: "Redshift Sink",
      blockType: "sink",
      targetType: "redshift",
      location: "s3://cognimesh-staging/redshift/",
      catalogDatabase: "reporting",
      catalogTable: "output",
      detail: "redshift",
    },
  },
  {
    category: "data",
    type: "sink-s3",
    label: "S3 Sink",
    defaults: {
      label: "S3 Sink",
      blockType: "sink",
      targetType: "s3",
      location: "s3://cognimesh-archive/output/",
      detail: "s3 · archive",
    },
  },

  // ── Governance ────────────────────────────────────────────────
  {
    category: "governance",
    type: "integrity_gate",
    label: "Integrity Gate",
    defaults: {
      label: "Integrity Gate",
      blockType: "integrity_gate",
      detail: "Vaquar PVDM check",
    },
  },
];

export function blocksByCategory() {
  return BLOCK_CATEGORIES.map((cat) => ({
    ...cat,
    blocks: WORKFLOW_BLOCKS.filter((b) => b.category === cat.id),
  }));
}

/** @deprecated use WORKFLOW_BLOCKS — kept for tests importing PALETTE_BLOCKS */
export const PALETTE_BLOCKS = WORKFLOW_BLOCKS.filter((b) => b.category === "data");
