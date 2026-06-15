"use strict";

/**
 * CogniMesh DataContract (cognimesh.io/v1) → Serverless Data Mesh pipeline (sdm/v1)
 * @see https://github.com/vaquarkhan/aws-serverless-datamesh-framework
 */
function contractToMesh(contract, options = {}) {
  const { metadata, spec } = contract;
  const accounts = spec.governance?.accounts || options.accounts || {
    producer: options.producerAccount || "123456789012",
    steward: options.stewardAccount || "123456789012",
    publisher: options.publisherAccount || "123456789012",
  };

  const identityFields =
    spec.transform?.pvdm?.identityFields ||
    spec.source?.cdc?.primaryKey ||
    ["id"];

  const contentFields =
    spec.transform?.pvdm?.contentFields ||
    (spec.source?.schema || []).map((c) => c.name).filter(Boolean);

  const partitionKey =
    spec.transform?.pvdm?.partitionKey ||
    (spec.target?.partitionBy?.[0]) ||
    "dt";

  return {
    apiVersion: "sdm/v1",
    kind: "DataProductPipeline",
    metadata: {
      domain_id: metadata.domain,
      product_id: `${metadata.domain}-${metadata.name}`,
      owner_team: metadata.owner?.team || metadata.domain,
      description: metadata.description || `CogniMesh pipeline ${metadata.name}`,
    },
    spec: {
      accounts,
      boundary: {
        source_namespace: spec.source.connection?.database || spec.source.type,
        target_table: spec.target.catalog?.table || metadata.name.replace(/-/g, "_"),
        partition_key: partitionKey,
        quality_policy_id: spec.transform?.pvdm?.qualityPolicyId || "strict-zero-drop",
        max_chunk_records: spec.transform?.pvdm?.maxChunkRecords || 5000,
      },
      workload: {
        identity_fields: identityFields,
        content_fields: contentFields.length ? contentFields : identityFields,
        checkpoint_interval: spec.transform?.pvdm?.checkpointInterval || 5000,
        rollback_threshold_ms: spec.transform?.pvdm?.rollbackThresholdMs || 30000,
      },
      runtime: {
        pattern: "vaquar",
        engine: spec.transform?.type === "agentic" ? "agentic" : "pyarrow",
        package_extras: spec.transform?.sparkRules?.enabled ? ["rules"] : [],
        spark_rules_enabled: !!spec.transform?.sparkRules?.enabled,
        spark_rules_drl_s3_uri: spec.transform?.sparkRules?.drlS3Uri || null,
        iceguard: {
          checkpoint_bucket: options.checkpointBucket || "${checkpoint_bucket}",
          proof_bucket: options.proofBucket || "${proof_bucket}",
          lakehouse_bucket: spec.target.location || "${lakehouse_bucket}",
        },
        durable: {
          lambda_timeout_seconds: spec.execution?.pvdm?.lambdaTimeoutSeconds || 900,
          durable_execution_timeout_seconds:
            spec.execution?.pvdm?.durableTimeoutSeconds || 5400,
          max_resume_attempts: spec.execution?.pvdm?.maxResumeAttempts || 8,
        },
        metadata: {
          glue_database: spec.target.catalog?.database,
          glue_table: spec.target.catalog?.table,
          iceberg_warehouse: spec.target.location,
        },
      },
      governance: {
        sla_freshness_hours: Math.ceil((spec.execution?.slaMinutes || 120) / 60),
        auto_repair: spec.transform?.pvdm?.autoRepair !== false,
        canary_max_divergence_pct: spec.transform?.pvdm?.canaryMaxDivergencePct || 1.0,
        schema_version: metadata.version,
        pii_classification: spec.governance?.piiClassification || "none",
      },
      triggers: [
        {
          type: spec.execution.mode === "stream" ? "event" : "schedule",
          cron: spec.execution.schedule || "0 0 * * *",
          description: `CogniMesh ${metadata.name}`,
        },
      ],
      consumer_slas: (spec.governance?.consumerSlas || []).length
        ? spec.governance.consumerSlas
        : [
            {
              consumer_id: metadata.domain,
              target_table: spec.target.catalog?.table || metadata.name,
              max_freshness_minutes: spec.execution?.slaMinutes || 120,
              min_completeness_pct: 99.9,
              enforcement: "vrp_backed",
            },
          ],
      aws_region: options.awsRegion || process.env.AWS_REGION || "us-east-1",
      name_prefix: options.namePrefix || `cognimesh-${metadata.domain}`,
      cognimesh: {
        source_contract: metadata.name,
        version: metadata.version,
        transform_type: spec.transform.type,
      },
    },
  };
}

function isVaquarContract(contract) {
  const pattern = contract?.spec?.execution?.pattern;
  if (pattern === "vaquar") return true;
  if (pattern === "glue") return false;
  if (contract?.spec?.transform?.type === "agentic") return false;
  return contract?.spec?.transform?.type === "spark_sql" ||
    contract?.spec?.source?.cdc?.enabled;
}

module.exports = { contractToMesh, isVaquarContract };
