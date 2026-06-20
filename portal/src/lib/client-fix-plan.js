/**
 * Client-side fix playbooks (no API) - mirrors lib/aws-design-review/fix-assistant.
 */

const PLAYBOOK = {
  "setup.rds_secret": {
    fields: ["secretArn", "rdsProvisioningMode"],
    steps: [
      "Paste your Secrets Manager ARN in the field below, or switch to Create new database.",
      "Never put passwords in the canvas.",
      "Click Apply fix - we update the block for you.",
    ],
    suggestPatch: (node) =>
      node?.data?.rdsProvisioningMode === "existing"
        ? null
        : { rdsProvisioningMode: "provision" },
  },
  "sec.secrets_manager": {
    fields: ["secretArn", "rdsProvisioningMode"],
    steps: [
      "For existing RDS: paste Secrets Manager ARN below.",
      "Or click Apply fix to switch to Create new (Terraform) - no ARN needed.",
    ],
    suggestPatch: (node) =>
      node?.data?.rdsProvisioningMode === "provision"
        ? null
        : { rdsProvisioningMode: "provision" },
  },
  "setup.s3_encryption": {
    fields: ["encryption"],
    steps: ["Set encryption to AES256 below.", "Click Apply fix to apply on the sink block."],
    suggestPatch: () => ({ encryption: "AES256" }),
  },
  "sec.s3_encryption": {
    fields: ["encryption"],
    steps: ["Enable AES256 encryption on the sink block.", "Click Apply fix - no YAML editing."],
    suggestPatch: () => ({ encryption: "AES256" }),
  },
  "sec.glue_catalog": {
    fields: ["catalogDatabase", "catalogTable"],
    steps: ["Set catalog database and table names below.", "Click Apply fix to fill suggested values."],
    suggestPatch: (node, pipelineMeta) => ({
      catalogDatabase: node?.data?.catalogDatabase || pipelineMeta?.domain || "gold",
      catalogTable: node?.data?.catalogTable || pipelineMeta?.name || "curated",
    }),
  },
  "sec.lake_formation": {
    fields: ["enableLakeFormation"],
    steps: ["Enable Lake Formation for this pipeline.", "Click Apply fix to turn it on."],
    suggestPatch: () => ({ enableLakeFormation: true }),
  },
  "sec.integrity_gate": {
    fields: [],
    steps: ["Click Apply fix to insert an Integrity Gate between transform and sink."],
  },
  "arch.schema_evolution": {
    fields: [],
    steps: ["Click Apply fix to set schema evolution policy to compatible."],
    suggestPatch: () => ({ schemaEvolutionPolicy: "compatible" }),
  },
  "arch.parallel_no_merge": {
    fields: [],
    steps: ["Add a Merge block after Parallel branches in AWS Blocks.", "Connect each branch into Merge."],
  },
  "arch.no_source": {
    fields: [],
    steps: ["Drag a Source block from AWS Blocks onto the canvas.", "Or load a starter pattern from Architectures."],
  },
  "arch.no_sink": {
    fields: [],
    steps: ["Drag a Sink block and connect the last transform or merge to it."],
  },
};

const PREFIX_KEYS = [
  "setup.rds_secret",
  "setup.s3_encryption",
  "sec.secrets_manager",
  "sec.s3_encryption",
  "sec.glue_catalog",
  "sec.lake_formation",
];

function resolvePlaybook(findingId) {
  if (PLAYBOOK[findingId]) return PLAYBOOK[findingId];
  for (const key of PREFIX_KEYS) {
    if (findingId.startsWith(`${key}.`) || findingId === key) return PLAYBOOK[key];
  }
  if (findingId.startsWith("sec.integrity_gate")) return PLAYBOOK["sec.integrity_gate"];
  // Integrity-gate findings (sec.integrity.security.<rule>) reuse the security playbooks.
  if (findingId.startsWith("sec.integrity")) {
    if (findingId.includes("secrets_manager")) return PLAYBOOK["sec.secrets_manager"];
    if (findingId.includes("s3_encryption") || findingId.endsWith(".encryption"))
      return PLAYBOOK["sec.s3_encryption"];
    if (findingId.includes("glue") || findingId.includes("catalog")) return PLAYBOOK["sec.glue_catalog"];
    if (findingId.includes("lake_formation")) return PLAYBOOK["sec.lake_formation"];
  }
  if (findingId.startsWith("arch.schema_evolution")) return PLAYBOOK["arch.schema_evolution"];
  if (findingId.startsWith("validation.")) {
    return {
      fields: [],
      steps: ["Use the fields below or Go to block.", "Complete guided setup in Properties - no YAML."],
    };
  }
  if (findingId.startsWith("deploy.")) {
    return {
      fields: [],
      steps: ["Fix the issue on the canvas using the steps above.", "Re-run Preview or Deploy when done."],
    };
  }
  return null;
}

function nodeForFinding(finding, nodes) {
  const id = finding.nodeIds?.[0];
  if (id) return nodes.find((n) => n.id === id);
  const fid = finding.id || "";
  if (fid.includes("secrets_manager")) {
    return nodes.find((n) => ["rds", "mysql"].includes(n.data?.sourceType));
  }
  if (fid.includes("s3_encryption") || fid.endsWith(".encryption") || fid.includes("glue") || fid.includes("catalog")) {
    return nodes.find((n) => n.data?.blockType === "sink");
  }
  return null;
}

/** Build a fix plan locally - works offline and without Bedrock. */
export function buildClientFixPlan(finding, nodes, pipelineMeta = {}) {
  if (!finding?.id) return null;
  const playbook = resolvePlaybook(finding.id);
  const node = nodeForFinding(finding, nodes);
  const steps = playbook?.steps || [
    finding.fix || finding.message || "Update the affected block in Properties.",
    "Click Apply fix if available, or use the fields below.",
    "Re-run Preview when finished - no YAML editing required.",
  ];
  const fields = playbook?.fields || [];
  const rawPatch = playbook?.suggestPatch ? playbook.suggestPatch(node, pipelineMeta) : null;

  let propertyPatch = null;
  let pipelineMetaPatch = null;
  if (rawPatch) {
    const metaKeys = ["enableLakeFormation", "schemaEvolutionPolicy"];
    pipelineMetaPatch = {};
    for (const key of Object.keys(rawPatch)) {
      if (metaKeys.includes(key)) pipelineMetaPatch[key] = rawPatch[key];
    }
    if (!Object.keys(pipelineMetaPatch).length) pipelineMetaPatch = null;

    if (node) {
      const nodePatch = Object.fromEntries(
        Object.entries(rawPatch).filter(([k]) => !metaKeys.includes(k))
      );
      if (Object.keys(nodePatch).length) propertyPatch = nodePatch;
    } else if (!pipelineMetaPatch && rawPatch.enableLakeFormation != null) {
      pipelineMetaPatch = { enableLakeFormation: rawPatch.enableLakeFormation };
    }
  }

  return {
    findingId: finding.id,
    steps,
    fields,
    propertyPatch,
    pipelineMetaPatch,
    nodeId: node?.id || finding.nodeIds?.[0] || null,
    mode: "rules",
    aiExplanation: null,
  };
}

export function mergeWizardFindings({ awsFindings = [], deployErrors = [], blockValidation = null }) {
  const out = [];
  const seen = new Set();

  const push = (f) => {
    if (!f?.id || seen.has(f.id)) return;
    seen.add(f.id);
    out.push(f);
  };

  for (const msg of deployErrors || []) {
    const text = typeof msg === "string" ? msg : msg.message || String(msg);
    push({
      id: `deploy.${out.length}`,
      severity: "critical",
      title: "Deploy blocked",
      message: text,
      fix: "Use Apply fix in this wizard - we update the canvas for you.",
      nodeIds: [],
    });
  }

  if (blockValidation?.byNode) {
    for (const [nodeId, msg] of Object.entries(blockValidation.byNode)) {
      push({
        id: `validation.${nodeId}`,
        severity: "high",
        title: "Block needs attention",
        message: msg,
        fix: "Complete the guided fields below or open Properties for this block.",
        nodeIds: [nodeId],
      });
    }
  }

  for (const msg of blockValidation?.errors || []) {
    if (typeof msg === "string" && !out.some((f) => f.message === msg)) {
      push({
        id: `validation.err.${out.length}`,
        severity: "high",
        title: "Pipeline validation",
        message: msg,
        fix: "Fix connections and required fields on the canvas.",
        nodeIds: [],
      });
    }
  }

  for (const f of awsFindings) {
    push(f);
  }

  return out;
}
