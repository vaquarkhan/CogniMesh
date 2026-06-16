<p align="center">
  <img src="docs/assets/cognimesh-hero.png" alt="CogniMesh — Multimodal Cognitive Data Mesh &amp; Marketplace" width="720" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/CogniMesh-0.1.0-0d9488?style=for-the-badge" alt="CogniMesh" />
  <img src="https://img.shields.io/badge/Vaquar-PVDM-2563eb?style=for-the-badge" alt="Vaquar PVDM" />
  <img src="https://img.shields.io/badge/AWS-Serverless-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white" alt="AWS" />
  <img src="https://img.shields.io/badge/Tests-passing-22c55e?style=for-the-badge" alt="Tests" />
</p>

<p align="center">
  <a href="docs/DISTRIBUTION.md#docker-recommended-for-local-full-stack"><img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker" /></a>
  <a href="docs/DISTRIBUTION.md#npm-nodejs"><img src="https://img.shields.io/badge/npm-0.1.0-CB3837?style=flat-square&logo=npm&logoColor=white" alt="npm" /></a>
  <a href="docs/DISTRIBUTION.md#pypi-python-sdk"><img src="https://img.shields.io/badge/PyPI-cognimesh-3776AB?style=flat-square&logo=pypi&logoColor=white" alt="PyPI" /></a>
  <a href="docs/DISTRIBUTION.md#maven-java-catalog"><img src="https://img.shields.io/badge/Maven-catalog-ED8B00?style=flat-square&logo=apachemaven&logoColor=white" alt="Maven" /></a>
  <a href="docs/DISTRIBUTION.md#go-cognitive-runtime"><img src="https://img.shields.io/badge/Go-runtime-00ADD8?style=flat-square&logo=go&logoColor=white" alt="Go" /></a>
</p>

<h1 align="center">CogniMesh</h1>

<p align="center">
  <strong>Multimodal Cognitive Data Mesh &amp; Marketplace</strong>
</p>

<p align="center">
  Zero-code pipelines · Proof-gated publication · Agentic AI · Fine-grained governance
</p>

<p align="center">
  <a href="docs/vaquar-pattern.md"><b>⭐ The Vaquar Pattern</b></a> ·
  <a href="docs/PIPELINE_E2E_DIAGRAM.md"><b>📐 Pipeline E2E Diagram</b></a> ·
  <a href="docs/drag-drop-pipeline-flow.md">Drag-and-drop E2E</a> ·
  <a href="docs/data-contract-spec.md">Data Contract</a> ·
  <a href="infra/terraform/README.md">Terraform</a> ·
  <a href="docs/architecture.md">Architecture</a>
</p>

---

## At a glance

CogniMesh lets **business users** design data pipelines in a visual portal. The platform generates **`DataContract.yaml`**, runs governance checks, compiles **AWS Step Functions**, registers products in a **marketplace**, and deploys to AWS when enabled.

Built on **[The Vaquar Pattern](docs/vaquar-pattern.md)** by [Vaquarkhan](https://github.com/vaquarkhan): structured pipelines use **PVDM** (Physical → Verify → Durable → Metadata); cognitive pipelines use an **EKS transactional runtime** with Bedrock agents.

<table>
<tr>
<td width="50%">

**Structured pipelines**
- RDS CDC → Bronze → Silver → Iceberg Gold
- Vaquar PVDM + VRP proof
- Lambda + Step Functions

</td>
<td width="50%">

**Cognitive pipelines**
- Media URL → Bedrock agent
- Epoch / frontier / compensation
- EKS + Agent MCP

</td>
</tr>
</table>

---

## Table of contents

| | Section |
|---|---------|
| 🏗️ | [System architecture](#system-architecture) |
| 📐 | [Pipeline E2E diagram](docs/PIPELINE_E2E_DIAGRAM.md) |
| 🔄 | [End-to-end journey](#end-to-end-journey) |
| 🖥️ | [Zero-code portal](#zero-code-portal) · [Pattern catalog](docs/PORTAL_UI.md) |
| 🔐 | [Security](#security-cognito) |
| ⭐ | [Vaquar Pattern](docs/vaquar-pattern.md) · [Top 3 features](docs/TOP3_FEATURES.md) |
| 🔀 | [Dual pipeline model](#dual-pipeline-model) |
| 🏪 | [Marketplace](#marketplace--governance) |
| ☁️ | [Terraform](#aws-infrastructure-terraform) |
| ✅ | [Feature matrix](#feature-matrix) |
| 📦 | [Distribution](#distribution) |
| 🚀 | [Quick start](#quick-start) |
| 📚 | [Documentation](#documentation) |

---

## System architecture

Four cooperating planes:

```mermaid
flowchart TB
    classDef control fill:#0d9488,stroke:#0f766e,color:#fff
    classDef engine fill:#2563eb,stroke:#1d4ed8,color:#fff
    classDef cognitive fill:#7c3aed,stroke:#6d28d9,color:#fff
    classDef market fill:#d97706,stroke:#b45309,color:#fff

    subgraph CP["① Orchestration Control Plane"]
        Portal["🖥️ Zero-Code Portal"]
        Cognito["🔐 Cognito · invite-only"]
        GW["🌐 API Gateway :4000"]
        Portal --> Cognito & GW
    end

    subgraph PE["② Pipeline Engine"]
        Compiler["📄 Contract Compiler"]
        Gate["✅ Integrity Gate"]
        SFN["⚡ Step Functions"]
        GW --> Compiler --> Gate --> SFN
    end

    subgraph CL["③ Cognitive Layer"]
        RT["🔄 EKS Runtime"]
        Agent["🤖 Bedrock · MCP"]
        SFN -->|"agentic"| RT --> Agent
    end

    subgraph MG["④ Marketplace"]
        Cat["📦 Catalog"]
        LF["🛡️ Lake Formation"]
        Cat --> LF
    end

    SFN --> Cat
    class Portal,Cognito,GW control
    class Compiler,Gate,SFN engine
    class RT,Agent cognitive
    class Cat,LF market
```

| Capability | Technology |
|------------|------------|
| Zero-code design | React + React Flow |
| Contracts | `cognimesh.io/v1` DataContract |
| Structured writes | [Vaquar PVDM](docs/vaquar-pattern.md) |
| Cognitive writes | Go runtime · epoch / frontier |
| Security | Cognito (no self-registration) |
| Infrastructure | Terraform · VPC · S3 · EKS · CloudFront |

---

## End-to-end journey

```mermaid
sequenceDiagram
    autonumber
    actor User as 👤 User
    participant Portal as Portal
    participant API as API
    participant Gate as Integrity Gate
    participant SFN as SFN Compiler
    participant Cat as Catalog
    participant Mkt as Marketplace

    User->>Portal: Drag blocks · Deploy
    Portal->>API: POST /deploy + JWT
    API->>API: graphToContract · validate
    API->>Gate: runIntegrityGate()
    Gate-->>API: PASS
    API->>SFN: compileContractSmart()
  Note over SFN: Vaquar PVDM or cognitive ASL
    API->>Cat: Register product
    API-->>Portal: YAML · SFN · Vaquar artifacts
    Portal->>Mkt: Refresh products
```

---

## Zero-code portal

Visual pipeline designer: **28+ architecture patterns**, AWS service blocks (Glue, Kinesis, MSK, DMS, Firehose), AI builder, live AWS security/architecture review, VRP observability, and consumer marketplace.

→ Full pattern catalog: **[docs/PORTAL_UI.md](docs/PORTAL_UI.md)**

### Portal screenshots

<p align="center">
  <img src="docs/images/cog1.jpeg" alt="CogniMesh portal — Data Mesh Customer 360 canvas, Architectures pattern library, pipeline settings" width="720" />
  <br /><em>Architectures tab · Multi-domain Data Mesh (Customer 360) · AWS Glue / MSK / S3 · Mesh integrity gate → Iceberg gold</em>
</p>

<p align="center">
  <img src="docs/images/cog2.jpeg" alt="CogniMesh portal — Lambda architecture batch and speed layers on canvas" width="720" />
  <br /><em>Lambda (λ) architecture — Parallel batch (S3 → Glue ETL → Iceberg) + speed (Kinesis → Flink → Iceberg) → Merge → Athena serving view</em>
</p>

<table>
<tr>
<td width="50%">

**Pattern library & architecture filters**

<p><img src="docs/assets/portal-pattern-library.png" alt="Architecture pattern library with Data Mesh, Lakehouse, Kappa filters" width="100%" /></p>

Data Mesh · Data Lake · Lakehouse · Kappa · Lambda λ · Streaming · ETL/ELT

</td>
<td width="50%">

**AWS Blocks palette**

<p><img src="docs/assets/portal-aws-blocks.png" alt="AWS Blocks — Glue, Kinesis, MSK, ETL enrichment transforms" width="100%" /></p>

Glue ETL/ELT · enrichment · dedupe · CDC merge · stream windows

</td>
</tr>
<tr>
<td width="50%">

**Design canvas overview**

<p><img src="docs/assets/portal-overview.png" alt="CogniMesh portal — canvas with Kappa architecture and AWS Design Review" width="100%" /></p>

AWS Design Review HUD · VRP-ready pipeline

</td>
<td width="50%">

**AI pipeline builder**

<p><img src="docs/assets/portal-ai-builder.png" alt="AI Builder — describe pipeline in English" width="100%" /></p>

Natural language → pattern → canvas

</td>
</tr>
</table>

<details>
<summary><strong>All patterns in the UI (click to expand)</strong></summary>

| Category | Patterns |
|----------|----------|
| **Data Mesh** | Domain Data Product · Multi-Domain Parallel (Customer 360) |
| **Data Lake** | Raw / Curated / Consumption zones |
| **Lakehouse** | Iceberg Medallion · Glue ETL Factory |
| **Kappa** | Stream-only (Kinesis → Flink → Iceberg) |
| **Lambda λ** | Batch layer + Speed layer → Athena serving |
| **Streaming** | Kinesis + Firehose · MSK + Glue streaming |
| **ETL / ELT** | Glue multi-stage factory · Redshift ELT marts |
| **Medallion** | Full Bronze → Silver → Gold |
| **Finance** | Payment ledger (SOX / double-entry) |
| **Healthcare** | FHIR → HIPAA gold |
| **Retail** | Clickstream funnel |
| **Cognitive** | Media Bedrock · GenAI RAG documents |
| **Compliance** | Fraud parallel · DQ quarantine |
| **Structured** | Vaquar CDC · Multi-source Parallel → Choice |
| **Analytics** | IoT fleet · SCD2 · Feature store |

Regenerate automated screenshots: `npm run build --prefix portal && npx playwright install chromium && npm run docs:screenshots` (output: `docs/assets/`). Manual UI captures live in **`docs/images/`**.

</details>

### Blocks → DataContract

| Block | Contract | Examples |
|-------|----------|----------|
| Source | `spec.source` | `rds`, `s3`, `kinesis`, `kafka`, `media_url`, `api` |
| Transform | `spec.transform` | `spark_sql`, `glue_etl`, `agentic` + modes: ETL, ELT, enrichment, dedupe, aggregate, CDC merge |
| Sink | `spec.target` | `iceberg`, `s3`, `redshift`, `delta`, Athena views |
| Flow | Step Functions ASL | `parallel`, `choice`, `merge`, `map`, `start` |
| Governance | Integrity gate | Vaquar PVDM · VRP proof before commit |

→ [Full drag-and-drop guide](docs/drag-drop-pipeline-flow.md)

---

## Security (Cognito)

| Control | Setting |
|---------|---------|
| Self-registration | **Disabled** |
| Default admin | Created by Terraform |
| API | JWT on `/api/v1/pipelines/*` |
| Local dev | `AUTH_DISABLED=true` |

```mermaid
flowchart LR
    User --> Cognito --> Portal -->|Bearer JWT| API
```

---

## Vaquar Pattern

CogniMesh implements **[The Vaquar Pattern](docs/vaquar-pattern.md)** (author: **Vaquarkhan**): proof-gated serverless writes with invariant **`commit_metadata ⟹ VRP = PASS`**.

```mermaid
flowchart LR
    P["Physical"] --> V["Verify"] --> D["Durable"] --> M["Metadata"]
    V -.->|FAIL| X["Blocked"]
    style P fill:#1e40af,color:#fff
    style V fill:#0d9488,color:#fff
    style D fill:#7c3aed,color:#fff
    style M fill:#d97706,color:#fff
```

| Block | Status |
|-------|--------|
| Integrity gate · SparkRules · IceGuard · VRP · Durable SFN · Metadata commit | ✅ |

**Read the full pattern spec:** [docs/vaquar-pattern.md](docs/vaquar-pattern.md)

---

## Dual pipeline model

```mermaid
flowchart TB
    DC["DataContract.yaml"]
    DC --> Structured["Structured · Vaquar PVDM"]
    DC --> Cognitive["Cognitive · EKS + Bedrock"]

    style Structured fill:#1e3a5f,color:#fff
    style Cognitive fill:#4c1d95,color:#fff
```

| Type | Example | Runtime |
|------|---------|---------|
| Structured CDC → Iceberg | [`structured-cdc-pipeline.yaml`](contracts/examples/structured-cdc-pipeline.yaml) | PVDM Lambda + SFN |
| Cognitive media → Parquet | [`cognitive-media-pipeline.yaml`](contracts/examples/cognitive-media-pipeline.yaml) | [`cognitive-runtime/`](services/cognitive-runtime/) |

---

## Marketplace & governance

Deploy → integrity gate **PASS** → catalog registration → Lake Formation policies → marketplace UI.

Governance fields: `piiClassification`, `rowFilters`, `columnMasks`.

---

## AWS infrastructure (Terraform)

```mermaid
flowchart TB
    Net["VPC · subnets"] --> Compute["Cognito · Lambda · SFN · EKS"]
    Store["S3 medallion · checkpoints · proofs"] --> Compute
    Compute --> Data["DynamoDB · Glue · Lake Formation"]
```

| Module | Purpose |
|--------|---------|
| `cognito` | Admin-only auth |
| `storage` | Bronze / silver / gold / checkpoint / proof |
| `lambda` | Integrity gate + domain writer |
| `orchestration` | Step Functions |
| `eks` | Cognitive runtime |
| `portal-cdn` | CloudFront + S3 portal |

→ [Terraform guide](infra/terraform/README.md)

---

## Feature matrix

<details open>
<summary><b>All features implemented</b></summary>

| Feature | Location |
|---------|----------|
| Zero-code portal | `portal/` |
| DataContract schema | `schemas/` |
| Graph → contract compiler | `lib/contract-builder/` |
| **[Vaquar Pattern](docs/vaquar-pattern.md)** | `docs/vaquar-pattern.md`, `lib/vaquar/` |
| PVDM runtime (IceGuard · VRP) | `services/pvdm-runtime/` |
| Integrity gate | `lib/integrity-gate/`, `rules/` |
| API + JWT | `services/api-gateway/` |
| Marketplace catalog | `services/catalog/` |
| Bedrock Agent MCP | `services/agent-mcp/` |
| Cognitive runtime | `services/cognitive-runtime/` |
| Production Terraform | `infra/terraform/` |
| CI + tests | `.github/workflows/`, `scripts/test-*.js` |

</details>

---

## Distribution

Install and run CogniMesh via Docker, npm, PyPI, Maven, or Go. Full details: **[docs/DISTRIBUTION.md](docs/DISTRIBUTION.md)**.

| Channel | Install | Use case |
|---------|---------|----------|
| **Docker** | `docker compose up --build` | Full stack — no local Java/Maven |
| **npm** | `npm install && npm start` | Monorepo dev — API, portal, contract compiler |
| **PyPI** | `pip install cognimesh` | Python SDK + CLI for contracts & API |
| **Maven** | `cd services/catalog && mvn spring-boot:run` | Marketplace catalog service |
| **Go** | `cd services/cognitive-runtime && go run ./cmd/controller` | Cognitive epoch runtime |

### Docker

```bash
docker compose up --build
# Portal :3000 · API :4000 · Catalog :8080
```

| Image | Tag |
|-------|-----|
| `ghcr.io/vaquarkhan/cognimesh-api` | `0.1.0` |
| `ghcr.io/vaquarkhan/cognimesh-portal` | `0.1.0` |
| `ghcr.io/vaquarkhan/cognimesh-catalog` | `0.1.0` |

### PyPI

```bash
pip install cognimesh
cognimesh validate contracts/examples/structured-cdc-pipeline.yaml
cognimesh health --api http://localhost:4000
```

```python
from cognimesh import CogniMeshClient, load_contract
client = CogniMeshClient("http://localhost:4000")
print(client.health())
```

Related Vaquar package: [`serverless-data-mesh`](https://pypi.org/project/serverless-data-mesh/) (`pip install serverless-data-mesh`).

---

## Quick start

```bash
git clone git@github.com:vaquarkhan/CogniMesh.git
cd CogniMesh
npm install
cp .env.example .env
npm start
```

| Service | URL |
|---------|-----|
| Portal | http://localhost:3000 |
| API | http://localhost:4000 |
| Catalog | http://localhost:8080 |

**Workflow:** Sign in → drag Source → Transform → Sink → **Deploy Pipeline** → view YAML, Step Functions, Vaquar mesh artifacts, marketplace.

### Tests

```bash
npm test                 # offline unit/e2e (no servers)
npm run dev:api          # API only — embedded catalog, no Java
npm run dev:minimal      # API + portal (no catalog)
npm run test:api         # SKIPs marketplace when catalog offline
```

### Docker Compose (full stack, no local Java/Maven)

```bash
npm run docker:up
```

→ [docs/LOCAL_DEV.md](docs/LOCAL_DEV.md)

### AWS production

```bash
npm run package:lambda
npm run package:domain-writer
cd infra/terraform/environments/prod
cp terraform.tfvars.example terraform.tfvars
terraform init && terraform apply
```

---

## Repository layout

```
CogniMesh/
├── portal/                 # React + React Flow SPA
├── services/
│   ├── api-gateway/        # JWT · preview · deploy
│   ├── catalog/            # Marketplace (Spring Boot)
│   ├── pipeline-engine/    # SFN compiler
│   ├── pvdm-runtime/       # Vaquar PVDM (IceGuard · VRP)
│   ├── cognitive-runtime/  # Go · epoch / frontier
│   ├── agent-mcp/          # Bedrock MCP
│   └── lambda/             # Integrity gate · domain writer
├── lib/
│   ├── vaquar/             # contract → mesh · PVDM SFN
│   ├── contract-builder/   # Graph → deploy orchestration
│   └── integrity-gate/     # Design-time rules
├── docs/
│   └── vaquar-pattern.md   # ⭐ The Vaquar Pattern (author: Vaquarkhan)
├── infra/terraform/          # Production IaC
├── contracts/examples/     # Sample pipelines
└── rules/                    # Integrity gate policies
```

---

## Documentation

| Document | Description |
|----------|-------------|
| **[docs/vaquar-pattern.md](docs/vaquar-pattern.md)** | **The Vaquar Pattern** · PVDM · VRP · building blocks |
| [docs/drag-drop-pipeline-flow.md](docs/drag-drop-pipeline-flow.md) | Portal → deploy E2E |
| [docs/architecture.md](docs/architecture.md) | Architecture deep-dive |
| [docs/data-contract-spec.md](docs/data-contract-spec.md) | DataContract YAML spec |
| [docs/LINEAGE_CATALOG.md](docs/LINEAGE_CATALOG.md) | Lineage catalog · schema evolution |
| [docs/PLATFORM_CHECKLIST.md](docs/PLATFORM_CHECKLIST.md) | 10/10 evaluation tracker |
| [docs/PIPELINE_E2E_DIAGRAM.md](docs/PIPELINE_E2E_DIAGRAM.md) | **AWS E2E diagram** (draw.io) · all pipelines |
| [docs/DISTRIBUTION.md](docs/DISTRIBUTION.md) | Docker · npm · PyPI · Maven · Go |

---

## License

Proprietary — see [LICENSE](LICENSE). Pattern by [Vaquarkhan](https://github.com/vaquarkhan).

Security: [SECURITY.md](SECURITY.md) · Changelog: [CHANGELOG.md](CHANGELOG.md) · [10/10 checklist](docs/PLATFORM_CHECKLIST.md)

<p align="center">
  <sub>Domain teams own the pipeline design. The mesh proves correctness before publication.</sub>
</p>
