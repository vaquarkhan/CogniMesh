"use strict";

const PUBLIC_ACL = /(\*|public-read|allusers|authenticated-read)/i;
const HTTP_INSECURE = /^http:\/\//;
const SECRETS_ARN = /^arn:aws:secretsmanager:[a-z0-9-]+:\d{12}:secret:/;
const WILDCARD_PRINCIPAL = /(\*|Principal.*\*|Action.*\*)/;

function finding(base) {
  return {
    severity: "medium",
    category: "security",
    pillar: "Security",
    awsServices: [],
    nodeIds: [],
    waReference: null,
    ...base,
  };
}

function nodesByType(nodes, blockType) {
  return nodes.filter((n) => n.data?.blockType === blockType);
}

/**
 * AWS Well-Architected Security pillar + CogniMesh Terraform defaults.
 */
function runSecurityReview({ nodes, edges, pipelineMeta, contract, integrityGate }) {
  const findings = [];
  const sources = nodesByType(nodes, "source");
  const sinks = nodesByType(nodes, "sink");
  const transforms = nodesByType(nodes, "transform");
  const gates = nodesByType(nodes, "integrity_gate");

  for (const src of sources) {
    const d = src.data || {};
    const st = d.sourceType;

    if (st === "rds" || st === "mysql") {
      const secretArn = d.secretArn || contract?.spec?.source?.connection?.secretArn;
      if (!secretArn || !SECRETS_ARN.test(secretArn)) {
        findings.push(
          finding({
            id: `sec.secrets_manager.${src.id}`,
            severity: "critical",
            pillar: "Identity & Access",
            title: "Database credentials must use Secrets Manager",
            message: `Source "${d.label || src.id}" (${st}) stores credentials insecurely without a Secrets Manager ARN.`,
            fix: "Set secretArn to arn:aws:secretsmanager:region:account:secret:name - never embed passwords in the graph.",
            nodeIds: [src.id],
            awsServices: ["RDS", "Secrets Manager"],
            waReference: "SEC-02",
          })
        );
      }
      if (!d.vpcSecurityGroup && !d.privateSubnet) {
        findings.push(
          finding({
            id: `sec.rds_private.${src.id}`,
            severity: "high",
            pillar: "Network Security",
            title: "RDS source should run in private subnets",
            message: "Production RDS endpoints must not be publicly reachable.",
            fix: "Deploy RDS in private subnets with VPC security groups; use Glue/VPC connection or DMS in VPC.",
            nodeIds: [src.id],
            awsServices: ["RDS", "VPC", "Security Groups"],
            waReference: "SEC-05",
          })
        );
      }
    }

    const endpoint = d.endpoint || d.location || "";
    if (HTTP_INSECURE.test(endpoint)) {
      findings.push(
        finding({
          id: `sec.tls_transit.${src.id}`,
          severity: "high",
          pillar: "Data Protection",
          title: "Insecure HTTP endpoint detected",
          message: "Data in transit must use TLS (HTTPS, s3://, or encrypted JDBC).",
          fix: "Change endpoint to https:// or s3:// with bucket encryption enabled.",
          nodeIds: [src.id],
          awsServices: ["S3", "CloudFront"],
          waReference: "SEC-09",
        })
      );
    }
  }

  for (const sink of sinks) {
    const loc = sink.data?.location || contract?.spec?.target?.location || "";
    if (PUBLIC_ACL.test(loc)) {
      findings.push(
        finding({
          id: `sec.public_acl.${sink.id}`,
          severity: "critical",
          pillar: "Data Protection",
          title: "Public S3 ACL pattern blocked",
          message: "Target location matches public-read or wildcard ACL - CogniMesh blocks this at deploy.",
          fix: "Use private S3 buckets with Block Public Access; grant via Lake Formation only.",
          nodeIds: [sink.id],
          awsServices: ["S3", "Lake Formation"],
          waReference: "SEC-08",
        })
      );
    }
    if (loc.startsWith("s3://") && !sink.data?.encryption && !/AES256|aws:kms/.test(loc)) {
      findings.push(
        finding({
          id: `sec.s3_encryption.${sink.id}`,
          severity: "high",
          pillar: "Data Protection",
          title: "S3 target missing encryption at rest",
          message: "Terraform defaults require AES256 or KMS on all lakehouse buckets.",
          fix: "Enable default encryption (AES256 or aws:kms) on checkpoint, proof, and gold buckets.",
          nodeIds: [sink.id],
          awsServices: ["S3", "KMS"],
          waReference: "SEC-08",
        })
      );
    }
    if (sink.data?.sinkType === "iceberg" && !sink.data?.catalogDatabase) {
      findings.push(
        finding({
          id: `sec.glue_catalog.${sink.id}`,
          severity: "medium",
          pillar: "Governance",
          title: "Iceberg sink missing Glue catalog",
          message: "Unregistered tables bypass Lake Formation column-level security.",
          fix: "Set catalogDatabase and catalogTable; register via Glue Data Catalog + LF tags.",
          nodeIds: [sink.id],
          awsServices: ["Glue", "Lake Formation"],
          waReference: "SEC-11",
        })
      );
    }
  }

  const pii = pipelineMeta?.piiClassification || contract?.spec?.governance?.piiClassification;
  if (pii === "high" || pii === "restricted") {
    const masks = contract?.spec?.governance?.columnMasks;
    if (!masks || (Array.isArray(masks) && masks.length === 0)) {
      findings.push(
        finding({
          id: "sec.pii_masks",
          severity: "critical",
          pillar: "Data Protection",
          title: "High/restricted PII requires column masks",
          message: `PII classification is "${pii}" but no column masks are defined.`,
          fix: "Add governance.columnMasks in contract or enable masking in transform SparkRules before gold layer.",
          nodeIds: transforms.map((t) => t.id),
          awsServices: ["Lake Formation", "Glue"],
          waReference: "SEC-10",
        })
      );
    }
  }

  if (gates.length === 0 && sinks.length > 0) {
    findings.push(
      finding({
        id: "sec.integrity_gate",
        severity: "high",
        pillar: "Governance",
        title: "No integrity gate before publish",
        message: "Vaquar Pattern requires design-time rules + PVDM verification before Iceberg commit.",
        fix: "Add an Integrity Gate block between transform and sink (or use a pattern with PVDM gate).",
        nodeIds: sinks.map((s) => s.id),
        awsServices: ["Lambda", "Step Functions"],
        waReference: "SEC-01",
      })
    );
  }

  for (const t of transforms) {
    if (t.data?.transformType === "agentic") {
      if (!t.data?.compensationHandler) {
        findings.push(
          finding({
            id: "sec.agentic_compensation",
            severity: "critical",
            pillar: "Reliability",
            title: "Agentic transform missing compensation handler",
            message: "Cognitive/agentic steps must declare rollback for partial failures.",
            fix: "Set compensationHandler ARN (Lambda) for saga-style undo on Bedrock/agent failures.",
            nodeIds: [t.id],
            awsServices: ["Lambda", "Step Functions", "Bedrock"],
            waReference: "REL-07",
          })
        );
      }
      if (!t.data?.idempotencyKey) {
        findings.push(
          finding({
            id: "sec.agentic_idempotency",
            severity: "high",
            pillar: "Reliability",
            title: "Agentic transform missing idempotency key",
            message: "Exactly-once semantics require an idempotency key for agent invocations.",
            fix: "Set idempotencyKey (e.g. order_id or correlation_id column).",
            nodeIds: [t.id],
            awsServices: ["Lambda", "DynamoDB"],
            waReference: "REL-02",
          })
        );
      }
    }
    if (WILDCARD_PRINCIPAL.test(t.data?.iamPolicy || "")) {
      findings.push(
        finding({
          id: "sec.wildcard_iam",
          severity: "critical",
          pillar: "Identity & Access",
          title: "Wildcard IAM policy detected",
          message: "Least-privilege IAM must not use * on Principal or Action.",
          fix: "Scope IAM to specific ARNs: cognimesh-* buckets, glue:GetTable, states:StartExecution.",
          nodeIds: [t.id],
          awsServices: ["IAM"],
          waReference: "SEC-03",
        })
      );
    }
  }

  if (pipelineMeta?.domain && pipelineMeta.domain !== "default" && !pipelineMeta.ownerEmail && !contract?.metadata?.owner?.contact) {
    findings.push(
      finding({
        id: "sec.owner_contact",
        severity: "medium",
        pillar: "Governance",
        title: "Production domain missing owner contact",
        message: "Non-default domains require an accountable owner for access reviews.",
        fix: "Set owner email in pipeline metadata (used for steward approvals and audit).",
        nodeIds: [],
        awsServices: ["Cognito", "CloudTrail"],
        waReference: "SEC-01",
      })
    );
  }

  if (integrityGate?.errors?.length) {
    for (const err of integrityGate.errors) {
      findings.push(
        finding({
          id: `sec.integrity.${err.ruleId || "gate"}`,
          severity: "critical",
          pillar: "Governance",
          title: "Integrity gate failure",
          message: err.message || err.field,
          fix: "Resolve before deploy - integrity gate runs first in Step Functions ASL.",
          nodeIds: [],
          awsServices: ["Lambda", "Step Functions"],
          waReference: "SEC-01",
        })
      );
    }
  }

  if (integrityGate?.warnings?.length) {
    for (const w of integrityGate.warnings) {
      findings.push(
        finding({
          id: `sec.integrity.warn.${w.ruleId || "gate"}`,
          severity: "low",
          pillar: "Governance",
          title: "Integrity gate warning",
          message: w.message || w.field,
          fix: "Address before production deploy.",
          nodeIds: [],
          awsServices: ["Lambda"],
          waReference: "SEC-01",
        })
      );
    }
  }

  const batchMode = pipelineMeta?.executionMode === "batch" || contract?.spec?.execution?.mode === "batch";
  if (batchMode && !nodes.some((n) => n.data?.dlqArn || n.data?.enableDlq)) {
    findings.push(
      finding({
        id: "sec.sqs_dlq",
        severity: "medium",
        pillar: "Reliability",
        title: "Batch pipeline should configure SQS DLQ",
        message: "Terraform provisions a KMS-encrypted DLQ for failed pipeline steps.",
        fix: "Enable DLQ on Step Functions or Glue job failure routing (enableDlq in transform).",
        nodeIds: transforms.map((t) => t.id),
        awsServices: ["SQS", "KMS", "Step Functions"],
        waReference: "REL-05",
      })
    );
  }

  if (!pipelineMeta?.enableLakeFormation && sinks.length > 0 && pipelineMeta?.domain !== "default") {
    findings.push(
      finding({
        id: "sec.lake_formation",
        severity: "medium",
        pillar: "Governance",
        title: "Lake Formation governance not enabled",
        message: "Mesh consumers need LF grants - not bucket ACLs.",
        fix: "Enable Lake Formation module (enable_lake_formation_governance=true) and tag gold tables.",
        nodeIds: sinks.map((s) => s.id),
        awsServices: ["Lake Formation", "Glue"],
        waReference: "SEC-11",
      })
    );
  }

  return { findings, passed: !findings.some((f) => f.severity === "critical" || f.severity === "high") };
}

module.exports = { runSecurityReview };
