/**
 * Browser downloads + infrastructure export (mirrors lib/infrastructure-export).
 * Dynamic draw.io export reads actual canvas nodes to build diagrams.
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
 * Analyze canvas nodes to determine which AWS services are present.
 * Returns a capabilities object describing the pipeline composition.
 */
function analyzeCanvasNodes(nodes) {
  const caps = {
    rdsSources: [],
    kinesisSources: [],
    kafkaSources: [],
    s3Sources: [],
    glueTransforms: [],
    sparkTransforms: [],
    firehosePassthroughs: [],
    integrityGates: [],
    s3Sinks: [],
    icebergSinks: [],
    redshiftSinks: [],
    dynamodbSinks: [],
    allSources: [],
    allTransforms: [],
    allSinks: [],
    hasRds: false,
    hasKinesis: false,
    hasKafka: false,
    hasS3Source: false,
    hasGlue: false,
    hasSpark: false,
    hasFirehose: false,
    hasIntegrityGate: false,
    hasS3Sink: false,
    hasIceberg: false,
    hasRedshift: false,
    hasDynamoDB: false,
  };

  for (const n of nodes || []) {
    const d = n.data || {};
    const blockType = d.blockType;

    if (blockType === "source") {
      caps.allSources.push(n);
      if (isRdsSource(d)) { caps.rdsSources.push(n); caps.hasRds = true; }
      else if (d.sourceType === "kinesis") { caps.kinesisSources.push(n); caps.hasKinesis = true; }
      else if (d.sourceType === "kafka") { caps.kafkaSources.push(n); caps.hasKafka = true; }
      else if (d.sourceType === "s3") { caps.s3Sources.push(n); caps.hasS3Source = true; }
    } else if (blockType === "transform") {
      caps.allTransforms.push(n);
      if (d.transformType === "glue_etl" || d.transformType === "spark_sql") {
        caps.glueTransforms.push(n);
        caps.hasGlue = true;
      }
      if (d.transformType === "spark_sql") { caps.sparkTransforms.push(n); caps.hasSpark = true; }
    } else if (blockType === "sink") {
      caps.allSinks.push(n);
      if (d.targetType === "s3") { caps.s3Sinks.push(n); caps.hasS3Sink = true; }
      else if (d.targetType === "iceberg") { caps.icebergSinks.push(n); caps.hasIceberg = true; }
      else if (d.targetType === "redshift") { caps.redshiftSinks.push(n); caps.hasRedshift = true; }
      else if (d.targetType === "dynamodb") { caps.dynamodbSinks.push(n); caps.hasDynamoDB = true; }
    } else if (blockType === "integrity_gate") {
      caps.integrityGates.push(n);
      caps.hasIntegrityGate = true;
    } else if (blockType === "passthrough" || blockType === "connector") {
      if (d.awsService === "firehose" || d.transformType === "firehose") {
        caps.firehosePassthroughs.push(n);
        caps.hasFirehose = true;
      }
    }
  }

  return caps;
}

/**
 * Generate detailed AWS architecture draw.io diagram DYNAMICALLY based on
 * actual canvas nodes. Only shows services that are present on the canvas.
 * Handles edge cases: empty nodes produces a minimal diagram, partial
 * configurations don't crash. Always produces valid XML.
 */
export function generateDrawioArchitecture({ topology, nodes = [], pipelineMeta = {} }) {
  const region = pipelineMeta.awsRegion || "us-east-1";
  const name = escapeXml(pipelineMeta.name || "CogniMesh architecture");
  const domain = pipelineMeta.domain || "default";
  const vpcMode = pipelineMeta.vpcMode || "create_new";

  // Analyze what's actually on the canvas
  const caps = analyzeCanvasNodes(nodes);

  let cellId = 2;
  const cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>'];

  function nextId() { return String(cellId++); }

  function addGroup(label, x, y, w, h, style) {
    const id = nextId();
    cells.push(
      `<mxCell id="${id}" value="${escapeXml(label)}" style="${style}" vertex="1" parent="1">`,
      `<mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/>`,
      "</mxCell>"
    );
    return id;
  }

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

  function addEdge(sourceId, targetId, label, style) {
    if (!sourceId || !targetId) return null;
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
  // LAYOUT: Dynamic AWS infrastructure based on canvas nodes
  // ═══════════════════════════════════════════════════

  // Determine diagram height based on content
  const hasAnyContent = nodes.length > 0;
  const diagramHeight = hasAnyContent ? 900 : 400;
  const diagramWidth = 1200;

  // Region container
  addGroup(
    `AWS Region: ${region}`,
    0, 0, diagramWidth, diagramHeight,
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#f0f9ff;strokeColor=#0ea5e9;dashed=1;fontSize=14;verticalAlign=top;fontStyle=1;spacingTop=5;"
  );

  // VPC container
  const vpcLabel = vpcMode === "existing"
    ? `VPC (existing) · ${pipelineMeta.vpcId || "vpc-xxxxxxx"}`
    : "VPC (Terraform-managed) · 10.0.0.0/16";
  const vpcContainerId = addGroup(
    vpcLabel,
    30, 50, diagramWidth - 60, diagramHeight - 80,
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#f8fafc;strokeColor=#3b82f6;dashed=1;fontSize=12;verticalAlign=top;fontStyle=1;spacingTop=5;"
  );

  const serviceIds = {};

  // ─── Public subnets (always shown for VPC context) ───
  const pubSubnet1 = addGroup(
    "Public Subnet (AZ-a) · 10.0.1.0/24",
    20, 40, 360, 160,
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#fef3c7;strokeColor=#d97706;dashed=1;fontSize=10;verticalAlign=top;"
  );

  const igwId = addService("Internet Gateway", 20, 35, 140, 45, pubSubnet1, { fill: "#bfdbfe", stroke: "#2563eb" });
  const natId = addService("NAT Gateway", 180, 35, 140, 45, pubSubnet1, { fill: "#bfdbfe", stroke: "#2563eb" });
  addEdge(igwId, natId, "");

  if (hasAnyContent) {
    const pubSubnet2 = addGroup(
      "Public Subnet (AZ-b) · 10.0.2.0/24",
      400, 40, 360, 160,
      "rounded=1;whiteSpace=wrap;html=1;fillColor=#fef3c7;strokeColor=#d97706;dashed=1;fontSize=10;verticalAlign=top;"
    );
    addService("ALB / API Gateway", 20, 35, 160, 45, pubSubnet2, { fill: "#bfdbfe", stroke: "#2563eb" });
  }

  // ─── If no nodes, produce minimal diagram ───
  if (!hasAnyContent) {
    const noteId = nextId();
    cells.push(
      `<mxCell id="${noteId}" value="${escapeXml("No pipeline blocks on canvas.\\nAdd sources, transforms, and sinks to generate a full architecture diagram.")}" style="text;html=1;fontSize=11;fillColor=none;align=center;verticalAlign=middle;" vertex="1" parent="1">`,
      `<mxGeometry x="300" y="240" width="600" height="60" as="geometry"/>`,
      "</mxCell>"
    );

    return {
      xml: buildXml(name, cells, diagramWidth, diagramHeight),
      serviceCount: 2,
    };
  }

  // ─── Private subnet 1: Compute & Ingestion ───
  const privSubnet1 = addGroup(
    "Private Subnet (AZ-a) · 10.0.10.0/24",
    20, 230, 540, 470,
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#ede9fe;strokeColor=#7c3aed;dashed=1;fontSize=10;verticalAlign=top;"
  );

  // ─── Private subnet 2: Storage & Governance ───
  const privSubnet2 = addGroup(
    "Private Subnet (AZ-b) · 10.0.20.0/24",
    580, 230, 540, 470,
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#ede9fe;strokeColor=#7c3aed;dashed=1;fontSize=10;verticalAlign=top;"
  );

  // ═══════════════════════════════════════════════════
  // PRIVATE SUBNET 1: Compute services based on actual nodes
  // ═══════════════════════════════════════════════════
  let yPos = 40;
  let rightCol = 40; // y-offset for right column in privSubnet1

  // RDS sources — one box per actual RDS source on the canvas
  if (caps.hasRds) {
    for (const src of caps.rdsSources) {
      const d = src.data || {};
      const mode = rdsProvisioningMode(d);
      const lbl = `RDS: ${d.label || d.database || src.id} (${mode === "provision" ? "Terraform" : "existing"})`;
      serviceIds.rds = addService(lbl, 20, yPos, 230, 45, privSubnet1, { fill: "#dbeafe", stroke: "#1d4ed8" });
      yPos += 55;
    }
    // Secrets Manager needed for RDS
    serviceIds.secrets = addService("Secrets Manager", 270, rightCol, 200, 45, privSubnet1, { fill: "#fef9c3", stroke: "#ca8a04" });
    rightCol += 55;
  }

  // Kinesis Data Streams
  if (caps.hasKinesis) {
    for (const src of caps.kinesisSources) {
      const lbl = `Kinesis Data Streams: ${src.data?.label || src.id}`;
      serviceIds.kinesis = addService(lbl, 20, yPos, 230, 45, privSubnet1, { fill: "#cffafe", stroke: "#0891b2" });
      yPos += 55;
    }
  }

  // Amazon MSK (Kafka)
  if (caps.hasKafka) {
    for (const src of caps.kafkaSources) {
      const lbl = `Amazon MSK: ${src.data?.label || src.id}`;
      serviceIds.msk = addService(lbl, 20, yPos, 230, 45, privSubnet1, { fill: "#e9d5ff", stroke: "#7c3aed" });
      yPos += 55;
    }
  }

  // Firehose passthrough
  if (caps.hasFirehose) {
    serviceIds.firehose = addService("Kinesis Data Firehose", 270, rightCol, 200, 45, privSubnet1, { fill: "#cffafe", stroke: "#0891b2" });
    rightCol += 55;
  }

  // Glue ETL / Spark transforms
  if (caps.hasGlue) {
    const glueCount = caps.glueTransforms.length;
    const lbl = glueCount > 1 ? `AWS Glue ETL (${glueCount} jobs)` : "AWS Glue / Spark ETL";
    serviceIds.glue = addService(lbl, 20, yPos, 230, 45, privSubnet1, { fill: "#ccfbf1", stroke: "#0d9488" });
    yPos += 55;
  }

  // Lambda Integrity Gate (only if integrity_gate block exists)
  if (caps.hasIntegrityGate) {
    const gateCount = caps.integrityGates.length;
    const lbl = gateCount > 1 ? `Lambda: Integrity Gate (${gateCount})` : "Lambda: Integrity Gate";
    serviceIds.lambda = addService(lbl, 20, yPos, 230, 45, privSubnet1, { fill: "#fed7aa", stroke: "#ea580c" });
    yPos += 55;
    // PVDM proof storage
    serviceIds.pvdmProof = addService("PVDM Proof (VRP)", 270, rightCol, 200, 45, privSubnet1, { fill: "#d1fae5", stroke: "#059669" });
    rightCol += 55;
  }

  // Step Functions (if there are transforms or integrity gates to orchestrate)
  if (caps.allTransforms.length > 0 || caps.hasIntegrityGate) {
    serviceIds.sfn = addService("Step Functions (orchestration)", 20, yPos, 230, 45, privSubnet1, { fill: "#e0e7ff", stroke: "#4f46e5" });
    yPos += 55;
  }

  // ═══════════════════════════════════════════════════
  // PRIVATE SUBNET 2: Storage & Governance based on actual sinks
  // ═══════════════════════════════════════════════════
  let yPos2 = 40;
  let rightCol2 = 40;

  // S3 source landing bucket
  if (caps.hasS3Source) {
    const srcCount = caps.s3Sources.length;
    const lbl = srcCount > 1 ? `S3 Landing (${srcCount} buckets)` : "S3 Landing (bronze)";
    serviceIds.s3Landing = addService(lbl, 20, yPos2, 210, 45, privSubnet2, { fill: "#d1fae5", stroke: "#059669" });
    yPos2 += 55;
  }

  // S3 sinks
  if (caps.hasS3Sink) {
    for (const sink of caps.s3Sinks) {
      const lbl = `S3: ${sink.data?.label || sink.data?.catalogTable || sink.id}`;
      serviceIds.s3Sink = addService(lbl, 20, yPos2, 210, 45, privSubnet2, { fill: "#d1fae5", stroke: "#059669" });
      yPos2 += 55;
    }
  }

  // Iceberg sinks
  if (caps.hasIceberg) {
    for (const sink of caps.icebergSinks) {
      const lbl = `Iceberg: ${sink.data?.label || sink.data?.catalogTable || sink.id}`;
      serviceIds.s3Gold = addService(lbl, 20, yPos2, 210, 45, privSubnet2, { fill: "#d1fae5", stroke: "#059669" });
      yPos2 += 55;
    }
  }

  // Redshift sinks
  if (caps.hasRedshift) {
    for (const sink of caps.redshiftSinks) {
      const lbl = `Redshift: ${sink.data?.label || sink.id}`;
      serviceIds.redshift = addService(lbl, 20, yPos2, 210, 45, privSubnet2, { fill: "#dbeafe", stroke: "#1d4ed8" });
      yPos2 += 55;
    }
  }

  // DynamoDB sinks
  if (caps.hasDynamoDB) {
    for (const sink of caps.dynamodbSinks) {
      const lbl = `DynamoDB: ${sink.data?.label || sink.id}`;
      serviceIds.dynamodb = addService(lbl, 20, yPos2, 210, 45, privSubnet2, { fill: "#fef9c3", stroke: "#ca8a04" });
      yPos2 += 55;
    }
  }

  // Lake Formation (show if any sinks present — governance layer)
  if (caps.allSinks.length > 0) {
    serviceIds.lf = addService("Lake Formation (governance)", 20, yPos2, 210, 45, privSubnet2, { fill: "#fce7f3", stroke: "#db2777" });
    yPos2 += 55;
  }

  // Glue Data Catalog (show if Glue transforms or Iceberg sinks)
  if (caps.hasGlue || caps.hasIceberg) {
    serviceIds.catalog = addService("Glue Data Catalog", 20, yPos2, 210, 45, privSubnet2, { fill: "#ccfbf1", stroke: "#0d9488" });
    yPos2 += 55;
  }

  // Observability (always shown when there are any services)
  serviceIds.cw = addService("CloudWatch Logs & Alarms", 250, rightCol2, 200, 45, privSubnet2, { fill: "#f1f5f9", stroke: "#475569" });
  rightCol2 += 55;
  serviceIds.cloudtrail = addService("CloudTrail (audit)", 250, rightCol2, 200, 45, privSubnet2, { fill: "#f1f5f9", stroke: "#475569" });
  rightCol2 += 55;

  // KMS (show if any encrypted storage)
  if (caps.hasS3Sink || caps.hasIceberg || caps.hasRds) {
    serviceIds.kms = addService("KMS (encryption keys)", 250, rightCol2, 200, 45, privSubnet2, { fill: "#fef9c3", stroke: "#ca8a04" });
    rightCol2 += 55;
  }

  // ═══════════════════════════════════════════════════
  // IAM Roles — only for services that exist
  // ═══════════════════════════════════════════════════
  const iamRoles = [];
  if (caps.hasGlue) iamRoles.push("GlueJobRole");
  if (caps.hasIntegrityGate) iamRoles.push("LambdaExecRole");
  if (caps.allTransforms.length > 0 || caps.hasIntegrityGate) iamRoles.push("StepFunctionsRole");
  if (caps.allSinks.length > 0) iamRoles.push("LakeFormationAdmin");
  if (caps.hasKinesis || caps.hasKafka) iamRoles.push("StreamConsumerRole");
  if (caps.hasFirehose) iamRoles.push("FirehoseDeliveryRole");
  if (caps.hasRedshift) iamRoles.push("RedshiftSpectrumRole");

  if (iamRoles.length > 0) {
    const iamH = Math.max(80, 30 + Math.ceil(iamRoles.length / 2) * 45);
    const iamId = addGroup(
      "IAM Roles & Policies",
      800, 50, 350, iamH,
      "rounded=1;whiteSpace=wrap;html=1;fillColor=#fff7ed;strokeColor=#ea580c;dashed=1;fontSize=10;verticalAlign=top;"
    );
    iamRoles.forEach((role, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      addService(role, 10 + col * 170, 30 + row * 45, 155, 35, iamId, { fill: "#fed7aa", stroke: "#ea580c", fontSize: 9 });
    });
  }

  // ═══════════════════════════════════════════════════
  // Security Groups — only for services that need them
  // ═══════════════════════════════════════════════════
  const sgRules = [];
  if (caps.hasRds) sgRules.push("sg-rds (3306/5432 from Glue SG)");
  if (caps.hasGlue) sgRules.push("sg-glue (VPC endpoints)");
  if (caps.hasIntegrityGate) sgRules.push("sg-lambda (VPC attached)");
  if (caps.hasKinesis || caps.hasKafka) sgRules.push("sg-streaming (consumer ports)");
  if (caps.hasRedshift) sgRules.push("sg-redshift (5439 from Glue SG)");

  if (sgRules.length > 0) {
    const sgH = 30 + sgRules.length * 40;
    const sgId = addGroup(
      "Security Groups",
      800, 270, 350, sgH,
      "rounded=1;whiteSpace=wrap;html=1;fillColor=#fef2f2;strokeColor=#dc2626;dashed=1;fontSize=10;verticalAlign=top;"
    );
    sgRules.forEach((rule, i) => {
      addService(rule, 10, 30 + i * 40, 310, 30, sgId, { fill: "#fecaca", stroke: "#dc2626", fontSize: 9 });
    });
  }

  // ═══════════════════════════════════════════════════
  // Connections — based on what's actually wired up
  // ═══════════════════════════════════════════════════
  if (serviceIds.rds && serviceIds.secrets) addEdge(serviceIds.rds, serviceIds.secrets, "credentials");
  if (serviceIds.rds && serviceIds.glue) addEdge(serviceIds.rds, serviceIds.glue, "CDC extract");
  if (serviceIds.kinesis && serviceIds.glue) addEdge(serviceIds.kinesis, serviceIds.glue, "stream ingest");
  if (serviceIds.kinesis && serviceIds.firehose) addEdge(serviceIds.kinesis, serviceIds.firehose, "delivery");
  if (serviceIds.msk && serviceIds.glue) addEdge(serviceIds.msk, serviceIds.glue, "consume");
  if (serviceIds.s3Landing && serviceIds.glue) addEdge(serviceIds.s3Landing, serviceIds.glue, "read");
  if (serviceIds.glue && serviceIds.lambda) addEdge(serviceIds.glue, serviceIds.lambda, "quality gate");
  if (serviceIds.glue && serviceIds.sfn) addEdge(serviceIds.glue, serviceIds.sfn, "orchestrate");
  if (serviceIds.lambda && serviceIds.sfn) addEdge(serviceIds.lambda, serviceIds.sfn, "orchestrate");
  if (serviceIds.lambda && serviceIds.pvdmProof) addEdge(serviceIds.lambda, serviceIds.pvdmProof, "VRP proof");
  if (serviceIds.sfn && serviceIds.s3Gold) addEdge(serviceIds.sfn, serviceIds.s3Gold, "write gold");
  if (serviceIds.sfn && serviceIds.s3Sink) addEdge(serviceIds.sfn, serviceIds.s3Sink, "write");
  if (serviceIds.sfn && serviceIds.redshift) addEdge(serviceIds.sfn, serviceIds.redshift, "load");
  if (serviceIds.sfn && serviceIds.dynamodb) addEdge(serviceIds.sfn, serviceIds.dynamodb, "put");
  if (serviceIds.firehose && (serviceIds.s3Sink || serviceIds.s3Gold)) {
    addEdge(serviceIds.firehose, serviceIds.s3Sink || serviceIds.s3Gold, "deliver");
  }
  if (serviceIds.s3Gold && serviceIds.lf) addEdge(serviceIds.s3Gold, serviceIds.lf, "governed");
  if (serviceIds.s3Gold && serviceIds.catalog) addEdge(serviceIds.s3Gold, serviceIds.catalog, "register");
  if (serviceIds.s3Sink && serviceIds.lf) addEdge(serviceIds.s3Sink, serviceIds.lf, "governed");
  // NAT → compute
  const firstCompute = serviceIds.glue || serviceIds.lambda || serviceIds.sfn;
  if (firstCompute) addEdge(natId, firstCompute, "outbound");

  // ─── Metadata note ───
  const s3Buckets = collectProvisionS3Buckets(nodes, pipelineMeta);
  const rdsSources = listRdsSources(nodes);
  const noteId = nextId();
  const noteLines = [
    `Pipeline: ${pipelineMeta.name || "—"}`,
    `Domain: ${domain}`,
    `Region: ${region}`,
    `VPC: ${vpcMode === "existing" ? "existing" : "Terraform-provisioned"}`,
    `Sources: ${caps.allSources.length} · Transforms: ${caps.allTransforms.length} · Sinks: ${caps.allSinks.length}`,
    `Provisioned: ${rdsSources.filter((n) => rdsProvisioningMode(n.data) === "provision").length} RDS, ${s3Buckets.size} S3`,
  ].join("\\n");
  cells.push(
    `<mxCell id="${noteId}" value="${escapeXml(noteLines)}" style="text;html=1;fontSize=9;fillColor=none;align=left;verticalAlign=top;" vertex="1" parent="1">`,
    `<mxGeometry x="30" y="${diagramHeight - 50}" width="500" height="80" as="geometry"/>`,
    "</mxCell>"
  );

  const xml = buildXml(name, cells, diagramWidth, diagramHeight);
  return { xml, serviceCount: Object.keys(serviceIds).length };
}

function buildXml(name, cells, width, height) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" agent="CogniMesh" version="22.1.0">
  <diagram name="${name}">
    <mxGraphModel dx="1422" dy="920" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${width}" pageHeight="${height}" math="0" shadow="0">
      <root>
        ${cells.join("\n        ")}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
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
