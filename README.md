<p align="center">
  <img src="https://img.shields.io/badge/CogniMesh-0.1.0-0d9488?style=for-the-badge" alt="CogniMesh version" />
  <img src="https://img.shields.io/badge/Vaquar-PVDM-2563eb?style=for-the-badge" alt="Vaquar Pattern" />
  <img src="https://img.shields.io/badge/AWS-Serverless-orange?style=for-the-badge" alt="AWS Serverless" />
</p>

<h1 align="center">CogniMesh</h1>

<p align="center">
  <strong>Multimodal Cognitive Data Mesh &amp; Marketplace</strong><br/>
  Zero-code pipelines · Proof-gated publication · Agentic AI · Fine-grained governance
</p>

<p align="center">
  <a href="docs/drag-drop-pipeline-flow.md">Drag-and-drop E2E</a> ·
  <a href="docs/data-contract-spec.md">Data Contract</a> ·
  <a href="infra/terraform/README.md">Terraform</a> ·
  <a href="https://github.com/vaquarkhan/aws-serverless-datamesh-framework/blob/main/docs/vaquar-pattern.md">Vaquar Pattern</a>
</p>

---

## What is CogniMesh?

CogniMesh is an end-to-end data platform where **non-technical users** design pipelines in a drag-and-drop portal, and the platform automatically generates **`DataContract.yaml`**, enforces governance, compiles **AWS Step Functions**, registers products in a **marketplace**, and optionally deploys to AWS.

It combines:

| Capability | Technology |
|------------|------------|
| Zero-code design | React + React Flow portal |
| Declarative contracts | `cognimesh.io/v1` DataContract schema |
| Security | Amazon Cognito (admin-only users, no self-registration) |
| Governance | Vaquar-inspired integrity gate + Lake Formation |
| Structured writes | Vaquar [PVDM](https://github.com/vaquarkhan/aws-serverless-datamesh-framework/blob/main/docs/vaquar-pattern.md) via `serverless-data-mesh` bridge |
| Cognitive writes | EKS transactional runtime (epoch / frontier / compensation) |
| Infrastructure | Production Terraform (VPC, S3, Cognito, SFN, DynamoDB, LF) |

---

## System architecture (four planes)

```mermaid
flowchart TB
    classDef control fill:#0d9488,stroke:#0f766e,color:#fff
    classDef engine fill:#2563eb,stroke:#1d4ed8,color:#fff
    classDef cognitive fill:#7c3aed,stroke:#6d28d9,color:#fff
    classDef market fill:#d97706,stroke:#b45309,color:#fff

    subgraph CP["① Orchestration Control Plane"]
        direction TB
        Portal["🖥️ Zero-Code Portal<br/><small>Drag Source → Transform → Sink</small>"]
        Cognito["🔐 Amazon Cognito<br/><small>Admin-only · No self-signup</small>"]
        GW["🌐 API Gateway :4000<br/><small>JWT validation</small>"]
        Portal --> Cognito
        Portal --> GW
    end

    subgraph PE["② Metadata-Driven Pipeline Engine"]
        direction TB
        Compiler["📄 Contract Compiler"]
        Gate["✅ Integrity Gate<br/><small>Vaquar rules engine</small>"]
        SFN["⚡ Step Functions"]
        AWS["☁️ AWS Deploy"]
        GW --> Compiler --> Gate --> SFN --> AWS
    end

    subgraph CL["③ Cognitive Transformation Layer"]
        direction TB
        RT["🔄 Transactional Runtime<br/><small>Go · EKS</small>"]
        Agent["🤖 AI Agent Jobs<br/><small>Bedrock · MCP</small>"]
        SFN -->|"agentic"| RT --> Agent
    end

    subgraph MG["④ Marketplace & Governance"]
        direction TB
        Cat["📦 Catalog Service<br/><small>Spring Boot · DynamoDB</small>"]
        LF["🛡️ Lake Formation"]
        MCP["🔌 Agent MCP"]
        AWS --> Cat
        Cat --> LF
        MCP -.-> Agent
    end

    class Portal,Cognito,GW control
    class Compiler,Gate,SFN,AWS engine
    class RT,Agent cognitive
    class Cat,LF,MCP market
```

---

## End-to-end journey (implemented)

From login to marketplace in one flow:

```mermaid
sequenceDiagram
    autonumber
    actor User as 👤 Business User
    participant Login as 🔐 Cognito Login
    participant Portal as 🖥️ Portal :3000
    participant API as 🌐 API :4000
    participant Gate as ✅ Integrity Gate
    participant SFN as ⚡ SFN Compiler
    participant AWS as ☁️ AWS
    participant Cat as 📦 Catalog :8080
    participant Mkt as 🏪 Marketplace UI

    User->>Login: Sign in (invite-only)
    Login-->>Portal: JWT id token
    User->>Portal: Drag blocks + connect + configure
    User->>Portal: Click Deploy Pipeline
    Portal->>API: POST /deploy + Bearer token

    API->>API: graphToContract()
    API->>API: JSON Schema validate
    API->>Gate: runIntegrityGate()
    Gate-->>API: PASS

    API->>SFN: compileContract()
    SFN-->>API: Step Functions JSON

    API->>AWS: deployStateMachine() [optional]
    API->>Cat: POST /products (approved)
    Cat-->>API: product registered

    API-->>Portal: YAML + SFN + catalog + AWS status
    Portal->>Mkt: Refresh marketplace list
    Mkt-->>User: Data product visible
```

---

## Zero-code portal (drag-and-drop)

```mermaid
flowchart LR
    subgraph Palette["Block palette"]
        S["🟢 Source"]
        T["🔵 Transform"]
        AI["🟣 AI Transform"]
        K["🟠 Sink"]
    end

    subgraph Canvas["React Flow canvas"]
        N1["RDS / media_url"]
        N2["spark_sql / agentic"]
        N3["iceberg / s3"]
        N1 --> N2 --> N3
    end

    subgraph Contract["DataContract.yaml"]
        SC["spec.source"]
        TR["spec.transform"]
        TG["spec.target"]
    end

  S & T & AI & K -.->|drag| Canvas
    N1 -.-> SC
    N2 -.-> TR
    N3 -.-> TG

    style S fill:#059669,color:#fff
    style T fill:#2563eb,color:#fff
    style AI fill:#7c3aed,color:#fff
    style K fill:#ea580c,color:#fff
```

| Portal block | Contract field | Values |
|--------------|----------------|--------|
| Source | `spec.source` | `rds`, `mysql`, `s3`, `kafka`, `media_url`, `api` |
| Transform | `spec.transform` | `spark_sql`, `glue_etl`, `agentic`, `passthrough` |
| AI Transform | `spec.transform.agentic` | Bedrock model, prompt, compensation handler |
| Sink | `spec.target` | `s3`, `iceberg`, `redshift`, `delta` |

Deep dive: [docs/drag-drop-pipeline-flow.md](docs/drag-drop-pipeline-flow.md)

---

## Security: Cognito (no self-registration)

```mermaid
flowchart TB
    subgraph Public["Internet"]
        User["User browser"]
    end

    subgraph Auth["Amazon Cognito"]
        Pool["User Pool<br/>allow_admin_create_user_only = true"]
        Admin["Default admin user<br/>created by Terraform"]
        Groups["cognimesh-admins<br/>cognimesh-designers"]
        Pool --> Admin
        Pool --> Groups
    end

    subgraph App["CogniMesh"]
        Portal["Portal SPA<br/>Sign-in only · No signup page"]
        API["API Gateway<br/>aws-jwt-verify"]
    end

    User -->|"SRP login"| Pool
    Pool -->|"id token"| Portal
    Portal -->|"Bearer JWT"| API

    style Pool fill:#c2410c,color:#fff
```

| Security control | Implementation |
|------------------|----------------|
| Self-registration | **Disabled** (`allow_admin_create_user_only`) |
| Default user | Terraform creates admin with random initial password |
| Password policy | 12+ chars, upper, lower, number, symbol |
| MFA | Optional TOTP |
| API protection | JWT required on `/api/v1/pipelines/*` |
| Local dev | `AUTH_DISABLED=true` in `.env` |

---

## Vaquar Pattern (PVDM) integration

CogniMesh aligns with the [Vaquar Pattern](https://github.com/vaquarkhan/aws-serverless-datamesh-framework/blob/main/docs/vaquar-pattern.md): **Physical → Verify → Durable → Metadata**, with invariant `commit_metadata ⟹ VRP = PASS`.

### Building block stack

```mermaid
flowchart LR
    subgraph Phase0["Phase 0 · Rules"]
        SR["SparkRules<br/><small>optional DRL</small>"]
        IG0["Integrity Gate<br/><small>design-time YAML</small>"]
    end

    subgraph PVDM["Vaquar PVDM runtime"]
        P["P · IceGuard<br/>chunked Parquet · rollback"]
        V["V · veridata-recon<br/>VRP per chunk"]
        D["D · Durable Execution<br/>SFN resume loop"]
        M["M · PyIceberg Glue REST<br/>proof-gated commit"]
    end

    IG0 --> SR
    SR --> P --> V --> D --> M
    V -.->|FAIL| X["❌ No snapshot"]

    style X fill:#fee2e2,stroke:#dc2626
```

| Building block | Role | CogniMesh status |
|----------------|------|------------------|
| **Integrity gate** | Design-time rules (SparkRules-style YAML) | ✅ Implemented (`rules/default-policies.yaml`) |
| **SparkRules** | Runtime DRL before physical write | ✅ `services/pvdm-runtime/` + `rules/default-policies.yaml` |
| **IceGuard** | Chunked Parquet, timeout rollback, S3 resume | ✅ `services/pvdm-runtime/` IceGuardWriter |
| **veridata-recon** | VRP multiset proof per chunk | ✅ `services/pvdm-runtime/` generateVRP |
| **AWS Durable Execution** | 15-min Lambda segments → 90+ min | ✅ `lib/vaquar/pvdm-sfn.js` SFN resume loop |
| **PyIceberg Glue REST** | SigV4 metadata commit after VRP PASS | ✅ `validateThenCommit` in pvdm-runtime |
| **Integrity gate Lambda** | Runtime gate in Step Functions | ✅ Packaged + Terraform module |

Bridge path:

```
DataContract.yaml  →  mesh.yaml compiler  →  serverless-data-mesh apply  →  AWS Lambda + SFN
```

---

## Dual pipeline model

```mermaid
flowchart TB
    DC["DataContract.yaml"]

    DC --> Structured
    DC --> Cognitive

    subgraph Structured["Structured pipeline (Vaquar PVDM)"]
        direction LR
        CDC["RDS CDC"] --> Bronze["S3 Bronze"]
        Bronze --> Silver["Glue / Lambda Silver"]
        Silver --> Gold["Iceberg Gold"]
    end

    subgraph Cognitive["Cognitive pipeline (Atomix runtime)"]
        direction LR
        Media["Media URL"] --> EKS["EKS Controller"]
        EKS --> Agent["Bedrock Agent"]
        Agent --> PQ["Parquet Silver"]
        PQ --> ICE["Iceberg Gold"]
    end

    style Structured fill:#1e3a5f,color:#fff
    style Cognitive fill:#4c1d95,color:#fff
```

### Structured: CDC → Iceberg

```mermaid
flowchart LR
    RDS[(RDS)] -->|CDC| B["🟤 Bronze S3"]
    B --> G1["Glue ETL"]
    G1 --> S["⚪ Silver S3"]
    S --> G2["Spark SQL"]
    G2 --> ICE["🟡 Iceberg Gold"]
```

Example: [`contracts/examples/structured-cdc-pipeline.yaml`](contracts/examples/structured-cdc-pipeline.yaml)

### Cognitive: Media → Agent → Parquet

```mermaid
stateDiagram-v2
    [*] --> BeginTx: Job epoch N
    BeginTx --> EpochCheck
    EpochCheck --> Rejected: stale epoch
    EpochCheck --> Frontier: ordering OK
    Frontier --> Executing
    Executing --> Committed: agent success
    Executing --> Compensating: agent failure
    Compensating --> RolledBack
    Committed --> [*]
    RolledBack --> [*]
    Rejected --> [*]
```

| Concept | Purpose |
|---------|---------|
| **Epoch** | Monotonic sequence; rejects duplicate commits |
| **Frontier** | Strict ordering (N before N+1) |
| **Compensation** | Rollback on agent failure |

Example: [`contracts/examples/cognitive-media-pipeline.yaml`](contracts/examples/cognitive-media-pipeline.yaml)  
Runtime: [`services/cognitive-runtime/`](services/cognitive-runtime/)

---

## Marketplace & governance

```mermaid
flowchart TB
    Deploy["Deploy Pipeline"] --> Gate["Integrity gate PASS"]
    Gate --> Reg["POST /api/v1/products"]
    Reg --> Store["Catalog store<br/>memory · DynamoDB"]
    Store --> Status["status: approved"]
    Status --> LF["Lake Formation<br/>row filters · column masks"]
    LF --> Mkt["Marketplace panel in portal"]

    subgraph Governance["Contract governance"]
        PII["piiClassification"]
        RF["rowFilters"]
        CM["columnMasks"]
    end

    Deploy --> Governance
    Governance --> LF
```

---

## AWS infrastructure (Terraform)

Production-grade IaC aligned with [aws-serverless-datamesh-framework](https://github.com/vaquarkhan/aws-serverless-datamesh-framework):

```mermaid
flowchart TB
    subgraph Network["networking"]
        VPC["VPC"]
        SUB["Private / Public subnets"]
    end

    subgraph Storage["storage · Medallion"]
        CHK["checkpoint bucket"]
        PRF["proof bucket · Steward"]
        BRZ["bronze"]
        SLV["silver"]
        GLD["gold · lakehouse"]
    end

    subgraph Compute["compute & orchestration"]
        COG["cognito"]
        LAM["integrity-gate λ"]
        SFN["step functions"]
        GLUE["glue catalog"]
    end

    subgraph Data["data & governance"]
        DDB["dynamodb catalog"]
        LF["lake formation"]
        DLQ["sqs dlq"]
    end

    VPC --> Compute
    Storage --> Compute
    Compute --> Data
```

| Module | Purpose |
|--------|---------|
| `cognito` | Admin-only user pool + default user |
| `storage` | Checkpoint, proof, bronze/silver/gold (encrypted) |
| `iam` | Orchestrator + domain writer (LF-aware) |
| `glue` | Glue Data Catalog database |
| `dynamodb` | Marketplace product registry |
| `orchestration` | SFN with integrity-gate-first ASL |
| `governance` | Lake Formation consumer SELECT |
| `messaging` | SQS DLQ |
| `lambda` | Integrity gate + domain writer functions |
| `eks` | EKS cluster for cognitive runtime |
| `portal-cdn` | S3 + CloudFront static portal hosting |

Details: [infra/terraform/README.md](infra/terraform/README.md)

---

## Feature matrix (agreed & implemented)

| Feature | Status | Location |
|---------|--------|----------|
| Zero-code drag-and-drop portal | ✅ | `portal/` |
| Block palette + properties panel | ✅ | `portal/src/components/` |
| DataContract schema + validator | ✅ | `schemas/`, `scripts/validate-contract.js` |
| Graph → contract compiler | ✅ | `lib/contract-builder/` |
| Integrity gate (Vaquar rules) | ✅ | `lib/integrity-gate/`, `rules/` |
| Step Functions compiler | ✅ | `services/pipeline-engine/` |
| API gateway + JWT auth | ✅ | `services/api-gateway/` |
| Cognito login (no signup) | ✅ | `portal/src/auth/`, `infra/terraform/modules/cognito/` |
| Catalog + marketplace UI | ✅ | `services/catalog/`, `MarketplacePanel.jsx` |
| DynamoDB catalog store | ✅ | `DynamoProductStore.java` |
| AWS Step Functions deploy | ✅ | `lib/aws/stepfunctions-deploy.js` |
| Cognitive transactional runtime | ✅ | `services/cognitive-runtime/` |
| Agent MCP (Bedrock) | ✅ | `services/agent-mcp/` |
| Integrity gate Lambda | ✅ | `services/lambda/integrity-gate/` |
| Domain writer Lambda (PVDM) | ✅ | `services/lambda/domain-writer/` |
| Vaquar contract → mesh bridge | ✅ | `lib/vaquar/contract-to-mesh.js` |
| PVDM Step Functions (durable) | ✅ | `lib/vaquar/pvdm-sfn.js` |
| PVDM runtime (IceGuard/VRP) | ✅ | `services/pvdm-runtime/` |
| EKS cognitive cluster | ✅ | `infra/terraform/modules/eks/` |
| Portal CloudFront CDN | ✅ | `infra/terraform/modules/portal-cdn/` |
| Production Terraform | ✅ | `infra/terraform/` |
| CI integrity gate workflow | ✅ | `.github/workflows/integrity-gate.yml` |
| HTTP E2E tests | ✅ | `scripts/test-api-e2e.js` |
| Vaquar bridge tests | ✅ | `scripts/test-vaquar-bridge.js` |
| PVDM runtime tests | ✅ | `scripts/test-pvdm-runtime.js` |

---

## Repository layout

```
cognimesh/
├── portal/                    # Zero-code SPA (React + React Flow + Cognito)
├── services/
│   ├── api-gateway/           # JWT auth, preview, deploy, catalog proxy
│   ├── catalog/                 # Marketplace API (Spring Boot)
│   ├── pipeline-engine/         # Contract → Step Functions
│   ├── cognitive-runtime/       # Epoch / frontier / compensation (Go)
│   ├── agent-mcp/               # MCP server for Bedrock
│   └── lambda/integrity-gate/   # Runtime integrity gate
├── lib/
│   ├── contract-builder/      # Graph → contract → deploy orchestration
│   ├── integrity-gate/          # Vaquar-inspired rules engine
│   └── aws/                     # Step Functions deploy
├── schemas/                     # DataContract JSON Schema
├── contracts/examples/          # Sample pipelines
├── rules/                       # Integrity gate policies
├── infra/terraform/             # Production IaC
├── docs/                        # Architecture + specs
└── scripts/                     # Validators + E2E tests
```

---

## Quick start (full stack)

```bash
git clone <repo>
cd atomix
npm install
cp .env.example .env
npm start
```

| Service | URL |
|---------|-----|
| Portal | http://localhost:3000 |
| API | http://localhost:4000 |
| Catalog | http://localhost:8080 |

**Workflow:** Sign in → drag Source → Transform → Sink → connect edges → **Deploy Pipeline** → view YAML, Step Functions, marketplace.

---

## Tests

```bash
npm test              # Graph → contract → schema → compile → integrity gate
npm run test:api      # Full HTTP E2E (requires npm start)
npm run test:integrity-gate -- contracts/examples/structured-cdc-pipeline.yaml
```

```mermaid
flowchart LR
    T1["test:e2e"] --> T2["test:integrity-gate"]
    T3["test:api"] --> H["health"]
    T3 --> P["preview"]
    T3 --> D["deploy"]
    T3 --> M["marketplace"]
```

---

## AWS production deploy

```bash
# 1. Package integrity gate Lambda
npm run package:lambda

# 2. Terraform
cd infra/terraform/environments/prod
cp terraform.tfvars.example terraform.tfvars
# Edit bucket names + default_admin_email
terraform init && terraform apply

# 3. Retrieve Cognito admin password
terraform output -raw cognito_default_admin_initial_password
terraform output cognito_user_pool_id
terraform output cognito_client_id
```

**`.env` for production:**

```env
AUTH_DISABLED=false
COGNITO_USER_POOL_ID=us-east-1_xxxxx
COGNITO_CLIENT_ID=xxxxxxxx
AWS_DEPLOY_ENABLED=true
AWS_REGION=us-east-1
AWS_STEP_FUNCTIONS_ROLE_ARN=arn:aws:iam::ACCOUNT:role/cognimesh-prod-pipeline-orchestrator
```

**Catalog with DynamoDB:**

```yaml
# services/catalog/src/main/resources/application-prod.yml
cognimesh:
  catalog:
    storage: dynamodb
    table-name: cognimesh-prod-cognimesh-data-products
```

---

## Data contract

Every pipeline is declared in `DataContract.yaml` (`cognimesh.io/v1`):

```mermaid
flowchart TB
    DC["📄 DataContract.yaml"]
    DC --> Portal
    DC --> Validator
    DC --> Compiler
    DC --> Gate["Integrity Gate"]
    DC --> Catalog
    DC --> LF["Lake Formation"]
```

| Section | Contents |
|---------|----------|
| `metadata` | name, domain, version, owner, tags |
| `spec.execution` | `batch` / `stream`, schedule, SLA |
| `spec.source` | connection, CDC, schema |
| `spec.transform` | `spark_sql`, `agentic`, layers |
| `spec.target` | iceberg, S3 location, catalog |
| `spec.governance` | PII, row filters, column masks |

Spec: [docs/data-contract-spec.md](docs/data-contract-spec.md)

---

## CI pipeline

```mermaid
flowchart LR
    PR["Pull Request"] --> V["Validate contracts"]
    PR --> IG["Integrity gate"]
    PR --> C["Compile SFN"]
    PR --> Go["Go runtime tests"]
    PR --> J["Catalog tests"]
    V & IG & C & Go & J --> OK["✅ Merge"]
```

Workflow: [`.github/workflows/integrity-gate.yml`](.github/workflows/integrity-gate.yml)

---

## Documentation index

| Document | Description |
|----------|-------------|
| [docs/drag-drop-pipeline-flow.md](docs/drag-drop-pipeline-flow.md) | Portal → deploy E2E |
| [docs/architecture.md](docs/architecture.md) | Architecture deep-dive |
| [docs/data-contract-spec.md](docs/data-contract-spec.md) | Appendix A: YAML spec |
| [infra/terraform/README.md](infra/terraform/README.md) | IaC modules + Cognito |
| [Vaquar Pattern](https://github.com/vaquarkhan/aws-serverless-datamesh-framework/blob/main/docs/vaquar-pattern.md) | PVDM reference pattern |
| [Serverless Data Mesh](https://github.com/vaquarkhan/aws-serverless-datamesh-framework) | Reference AWS implementation |

---

## License

Proprietary. CogniMesh Platform Team.

<p align="center">
  <sub>Domain teams own the pipeline design. The mesh proves correctness before publication.</sub>
</p>
