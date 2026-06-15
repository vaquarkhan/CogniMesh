/** AWS services visible on canvas blocks — maps to CogniMesh Terraform modules. */

export const AWS_SERVICES = {
  glue: { label: "AWS Glue", icon: "🧊", color: "#0369a1", role: "process" },
  kinesis: { label: "Amazon Kinesis", icon: "🌊", color: "#0e7490", role: "ingest" },
  firehose: { label: "Kinesis Firehose", icon: "🔥", color: "#c2410c", role: "delivery" },
  msk: { label: "Amazon MSK", icon: "📨", color: "#7c3aed", role: "ingest" },
  dms: { label: "AWS DMS", icon: "🔄", color: "#059669", role: "ingest" },
  emr: { label: "Amazon EMR", icon: "⚡", color: "#ea580c", role: "process" },
  lambda: { label: "AWS Lambda", icon: "λ", color: "#854d0e", role: "process" },
  sfn: { label: "Step Functions", icon: "⛓", color: "#2563eb", role: "orchestrate" },
  athena: { label: "Amazon Athena", icon: "🔍", color: "#9333ea", role: "consume" },
  redshift: { label: "Redshift", icon: "🏢", color: "#be123c", role: "warehouse" },
  iceberg: { label: "Iceberg / Lakehouse", icon: "🏔", color: "#0891b2", role: "store" },
  lakeformation: { label: "Lake Formation", icon: "🏛", color: "#4f46e5", role: "govern" },
  flink: { label: "Managed Flink", icon: "〰", color: "#0d9488", role: "stream" },
  bedrock: { label: "Amazon Bedrock", icon: "🤖", color: "#6366f1", role: "ai" },
  s3: { label: "Amazon S3", icon: "🪣", color: "#ca8a04", role: "store" },
  rds: { label: "Amazon RDS", icon: "🗄", color: "#047857", role: "source" },
};

export const PROCESSING_MODES = [
  { id: "etl", label: "ETL", desc: "Extract → Transform → Load (transform before load)" },
  { id: "elt", label: "ELT", desc: "Extract → Load raw → Transform in warehouse/lake" },
  { id: "enrichment", label: "Enrichment", desc: "Join/lookup to add context (geo, product, customer)" },
  { id: "dedupe", label: "Deduplication", desc: "Window dedupe on business keys" },
  { id: "aggregate", label: "Aggregation", desc: "Rollups, KPIs, windowed metrics" },
  { id: "cdc_merge", label: "CDC Merge", desc: "Upsert / SCD2 from change stream" },
  { id: "stream_window", label: "Stream window", desc: "Tumbling/sliding windows on Kinesis/MSK" },
  { id: "sql", label: "Spark SQL", desc: "Declarative SQL transform" },
  { id: "quality", label: "Data quality", desc: "SparkRules + quarantine bad rows" },
];

export const ARCHITECTURE_TYPES = [
  { id: "datamesh", label: "Data Mesh", icon: "🕸", desc: "Domain-oriented data products · LF governance · self-serve" },
  { id: "datalake", label: "Data Lake", icon: "🏞", desc: "Raw + curated zones on S3 · schema-on-read" },
  { id: "lakehouse", label: "Lakehouse", icon: "🏔", desc: "Iceberg ACID tables · medallion · open formats" },
  { id: "kappa", label: "Kappa", icon: "κ", desc: "Stream-only · replay from log · no separate batch layer" },
  { id: "lambda_arch", label: "Lambda (λ)", icon: "λ", desc: "Batch layer + speed layer · merge at query time" },
  { id: "streaming", label: "Streaming", icon: "🌊", desc: "Kinesis / MSK real-time pipelines" },
  { id: "medallion", label: "Medallion", icon: "🏅", desc: "Bronze → Silver → Gold curation" },
  { id: "workflow", label: "Step Functions", icon: "🔀", desc: "Parallel · Choice · Merge orchestration" },
];

export function serviceDetail(awsService, processingMode) {
  const svc = AWS_SERVICES[awsService];
  if (!svc) return processingMode || "";
  return `${svc.icon} ${svc.label}${processingMode ? ` · ${processingMode}` : ""}`;
}
