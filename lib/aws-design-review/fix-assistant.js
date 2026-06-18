"use strict";

const { isCopilotLlmEnabled } = require("../platform/copilot-llm");

/** Step-by-step playbooks keyed by finding id (prefix match for dynamic ids). */
const PLAYBOOK = {
  "sec.secrets_manager": {
    fields: ["secretArn", "rdsProvisioningMode"],
    steps: [
      "For an existing database: set Credentials → secretArn to your Secrets Manager ARN.",
      "Or switch RDS database → Create new (Terraform) to provision RDS + secret automatically.",
      "Re-run AWS Design Review to confirm the critical finding clears.",
    ],
    suggestPatch: (node) =>
      node?.data?.rdsProvisioningMode === "provision"
        ? null
        : { rdsProvisioningMode: "provision" },
  },
  "sec.rds_private": {
    fields: ["vpcSecurityGroup", "rdsProvisioningMode"],
    steps: [
      "For existing RDS: set vpcSecurityGroup and ensure private subnets.",
      "Or switch RDS database → Create new (Terraform) — VPC, SG, and secret are provisioned.",
    ],
    suggestPatch: (node) =>
      node?.data?.rdsProvisioningMode === "provision"
        ? null
        : { rdsProvisioningMode: "provision", privateSubnet: true },
  },
  "sec.tls_transit": {
    fields: ["endpoint"],
    steps: [
      "Change the source endpoint from http:// to https:// or s3://.",
      "Enable TLS on the upstream service (ALB, CloudFront, or S3 bucket policy).",
    ],
    suggestPatch: (node) => ({
      endpoint: (node?.data?.endpoint || "http://").replace(/^http:\/\//i, "https://"),
    }),
  },
  "sec.public_acl": {
    fields: ["location"],
    steps: [
      "Remove public-read or wildcard ACL patterns from the sink location.",
      "Use a private bucket with S3 Block Public Access enabled.",
      "Grant consumer access via Lake Formation, not bucket ACLs.",
    ],
  },
  "sec.s3_encryption": {
    fields: ["encryption", "location"],
    steps: [
      "Enable default encryption (AES256 or aws:kms) on the target bucket.",
      "Set encryption on the sink block to AES256 or KMS key ARN.",
      "Match Terraform storage module defaults (checkpoint, proof, gold buckets).",
    ],
    suggestPatch: () => ({ encryption: "AES256" }),
  },
  "sec.glue_catalog": {
    fields: ["catalogDatabase", "catalogTable"],
    steps: [
      "Set catalogDatabase and catalogTable on the Iceberg sink.",
      "Register the table in Glue Data Catalog.",
      "Apply Lake Formation tags for column-level access.",
    ],
    suggestPatch: (node, pipelineMeta) => ({
      catalogDatabase: node?.data?.catalogDatabase || pipelineMeta?.domain || "gold",
      catalogTable: node?.data?.catalogTable || pipelineMeta?.name || "curated",
    }),
  },
  "sec.pii_masks": {
    fields: [],
    steps: [
      "Set pipeline PII classification in Properties → Pipeline metadata.",
      "Add column masks in transform SparkRules or contract governance.columnMasks.",
      "Use audit-only mode first, then strict-zero-drop for production.",
    ],
  },
  "sec.integrity_gate": {
    fields: [],
    steps: [
      "Drag an Integrity Gate block from AWS Blocks onto the canvas.",
      "Wire: Transform → Integrity Gate → Sink.",
      "Load a Vaquar/PVDM pattern if you need a starter topology.",
    ],
  },
  "sec.agentic_compensation": {
    fields: ["compensationHandler"],
    steps: [
      "Set compensationHandler to a Lambda ARN that reverses partial agent work.",
      "Model as Step Functions saga with catch → compensation state.",
    ],
    suggestPatch: () => ({
      compensationHandler: "arn:aws:lambda:us-east-1:ACCOUNT_ID:function:agent-compensation",
    }),
  },
  "sec.agentic_idempotency": {
    fields: ["idempotencyKey"],
    steps: [
      "Pick a stable business key column (order_id, event_id).",
      "Set idempotencyKey on the agentic transform block.",
    ],
    suggestPatch: () => ({ idempotencyKey: "order_id" }),
  },
  "sec.wildcard_iam": {
    fields: ["iamPolicy"],
    steps: [
      "Replace * principals/actions with scoped ARNs.",
      "Limit to cognimesh-* buckets, glue:GetTable, states:StartExecution.",
    ],
  },
  "sec.owner_contact": {
    fields: [],
    steps: [
      "Set owner email in the header pipeline metadata (used for steward approvals).",
      "Ensure contract metadata.owner.contact is a valid email.",
    ],
  },
  "sec.sqs_dlq": {
    fields: ["enableDlq", "dlqArn"],
    steps: [
      "Enable DLQ on Step Functions or Glue job failure routing.",
      "Point enableDlq / dlqArn at the KMS-encrypted DLQ from Terraform.",
    ],
    suggestPatch: () => ({ enableDlq: true }),
  },
  "sec.lake_formation": {
    fields: ["enableLakeFormation"],
    steps: [
      "Enable Lake Formation in pipeline metadata for non-default domains.",
      "Run terraform with enable_lake_formation_governance=true.",
      "Tag gold tables for consumer LF grants.",
    ],
    suggestPatch: () => ({ enableLakeFormation: true }),
  },
  "arch.no_source": {
    fields: [],
    steps: [
      "Add a Source block (RDS, S3, Kafka) from AWS Blocks.",
      "Or load a starter pattern from Architectures → Use pattern.",
    ],
  },
  "arch.no_sink": {
    fields: [],
    steps: [
      "Add a Sink block with s3:// path or Glue/Iceberg catalog target.",
      "Connect the last transform or merge to the sink.",
    ],
  },
  "arch.parallel_no_merge": {
    fields: [],
    steps: [
      "Add a Merge block after Parallel branches.",
      "Connect each branch output into Merge, then continue to transform/sink.",
    ],
  },
  "arch.vaquar_pvdm": {
    fields: [],
    steps: [
      "Add Integrity Gate between transform and sink.",
      "Enable PVDM on the transform block (quality policy + SparkRules).",
    ],
  },
  "arch.schema_evolution": {
    fields: [],
    steps: [
      "Open pipeline metadata in Properties.",
      "Set schemaEvolutionPolicy to compatible or strict.",
    ],
    suggestPatch: () => ({ schemaEvolutionPolicy: "compatible" }),
  },
  "arch.gate_wiring": {
    fields: [],
    steps: [
      "Draw edges: upstream transform → Integrity Gate → sink.",
      "Remove orphan gate nodes not on the main path.",
    ],
  },
  "arch.orphan_nodes": {
    fields: [],
    steps: [
      "Connect orphan nodes to the workflow from Start.",
      "Or delete unused blocks from the canvas.",
    ],
  },
  "arch.disconnected_sink": {
    fields: [],
    steps: [
      "Draw an edge from the last transform (or merge) to the sink.",
      "Verify the path in Step Functions tab after Preview YAML.",
    ],
  },
  "arch.multi_source_parallel": {
    fields: [],
    steps: [
      "Insert a Parallel block after Start.",
      "Fan each source into its own branch, then Merge.",
    ],
  },
};

function resolvePlaybook(findingId) {
  if (PLAYBOOK[findingId]) return PLAYBOOK[findingId];
  const prefixKeys = [
    "sec.secrets_manager",
    "sec.rds_private",
    "sec.tls_transit",
    "sec.public_acl",
    "sec.s3_encryption",
    "sec.glue_catalog",
    "sec.lake_formation",
  ];
  for (const key of prefixKeys) {
    if (findingId.startsWith(`${key}.`) || findingId === key) return PLAYBOOK[key];
  }
  if (findingId.startsWith("sec.integrity.")) {
    return {
      fields: [],
      steps: [
        "Open Deploy panel → YAML tab and review the DataContract.",
        "Fix the field cited in the integrity gate message.",
        "Re-run Preview YAML, then AWS Design Review.",
      ],
    };
  }
  return null;
}

function nodeForFinding(finding, nodes) {
  const id = finding.nodeIds?.[0];
  return id ? nodes.find((n) => n.id === id) : null;
}

function buildFixPlan(finding, nodes, pipelineMeta) {
  const playbook = resolvePlaybook(finding.id);
  const node = nodeForFinding(finding, nodes);
  const steps = playbook?.steps || [
    finding.fix || "Review the finding and update the affected block properties.",
    "Re-run AWS Design Review after changes.",
  ];
  const fields = playbook?.fields || [];
  const rawPatch = playbook?.suggestPatch ? playbook.suggestPatch(node, pipelineMeta) : null;
  let propertyPatch = null;
  let pipelineMetaPatch = null;
  if (rawPatch) {
    pipelineMetaPatch = {};
    for (const key of Object.keys(rawPatch)) {
      if (key === "enableLakeFormation" || key === "schemaEvolutionPolicy") {
        pipelineMetaPatch[key] = rawPatch[key];
      }
    }
    if (!Object.keys(pipelineMetaPatch).length) pipelineMetaPatch = null;

    if (node) {
      const nodePatch = Object.fromEntries(
        Object.entries(rawPatch).filter(
          ([k]) => k !== "enableLakeFormation" && k !== "schemaEvolutionPolicy"
        )
      );
      if (Object.keys(nodePatch).length) propertyPatch = nodePatch;
    } else if (!pipelineMetaPatch && rawPatch.enableLakeFormation != null) {
      pipelineMetaPatch = { enableLakeFormation: rawPatch.enableLakeFormation };
    }
  }

  return {
    findingId: finding.id,
    title: finding.title,
    severity: finding.severity,
    summary: finding.message,
    steps,
    fields,
    propertyPatch,
    pipelineMetaPatch,
    nodeId: node?.id || finding.nodeIds?.[0] || null,
    waReference: finding.waReference,
    mode: "rules",
    aiExplanation: null,
  };
}

function buildFixPlans({ findings, nodes, pipelineMeta, findingIds }) {
  const ids = findingIds?.length ? new Set(findingIds) : null;
  const selected = ids ? findings.filter((f) => ids.has(f.id)) : findings;
  return selected
    .filter((f) => f.severity !== "info")
    .map((f) => buildFixPlan(f, nodes, pipelineMeta));
}

async function invokeBedrockFixExplanation(finding, plan, node, pipelineMeta) {
  const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");
  const region = process.env.AWS_REGION || "us-east-1";
  const modelId =
    process.env.COPILOT_BEDROCK_MODEL_ID || "anthropic.claude-3-haiku-20240307-v1:0";
  const client = new BedrockRuntimeClient({ region });

  const prompt = `You are an AWS data architect helping fix CogniMesh pipeline design review findings.
Finding: ${finding.title} (${finding.severity})
Issue: ${finding.message}
Rule fix: ${finding.fix}
Block data: ${JSON.stringify(node?.data || {})}
Pipeline: ${pipelineMeta?.name} / ${pipelineMeta?.domain}

Give a concise fix guide (max 100 words): numbered steps, which Properties panel fields to change, and one Terraform or IAM note if relevant. No markdown headers.`;

  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 350,
    messages: [{ role: "user", content: prompt }],
  });

  const res = await client.send(
    new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body,
    })
  );
  const parsed = JSON.parse(new TextDecoder().decode(res.body));
  return (parsed.content?.[0]?.text || parsed.generation || "").trim();
}

async function enrichFixPlansWithLlm(plans, { findings, nodes, pipelineMeta }) {
  if (!isCopilotLlmEnabled()) return plans;

  const byId = new Map(findings.map((f) => [f.id, f]));
  const out = [];
  for (const plan of plans) {
    const finding = byId.get(plan.findingId);
    const node = plan.nodeId ? nodes.find((n) => n.id === plan.nodeId) : null;
    try {
      const aiExplanation = await invokeBedrockFixExplanation(finding, plan, node, pipelineMeta);
      out.push({ ...plan, aiExplanation, mode: "llm" });
    } catch (err) {
      out.push({
        ...plan,
        aiExplanation: `AI unavailable (${err.message}). Use the steps above.`,
        mode: "rules",
      });
    }
  }
  return out;
}

module.exports = {
  buildFixPlans,
  enrichFixPlansWithLlm,
  resolvePlaybook,
  PLAYBOOK,
};
