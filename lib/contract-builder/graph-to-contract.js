"use strict";

/**
 * Validates React Flow graph topology and converts nodes/edges
 * into a CogniMesh DataContract manifest.
 */

const BLOCK_TYPES = ["source", "transform", "sink"];

function validateGraph(nodes, edges) {
  const errors = [];

  for (const type of BLOCK_TYPES) {
    const count = nodes.filter((n) => n.data?.blockType === type).length;
    if (count !== 1) {
      errors.push(`Pipeline must have exactly one ${type} block (found ${count})`);
    }
  }

  if (errors.length) return { valid: false, errors };

  const source = nodes.find((n) => n.data.blockType === "source");
  const transform = nodes.find((n) => n.data.blockType === "transform");
  const sink = nodes.find((n) => n.data.blockType === "sink");

  const hasEdge = (fromId, toId) =>
    edges.some((e) => e.source === fromId && e.target === toId);

  if (!hasEdge(source.id, transform.id)) {
    errors.push("Connect Source → Transform");
  }
  if (!hasEdge(transform.id, sink.id)) {
    errors.push("Connect Transform → Sink");
  }

  return { valid: errors.length === 0, errors };
}

function slugify(value) {
  return (value || "pipeline")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildSource(sourceNode) {
  const d = sourceNode.data;
  const source = {
    type: d.sourceType || "s3",
    connection: {},
  };

  if (d.sourceType === "rds" || d.sourceType === "mysql") {
    source.connection.secretArn = d.secretArn || "arn:aws:secretsmanager:us-east-1:123456789012:secret:placeholder";
  }
  if (d.endpoint) source.connection.endpoint = d.endpoint;
  if (d.database) source.connection.database = d.database;
  if (d.table) source.connection.table = d.table;

  if (d.cdcEnabled) {
    source.cdc = {
      enabled: true,
      primaryKey: (d.primaryKey || "id").split(",").map((s) => s.trim()),
    };
  }

  if (d.sourceType === "media_url") {
    source.schema = [
      { name: "media_uri", type: "string", nullable: false },
      { name: "content_type", type: "string" },
      { name: "ingested_at", type: "timestamp" },
    ];
  }

  return source;
}

function buildTransform(transformNode, sourceNode) {
  const d = transformNode.data;
  const transform = {
    type: d.transformType || "spark_sql",
    layers: d.layers || ["bronze", "silver", "gold"],
  };

  if (d.transformType === "spark_sql" && d.sparkSql) {
    transform.sparkSql = d.sparkSql;
  }

  if (transform.type === "spark_sql") {
    transform.sparkRules = { enabled: d.sparkRulesEnabled !== false };
    const pk = (sourceNode?.data?.primaryKey || "id").split(",").map((s) => s.trim());
    transform.pvdm = {
      identityFields: pk,
      contentFields: d.pvdmContentFields
        ? d.pvdmContentFields.split(",").map((s) => s.trim())
        : pk,
    };
  }

  if (d.transformType === "agentic") {
    transform.agentic = {
      modelId: d.modelId || "anthropic.claude-3-sonnet-20240229-v1:0",
      promptTemplate: d.promptTemplate || "Extract structured entities from the provided media.",
      outputFormat: d.outputFormat || "parquet",
      compensationHandler:
        d.compensationHandler || "cognimesh.compensation.media-rollback",
      idempotencyKey: d.idempotencyKey || "${media_uri}:${ingested_at}",
    };
    transform.layers = ["silver", "gold"];
  }

  return transform;
}

function buildTarget(sinkNode) {
  const d = sinkNode.data;
  return {
    type: d.targetType || "iceberg",
    location: d.location || "s3://cognimesh-dev-gold/portal-output/",
    catalog: {
      database: d.catalogDatabase || "portal_gold",
      table: d.catalogTable || "output",
    },
    partitionBy: d.partitionBy ? d.partitionBy.split(",").map((s) => s.trim()) : undefined,
  };
}

function graphToContract(nodes, edges, pipelineMeta = {}) {
  const graphCheck = validateGraph(nodes, edges);
  if (!graphCheck.valid) {
    return { success: false, errors: graphCheck.errors };
  }

  const sourceNode = nodes.find((n) => n.data.blockType === "source");
  const transformNode = nodes.find((n) => n.data.blockType === "transform");
  const sinkNode = nodes.find((n) => n.data.blockType === "sink");

  const name = slugify(pipelineMeta.name || "portal-generated-pipeline");
  const domain = pipelineMeta.domain || "default";
  const version = pipelineMeta.version || "0.1.0";
  const executionMode = pipelineMeta.executionMode || transformNode.data.executionMode || "batch";
  const executionPattern =
    pipelineMeta.executionPattern ||
    transformNode.data.executionPattern ||
    (transformNode.data.transformType === "agentic" ? "cognitive" : "vaquar");

  const owner = pipelineMeta.owner || (pipelineMeta.ownerEmail
    ? { team: pipelineMeta.domain || "portal", contact: pipelineMeta.ownerEmail }
    : undefined);

  const contract = {
    apiVersion: "cognimesh.io/v1",
    kind: "DataContract",
    metadata: {
      name,
      domain,
      version,
      description:
        pipelineMeta.description ||
        `Generated from CogniMesh zero-code portal (${name})`,
      ...(owner && { owner }),
      tags: pipelineMeta.tags || { origin: "portal" },
    },
    spec: {
      execution: {
        mode: executionMode,
        pattern: executionPattern,
        ...(executionMode === "batch" && {
          schedule: pipelineMeta.schedule || transformNode.data.schedule || "0 0 * * *",
        }),
        slaMinutes: Number(pipelineMeta.slaMinutes || transformNode.data.slaMinutes || 60),
      },
      source: buildSource(sourceNode),
      transform: buildTransform(transformNode, sourceNode),
      target: buildTarget(sinkNode),
    },
  };

  if (pipelineMeta.piiClassification || sourceNode.data.sourceType === "rds") {
    contract.spec.governance = {
      piiClassification: pipelineMeta.piiClassification || "medium",
      columnMasks: pipelineMeta.columnMasks || [
        { column: "customer_id", maskType: "hash" },
      ],
    };
  } else if (pipelineMeta.piiClassification) {
    contract.spec.governance = {
      piiClassification: pipelineMeta.piiClassification,
      ...(pipelineMeta.columnMasks && { columnMasks: pipelineMeta.columnMasks }),
    };
  }

  return { success: true, contract };
}

module.exports = { graphToContract, validateGraph, slugify };
