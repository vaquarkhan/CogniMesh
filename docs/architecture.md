# CogniMesh Architecture

**Product:** CogniMesh  
**Version:** 1.0  
**Status:** Active development

## System Planes

```mermaid
flowchart TB
    subgraph Control["Orchestration Control Plane"]
        Portal["Zero-Code Portal"]
        API["API Gateway"]
        Portal -->|"Deploy"| API
    end

    subgraph Engine["Metadata-Driven Pipeline Engine"]
        Compiler["Contract Compiler"]
        SF["Step Functions"]
        Compiler --> SF
        SF --> Glue["Glue / EMR / Lambda"]
    end

    subgraph Cognitive["Cognitive Transformation Layer"]
        Controller["Transactional Runtime"]
        Agent["AI Agent Jobs"]
        Controller --> Agent
    end

    subgraph Market["Marketplace & Governance"]
        Catalog["Catalog Service"]
        LF["Lake Formation"]
        MCP["Agent MCP Service"]
    end

    API --> Compiler
    Glue --> Controller
    Agent --> Catalog
    Catalog --> LF
    MCP --> Agent
```

## Pipeline Types

### Structured Pipeline (Vaquar PVDM)

`RDS/MySQL (CDC)` → `S3 Bronze` → `Glue Silver` → `Iceberg Gold`

Proof-gated writes follow **[The Vaquar Pattern](vaquar-pattern.md)** (Physical → Verify → Durable → Metadata).

### Cognitive Pipeline

`Media URL` → `Agentic Runtime (EKS)` → `Parquet Silver` → `Iceberg Gold`

## Transactional Runtime

The cognitive runtime (inspired by Atomix) provides:

- **Epoch tracking**: ordered sequence numbers per pipeline partition
- **Frontier tracking**: transaction isolation boundaries
- **Compensation handlers**: rollback for failed agent invocations

Implementation: `services/cognitive-runtime/`

## Marketplace Registration

1. Submit `manifest.yaml` (Data Contract)
2. CI runs `aiv-integrity-gate` (quality, security, compliance)
3. On approval → Glue Data Catalog + Lake Formation policies

## Documentation

| Document | Description |
|----------|-------------|
| [vaquar-pattern.md](vaquar-pattern.md) | The Vaquar Pattern (PVDM) |
| [drag-drop-pipeline-flow.md](drag-drop-pipeline-flow.md) | Portal E2E |
| [data-contract-spec.md](data-contract-spec.md) | DataContract spec |

See [README](../README.md) for service and infrastructure paths.
