/** Resource provisioning defaults and wizard state — create-first, existing optional. */

export const PROVISION = "provision";
export const EXISTING = "existing";

export function isRdsSource(data) {
  const st = data?.sourceType;
  return st === "rds" || st === "mysql";
}

export function isS3LikeSink(data) {
  return data?.blockType === "sink" && (data?.targetType === "s3" || data?.targetType === "iceberg");
}

export function isS3Source(data) {
  return data?.blockType === "source" && data?.sourceType === "s3";
}

/** Unset mode defaults to create (provision). */
export function resolveRdsMode(data) {
  return data?.rdsProvisioningMode === EXISTING ? EXISTING : PROVISION;
}

export function resolveSinkMode(data) {
  return data?.sinkProvisioningMode === EXISTING ? EXISTING : PROVISION;
}

export function resolveS3SourceMode(data) {
  return data?.sourceProvisioningMode === EXISTING ? EXISTING : PROVISION;
}

export function normalizeNodeData(data) {
  if (!data || typeof data !== "object") return data;
  const d = { ...data };

  if (d.blockType === "source" && isRdsSource(d)) {
    if (!d.rdsProvisioningMode) d.rdsProvisioningMode = PROVISION;
  }
  if (isS3LikeSink(d)) {
    if (!d.sinkProvisioningMode) d.sinkProvisioningMode = PROVISION;
    if (resolveSinkMode(d) === PROVISION && !d.encryption) d.encryption = "AES256";
  }
  if (isS3Source(d)) {
    if (!d.sourceProvisioningMode) d.sourceProvisioningMode = PROVISION;
  }

  return d;
}

export function normalizeGraphNodes(nodes) {
  return (nodes || []).map((n) => ({
    ...n,
    data: normalizeNodeData(n.data),
  }));
}

export function rdsWizardSteps(data) {
  const mode = resolveRdsMode(data);
  const steps = [];

  steps.push({
    id: "mode",
    label: "Database",
    complete: true,
    hint:
      mode === PROVISION
        ? "Create new — Terraform will provision RDS + Secrets Manager"
        : "Use existing — you'll paste connection ARNs next",
  });

  const schemaOk = Boolean(data?.database?.trim() && data?.table?.trim());
  steps.push({
    id: "schema",
    label: "Schema",
    complete: schemaOk,
    hint: schemaOk ? `${data.database}.${data.table}` : "Enter database and table names",
  });

  if (mode === EXISTING) {
    const secretOk = /^arn:aws:secretsmanager:/.test(data?.secretArn || "");
    steps.push({
      id: "credentials",
      label: "Credentials",
      complete: secretOk,
      hint: secretOk ? "Secrets Manager ARN set" : "Paste your Secrets Manager ARN (no passwords in the canvas)",
    });
    const networkOk = Boolean(data?.vpcSecurityGroup?.trim() || data?.privateSubnet);
    steps.push({
      id: "network",
      label: "Network",
      complete: networkOk,
      optional: true,
      hint: networkOk ? "VPC settings recorded" : "Optional: VPC security group for private RDS",
    });
  } else {
    steps.push({
      id: "terraform",
      label: "Deploy",
      complete: schemaOk,
      hint: schemaOk
        ? "Ready — export Terraform from AWS Design Review before deploy"
        : "Finish schema, then export Terraform from Design Review",
    });
  }

  return steps;
}

export function sinkWizardSteps(data) {
  const mode = resolveSinkMode(data);
  const steps = [
    {
      id: "mode",
      label: "Storage",
      complete: true,
      hint:
        mode === PROVISION
          ? "Create new — Terraform provisions an encrypted S3 bucket"
          : "Use existing — provide your s3:// path",
    },
  ];

  const locOk =
    mode === PROVISION
      ? Boolean(data?.location?.trim() || data?.catalogTable?.trim())
      : Boolean(data?.location?.startsWith("s3://"));
  steps.push({
    id: "location",
    label: "Target path",
    complete: locOk,
    hint: locOk ? data.location || "Path from catalog" : "Set S3 path or accept suggested path",
  });

  const encOk = Boolean(data?.encryption);
  steps.push({
    id: "encryption",
    label: "Encryption",
    complete: encOk,
    hint: encOk ? data.encryption : "AES256 applied automatically for new buckets",
  });

  return steps;
}

export function s3SourceWizardSteps(data) {
  const mode = resolveS3SourceMode(data);
  return [
    {
      id: "mode",
      label: "Bucket",
      complete: true,
      hint: mode === PROVISION ? "Create new landing bucket via Terraform" : "Use existing S3 prefix",
    },
    {
      id: "path",
      label: "S3 path",
      complete: mode === PROVISION ? true : Boolean(data?.endpoint?.startsWith("s3://")),
      hint:
        mode === PROVISION
          ? "Suggested prefix — override if needed"
          : "Enter s3://bucket/prefix/ for your landing zone",
    },
  ];
}

export function isRdsSetupComplete(data) {
  return rdsWizardSteps(data).every((s) => s.complete || s.optional);
}

export function isSinkSetupComplete(data) {
  return sinkWizardSteps(data).every((s) => s.complete);
}

export function suggestedS3Location(pipelineMeta, data) {
  const domain = (pipelineMeta?.domain || "default").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const name = (pipelineMeta?.name || "pipeline").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const table = (data?.catalogTable || "output").replace(/[^a-z0-9-_]/gi, "-").toLowerCase();
  return `s3://cognimesh-${domain}-${name}/${table}/`;
}

export function suggestedS3SourceEndpoint(pipelineMeta) {
  const domain = (pipelineMeta?.domain || "default").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  return `s3://cognimesh-${domain}-landing/raw/`;
}
