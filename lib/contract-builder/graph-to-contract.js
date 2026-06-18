"use strict";

/**
 * Validates React Flow graph topology and converts nodes/edges
 * into a CogniMesh DataContract manifest.
 */

const BLOCK_TYPES = ["source", "transform", "sink"];

const VALID_SOURCE_TYPES = new Set(["rds", "mysql", "s3", "kafka", "kinesis", "media_url", "api"]);

/** Map portal/awsService labels to contract source.type enum. */
const SOURCE_TYPE_ALIASES = {
  firehose: "kinesis",
  msk: "kafka",
  dms: "rds",
  dynamodb: "api",
  athena: "s3",
};

function normalizeSourceType(rawType, awsService) {
  const t = String(rawType || "").trim().toLowerCase();
  if (VALID_SOURCE_TYPES.has(t)) return t;
  const alias = SOURCE_TYPE_ALIASES[t];
  if (alias) return alias;
  const fromService = SOURCE_TYPE_ALIASES[String(awsService || "").trim().toLowerCase()];
  if (fromService) return fromService;
  if (VALID_SOURCE_TYPES.has(String(awsService || "").trim().toLowerCase())) {
    return String(awsService).trim().toLowerCase();
  }
  return "s3";
}

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

/** Ensure owner.contact satisfies JSON Schema email format (portal dev usernames are not emails). */
function normalizeOwnerContact(contact) {
  if (!contact) return undefined;
  const s = String(contact).trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return s;
  const slug = s.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "portal-user";
  return `${slug}@cognimesh.local`;
}

function buildOwner(pipelineMeta) {
  if (pipelineMeta.owner) return pipelineMeta.owner;
  if (pipelineMeta.ownerEmail) {
    return {
      team: pipelineMeta.domain || "portal",
      contact: normalizeOwnerContact(pipelineMeta.ownerEmail),
    };
  }
  // Auto-generate owner for non-default domains so patterns pass integrity gate
  if (pipelineMeta.domain && pipelineMeta.domain !== "default") {
    return {
      team: pipelineMeta.domain,
      contact: `${pipelineMeta.domain}-team@cognimesh.local`,
    };
  }
  return undefined;
}

function buildSource(sourceNode, pipelineMeta = {}) {
  const d = sourceNode.data;
  const deployRegion = pipelineMeta.awsRegion || process.env.AWS_REGION || "us-east-1";
  const sourceType = normalizeSourceType(d.sourceType, d.awsService);
  const source = {
    type: sourceType,
    connection: {},
  };

  if (sourceType === "rds" || sourceType === "mysql") {
    source.connection.database = d.database;
    source.connection.table = d.table;
    source.provisioning = {
      mode: d.rdsProvisioningMode === "existing" ? "existing" : "terraform",
    };
    if (d.rdsProvisioningMode !== "existing") {
      const acct = process.env.AWS_ACCOUNT_ID || "ACCOUNT";
      if (d.secretArn) {
        source.connection.secretArn = d.secretArn;
      } else {
        // Terraform will auto-create Secrets Manager; emit placeholder for validation
        source.connection.secretArn = `arn:aws:secretsmanager:${deployRegion}:${acct}:secret:${pipelineMeta.name || "rds"}-auto`;
      }
    } else {
      const acct = process.env.AWS_ACCOUNT_ID || "ACCOUNT";
      if (d.secretArn) {
        source.connection.secretArn = d.secretArn;
      } else {
        source.connection.secretArn = `arn:aws:secretsmanager:${deployRegion}:${acct}:secret:placeholder`;
      }
    }
  }
  if (d.endpoint) source.connection.endpoint = d.endpoint;
  if (d.database && !source.connection.database) source.connection.database = d.database;
  if (d.table && !source.connection.table) source.connection.table = d.table;
  if (d.awsService) source.connection.awsService = d.awsService;

  if (sourceType === "kinesis") {
    source.type = "kinesis";
    source.connection.streamName = d.endpoint;
  }

  if (d.cdcEnabled) {
    source.cdc = {
      enabled: true,
      primaryKey: (d.primaryKey || "id").split(",").map((s) => s.trim()),
    };
  }

  if (sourceType === "media_url") {
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
  if (d.transformType === "glue_etl" || d.transformType === "glue_streaming") {
    transform.type = "glue_etl";
    transform.glue = {
      jobType: d.transformType === "glue_streaming" ? "streaming" : "batch",
      script: d.sparkSql || "",
      processingMode: d.processingMode || "etl",
    };
    if (d.sparkSql) transform.sparkSql = d.sparkSql;
  }
  if (d.processingMode) transform.processingMode = d.processingMode;
  if (d.awsService) transform.awsService = d.awsService;

  if (transform.type === "spark_sql" || transform.type === "glue_etl") {
    transform.sparkRules = { enabled: d.sparkRulesEnabled !== false };
    const pk = (sourceNode?.data?.primaryKey || "id").split(",").map((s) => s.trim());
    transform.pvdm = {
      identityFields: pk,
      contentFields: d.pvdmContentFields
        ? d.pvdmContentFields.split(",").map((s) => s.trim())
        : pk,
      qualityPolicyId: d.qualityPolicyId || "strict-zero-drop",
      ...(d.maxNullPct != null && d.maxNullPct !== "" && {
        maxNullPct: Number(d.maxNullPct),
      }),
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

  const owner = buildOwner(pipelineMeta);
  const deployRegion = pipelineMeta.awsRegion || process.env.AWS_REGION || "us-east-1";

  const contract = {
    apiVersion: "cognimesh.io/v1",
    kind: "DataContract",
    metadata: {
      name,
      domain,
      version,
      awsRegion: deployRegion,
      description:
        pipelineMeta.description ||
        `Generated from CogniMesh zero-code portal (${name})`,
      ...(owner && { owner }),
      tags: pipelineMeta.tags || { origin: "portal" },
    },
    spec: {
      deployment: {
        region: deployRegion,
      },
      execution: {
        mode: executionMode,
        pattern: executionPattern,
        ...(executionMode === "batch" && {
          schedule: pipelineMeta.schedule || transformNode.data.schedule || "0 0 * * *",
        }),
        slaMinutes: Number(pipelineMeta.slaMinutes || transformNode.data.slaMinutes || 60),
      },
      source: buildSource(sourceNode, pipelineMeta),
      transform: buildTransform(transformNode, sourceNode),
      target: buildTarget(sinkNode),
      schemaEvolution: {
        policy: pipelineMeta.schemaEvolutionPolicy || transformNode.data.schemaEvolutionPolicy || "compatible",
        onNewColumn: pipelineMeta.onNewColumn || "add_nullable",
        onRemovedColumn: pipelineMeta.onRemovedColumn || "reject",
      },
    },
  };

  if (pipelineMeta.piiClassification || sourceNode.data.sourceType === "rds") {
    const explicitMasks = pipelineMeta.columnMasks;
    let columnMasks = explicitMasks;
    if (!explicitMasks?.length) {
      const pkCols = (sourceNode.data.primaryKey || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (pkCols.includes("customer_id")) {
        columnMasks = [{ column: "customer_id", maskType: "hash" }];
      }
    }
    contract.spec.governance = {
      piiClassification: pipelineMeta.piiClassification || "medium",
      ...(columnMasks?.length ? { columnMasks } : {}),
    };
  }

  if (pipelineMeta.meshAccounts) {
    contract.spec.governance = {
      ...(contract.spec.governance || {}),
      accounts: { ...pipelineMeta.meshAccounts },
    };
  }

  return { success: true, contract };
}

module.exports = {
  graphToContract,
  validateGraph,
  slugify,
  normalizeOwnerContact,
  normalizeSourceType,
  buildOwner,
  buildSource,
  buildTransform,
  buildTarget,
};
