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

function listRdsSources(nodes) {
  return (nodes || []).filter(
    (n) => n.data?.blockType === "source" && isRdsSource(n.data)
  );
}

function rdsProvisioningMode(data) {
  return data?.rdsProvisioningMode === "existing" ? "existing" : "provision";
}

/**
 * Generate detailed AWS architecture draw.io diagram with VPC, subnets,
 * NAT gateways, security groups, IAM roles, and all infrastructure.
 */
export function generateDrawioArchitecture({ topology, nodes = [], pipelineMeta = {} }) {
  const region = pipelineMeta.awsRegion || "us-east-1";
  const name = escapeXml(pipelineMeta.name || "CogniMesh architecture");
  const domain = pipelineMeta.domain || "default";
  const vpcMode = pipelineMeta.vpcMode || "create_new";

  let cellId = 2;
  const cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>'];

  function nextId() { return String(cellId++); }

  // ─── Container (group) helper ───
  function addGroup(label, x, y, w, h, style) {
    const id = nextId();
    cells.push(
      `<mxCell id="${id}" value="${escapeXml(label)}" style="${style}" vertex="1" parent="1">`,
      `<mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/>`,
      "</mxCell>"
    );
    return id;
  }

  // ─── Service box inside a parent ───
  function addService(label, x, y, w, h, parent, opts = {}) {
    const id = nextId();
    const fill = opts.fill || "#d1fae5";
    const stroke = opts.stroke || "#059669";
    const fontSize = opts.fontSize || 11;
    cells.push(
      `<mxCell id="${id}" value="${escapeXml(label)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=${stroke};fontSize=${fontSize};" vertex="1" parent="${parent}">`,
      `<mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/>`,
      "</mxCell>"
    );
    return id;
  }

  // ─── Edge ───
  function addEdge(sourceId, targetId, label = "", style = "") {
    const id = nextId();
    const edgeStyle = style || "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;html=1;strokeColor=#64748b;fontSize=9;";
    const valAttr = label ? ` value="${escapeXml(label)}"` : "";
    cells.push(
      `<mxCell id="${id}"${valAttr} style="${edgeStyle}" edge="1" parent="1" source="${sourceId}" target="${targetId}">`,
      '<mxGeometry relative="1" as="geometry"/>',
      "</mxCell>"
    );
    return id;
  }

  // ═══════════════════════════════════════════════════
  // LAYOUT: Full AWS infrastructure diagram
  // ═══════════════════════════════════════════════════

  // Region container
  const regionId = addGroup(
    `AWS Region: ${region}`,
    0, 0, 1200, 900,
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#f0f9ff;strokeColor=#0ea5e9;dashed=1;fontSize=14;verticalAlign=top;fontStyle=1;spacingTop=5;"
  );

  // VPC container
  const vpcLabel = vpcMode === "existing"
    ? `VPC (existing) · ${pipelineMeta.vpcId || "vpc-xxxxxxx"}`
    : "VPC (Terraform-managed) · 10.0.0.0/16";
  const vpcId = addGroup(
    vpcLabel,
    30, 50, 1140, 780,
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#f8fafc;strokeColor=#3b82f6;dashed=1;fontSize=12;verticalAlign=top;fontStyle=1;spacingTop=5;"
  );

  // ─── Public subnets ───
  const pubSubnet1 = addGroup(
    "Public Subnet (AZ-a) · 10.0.1.0/24",
    20, 40, 360, 200,
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#fef3c7;strokeColor=#d97706;dashed=1;fontSize=10;verticalAlign=top;"
  );
  const pubSubnet2 = addGroup(
    "Public Subnet (AZ-b) · 10.0.2.0/24",
    400, 40, 360, 200,
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#fef3c7;strokeColor=#d97706;dashed=1;fontSize=10;verticalAlign=top;"
  );

  // ─── Private subnets ───
  const privSubnet1 = addGroup(
    "Private Subnet (AZ-a) · 10.0.10.0/24",
    20, 270, 540, 470,
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#ede9fe;strokeColor=#7c3aed;dashed=1;fontSize=10;verticalAlign=top;"
  );
  const privSubnet2 = addGroup(
    "Private Subnet (AZ-b) · 10.0.20.0/24",
    580, 270, 540, 470,
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#ede9fe;strokeColor=#7c3aed;dashed=1;fontSize=10;verticalAlign=top;"
  );

  // ─── Public subnet services ───
  const igwId = addService("Internet Gateway", 20, 40, 140, 50, pubSubnet1, { fill: "#bfdbfe", stroke: "#2563eb" });
  const natId = addService("NAT Gateway", 180, 40, 140, 50, pubSubnet1, { fill: "#bfdbfe", stroke: "#2563eb" });
  const albId = addService("ALB / API Gateway", 20, 110, 140, 50, pubSubnet2, { fill: "#bfdbfe", stroke: "#2563eb" });

  // ─── Private subnet 1 services (Data layer) ───
  let yPos = 40;
  const serviceIds = {};

  // RDS
  const rdsSources = listRdsSources(nodes);
  if (rdsSources.length) {
    for (const src of rdsSources) {
      const d = src.data || {};
      const mode = rdsProvisioningMode(d);
      const lbl = `RDS ${d.database || ""} (${mode === "provision" ? "Terraform" : "existing"})`;
      serviceIds.rds = addService(lbl, 20, yPos, 220, 45, privSubnet1, { fill: "#dbeafe", stroke: "#1d4ed8" });
      yPos += 60;
    }
  }

  // Secrets Manager
  serviceIds.secrets = addService("Secrets Manager", 260, 40, 180, 45, privSubnet1, { fill: "#fef9c3", stroke: "#ca8a04" });

  // Glue ETL
  serviceIds.glue = addService("AWS Glue / Spark ETL", 20, yPos, 220, 45, privSubnet1, { fill: "#ccfbf1", stroke: "#0d9488" });
  yPos += 60;

  // Lambda Integrity Gate
  serviceIds.lambda = addService("Lambda: Integrity Gate", 20, yPos, 220, 45, privSubnet1, { fill: "#fed7aa", stroke: "#ea580c" });
  yPos += 60;

  // Step Functions
  serviceIds.sfn = addService("Step Functions (orchestration)", 20, yPos, 220, 45, privSubnet1, { fill: "#e0e7ff", stroke: "#4f46e5" });
  yPos += 60;

  // Kinesis / MSK (if present)
  const hasKinesis = nodes.some((n) => n.data?.sourceType === "kinesis");
  const hasMsk = nodes.some((n) => n.data?.sourceType === "kafka");
  if (hasKinesis) {
    serviceIds.kinesis = addService("Kinesis Data Streams", 260, 100, 180, 45, privSubnet1, { fill: "#cffafe", stroke: "#0891b2" });
  }
  if (hasMsk) {
    serviceIds.msk = addService("Amazon MSK (Kafka)", 260, 155, 180, 45, privSubnet1, { fill: "#e9d5ff", stroke: "#7c3aed" });
  }

  // ─── Private subnet 2 services (Storage & Governance) ───
  let yPos2 = 40;

  // S3 buckets
  const s3Buckets = collectProvisionS3Buckets(nodes, pipelineMeta);
  serviceIds.s3Gold = addService("S3 Gold / Iceberg", 20, yPos2, 200, 45, privSubnet2, { fill: "#d1fae5", stroke: "#059669" });
  yPos2 += 60;
  serviceIds.s3Proof = addService("S3 Proof Bucket (VRP)", 20, yPos2, 200, 45, privSubnet2, { fill: "#d1fae5", stroke: "#059669" });
  yPos2 += 60;

  if (nodes.some((n) => n.data?.sourceType === "s3")) {
    serviceIds.s3Landing = addService("S3 Landing (bronze)", 20, yPos2, 200, 45, privSubnet2, { fill: "#d1fae5", stroke: "#059669" });
    yPos2 += 60;
  }

  // Lake Formation
  serviceIds.lf = addService("Lake Formation (governance)", 20, yPos2, 200, 45, privSubnet2, { fill: "#fce7f3", stroke: "#db2777" });
  yPos2 += 60;

  // Glue Data Catalog
  serviceIds.catalog = addService("Glue Data Catalog", 20, yPos2, 200, 45, privSubnet2, { fill: "#ccfbf1", stroke: "#0d9488" });
  yPos2 += 60;

  // CloudTrail
  serviceIds.cloudtrail = addService("CloudTrail (audit)", 240, 40, 180, 45, privSubnet2, { fill: "#f1f5f9", stroke: "#475569" });

  // CloudWatch
  serviceIds.cw = addService("CloudWatch Logs & Alarms", 240, 100, 180, 45, privSubnet2, { fill: "#f1f5f9", stroke: "#475569" });

  // KMS
  serviceIds.kms = addService("KMS (encryption keys)", 240, 160, 180, 45, privSubnet2, { fill: "#fef9c3", stroke: "#ca8a04" });

  // ─── IAM box (outside VPC, in region) ───
  const iamId = addGroup(
    "IAM Roles & Policies",
    800, 50, 350, 200,
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#fff7ed;strokeColor=#ea580c;dashed=1;fontSize=10;verticalAlign=top;"
  );
  addService("GlueJobRole", 10, 30, 150, 35, iamId, { fill: "#fed7aa", stroke: "#ea580c", fontSize: 9 });
  addService("LambdaExecRole", 170, 30, 150, 35, iamId, { fill: "#fed7aa", stroke: "#ea580c", fontSize: 9 });
  addService("StepFunctionsRole", 10, 75, 150, 35, iamId, { fill: "#fed7aa", stroke: "#ea580c", fontSize: 9 });
  addService("LakeFormationAdmin", 170, 75, 150, 35, iamId, { fill: "#fed7aa", stroke: "#ea580c", fontSize: 9 });
  if (hasKinesis || hasMsk) {
    addService("StreamConsumerRole", 10, 120, 150, 35, iamId, { fill: "#fed7aa", stroke: "#ea580c", fontSize: 9 });
  }

  // ─── Security Groups box ───
  const sgId = addGroup(
    "Security Groups",
    800, 270, 350, 150,
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#fef2f2;strokeColor=#dc2626;dashed=1;fontSize=10;verticalAlign=top;"
  );
  addService("sg-rds (3306/5432 from Glue SG)", 10, 30, 310, 30, sgId, { fill: "#fecaca", stroke: "#dc2626", fontSize: 9 });
  addService("sg-glue (VPC endpoints)", 10, 70, 310, 30, sgId, { fill: "#fecaca", stroke: "#dc2626", fontSize: 9 });
  addService("sg-lambda (VPC attached)", 10, 110, 310, 30, sgId, { fill: "#fecaca", stroke: "#dc2626", fontSize: 9 });

  // ─── Connections ───
  if (serviceIds.rds && serviceIds.secrets) addEdge(serviceIds.rds, serviceIds.secrets, "credentials");
  if (serviceIds.rds && serviceIds.glue) addEdge(serviceIds.rds, serviceIds.glue, "CDC extract");
  if (serviceIds.glue && serviceIds.lambda) addEdge(serviceIds.glue, serviceIds.lambda, "quality gate");
  if (serviceIds.lambda && serviceIds.sfn) addEdge(serviceIds.lambda, serviceIds.sfn, "orchestrate");
  if (serviceIds.sfn && serviceIds.s3Gold) addEdge(serviceIds.sfn, serviceIds.s3Gold, "write gold");
  if (serviceIds.s3Gold && serviceIds.lf) addEdge(serviceIds.s3Gold, serviceIds.lf, "governed");
  if (serviceIds.s3Gold && serviceIds.catalog) addEdge(serviceIds.s3Gold, serviceIds.catalog, "register");
  if (serviceIds.kinesis && serviceIds.glue) addEdge(serviceIds.kinesis, serviceIds.glue, "stream ingest");
  if (serviceIds.msk && serviceIds.glue) addEdge(serviceIds.msk, serviceIds.glue, "consume");
  if (serviceIds.lambda && serviceIds.s3Proof) addEdge(serviceIds.lambda, serviceIds.s3Proof, "VRP proof");
  addEdge(igwId, natId, "");
  addEdge(natId, serviceIds.glue || serviceIds.sfn, "outbound");

  // ─── Metadata note ───
  const noteId = nextId();
  const noteLines = [
    `Pipeline: ${pipelineMeta.name || "—"}`,
    `Domain: ${domain}`,
    `Region: ${region}`,
    `VPC: ${vpcMode === "existing" ? "existing" : "Terraform-provisioned"}`,
    `Encryption: AES256 / KMS at rest`,
    `Provisioned: ${rdsSources.filter((n) => rdsProvisioningMode(n.data) === "provision").length} RDS, ${s3Buckets.size} S3`,
  ].join("\\n");
  cells.push(
    `<mxCell id="${noteId}" value="${escapeXml(noteLines)}" style="text;html=1;fontSize=9;fillColor=none;align=left;verticalAlign=top;" vertex="1" parent="1">`,
    '<mxGeometry x="30" y="860" width="400" height="80" as="geometry"/>',
    "</mxCell>"
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" agent="CogniMesh" version="22.1.0">
  <diagram name="${name}">
    <mxGraphModel dx="1422" dy="920" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1200" pageHeight="900" math="0" shadow="0">
      <root>
        ${cells.join("\n        ")}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

  return { xml, serviceCount: Object.keys(serviceIds).length + 10 };
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
