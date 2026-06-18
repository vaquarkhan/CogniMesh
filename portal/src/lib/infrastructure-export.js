/**
 * Browser downloads + infrastructure export (mirrors lib/infrastructure-export).
 */

function slugify(value) {
  return (value || "pipeline")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isRdsSource(data) {
  const st = data?.sourceType;
  return st === "rds" || st === "mysql";
}

function isS3LikeSink(data) {
  return data?.blockType === "sink" && (data?.targetType === "s3" || data?.targetType === "iceberg");
}

function isS3Source(data) {
  return data?.blockType === "source" && data?.sourceType === "s3";
}

function rdsMode(data) {
  return data?.rdsProvisioningMode === "existing" ? "existing" : "provision";
}

function sinkMode(data) {
  return data?.sinkProvisioningMode === "existing" ? "existing" : "provision";
}

function s3SourceMode(data) {
  return data?.sourceProvisioningMode === "existing" ? "existing" : "provision";
}

function parseS3Bucket(uri) {
  const match = String(uri || "").trim().match(/^s3:\/\/([a-z0-9.\-_]+)/i);
  return match ? match[1] : null;
}

function terraformResourceId(value) {
  return slugify(value).replace(/-/g, "_");
}

function listProvisionRds(nodes) {
  return (nodes || []).filter(
    (n) => n.data?.blockType === "source" && isRdsSource(n.data) && rdsMode(n.data) === "provision"
  );
}

function collectProvisionS3Buckets(nodes, pipelineMeta) {
  const prefix = slugify(pipelineMeta.name || "cognimesh");
  const domain = slugify(pipelineMeta.domain || "default");
  const buckets = new Map();

  for (const n of nodes || []) {
    const d = n.data || {};
    if (isS3Source(d) && s3SourceMode(d) === "provision") {
      const bucket = parseS3Bucket(d.endpoint) || `cognimesh-${domain}-${prefix}-landing`;
      buckets.set(bucket, { encryption: "AES256", label: d.label || n.id, kind: "source" });
    }
    if (isS3LikeSink(d) && sinkMode(d) === "provision") {
      const bucket =
        parseS3Bucket(d.location) ||
        `cognimesh-${domain}-${prefix}-${slugify(d.catalogTable || d.label || "output")}`;
      buckets.set(bucket, {
        encryption: d.encryption || "AES256",
        label: d.label || n.id,
        kind: "sink",
      });
    }
  }

  return buckets;
}

function appendS3BucketTerraform(lines, bucketName, meta, domain) {
  const id = terraformResourceId(bucketName);
  const sse = meta.encryption === "aws:kms" ? "aws:kms" : "AES256";

  lines.push(
    `# S3 bucket: ${meta.label} (${meta.kind})`,
    `resource "aws_s3_bucket" "${id}" {`,
    `  bucket = "${bucketName}"`,
    `  tags = { ManagedBy = "cognimesh", Domain = "${domain}" }`,
    "}",
    `resource "aws_s3_bucket_server_side_encryption_configuration" "${id}" {`,
    `  bucket = aws_s3_bucket.${id}.id`,
    "  rule { apply_server_side_encryption_by_default {",
    `    sse_algorithm = "${sse}"`,
    "  } }",
    "}",
    `resource "aws_s3_bucket_public_access_block" "${id}" {`,
    `  bucket = aws_s3_bucket.${id}.id`,
    "  block_public_acls = true block_public_policy = true",
    "  ignore_public_acls = true restrict_public_buckets = true",
    "}",
    `output "${id}_bucket_arn" { value = aws_s3_bucket.${id}.arn }`,
    ""
  );
}

export function generatePipelineTerraform({ nodes, pipelineMeta = {} }) {
  const prefix = slugify(pipelineMeta.name || "cognimesh");
  const domain = slugify(pipelineMeta.domain || "default");
  const awsRegion = pipelineMeta.awsRegion || "us-east-1";
  const sources = listProvisionRds(nodes);
  const s3Buckets = collectProvisionS3Buckets(nodes, pipelineMeta);

  if (!sources.length && !s3Buckets.size) {
    return {
      status: "empty",
      message:
        "No resources set to Create new (Terraform). In Properties, choose Create new for RDS, S3 source, or S3/Iceberg sink blocks.",
      hcl: "",
    };
  }

  const lines = [
    `# CogniMesh pipeline infrastructure — ${pipelineMeta.name || prefix}`,
    `# domain: ${domain} · export from portal AWS Design Review`,
    "",
    'terraform {',
    "  required_providers {",
    '    aws = { source = "hashicorp/aws" }',
    '    random = { source = "hashicorp/random" }',
    "  }",
    "}",
    "",
    'provider "aws" { region = var.aws_region }',
    "",
  ];

  for (const src of sources) {
    const d = src.data || {};
    const id = slugify(d.label || src.id);
    const dbName = (d.database || "app_db").replace(/[^a-zA-Z0-9_]/g, "_");
    const port = d.sourceType === "mysql" ? 3306 : 5432;
    const engine = d.sourceType === "mysql" ? "mysql" : "postgres";

    lines.push(
      `# ${d.label || src.id}`,
      `resource "random_password" "${id}_db" { length = 32 special = true }`,
      `resource "aws_secretsmanager_secret" "${id}_db" {`,
      `  name = "${prefix}-${id}-db-credentials"`,
      `  tags = { ManagedBy = "cognimesh", Domain = "${domain}" }`,
      "}",
      `resource "aws_secretsmanager_secret_version" "${id}_db" {`,
      `  secret_id     = aws_secretsmanager_secret.${id}_db.id`,
      "  secret_string = jsonencode({",
      `    username = "cognimesh_${id}"`,
      `    password = random_password.${id}_db.result`,
      `    engine   = "${engine}"`,
      `    host     = aws_db_instance.${id}.address`,
      `    port     = ${port}`,
      `    dbname   = "${dbName}"`,
      "  })",
      "}",
      `resource "aws_security_group" "${id}_db" {`,
      `  name_prefix = "${prefix}-${id}-db-"`,
      "  vpc_id      = var.vpc_id",
      "  ingress {",
      `    from_port = ${port} to_port = ${port} protocol = "tcp"`,
      "    security_groups = [var.glue_security_group_id]",
      "  }",
      "  egress { from_port = 0 to_port = 0 protocol = \"-1\" cidr_blocks = [\"0.0.0.0/0\"] }",
      "}",
      `resource "aws_db_subnet_group" "${id}" {`,
      `  name = "${prefix}-${id}-subnets" subnet_ids = var.private_subnet_ids`,
      "}",
      `resource "aws_db_instance" "${id}" {`,
      `  identifier = "${prefix}-${id}" engine = "${engine}"`,
      "  instance_class = var.db_instance_class publicly_accessible = false storage_encrypted = true",
      `  db_name = "${dbName}" username = "cognimesh_${id}"`,
      `  password = random_password.${id}_db.result`,
      `  db_subnet_group_name = aws_db_subnet_group.${id}.name`,
      `  vpc_security_group_ids = [aws_security_group.${id}_db.id]`,
      "  skip_final_snapshot = true",
      "}",
      `output "${id}_secret_arn" { value = aws_secretsmanager_secret.${id}_db.arn }`,
      ""
    );
  }

  for (const [bucketName, meta] of s3Buckets) {
    appendS3BucketTerraform(lines, bucketName, meta, domain);
  }

  lines.push(
    `variable "aws_region" { type = string default = "${awsRegion}" }`,
    'variable "vpc_id" { type = string }',
    'variable "private_subnet_ids" { type = list(string) }',
    'variable "glue_security_group_id" { type = string }',
    'variable "db_instance_class" { type = string default = "db.t3.micro" }',
    ""
  );

  return { status: "success", hcl: lines.join("\n"), provisionCount: sources.length + s3Buckets.size };
}

function escapeXml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function generateDrawioArchitecture({ topology, nodes = [], pipelineMeta = {} }) {
  const services = topology?.services?.length
    ? topology.services
    : [{ id: "pipeline", type: "sfn", label: pipelineMeta.name || "Pipeline", status: "ok" }];

  const cols = 3;
  const cellW = 160;
  const cellH = 72;
  const gapX = 40;
  const gapY = 50;
  let cellId = 2;
  const cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>'];
  const positions = new Map();

  services.forEach((svc, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = 40 + col * (cellW + gapX);
    const y = 40 + row * (cellH + gapY);
    const id = String(cellId++);
    positions.set(svc.id, id);
    const fill = svc.status === "issue" ? "#fecaca" : "#d1fae5";
    const stroke = svc.status === "issue" ? "#dc2626" : "#059669";
    cells.push(
      `<mxCell id="${id}" value="${escapeXml(svc.label)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=${stroke};" vertex="1" parent="1">`,
      `<mxGeometry x="${x}" y="${y}" width="${cellW}" height="${cellH}" as="geometry"/>`,
      "</mxCell>"
    );
  });

  for (const [from, to] of topology?.connections || []) {
    const source = positions.get(from);
    const target = positions.get(to);
    if (!source || !target) continue;
    const edgeId = String(cellId++);
    cells.push(
      `<mxCell id="${edgeId}" style="edgeStyle=orthogonalEdgeStyle;html=1;strokeColor=#64748b;" edge="1" parent="1" source="${source}" target="${target}">`,
      '<mxGeometry relative="1" as="geometry"/>',
      "</mxCell>"
    );
  }

  const name = escapeXml(pipelineMeta.name || "CogniMesh architecture");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" agent="CogniMesh" version="22.1.0">
  <diagram name="${name}">
    <mxGraphModel>
      <root>
        ${cells.join("\n        ")}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

  return { xml, serviceCount: services.length };
}

export function downloadTextFile(filename, content, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
