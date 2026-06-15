# CogniMesh End-to-End Pipeline Diagram

AWS architecture diagram showing **all pipeline types**, services, and the full path from portal design to marketplace publication.

## Interactive diagram (draw.io)

Open in [diagrams.net](https://app.diagrams.net) or VS Code with the **Draw.io Integration** extension:

| File | Description |
|------|-------------|
| [`diagrams/cognimesh-pipeline-e2e.drawio`](diagrams/cognimesh-pipeline-e2e.drawio) | Full E2E AWS diagram — editable |

```bash
# VS Code / Cursor
code docs/diagrams/cognimesh-pipeline-e2e.drawio

# Or open in browser
# https://app.diagrams.net → Open Existing → select cognimesh-pipeline-e2e.drawio
```

> **Tip:** In draw.io, enable **More Shapes → AWS19** (or AWS4) if icons do not render on first open.

---

## Diagram overview

Four swimlanes map to CogniMesh planes:

| Lane | Contents |
|------|----------|
| **① Control Plane** | User → CloudFront → Portal (S3) → Cognito → API → Contract Builder → Integrity Gate → Compiler → CI |
| **② Structured Pipeline** | Step Functions → RDS CDC → Glue → S3 Bronze → **Vaquar PVDM** (Physical → Verify → Durable → Metadata) → Iceberg Gold |
| **③ Cognitive Pipeline** | Step Functions → S3 media → **EKS runtime** → Bedrock + MCP → Parquet → Iceberg Gold |
| **④ Marketplace** | Catalog → DynamoDB → Glue Catalog → Lake Formation → Marketplace UI · SQS DLQ · VPC |

---

## Mermaid preview (GitHub-renderable)

### Full platform flow

```mermaid
flowchart TB
    classDef aws fill:#FF9900,stroke:#232F3E,color:#232F3E
    classDef control fill:#0D9488,stroke:#0F766E,color:#fff
    classDef struct fill:#2563EB,stroke:#1D4ED8,color:#fff
    classDef cog fill:#7C3AED,stroke:#6D28D9,color:#fff
    classDef market fill:#D97706,stroke:#B45309,color:#fff

    subgraph CP["① Control Plane"]
        User((User)) --> CF[CloudFront]
        CF --> Portal[Portal SPA]
        Cognito[Cognito JWT] --> API[API Gateway]
        Portal -->|Deploy| API
        API --> CB[Contract Builder]
        CB --> IG[Integrity Gate Lambda]
        IG -->|PASS| Comp[SFN Compiler]
    end

    subgraph SP["② Structured · Vaquar PVDM"]
        Comp --> SFN1[Step Functions]
        SFN1 --> RDS[(RDS CDC)]
        RDS --> GlueE[Glue Extract]
        GlueE --> Bronze[S3 Bronze]
        Bronze --> PVDM[PVDM Lambda]
        PVDM --> P1[Physical IceGuard]
        P1 --> P2[Verify VRP]
        P2 --> P3[Durable SFN loop]
        P3 --> P4[Metadata Iceberg]
        P4 --> Gold1[S3 Gold Iceberg]
    end

    subgraph CP2["③ Cognitive · EKS + Bedrock"]
        Comp -.->|agentic| SFN2[Step Functions]
        SFN2 --> EKS[EKS Runtime]
        Media[S3 Media] --> EKS
        EKS --> Bedrock[Bedrock Agent]
        MCP[Agent MCP] --> Bedrock
        Bedrock --> Parquet[S3 Parquet Silver]
        Parquet --> Gold2[S3 Gold Iceberg]
    end

    subgraph MP["④ Marketplace"]
        API --> Cat[Catalog Service]
        Cat --> DDB[(DynamoDB)]
        DDB --> GlueCat[Glue Catalog]
        GlueCat --> LF[Lake Formation]
        LF --> Mkt[Marketplace UI]
        SFN1 -.->|fail| DLQ[SQS DLQ]
    end

    class IG aws
    class PVDM aws
    class RDS,Bronze,Gold1,Media,Parquet,Gold2 aws
    class API,Portal control
    class SFN1,GlueE struct
    class EKS,Bedrock cog
    class Cat,LF market
```

### Structured vs cognitive decision

```mermaid
flowchart LR
    DC[DataContract.yaml]
    DC -->|spec.transform.type = spark_sql| Structured[Structured Pipeline]
    DC -->|spec.transform.type = agentic| Cognitive[Cognitive Pipeline]

    Structured --> PVDM[Vaquar PVDM · Lambda + SFN]
    Cognitive --> EKS[EKS + Bedrock + MCP]

    PVDM --> Iceberg1[Iceberg Gold]
    EKS --> Iceberg2[Iceberg Gold]

    Iceberg1 --> Market[Marketplace]
    Iceberg2 --> Market
```

---

## Example contracts

| Pipeline | Contract | AWS path |
|----------|----------|----------|
| Structured CDC | [`structured-cdc-pipeline.yaml`](../contracts/examples/structured-cdc-pipeline.yaml) | RDS → Glue → S3 → PVDM → Iceberg |
| Cognitive media | [`cognitive-media-pipeline.yaml`](../contracts/examples/cognitive-media-pipeline.yaml) | S3 → EKS → Bedrock → Parquet → Iceberg |

---

## Terraform modules (production)

| Module | AWS resources in diagram |
|--------|--------------------------|
| `networking` | VPC |
| `storage` | S3 bronze / silver / gold / proof / checkpoint |
| `cognito` | Cognito user pool |
| `portal-cdn` | CloudFront + S3 portal |
| `lambda` | Integrity gate + domain writer |
| `orchestration` | Step Functions ASL |
| `glue` | Glue Data Catalog |
| `dynamodb` | Product registry |
| `governance` | Lake Formation |
| `messaging` | SQS DLQ |
| `eks` | Cognitive runtime cluster |

→ [infra/terraform/README.md](../infra/terraform/README.md)

---

## Related docs

| Document | Focus |
|----------|-------|
| [architecture.md](architecture.md) | System planes |
| [drag-drop-pipeline-flow.md](drag-drop-pipeline-flow.md) | Portal → deploy sequence |
| [vaquar-pattern.md](vaquar-pattern.md) | PVDM phases in detail |
| [LINEAGE_CATALOG.md](LINEAGE_CATALOG.md) | Post-deploy lineage |
