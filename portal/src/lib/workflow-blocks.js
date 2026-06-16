/**
 * Step Functions–style block palette with AWS service blocks.
 * Data architect view: Glue, Kinesis, MSK, DMS, Firehose, ETL/ELT/enrichment transforms.
 */

export const BLOCK_CATEGORIES = [
  { id: "flow", label: "Flow control", hint: "Parallel, Choice, Merge - AWS Step Functions" },
  { id: "aws-ingest", label: "AWS ingest", hint: "Kinesis, MSK, DMS, RDS, S3 sources" },
  { id: "aws-process", label: "Transforms", hint: "Glue ETL/ELT, enrichment, dedupe, streaming" },
  { id: "aws-serving", label: "AWS serving", hint: "Iceberg, Firehose, Redshift, Athena sinks" },
  { id: "governance", label: "Governance", hint: "Integrity gates · PVDM · VRP proof" },
];

const flowBlocks = [
  { category: "flow", type: "start", label: "Start", defaults: { label: "Start", blockType: "start", detail: "Entry point" } },
  { category: "flow", type: "parallel", label: "Parallel", defaults: { label: "Parallel", blockType: "parallel", branchCount: 2, detail: "⛓ SFN Parallel" } },
  { category: "flow", type: "merge", label: "Merge", defaults: { label: "Merge", blockType: "merge", detail: "Join branches" } },
  { category: "flow", type: "choice", label: "Choice", defaults: { label: "Choice", blockType: "choice", detail: "⛓ SFN Choice" } },
  { category: "flow", type: "map", label: "Map", defaults: { label: "Map", blockType: "map", itemsPath: "$.items", maxConcurrency: 10, detail: "⛓ SFN Map" } },
  { category: "flow", type: "pass", label: "Pass", defaults: { label: "Pass", blockType: "pass", detail: "No-op state" } },
];

const ingestBlocks = [
  {
    category: "aws-ingest",
    type: "source-kinesis",
    label: "Kinesis Stream",
    defaults: {
      label: "Kinesis Stream",
      blockType: "source",
      sourceType: "kinesis",
      awsService: "kinesis",
      endpoint: "app-events-stream",
      executionMode: "stream",
      detail: "🌊 Kinesis Data Streams",
    },
  },
  {
    category: "aws-ingest",
    type: "source-msk",
    label: "MSK / Kafka",
    defaults: {
      label: "MSK Topic",
      blockType: "source",
      sourceType: "kafka",
      awsService: "msk",
      endpoint: "events.raw",
      executionMode: "stream",
      detail: "📨 Amazon MSK",
    },
  },
  {
    category: "aws-ingest",
    type: "source-dms",
    label: "DMS CDC",
    defaults: {
      label: "DMS CDC",
      blockType: "source",
      sourceType: "rds",
      awsService: "dms",
      database: "oltp_db",
      table: "orders",
      cdcEnabled: true,
      primaryKey: "id",
      detail: "🔄 AWS DMS replication",
    },
  },
  {
    category: "aws-ingest",
    type: "source-rds",
    label: "RDS / Aurora",
    defaults: {
      label: "RDS Source",
      blockType: "source",
      sourceType: "rds",
      awsService: "rds",
      database: "orders_db",
      table: "orders",
      cdcEnabled: true,
      primaryKey: "order_id",
      detail: "🗄 RDS · CDC",
    },
  },
  {
    category: "aws-ingest",
    type: "source-s3",
    label: "S3 Landing",
    defaults: {
      label: "S3 Landing",
      blockType: "source",
      sourceType: "s3",
      awsService: "s3",
      endpoint: "s3://datalake-raw/landing/",
      detail: "🪣 S3 raw zone",
    },
  },
  {
    category: "aws-ingest",
    type: "source-api",
    label: "API / EventBridge",
    defaults: {
      label: "API Events",
      blockType: "source",
      sourceType: "api",
      awsService: "lambda",
      endpoint: "https://events.example.com/webhook",
      detail: "λ API Gateway events",
    },
  },
];

const processBlocks = [
  {
    category: "aws-process",
    type: "transform-glue-etl",
    label: "Glue ETL Job",
    defaults: {
      label: "Glue ETL",
      blockType: "transform",
      transformType: "glue_etl",
      awsService: "glue",
      processingMode: "etl",
      executionMode: "batch",
      schedule: "0 */6 * * *",
      sparkSql: "SELECT id, TRIM(name) name FROM bronze.raw WHERE id IS NOT NULL",
      sparkRulesEnabled: true,
      qualityPolicyId: "strict-zero-drop",
      detail: "🧊 Glue · ETL",
    },
  },
  {
    category: "aws-process",
    type: "transform-glue-elt",
    label: "Glue ELT (load-first)",
    defaults: {
      label: "Glue ELT",
      blockType: "transform",
      transformType: "glue_etl",
      awsService: "glue",
      processingMode: "elt",
      executionMode: "batch",
      schedule: "0 2 * * *",
      sparkSql: "SELECT * FROM bronze.raw_landing",
      detail: "🧊 Glue · ELT",
    },
  },
  {
    category: "aws-process",
    type: "transform-enrichment",
    label: "Enrichment Join",
    defaults: {
      label: "Enrichment",
      blockType: "transform",
      transformType: "spark_sql",
      awsService: "glue",
      processingMode: "enrichment",
      executionMode: "batch",
      sparkSql: "SELECT e.*, d.segment, d.region FROM silver.events e LEFT JOIN gold.dim_customer d ON e.customer_id = d.id",
      detail: "Enrichment · lookup",
    },
  },
  {
    category: "aws-process",
    type: "transform-dedupe",
    label: "Deduplication",
    defaults: {
      label: "Dedupe",
      blockType: "transform",
      transformType: "spark_sql",
      awsService: "glue",
      processingMode: "dedupe",
      sparkSql: "SELECT * FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY id ORDER BY ts DESC) rn FROM bronze.events) WHERE rn = 1",
      detail: "Dedupe · latest wins",
    },
  },
  {
    category: "aws-process",
    type: "transform-aggregate",
    label: "Aggregation / KPIs",
    defaults: {
      label: "Aggregate KPIs",
      blockType: "transform",
      transformType: "spark_sql",
      awsService: "glue",
      processingMode: "aggregate",
      sparkSql: "SELECT DATE(ts) d, region, COUNT(*) cnt, SUM(amount) revenue FROM silver.orders GROUP BY 1, 2",
      detail: "Aggregate · rollups",
    },
  },
  {
    category: "aws-process",
    type: "transform-cdc-merge",
    label: "CDC Merge (SCD)",
    defaults: {
      label: "CDC Merge",
      blockType: "transform",
      transformType: "spark_sql",
      awsService: "glue",
      processingMode: "cdc_merge",
      sparkSql: "MERGE INTO silver.orders t USING bronze.orders_cdc s ON t.order_id = s.order_id WHEN MATCHED THEN UPDATE SET * WHEN NOT MATCHED THEN INSERT *",
      detail: "CDC merge · upsert",
    },
  },
  {
    category: "aws-process",
    type: "transform-stream",
    label: "Glue Streaming / Flink",
    defaults: {
      label: "Stream Window",
      blockType: "transform",
      transformType: "glue_etl",
      awsService: "flink",
      processingMode: "stream_window",
      executionMode: "stream",
      sparkSql: "SELECT window(start_time, '5 minutes') w, product_id, COUNT(*) events FROM stream.clicks GROUP BY window(start_time, '5 minutes'), product_id",
      detail: "〰 Managed Flink · window",
    },
  },
  {
    category: "aws-process",
    type: "transform-spark",
    label: "Spark SQL",
    defaults: {
      label: "Spark SQL",
      blockType: "transform",
      transformType: "spark_sql",
      awsService: "glue",
      processingMode: "sql",
      executionMode: "batch",
      schedule: "0 */6 * * *",
      sparkSql: "SELECT * FROM bronze.input WHERE id IS NOT NULL",
      sparkRulesEnabled: true,
      qualityPolicyId: "strict-zero-drop",
      detail: "🧊 Spark SQL · DQ",
    },
  },
  {
    category: "aws-process",
    type: "transform-firehose",
    label: "Firehose Transform",
    defaults: {
      label: "Firehose Buffer",
      blockType: "transform",
      transformType: "passthrough",
      awsService: "firehose",
      processingMode: "elt",
      executionMode: "stream",
      detail: "🔥 Kinesis Firehose delivery",
    },
  },
  {
    category: "aws-process",
    type: "transform-agentic",
    label: "Bedrock Enrichment",
    defaults: {
      label: "AI Enrichment",
      blockType: "transform",
      transformType: "agentic",
      awsService: "bedrock",
      processingMode: "enrichment",
      executionMode: "stream",
      modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
      promptTemplate: "Classify and enrich the following record with structured metadata.",
      compensationHandler: "cognimesh.compensation.rollback",
      idempotencyKey: "record_id",
      detail: "🤖 Bedrock · enrich",
    },
  },
  {
    category: "aws-process",
    type: "transform-emr",
    label: "EMR Spark (heavy)",
    defaults: {
      label: "EMR Spark",
      blockType: "transform",
      transformType: "spark_sql",
      awsService: "emr",
      processingMode: "etl",
      executionMode: "batch",
      schedule: "0 3 * * *",
      sparkSql: "SELECT /* EMR heavy join */ * FROM large_fact f JOIN large_dim d ON f.id = d.id",
      detail: "⚡ EMR · heavy compute",
    },
  },
];

const servingBlocks = [
  {
    category: "aws-serving",
    type: "sink-iceberg",
    label: "Iceberg Lakehouse",
    defaults: {
      label: "Iceberg Gold",
      blockType: "sink",
      targetType: "iceberg",
      awsService: "iceberg",
      location: "s3://lakehouse-gold/output/",
      catalogDatabase: "gold",
      catalogTable: "output",
      detail: "🏔 Iceberg · ACID",
    },
  },
  {
    category: "aws-serving",
    type: "sink-firehose",
    label: "Firehose → S3",
    defaults: {
      label: "Firehose Sink",
      blockType: "sink",
      targetType: "s3",
      awsService: "firehose",
      location: "s3://stream-delivery/output/",
      detail: "🔥 Firehose delivery",
    },
  },
  {
    category: "aws-serving",
    type: "sink-redshift",
    label: "Redshift Warehouse",
    defaults: {
      label: "Redshift Mart",
      blockType: "sink",
      targetType: "redshift",
      awsService: "redshift",
      location: "s3://warehouse-staging/output/",
      catalogDatabase: "marts",
      catalogTable: "output",
      detail: "🏢 Redshift mart",
    },
  },
  {
    category: "aws-serving",
    type: "sink-athena",
    label: "Athena View",
    defaults: {
      label: "Athena View",
      blockType: "sink",
      targetType: "s3",
      awsService: "athena",
      location: "s3://athena-results/views/",
      catalogDatabase: "analytics",
      catalogTable: "v_output",
      detail: "🔍 Athena · consumption",
    },
  },
  {
    category: "aws-serving",
    type: "sink-s3",
    label: "S3 Data Lake",
    defaults: {
      label: "S3 Curated",
      blockType: "sink",
      targetType: "s3",
      awsService: "s3",
      location: "s3://datalake-curated/output/",
      detail: "🪣 S3 curated zone",
    },
  },
  {
    category: "aws-serving",
    type: "sink-kinesis-out",
    label: "Kinesis Fan-out",
    defaults: {
      label: "Kinesis Out",
      blockType: "sink",
      targetType: "s3",
      awsService: "kinesis",
      location: "downstream-events-stream",
      detail: "🌊 Kinesis fan-out",
    },
  },
];

const governanceBlocks = [
  {
    category: "governance",
    type: "integrity_gate",
    label: "Integrity Gate (PVDM)",
    defaults: {
      label: "Integrity Gate",
      blockType: "integrity_gate",
      awsService: "lambda",
      detail: "λ Vaquar PVDM · VRP",
    },
  },
];

export const WORKFLOW_BLOCKS = [
  ...flowBlocks,
  ...ingestBlocks,
  ...processBlocks,
  ...servingBlocks,
  ...governanceBlocks,
];

export function blocksByCategory() {
  return BLOCK_CATEGORIES.map((cat) => ({
    ...cat,
    blocks: WORKFLOW_BLOCKS.filter((b) => b.category === cat.id),
  }));
}

/** @deprecated use WORKFLOW_BLOCKS */
export const PALETTE_BLOCKS = WORKFLOW_BLOCKS.filter((b) =>
  ["aws-ingest", "aws-process", "aws-serving"].includes(b.category)
);
