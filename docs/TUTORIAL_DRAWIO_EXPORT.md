# Tutorial: Exporting Architecture Diagrams

This guide explains how to export draw.io architecture diagrams from your CogniMesh pipeline canvas.

## Overview

The draw.io export generates a detailed AWS architecture diagram that **dynamically reflects your actual pipeline**. Only services that exist on your canvas are included in the diagram.

## 1. Build Your Pipeline on the Canvas

Drag blocks onto the canvas in the portal:

- **Sources**: RDS/MySQL, Kinesis Data Streams, Amazon MSK (Kafka), S3
- **Transforms**: Glue ETL, Spark SQL
- **Connectors**: Firehose (passthrough)
- **Gates**: Integrity Gate (Lambda + PVDM proof)
- **Sinks**: S3, Iceberg, Redshift, DynamoDB

## 2. Export the Diagram

Click the **Export** button in the AWS Design Review panel and select **Architecture Diagram (.drawio)**.

The exported file includes:

| Canvas Block | Diagram Shows |
|---|---|
| RDS/MySQL source | RDS instance + Secrets Manager + sg-rds |
| Kinesis source | Kinesis Data Streams + StreamConsumerRole |
| Kafka source | Amazon MSK + StreamConsumerRole |
| Glue ETL transform | AWS Glue + GlueJobRole + sg-glue |
| Integrity Gate | Lambda Gate + PVDM Proof bucket + LambdaExecRole + sg-lambda |
| Firehose passthrough | Kinesis Data Firehose + FirehoseDeliveryRole |
| S3 sink | S3 bucket + Lake Formation |
| Iceberg sink | Iceberg table + Glue Data Catalog + Lake Formation |
| Redshift sink | Redshift + RedshiftSpectrumRole |

## 3. What's Always Included

Regardless of which blocks you have, the diagram always shows:

- **AWS Region** container with your configured region
- **VPC** (Terraform-managed or existing, based on your settings)
- **Public subnets** with Internet Gateway and NAT Gateway
- **Private subnets** (AZ-a for compute, AZ-b for storage)
- **CloudWatch** Logs & Alarms
- **CloudTrail** audit logging
- **Metadata note** with pipeline name, domain, region, and resource counts

## 4. VPC Mode

Set the VPC mode in pipeline properties:

- **Create new (Terraform)**: Shows "VPC (Terraform-managed) · 10.0.0.0/16"
- **Existing**: Shows "VPC (existing) · vpc-xxxxxxx" with your VPC ID

## 5. Open the Exported File

Open the `.drawio` file in:

- [diagrams.net](https://app.diagrams.net) (web)
- VS Code with the Draw.io Integration extension
- The desktop Draw.io app

From there you can export to PNG, SVG, or PDF.

## 6. API Export

You can also export via the API:

```bash
curl -X POST http://localhost:4000/api/v1/pipelines/export/drawio \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "topology": {},
    "nodes": [
      {"id": "s1", "data": {"blockType": "source", "sourceType": "rds", "database": "orders", "label": "Orders DB"}},
      {"id": "t1", "data": {"blockType": "transform", "transformType": "glue_etl", "label": "ETL"}},
      {"id": "g1", "data": {"blockType": "integrity_gate", "label": "Quality Gate"}},
      {"id": "o1", "data": {"blockType": "sink", "targetType": "iceberg", "label": "Gold Table"}}
    ],
    "pipelineMeta": {"name": "orders-pipeline", "domain": "commerce", "awsRegion": "us-east-1"}
  }'
```

The response includes `{ xml, serviceCount }`.

## 7. Edge Cases

The export handles all edge cases gracefully:

| Scenario | Result |
|----------|--------|
| Empty canvas (no nodes) | Minimal diagram with VPC shell and a "no blocks" message |
| Only sinks, no sources | Shows sink services + Lake Formation, no source boxes |
| Only sources, no sinks | Shows source services, no storage boxes |
| Missing pipelineMeta | Uses defaults (region: us-east-1, domain: default) |

## 8. Terraform Export

For infrastructure-as-code, use the **Terraform Export** button instead. This generates HCL for resources set to "Create new" provisioning mode:

- RDS instances with Secrets Manager, security groups, and subnet groups
- S3 buckets with encryption, public access blocks, and outputs
- Variables for VPC ID, subnet IDs, and Glue security group

See the generated `.tf` file comments for `terraform apply` instructions.
