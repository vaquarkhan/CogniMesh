"use strict";

/**
 * Pluggable compute-engine registry.
 * Each block (source/transform/sink) may declare data.computeEngine.
 * managed:true  → CogniMesh can provision it via Terraform.
 * managed:false → bring-your-own; wire via connection/secret.
 */

function slug(value) {
  return String(value || "block").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "block";
}

function jobName(prefix, role, node) {
  const kind = node?.data?.sourceType || node?.data?.targetType || node?.data?.transformType || role;
  return `${prefix}-${role}-${slug(kind)}-${slug(node?.id)}`.slice(0, 80);
}

function blockArguments(role, node) {
  const d = node?.data || {};
  const args = {};
  if (role === "source") {
    if (d.database) args["--database"] = d.database;
    if (d.table) args["--table"] = d.table;
    if (d.endpoint) args["--endpoint"] = d.endpoint;
    if (d.secretArn) args["--secret_arn"] = d.secretArn;
  }
  if (role === "transform" && d.sparkSql) args["--spark_sql"] = d.sparkSql;
  if (role === "sink") {
    if (d.location) args["--location"] = d.location;
    if (d.catalogDatabase) args["--catalog_database"] = d.catalogDatabase;
    if (d.catalogTable) args["--catalog_table"] = d.catalogTable;
  }
  return args;
}

const ENGINES = {
  glue: {
    id: "glue",
    label: "AWS Glue",
    managed: true,
    task(role, node, prefix) {
      const name = jobName(prefix, role, node);
      return {
        Type: "Task",
        Comment: node?.data?.label || role,
        Resource: "arn:aws:states:::glue:startJobRun.sync",
        Parameters: { JobName: name, Arguments: blockArguments(role, node) },
      };
    },
    terraform(role, node, prefix) {
      return {
        kind: "glue_job",
        name: jobName(prefix, role, node),
        resourceType: "aws_glue_job",
        scriptHint: `s3://${prefix}-scripts/${jobName(prefix, role, node)}.py`,
      };
    },
  },
  lambda: {
    id: "lambda",
    label: "AWS Lambda",
    managed: true,
    task(role, node, prefix) {
      const fn = node?.data?.lambdaArn || `${prefix}-domain-writer`;
      return {
        Type: "Task",
        Comment: node?.data?.label || role,
        Resource: "arn:aws:states:::lambda:invoke",
        Parameters: {
          FunctionName: fn,
          Payload: { role, block: node?.id, args: blockArguments(role, node) },
        },
        ResultPath: "$.result",
      };
    },
    terraform(role, node, prefix) {
      return {
        kind: "lambda",
        name: node?.data?.lambdaArn || `${prefix}-domain-writer`,
        managedByPlatform: !node?.data?.lambdaArn,
      };
    },
  },
  emr_serverless: {
    id: "emr_serverless",
    label: "EMR Serverless (Spark)",
    managed: true,
    task(role, node, prefix) {
      return {
        Type: "Task",
        Comment: node?.data?.label || role,
        Resource: "arn:aws:states:::emr-serverless:startJobRun.sync",
        Parameters: {
          ApplicationId: node?.data?.emrApplicationId || "${EmrServerlessAppId}",
          ExecutionRoleArn: node?.data?.emrExecutionRoleArn || "${EmrExecutionRoleArn}",
          Name: jobName(prefix, role, node),
          JobDriver: {
            SparkSubmit: {
              EntryPoint: node?.data?.sparkEntryPoint || `s3://${prefix}-scripts/${slug(node?.id)}.py`,
            },
          },
        },
      };
    },
    terraform(role, node, prefix) {
      return { kind: "emr_serverless_app", name: `${prefix}-emr-serverless`, resourceType: "aws_emrserverless_application" };
    },
  },
  databricks: {
    id: "databricks",
    label: "Databricks (external)",
    managed: false,
    task(role, node, prefix) {
      return {
        Type: "Task",
        Comment: node?.data?.label || role,
        Resource: "arn:aws:states:::lambda:invoke",
        Parameters: {
          FunctionName: node?.data?.databricksProxyArn || `${prefix}-databricks-trigger`,
          Payload: {
            jobId: node?.data?.databricksJobId || "${DatabricksJobId}",
            workspaceSecretArn: node?.data?.databricksSecretArn || "${DatabricksSecretArn}",
            role,
            block: node?.id,
          },
        },
        ResultPath: "$.result",
      };
    },
    terraform(role, node) {
      return {
        kind: "external_databricks",
        managed: false,
        requires: ["databricksJobId", "databricksSecretArn (Secrets Manager)"],
      };
    },
  },
};

const ALIASES = {
  spark: "emr_serverless",
  emr: "emr_serverless",
  vanilla_spark: "emr_serverless",
  glue_etl: "glue",
  glue_streaming: "glue",
  spark_sql: "glue",
};

function resolveEngine(node) {
  const requested =
    node?.data?.computeEngine || node?.data?.engine || ALIASES[node?.data?.transformType] || null;
  const id = ALIASES[requested] || requested;
  return ENGINES[id] || ENGINES.glue;
}

function listEngines() {
  return Object.values(ENGINES).map((e) => ({ id: e.id, label: e.label, managed: e.managed }));
}

module.exports = { ENGINES, ALIASES, resolveEngine, listEngines };
