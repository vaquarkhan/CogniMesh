/** Contextual help text for properties panel fields. */

export const PIPELINE_META_TIPS = {
  name: "Unique pipeline name (kebab-case). Becomes the DataContract metadata.name.",
  domain: "Data mesh domain team owning this product (e.g. commerce, finance).",
  version: "Semver x.y.z - bump when you change schema or logic.",
  schemaEvolutionPolicy: "How to handle source schema changes: compatible allows new nullable columns; strict rejects drift.",
  piiClassification: "Drives governance rules - high/restricted PII requires column masks in the contract.",
};

export const BLOCK_TIPS = {
  source: {
    _default: "Where data enters the pipeline. Add one or many sources in workflow mode.",
    sourceType: "RDS/MySQL for databases · S3 for files · Kafka for streams · media_url for AI pipelines.",
    rdsProvisioningMode:
      "Use existing when RDS is already in your account (requires Secrets Manager ARN). Create new provisions RDS + secret via Terraform.",
    database: "Database name on the source system (RDS/MySQL).",
    table: "Table to read or capture via CDC.",
    cdcEnabled: "Enable change-data-capture for incremental updates instead of full reloads.",
    primaryKey: "Comma-separated keys used to deduplicate CDC events (e.g. order_id).",
    endpoint: "S3 prefix, Kafka topic, or media ingest path.",
  },
  transform: {
    _default: "Clean, join, or enrich data. Chain multiple transforms between flow states.",
    transformType: "spark_sql for SQL transforms · agentic for Bedrock AI · passthrough for minimal mapping.",
    executionMode: "batch = scheduled runs · stream = continuous processing.",
    sparkSql: "SQL run against bronze/silver layers. Use ${execution_date} for partition filters.",
    modelId: "Bedrock model ID (e.g. anthropic.claude-3-sonnet).",
    promptTemplate: "Instructions sent to the AI agent for extraction or classification.",
    compensationHandler: "Rollback handler if agentic step fails (required for production).",
    schedule: "Cron schedule for batch pipelines (shown when mode is batch).",
    sparkRulesEnabled: "Run SparkRules data quality filters before PVDM write (null keys, null thresholds).",
    qualityPolicyId: "strict-zero-drop rejects bad rows · compatible-nulls allows nullable keys · audit-only logs only.",
    pvdmContentFields: "Comma-separated fields included in VRP hash verification.",
    maxNullPct: "Drop rows where more than this % of content fields are null (100 = disabled).",
  },
  sink: {
    _default: "Where curated data lands. Route to multiple sinks via Choice blocks.",
    targetType: "iceberg for lakehouse tables · redshift for warehouse · s3 for raw output.",
    location: "S3 path for table data (e.g. s3://bucket/domain/table/).",
    catalogDatabase: "Glue Data Catalog database name.",
    catalogTable: "Glue table name registered in the marketplace.",
  },
  start: {
    _default: "Workflow entry point - connect to Parallel or your first Source.",
  },
  parallel: {
    _default: "Run multiple branches at the same time. Connect each branch, then optionally to Merge.",
    branchCount: "Number of concurrent branches (visual hint only).",
  },
  merge: {
    _default: "Join parallel branches before the next step.",
  },
  choice: {
    _default: "Route execution based on a condition. Connect each outgoing edge to a different path.",
    defaultRoute: "Fallback route when no condition matches.",
  },
  map: {
    _default: "Process each item in an array (Step Functions Map state).",
    itemsPath: "JSONPath to the array, e.g. $.items",
    maxConcurrency: "Max parallel iterations.",
  },
  pass: {
    _default: "No-op placeholder - useful for layout or future steps.",
  },
  integrity_gate: {
    _default: "Vaquar PVDM integrity check before downstream writes.",
  },
};

export function tipFor(blockType, field) {
  const group = BLOCK_TIPS[blockType];
  if (!group) return "";
  return group[field] || group._default || "";
}

export const CANVAS_TIPS = {
  empty:
    "👋 Welcome! Open the Pattern Library (left) and click Use pattern to load a starter pipeline.",
  noSelection:
    "Click a block on the canvas to edit it - or click empty space to edit pipeline name & domain.",
  invalid:
    "Fix red-bordered blocks: connect all nodes and fill required fields (sources, sinks, SQL).",
  ready: "Looking good! Preview YAML to see the Step Functions state machine, then Deploy.",
  workflow:
    "Workflow mode: drag Flow blocks (Parallel, Choice, Merge) and connect many sources → transforms → sinks.",
};
