# Portal UI — patterns & screenshots

Screenshots are generated with `npm run docs:screenshots` (requires Playwright Chromium).

## Portal tabs

| Tab | Purpose |
|-----|---------|
| **AI Builder** | Natural language → load matching architecture pattern |
| **Architectures** | 28+ patterns with mesh / lake / kappa / lambda filters |
| **AWS Blocks** | Drag Glue, Kinesis, MSK, DMS, ETL/ELT transforms |
| **Guide** | Step-by-step workflow |

## Architecture patterns (10)

| Pattern | Architecture | AWS services |
|---------|--------------|--------------|
| Data Mesh — Domain Data Product | Data Mesh | RDS, Glue, Iceberg, LF, SFN |
| Data Mesh — Multi-Domain Parallel | Data Mesh | Glue, MSK, Iceberg, SFN |
| Data Lake — Raw/Curated Zones | Data Lake | S3, Glue, Athena, LF |
| Lakehouse — Iceberg Medallion | Lakehouse | DMS, Glue, Iceberg, Athena |
| Kappa — Stream-Only | Kappa | Kinesis, Flink, Iceberg, Lambda |
| Lambda (λ) — Batch + Speed | Lambda | Glue, Kinesis, Iceberg, Athena |
| Kinesis → Firehose → Analytics | Streaming | Kinesis, Firehose, Glue, Iceberg |
| MSK → Glue Streaming | Streaming | MSK, Glue, Iceberg |
| Glue ETL Factory (multi-stage) | Lakehouse | DMS, Glue, Iceberg, SFN |
| ELT → Redshift Marts | Warehouse | S3, Glue, Redshift |

## Domain & industry patterns (11)

| Pattern | Category |
|---------|----------|
| Full Medallion (Bronze → Silver → Gold) | Medallion |
| Payment Ledger (double-entry) | Finance |
| FHIR → HIPAA Gold | Healthcare |
| Retail Clickstream | Retail |
| IoT Sensor Fleet | Analytics |
| SCD2 Customer Dimension | Analytics |
| Fraud Detection Parallel | Compliance |
| GenAI RAG Documents | Cognitive |
| DQ Quarantine Pipeline | Compliance |
| Feature Store for ML | Analytics |
| Multi-Source Parallel → Choice | Structured |

## Core starter patterns (6)

| Pattern | Use case |
|---------|----------|
| Vaquar CDC Orders | RDS CDC → Iceberg (signature demo) |
| Cognitive Media | Bedrock agentic pipeline |
| S3 Batch Lake | File landing → curated S3 |
| Kafka Stream | MSK/Kafka streaming |
| MySQL → Redshift | Warehouse sync |
| Blank canvas | Build from AWS blocks |

## Portal features on canvas

- **AWS Design Review** — Security + architecture scores, Well-Architected checks
- **VRP observability** — Run history, PVDM flow, drop trends
- **Marketplace consumer** — Schema, sample rows, Athena link
- **Steward approvals** — Access request workflow

See [README](../README.md#zero-code-portal) for screenshots.
