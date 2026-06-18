"use strict";

/** @typedef {"existing" | "provision"} RdsProvisioningMode */

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

function rdsProvisioningMode(data) {
  return data?.rdsProvisioningMode === "provision" ? "provision" : "existing";
}

function listRdsSources(nodes) {
  return (nodes || []).filter((n) => n.data?.blockType === "source" && isRdsSource(n.data));
}

/**
 * Terraform snippets for sources marked rdsProvisioningMode=provision.
 * Wired into pipeline deploy / export — not manual ARN entry.
 */
function generatePipelineTerraform({ nodes, pipelineMeta = {} }) {
  const prefix = slugify(pipelineMeta.name || "cognimesh");
  const domain = slugify(pipelineMeta.domain || "default");
  const rdsSources = listRdsSources(nodes).filter(
    (n) => rdsProvisioningMode(n.data) === "provision"
  );

  if (!rdsSources.length) {
    return {
      status: "empty",
      message:
        "No RDS sources set to Create new (Terraform). Select an RDS source → Properties → RDS database → Create new.",
      hcl: "",
      files: [],
    };
  }

  const blocks = [
    `# CogniMesh pipeline infrastructure — ${pipelineMeta.name || prefix}`,
    `# Generated from canvas · domain: ${domain}`,
    `# Apply with your VPC module outputs (private_subnet_ids, vpc_id).`,
    "",
    'terraform {',
    '  required_providers {',
    "    aws = { source = \"hashicorp/aws\" }",
    "    random = { source = \"hashicorp/random\" }",
    "  }",
    "}",
    "",
  ];

  const files = [];

  for (const src of rdsSources) {
    const d = src.data || {};
    const id = slugify(d.label || src.id);
    const dbName = (d.database || "app_db").replace(/[^a-zA-Z0-9_]/g, "_");
    const secretName = `${prefix}-${id}-db-credentials`;

    blocks.push(
      `# --- RDS source: ${d.label || src.id} (${d.sourceType}) ---`,
      "",
      `resource "random_password" "${id}_db" {`,
      "  length  = 32",
      "  special = true",
      "}",
      "",
      `resource "aws_secretsmanager_secret" "${id}_db" {`,
      `  name = "${secretName}"`,
      "  tags = { ManagedBy = \"cognimesh\", Domain = \"" + domain + "\" }",
      "}",
      "",
      `resource "aws_secretsmanager_secret_version" "${id}_db" {`,
      `  secret_id = aws_secretsmanager_secret.${id}_db.id`,
      "  secret_string = jsonencode({",
      `    username = "cognimesh_${id}"`,
      `    password = random_password.${id}_db.result`,
      `    engine   = "${d.sourceType === "mysql" ? "mysql" : "postgres"}"`,
      `    host     = aws_db_instance.${id}.address`,
      `    port     = aws_db_instance.${id}.port`,
      `    dbname   = "${dbName}"`,
      "  })",
      "}",
      "",
      `resource "aws_security_group" "${id}_db" {`,
      "  name_prefix = \"" + prefix + "-" + id + "-db-\"",
      "  vpc_id      = var.vpc_id",
      "",
      "  ingress {",
      "    from_port       = " + (d.sourceType === "mysql" ? 3306 : 5432),
      "    to_port         = " + (d.sourceType === "mysql" ? 3306 : 5432),
      "    protocol        = \"tcp\"",
      "    security_groups = [var.glue_security_group_id]",
      "  }",
      "",
      "  egress {",
      "    from_port   = 0",
      "    to_port     = 0",
      "    protocol    = \"-1\"",
      "    cidr_blocks = [\"0.0.0.0/0\"]",
      "  }",
      "}",
      "",
      `resource "aws_db_subnet_group" "${id}" {`,
      `  name       = "${prefix}-${id}-subnets"`,
      "  subnet_ids = var.private_subnet_ids",
      "}",
      "",
      `resource "aws_db_instance" "${id}" {`,
      `  identifier             = "${prefix}-${id}"`,
      `  engine                 = "${d.sourceType === "mysql" ? "mysql" : "postgres"}"`,
      "  engine_version         = var.db_engine_version",
      "  instance_class         = var.db_instance_class",
      `  db_name                = "${dbName}"`,
      `  username               = "cognimesh_${id}"`,
      `  password               = random_password.${id}_db.result`,
      "  db_subnet_group_name   = aws_db_subnet_group." + id + ".name",
      "  vpc_security_group_ids = [aws_security_group." + id + "_db.id]",
      "  publicly_accessible    = false",
      "  storage_encrypted      = true",
      "  skip_final_snapshot    = true",
      "",
      "  tags = { ManagedBy = \"cognimesh\", Domain = \"" + domain + "\" }",
      "}",
      "",
      `output "${id}_secret_arn" {`,
      `  value = aws_secretsmanager_secret.${id}_db.arn`,
      "}",
      ""
    );

    files.push({
      nodeId: src.id,
      label: d.label || src.id,
      secretArnOutput: `aws_secretsmanager_secret.${id}_db.arn`,
    });
  }

  blocks.push(
    "# --- Variables (wire from infra/terraform/modules/networking) ---",
    "variable \"vpc_id\" { type = string }",
    "variable \"private_subnet_ids\" { type = list(string) }",
    "variable \"glue_security_group_id\" { type = string }",
    'variable "db_instance_class" { type = string default = "db.t3.micro" }',
    'variable "db_engine_version" { type = string default = "15" }',
    ""
  );

  return {
    status: "success",
    hcl: blocks.join("\n"),
    files,
    provisionCount: rdsSources.length,
  };
}

function escapeXml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * draw.io (diagrams.net) mxGraphModel XML from AWS design-review topology.
 */
function generateDrawioArchitecture({ topology, nodes = [], pipelineMeta = {} }) {
  const services = topology?.services?.length
    ? topology.services
    : [{ id: "pipeline", type: "sfn", label: pipelineMeta.name || "Pipeline", status: "ok" }];

  const cols = 3;
  const cellW = 160;
  const cellH = 72;
  const gapX = 40;
  const gapY = 50;
  const startX = 40;
  const startY = 40;

  let cellId = 2;
  const cells = [
    '<mxCell id="0"/>',
    '<mxCell id="1" parent="0"/>',
  ];
  const positions = new Map();

  services.forEach((svc, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = startX + col * (cellW + gapX);
    const y = startY + row * (cellH + gapY);
    const id = String(cellId++);
    positions.set(svc.id, id);
    const fill = svc.status === "issue" ? "#fecaca" : "#d1fae5";
    const stroke = svc.status === "issue" ? "#dc2626" : "#059669";
    cells.push(
      `<mxCell id="${id}" value="${escapeXml(svc.label)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=${stroke};fontSize=12;" vertex="1" parent="1">`,
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
      `<mxCell id="${edgeId}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#64748b;" edge="1" parent="1" source="${source}" target="${target}">`,
      '<mxGeometry relative="1" as="geometry"/>',
      "</mxCell>"
    );
  }

  const rdsProvision = listRdsSources(nodes).filter(
    (n) => rdsProvisioningMode(n.data) === "provision"
  );
  if (rdsProvision.length) {
    const noteId = String(cellId++);
    cells.push(
      `<mxCell id="${noteId}" value="${escapeXml(
        `Terraform provisions: ${rdsProvision.map((n) => n.data?.label || n.id).join(", ")}`
      )}" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=top;fontSize=11;fontColor=#64748b;" vertex="1" parent="1">`,
      `<mxGeometry x="${startX}" y="${startY + Math.ceil(services.length / cols) * (cellH + gapY)}" width="520" height="40" as="geometry"/>`,
      "</mxCell>"
    );
  }

  const diagramName = escapeXml(pipelineMeta.name || "CogniMesh architecture");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" modified="${new Date().toISOString()}" agent="CogniMesh" version="22.1.0" type="device">
  <diagram id="cognimesh-arch" name="${diagramName}">
    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0">
      <root>
        ${cells.join("\n        ")}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

  return { xml, serviceCount: services.length };
}

function generateArchitecturePngSvgHint() {
  return "Open the .drawio file in https://app.diagrams.net → File → Export as PNG or SVG.";
}

module.exports = {
  slugify,
  isRdsSource,
  rdsProvisioningMode,
  listRdsSources,
  generatePipelineTerraform,
  generateDrawioArchitecture,
  generateArchitecturePngSvgHint,
};
