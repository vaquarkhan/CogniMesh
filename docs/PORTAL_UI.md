# Portal UI - patterns & screenshots

## Screenshots

### Architecture canvases

<p align="center">
  <img src="../images/cog1.jpeg" alt="CogniMesh portal - Data Mesh Customer 360 workflow" width="720" />
  <br /><em><strong>Data Mesh - Customer 360</strong> · Three AWS accounts (commerce / supply / CRM) · Parallel Commerce RDS, Inventory Kafka, CRM S3 → Merge → enrichment → Mesh gate → Iceberg gold</em>
</p>

<p align="center">
  <img src="../images/cog2.jpeg" alt="CogniMesh portal - Lambda batch and speed layers" width="720" />
  <br /><em><strong>Lambda (λ) architecture</strong> · Batch layer (S3 history → Glue ETL → Iceberg) + speed layer (Kinesis → Flink window → Iceberg) → Merge → Athena UNION view</em>
</p>

<p align="center">
  <img src="../images/cog1-datamesh-canvas.png" alt="Data Mesh canvas (automated capture)" width="360" />
  &nbsp;
  <img src="../images/cog2-lambda-canvas.png" alt="Lambda canvas (automated capture)" width="360" />
  <br /><em>Playwright auto-captures (same patterns) · <code>npm run docs:screenshots</code></em>
</p>

### AI Builder & Agent Builder

<p align="center">
  <img src="../images/portal-ai-pipeline-designer.png" alt="AI Pipeline Designer - natural language to pattern" width="360" />
  &nbsp;
  <img src="../images/portal-ai-agent-generator.png" alt="AI Agent Generator - Bedrock AgentCore templates" width="360" />
  <br /><em><strong>AI Builder sidebar</strong> · <em>Data pipeline</em> tab matches English to 28+ patterns (100% browser-local, no API) · <em>AI agent</em> tab generates AgentCore templates with guardrails</em>
</p>

<p align="center">
  <img src="../images/portal-agent-builder-canvas.png" alt="Agent Builder canvas - drag-drop AgentCore blocks" width="720" />
  <br /><em><strong>Agent Builder</strong> (header toggle) · Bedrock model, knowledge base, Lambda tools, guardrails, memory · Export AgentCore manifest YAML</em>
</p>

Automated Playwright captures: `npm run docs:screenshots` → `docs/assets/` and `docs/images/`.

**Tutorials:** [docs/tutorials/README.md](tutorials/README.md) - one real-world guide per architecture pattern (26) and AgentCore template (8).

**Developer customization:** [docs/developer/README.md](developer/README.md) - 21 annotated screenshots · customize pipelines & agents · extend catalog in code.

See also [README - Zero-code portal](../README.md#zero-code-portal).

---

## Designer modes (header)

| Mode | How to open | Purpose |
|------|-------------|---------|
| **Data Pipeline** | Default header toggle | React Flow canvas for Glue / Kinesis / MSK data pipelines |
| **Agent Builder** | Header → **Agent Builder** | AgentCore drag-drop canvas · templates · guardrails · manifest export |

From **AI Builder → AI agent**, describe an agent and CogniMesh switches to Agent Builder with the matched template loaded.

---

## Sidebar tabs (Data Pipeline mode)

| Tab | Purpose |
|-----|---------|
| **AI Builder** | **Data pipeline** - natural language → architecture pattern (local rules, no JSON/API). **AI agent** - natural language → AgentCore template → opens Agent Builder |
| **Architectures** | 28+ patterns with mesh / lake / kappa / lambda filters · sticky filters · scroll resets to top on tab change |
| **AWS Blocks** | Drag Glue, Kinesis, MSK, DMS, ETL/ELT transforms |
| **Guide** | Step-by-step workflow |

Agent Builder mode adds **Templates** and **Agent Blocks** tabs in the sidebar.

---

## AI Pipeline Designer (no API required)

The **Data pipeline** sub-tab uses `designPipelineFromMessage()` entirely in the browser. Click **Preview pipeline plan** to see a natural-language explanation of what will be created and how data flows - then confirm to load the canvas.

Example chips (Data mesh, Kappa, Lambda λ, Glue ETL factory, etc.) match patterns without calling `/api/v1/pipelines/ai-design`.

When the API gateway is offline, preview/deploy and AWS Design Review show friendly messages instead of JSON parse errors.

---

## Agent Builder

| Feature | Details |
|---------|---------|
| **Feature checkboxes** | Guardrails, session/long-term memory, KB, Gateway & tools, code interpreter, browser, identity, observability, HITL - applied when creating from AI generator or templates |
| **Templates** | Customer support, RAG, Data analyst, Fraud, Steward, **DevOps/SRE**, **Custom starter**, code review, HR, multi-agent |
| **Blocks** | Bedrock model, Knowledge Base, Lambda tool, API Gateway, memory, guardrails (PII, topic, content) |
| **Export** | AgentCore manifest YAML + validation (design tool - no Bedrock API calls) |
| **Pipeline deploy** | Data Pipeline mode only - Step Functions + catalog when API + `AWS_DEPLOY_ENABLED` |
| **AI generator** | Sidebar **AI Builder → AI agent** or header **Agent Builder** + Templates |

→ Tutorial: **[AGENT_BUILDER.md](AGENT_BUILDER.md)**

---

## Architecture patterns (10)

| Pattern | Architecture | AWS services |
|---------|--------------|--------------|
| Data Mesh - Domain Data Product | Data Mesh | RDS, Glue, Iceberg, LF, SFN |
| Data Mesh - Multi-Domain Parallel | Data Mesh | Glue, MSK, Iceberg, SFN |
| Data Lake - Raw/Curated Zones | Data Lake | S3, Glue, Athena, LF |
| Lakehouse - Iceberg Medallion | Lakehouse | DMS, Glue, Iceberg, Athena |
| Kappa - Stream-Only | Kappa | Kinesis, Flink, Iceberg, Lambda |
| Lambda (λ) - Batch + Speed | Lambda | Glue, Kinesis, Iceberg, Athena |
| Kinesis → Firehose → Analytics | Streaming | Kinesis, Firehose, Glue, Iceberg |
| MSK → Glue Streaming | Streaming | MSK, Glue, Iceberg |
| Glue ETL Factory (multi-stage) | Lakehouse | DMS, Glue, Iceberg, SFN |
| ELT → Redshift Marts | Warehouse | S3, Glue, Redshift |

**Data Mesh multi-domain** uses three dummy AWS accounts (`111122223333`, `222233334444`, `333344445555`) with swimlane overlays on the canvas.

---

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

---

## Core starter patterns (6)

| Pattern | Use case |
|---------|----------|
| Vaquar CDC Orders | RDS CDC → Iceberg (signature demo) |
| Cognitive Media | Bedrock agentic pipeline |
| S3 Batch Lake | File landing → curated S3 |
| Kafka Stream | MSK/Kafka streaming |
| MySQL → Redshift | Warehouse sync |
| Blank canvas | Build from AWS blocks |

---

## Portal features on canvas

- **AWS Design Review** - Security + architecture scores, Well-Architected checks (skipped when API is down)
- **Mesh swimlanes** - Producer / steward / publisher account overlays for Data Mesh patterns
- **VRP observability** - Run history, PVDM flow, drop trends
- **Marketplace consumer** - Schema, sample rows, Athena link
- **Steward approvals** - Access request workflow
- **Agent Builder** - Bedrock AgentCore templates with guardrails, Gateway, KB, memory
