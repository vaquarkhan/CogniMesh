/**
 * Client-side AWS design-review auto-fixes (no API). Mirrors lib/aws-design-review/fix-assistant playbooks.
 */

const PIPELINE_META_KEYS = new Set(["enableLakeFormation", "schemaEvolutionPolicy"]);

function nodeForFinding(finding, nodes) {
  const id = finding.nodeIds?.[0];
  return id ? nodes.find((n) => n.id === id) : null;
}

function patchForFinding(finding, node, pipelineMeta) {
  const id = finding.id;

  if (id.startsWith("setup.rds_secret") && node) {
    if (node.data?.secretArn?.trim()) return null;
    return {
      nodeId: node.id,
      propertyPatch: { rdsProvisioningMode: "provision", secretArn: "" },
    };
  }
  if (id.startsWith("setup.rds_secret")) {
    return null;
  }
  if (id.startsWith("sec.secrets_manager") && node) {
    if (node.data?.secretArn?.trim()) return null;
    return {
      nodeId: node.id,
      propertyPatch: { rdsProvisioningMode: "provision" },
    };
  }
  if (id.startsWith("setup.rds_network")) {
    return null;
  }
  if (id.startsWith("sec.rds_private") && node) {
    if (node.data?.rdsProvisioningMode === "existing") return null;
    return {
      nodeId: node.id,
      propertyPatch: { rdsProvisioningMode: "provision", privateSubnet: true },
    };
  }
  if (id.startsWith("sec.tls_transit") && node) {
    return {
      nodeId: node.id,
      propertyPatch: {
        endpoint: (node.data?.endpoint || "http://").replace(/^http:\/\//i, "https://"),
      },
    };
  }
  if (id.startsWith("setup.s3_encryption") || id.startsWith("sec.s3_encryption")) {
    if (!node) return null;
    return {
      nodeId: node.id,
      propertyPatch: {
        encryption: "AES256",
        sinkProvisioningMode: node.data?.sinkProvisioningMode || "provision",
      },
    };
  }
  if (id.startsWith("sec.glue_catalog") && node) {
    return {
      nodeId: node.id,
      propertyPatch: {
        catalogDatabase: node.data?.catalogDatabase || pipelineMeta?.domain || "gold",
        catalogTable: node.data?.catalogTable || pipelineMeta?.name || "curated",
      },
    };
  }
  if (id.startsWith("sec.agentic_compensation") && node) {
    return {
      nodeId: node.id,
      propertyPatch: {
        compensationHandler:
          "arn:aws:lambda:us-east-1:ACCOUNT_ID:function:agent-compensation",
      },
    };
  }
  if (id.startsWith("sec.agentic_idempotency") && node) {
    return { nodeId: node.id, propertyPatch: { idempotencyKey: "order_id" } };
  }
  if (id.startsWith("sec.sqs_dlq") && node) {
    return { nodeId: node.id, propertyPatch: { enableDlq: true } };
  }
  if (id === "arch.schema_evolution" || id.startsWith("arch.schema_evolution.")) {
    return { pipelineMetaPatch: { schemaEvolutionPolicy: "compatible" } };
  }
  if (id.startsWith("sec.lake_formation")) {
    return { pipelineMetaPatch: { enableLakeFormation: true } };
  }

  return null;
}

/**
 * @returns {{ type: 'add_integrity_gate' } | { type: 'pipelineMeta', patch: object } | { type: 'node', nodeId: string, patch: object } | null}
 */
export function resolveAutoFix(finding, nodes, pipelineMeta = {}) {
  if (!finding?.id) return null;

  if (
    finding.id === "sec.integrity_gate" ||
    finding.id.startsWith("sec.integrity_gate.") ||
    finding.title?.toLowerCase().includes("integrity gate")
  ) {
    return { type: "add_integrity_gate" };
  }

  const node = nodeForFinding(finding, nodes);
  const patch = patchForFinding(finding, node, pipelineMeta);
  if (!patch) return null;

  if (patch.pipelineMetaPatch) {
    return { type: "pipelineMeta", patch: patch.pipelineMetaPatch };
  }
  if (patch.propertyPatch && patch.nodeId) {
    const metaOnly = Object.keys(patch.propertyPatch).every((k) => PIPELINE_META_KEYS.has(k));
    if (metaOnly) {
      return { type: "pipelineMeta", patch: patch.propertyPatch };
    }
    return { type: "node", nodeId: patch.nodeId, patch: patch.propertyPatch };
  }

  return null;
}

/** Apply a fix-help API plan when present. */
export function resolvePlanActions(plan) {
  if (!plan) return null;
  if (plan.pipelineMetaPatch && Object.keys(plan.pipelineMetaPatch).length) {
    return { type: "pipelineMeta", patch: plan.pipelineMetaPatch };
  }
  if (plan.propertyPatch?.enableLakeFormation != null) {
    return { type: "pipelineMeta", patch: { enableLakeFormation: plan.propertyPatch.enableLakeFormation } };
  }
  if (plan.propertyPatch && plan.nodeId) {
    const nodePatch = { ...plan.propertyPatch };
    const metaPatch = {};
    for (const key of PIPELINE_META_KEYS) {
      if (nodePatch[key] != null) {
        metaPatch[key] = nodePatch[key];
        delete nodePatch[key];
      }
    }
    if (Object.keys(metaPatch).length) {
      return { type: "pipelineMeta", patch: metaPatch };
    }
    if (Object.keys(nodePatch).length) {
      return { type: "node", nodeId: plan.nodeId, patch: nodePatch };
    }
  }
  return null;
}
