/**
 * Canvas block type enums — keep aligned with schemas/data-contract-v1.schema.json
 * and portal workflow block defaults.
 */

/** @see sourceConfig.type in data-contract-v1.schema.json + portal kinesis blocks */
export const SOURCE_TYPES = ["rds", "mysql", "s3", "kafka", "kinesis", "media_url", "api"];

export const TRANSFORM_TYPES = ["spark_sql", "glue_etl", "glue_streaming", "agentic", "passthrough"];

export const TARGET_TYPES = ["s3", "iceberg", "redshift", "delta"];

export const EXECUTION_MODES = ["batch", "stream"];
