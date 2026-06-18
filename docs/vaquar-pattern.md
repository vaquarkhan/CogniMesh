<p align="center">
  <img src="https://img.shields.io/badge/The-Vaquar-Pattern-2563eb?style=for-the-badge" alt="Vaquar Pattern" />
  <img src="https://img.shields.io/badge/PVDM-Physical·Verify·Durable·Metadata-0d9488?style=for-the-badge" alt="PVDM" />
  <img src="https://img.shields.io/badge/PVDM--A-Decision·Attestation-6366f1?style=for-the-badge" alt="PVDM-A" />
  <img src="https://img.shields.io/badge/Author-Vaquarkhan-7c3aed?style=for-the-badge" alt="Author" />
</p>

<h1 align="center">The Vaquar Pattern</h1>

<p align="center">
  <strong>Proof-gated serverless data mesh writes for AWS</strong><br/>
  Design-time rules · Physical staging · Multiset verification · Durable execution · Metadata commit
</p>

<p align="center">
  <a href="../README.md">← CogniMesh</a> ·
  <a href="FAQ.md">FAQ</a> ·
  <a href="data-contract-spec.md">Data Contract</a> ·
  <a href="../lib/vaquar/contract-to-mesh.js">mesh compiler</a> ·
  <a href="../services/pvdm-runtime/">PVDM runtime</a>
</p>

---

## Overview

The **Vaquar Pattern** is a reference architecture for building **trustworthy data products** on AWS serverless infrastructure. It was created by **[Vaquarkhan](https://github.com/vaquarkhan)** to solve a recurring data-mesh failure mode: pipelines that write physical data and catalog metadata **without cryptographic proof** that source and sink agree.

CogniMesh implements the Vaquar Pattern end-to-end: from portal design through `DataContract.yaml`, integrity gate, PVDM runtime, and marketplace publication.

> **Core invariant**
>
> `commit_metadata ⟹ VRP = PASS`
>
> No Iceberg snapshot, Glue catalog update, or marketplace listing may proceed unless multiset verification passes for every committed chunk.

---

## Why the pattern exists

Traditional ETL assumes correctness. Modern data meshes need **evidence**.

| Problem | Vaquar response |
|---------|-----------------|
| Silent row loss during transform | Multiset VRP (veridata-recon) per chunk |
| Long-running Lambda timeouts | Durable execution with SFN resume loop |
| Partial writes corrupting gold tables | IceGuard chunked Parquet + rollback |
| Governance applied too late | Integrity gate at design time **and** runtime |
| Catalog drift from physical data | Metadata commit gated on VRP proof |

---

## PVDM: the four phases

**PVDM** stands for **Physical → Verify → Durable → Metadata**. Each phase has a single responsibility and a hard failure boundary.

```mermaid
flowchart LR
    classDef physical fill:#1e40af,stroke:#1e3a8a,color:#fff
    classDef verify fill:#0d9488,stroke:#0f766e,color:#fff
    classDef durable fill:#7c3aed,stroke:#6d28d9,color:#fff
    classDef metadata fill:#d97706,stroke:#b45309,color:#fff

    P["① Physical<br/><small>IceGuard · chunked Parquet</small>"]
    V["② Verify<br/><small>VRP multiset proof</small>"]
    D["③ Durable<br/><small>SFN resume loop</small>"]
    M["④ Metadata<br/><small>Glue / Iceberg commit</small>"]

    P --> V --> D --> M
    V -.->|FAIL| X["❌ Blocked"]

    class P physical
    class V verify
    class D durable
    class M metadata
    style X fill:#fee2e2,stroke:#dc2626,color:#991b1b
```

### Phase 0 (design time): Rules before runtime

Before PVDM executes, CogniMesh runs an **integrity gate** against declarative policies (`rules/default-policies.yaml`). This mirrors SparkRules-style governance at design time so bad contracts never reach AWS.

```mermaid
flowchart TB
    Portal["Zero-code portal"] --> Contract["DataContract.yaml"]
    Contract --> Gate["Integrity Gate"]
    Gate -->|PASS| Compile["Compile mesh + SFN"]
    Gate -->|FAIL| Block["Deploy blocked"]
```

---

## Building blocks

| Block | Phase | Responsibility | CogniMesh implementation |
|-------|-------|----------------|--------------------------|
| **Integrity Gate** | 0 · Rules | Schema, security, compliance checks | `lib/integrity-gate/`, `services/lambda/integrity-gate/` |
| **SparkRules** | 0 · Rules | Optional DRL filter before physical write | `services/pvdm-runtime/` `applySparkRules()` |
| **IceGuard** | 1 · Physical | Chunked Parquet, checkpoint, rollback | `services/pvdm-runtime/` `IceGuardWriter` |
| **veridata-recon** | 2 · Verify | Multiset hash comparison (VRP) | `services/pvdm-runtime/` `generateVRP()` |
| **Durable Execution** | 3 · Durable | 15-min Lambda segments, SFN resume | `lib/vaquar/pvdm-sfn.js` |
| **GlueCatalogConnector** | 4 · Metadata | Proof-gated catalog commit | `validateThenCommit()` + `commitMetadata()` |
| **Domain Writer** | Runtime | Orchestrates full PVDM workload | `services/lambda/domain-writer/` |

---

## VRP: verifiable reconciliation proof

VRP compares **source** and **sink** multisets over identity + content fields. A SHA-256 hash of row counts per composite key must match exactly - but the proof does **not** stop at a self-reported hash. The signed envelope binds **content-addressable sink artifacts** so an independent verifier can recompute the sink side from durable storage.

```mermaid
sequenceDiagram
    participant Src as Source chunk
    participant W as IceGuard writer
    participant Store as Parquet chunk store
    participant V as VRP engine
    participant Cat as Glue / Iceberg catalog

    Src->>W: writeChunk(n)
    W->>Store: persist Parquet + footer digest
    Store-->>W: read-back rows (independent materialization)
    W->>V: hashMultiset(source)
    W->>V: hashMultiset(sink from read-back)
    V->>V: bind file_digests[], manifest_digest, iceberg_snapshot_id
    alt hashes match + artifacts bound
        V-->>Cat: verdict PASS + signed proof
        Cat->>Cat: commit real snapshot id
    else mismatch or digest drift
        V-->>W: verdict FAIL
        W->>W: rollback uncommitted chunks
    end
```

**Proof envelope** (`proof_version: "3"`, v2 still accepted by verifier) includes:

| Field | Purpose |
|-------|---------|
| `multiset.source_hash` / `multiset.sink_hash` | JCS SHA-256 over row-count map (identity + content fields) |
| `multiset.mode` | `identity` (row-preserving) or `aggregate` (transform changes grain) |
| `multiset.sink_materialization` | Must be `"read_back"` - sink hash from persisted bytes, not in-memory copy |
| `transform_verification` | Derived invariants, per-group lineage hash, `transform_content_hash` |
| `sink_artifacts.logical_content` | Compaction-safe `logical_content_hash` (primary trust after `OPTIMIZE`) |
| `sink_artifacts.file_digests[]` | Per-chunk Parquet URI + digest (`physical_binding: secondary`) |
| `sink_artifacts.manifest_digest` | Binds catalog commit to proof multiset |
| `contract_binding.contract_hash` | JCS hash of signed contract at mint time |
| `environment_binding` | `aws_account_id`, `environment`, `table_uuid`, `region` |
| `reproducible_computation` | Claim: output is deterministic result of transform T over signed inputs |
| `failure_localization` | Merkle roots + hashed offending keys on FAIL (no raw PII) |
| `iceberg_snapshot_id` | Real Glue `current-snapshot-id` or monotonic catalog state - not `snap-${Date.now()}` |
| `snapshot_pin.sql` | `FOR SYSTEM_VERSION AS OF <id>` for consumer queries |
| `schema_fingerprint` | Detects schema drift between source and sink |
| `pipeline_run_id`, `chunk_sequence` | Replay binding |
| `not_before` / `not_after` | Freshness window |
| `signing` | KMS `kms:Sign` (production) or dev-Ed25519 (local only) |

**Outcomes** (aligned with serverless-data-mesh domain writer):

| Outcome | Meaning |
|---------|---------|
| `committed` | All chunks verified; metadata updated |
| `verification_failed` | VRP FAIL; no snapshot |
| `unverified` | Empty workload, filtered-to-zero, or PVDM not run - **not** PASS |
| `rolled_back` | Runtime error; IceGuard checkpoints reverted |
| `signing_failed` | KMS signing error; deploy blocked |
| `publish_blocked` | Transparency log or proof persistence failed; deploy blocked |

### What VRP proves - and what it does not

- **Proves:** For **identity** transforms (row-preserving): source and sink multisets match over declared fields. For **aggregate** transforms: derived invariants (per-group sums, lineage hashes) hold; swap attacks fail even when global totals match. Sink multiset was derived from independently read persisted bytes; logical content hash survives Iceberg compaction; contract and environment are bound; the proof was signed under a named key within a validity window; the Iceberg snapshot id resolves to catalog state.
- **Does not prove:** Semantic correctness of ML/LLM judgments, or integrity of columns outside `identityFields` + `contentFields`. Reproducible computation attests determinism of a **declared** transform - correctness of the transform code remains a separate review artifact.

### Security features

| Feature | What it does |
|---------|----------------|
| Content-bound sink | Parquet footer or NDJSON full-file digests; verifier recomputes from read-back bytes |
| Canonical proof payloads | RFC 8785-style JCS; decimal strings for numbers; stable key ordering |
| KMS signing | Production proofs signed with `kms:Sign`; dev Ed25519 for local only |
| Replay binding | `pipeline_run_id`, chunk sequence, validity window, table + snapshot identity |
| Real snapshot pins | Glue Iceberg `current-snapshot-id` or monotonic catalog state |
| Proof-aware gateway | Agents receive data only after proof verify; HMAC `gatewayToken` for attestations |
| Broad field coverage | All columns hashed by default; optional `identityFields` to narrow scope |
| Fail-closed outcomes | Empty or errored runs → `UNVERIFIED` or `FAIL`, never silent `PASS` |

### Trust model

VRP proofs are **not** “no trust required.” They reduce risk when all of the following hold:

1. **Sink binding** - Proofs include per-chunk Parquet footer digests and Iceberg manifest digests; `verifyVrpProof(proof, { localPath })` recomputes footer SHA-256 from persisted bytes.
2. **Signing custody** - Production signing uses **AWS KMS** (`VRP_KMS_KEY_ID`, `kms:Sign`); key material is non-exportable. Publish the public key out-of-band; trust KMS key policy + CloudTrail.
3. **Canonical payloads** - RFC 8785-style JCS (`lib/vrp/canonical.js`) over a strict schema (strings; numbers as decimal strings; no floats/undefined).
4. **Freshness** - Proofs carry `pipeline_run_id`, `chunk_sequence`, `not_before` / `not_after`, and catalog table + Iceberg snapshot identity.
5. **Fail closed** - Exceptions and empty workloads yield `UNVERIFIED`, never `PASS`. KMS signing failures yield `signing_failed` and block deploy.
6. **Sink read-back** - Source multiset hashed pre-write; sink multiset hashed after reading persisted bytes (`lib/vrp/parquet-chunk.js`, `lib/vrp/chunk-store.js`). Parquet footer digest via `@dsnp/parquetjs` when available; **NDJSON full-file digest fallback** on clean installs where legacy `parquetjs`/thrift breaks. `sink_materialization: "read_back"` required.
7. **Proof persistence** - `proofS3Uri` emitted only when a signed proof is written (`lib/vrp/proof-store.js`). Optional S3 Object Lock (`VRP_OBJECT_LOCK_MODE`, `VRP_OBJECT_LOCK_RETAIN_DAYS`).
8. **Transparency log** - Issued proofs append to local JSONL **and** S3 per-proof objects when `PROOF_BUCKET` is set (`lib/vrp/transparency-log.js`).
9. **Snapshot pinning** - Real `iceberg_snapshot_id` from Glue or catalog state + `snapshot_pin` SQL (`FOR SYSTEM_VERSION AS OF <id>`).
10. **Enforced inputs** - Decision attestations require `gatewayToken` from the proof-aware data gateway. Declared `inputProofs` rejected unless `VRP_ALLOW_DECLARED_INPUTS=true` (tests only).

Environment:

| Variable | Purpose |
|----------|---------|
| `VRP_KMS_KEY_ID` | KMS asymmetric key for production signing |
| `VRP_SIGNING_MODE` | `kms` (default when key set) or `dev` (ephemeral Ed25519, local only) |
| `VRP_PROOF_TTL_SEC` | Proof validity window (default 86400) |
| `VRP_SIGN_ON_GENERATE` | Set `false` to skip signing in tests |
| `PROOF_BUCKET` / `PROOF_BUCKET_NAME` | S3 bucket for proofs + transparency log objects |
| `VRP_S3_PERSIST` | Enable S3 persistence (default on when bucket set) |
| `VRP_OBJECT_LOCK_MODE` / `VRP_OBJECT_LOCK_RETAIN_DAYS` | S3 Object Lock on proof/transparency objects |
| `VRP_UPLOAD_PARQUET` | Upload Parquet chunks to lakehouse S3 URI (`true`) |
| `VRP_FORCE_NDJSON` / `VRP_SINK_FORMAT=ndjson` | Force durable NDJSON read-back (full-file digest) |
| `VRP_PARQUET_REQUIRED` | Set `true` to fail instead of NDJSON fallback when Parquet errors |
| `GLUE_ICEBERG_ENABLED` | Set `false` to skip Glue; use `data/iceberg-snapshots.json` |
| `VRP_GATEWAY_SECRET` | HMAC secret for gateway tokens |
| `VRP_ALLOW_DECLARED_INPUTS` | Allow self-declared `inputProofs` in attestations (tests only) |
| `VRP_FAIL_CLOSED` | When `true` with `PROOF_BUCKET`, failed proof persistence blocks publish |
| `VRP_ENVIRONMENT` | Environment label bound in `environment_binding` |

Conformance: `npm run verify:conformance` runs published known-good/tampered vectors (`fixtures/vrp-conformance/`).

Implementation: [`lib/vrp/`](../lib/vrp/)

### Offline verification

Consumers can verify a proof **without AWS credentials** using the producer's published public key:

```bash
node scripts/verify-vrp-proof.js path/to/proof.json --public-key producer-public.pem
```

`verifyVrpProof(proof, { publicKeyPem, localPath })` in [`lib/vrp/verify.js`](../lib/vrp/verify.js) checks:

- multiset binding (`source_hash === sink_hash`, `sink_materialization: read_back`)
- validity window (`not_before` / `not_after`)
- Parquet footer digest re-hash when `localPath` is supplied
- cryptographic signature (when present)
- optional transparency log membership

Agent MCP / API endpoints:

| Endpoint | Purpose |
|----------|---------|
| `POST /mcp/gateway/serve` | Verify proof, serve pinned snapshot rows, return `gatewayToken` |
| `POST /api/v1/gateway/serve` | Same semantics (auth required) |
| `POST /mcp/verify-proof` | Offline-style VRP proof verification |
| `POST /mcp/verify-attestation` | Verify decision attestation signature + output hash |

---

## PVDM-A: carrying proof into agent decisions

PVDM proves the **data** is intact. It says nothing about what an **agent** then does with that data. The recurring failure mode in agentic systems is *verified inputs feeding an unverifiable decision*: an LLM reads a clean dataset, produces an action, and there is no way for a downstream consumer to confirm the decision was computed only from proven inputs, or that the decision record was not altered afterward.

**PVDM-A** (Decision Attestation) extends the proof chain one hop past the data layer. It is a distinct extension - not a fifth PVDM phase - but it shares the same custody model and fail-closed semantics.

> **Decision invariant**
>
> `mint_attestation ⟹ every input proof verifies offline = PASS`
>
> An attestation is never minted over an input proof that fails verification. Fail closed.

### What it binds

When the agent runtime produces a decision, it signs an attestation body (`lib/vrp/decision-attestation.js`, `attestation_version: "1"`):

| Field | Meaning |
|-------|---------|
| `session_id` | Agent session the decision belongs to |
| `decision_id` | Stable id for this decision (idempotency key) |
| `nonce` | Per-attestation UUID to bind uniqueness |
| `pipeline_run_id` | Run that produced the consumed data |
| `iceberg_snapshot_id` | The exact table snapshot the agent read |
| `inputs[]` | Normalized binding of each verified VRP proof: `pipeline_run_id`, `chunk_sequence`, `table`, `schema_fingerprint`, `source_hash`, `sink_hash`, `manifest_digest`, `file_digest_count`, `gateway_enforced`, `gateway_served_at`, `gateway_row_count` |
| `output_hash` | JCS SHA-256 of the agent output (hash, not raw content) |
| `tool_calls_hash` | JCS SHA-256 of the tool-call list |
| `not_before` / `not_after` | Validity window |
| `signed_at` | Issue time |
| `signing` | KMS or dev-Ed25519 signature envelope (same custody model as VRP) |

### Flow

```mermaid
sequenceDiagram
    participant GW as Proof gateway
    participant DS as Proven dataset (VRP)
    participant AG as Bedrock agent
    participant AT as Attestation engine
    participant C as Consumer (offline)

    DS->>GW: proof + snapshot pin
    GW->>GW: verifyVrpProof + serve rows
    GW-->>AG: rows + gatewayToken
    AG->>AT: output + tool calls + gatewayToken
    AT->>AT: resolveGatewayInputs (fail closed)
    alt all inputs PASS
        AT-->>AG: signed Decision Attestation
    else any input fails
        AT-->>AG: verdict FAIL, no attestation
    end
    C->>C: verifyDecisionAttestation(att, publicKey)
```

### Gateway: served, not declared

Attack 6 is addressed at the **data-access boundary**:

1. Consumer calls `serveProofGatedDataset({ proof, sessionId, localPath })` - verifies the VRP proof, reads pinned snapshot materialization, returns rows + HMAC `gatewayToken`.
2. Agent invocation passes `gatewayToken` (not raw `inputProofs`) to `POST /mcp/invoke`.
3. `buildDecisionAttestation` resolves the token → verified proof; each `inputs[]` entry records `gateway_enforced: true`.

Declared `inputProofs` are **rejected by default** (`VRP_ALLOW_DECLARED_INPUTS=true` only in tests). This closes the loophole where a compromised agent reads unproven data but lists only proven inputs in the attestation.

### Verification

`verifyDecisionAttestation(attestation, options)` returns `VERIFIED` only when **all** of these hold:

- `attestation_version` is supported,
- validity window is current (`not_before` / `not_after`),
- the signature verifies against the public key,
- at least one input binding is present,
- (optional) recomputed `output_hash` matches the supplied output,
- (optional) recomputed `tool_calls_hash` matches the supplied tool calls.

Live endpoints:

| Endpoint | Purpose |
|----------|---------|
| `POST /mcp/gateway/serve` | Verify proof, serve rows, mint `gatewayToken` |
| `POST /mcp/invoke` (with `sessionId` + `gatewayToken`) | Mints signed attestation alongside agent result |
| `POST /mcp/verify-attestation` | Verifies attestation signature + hashes |

### What it proves - and what it does not

- **Proves:** the decision was computed only from inputs whose VRP proofs verify (via gateway token when enforcement is on), against a named snapshot, under a recorded tool-call set, and that the decision record has not been altered since signing (output/tool-call hashes + signature).
- **Does not prove:** that the decision is *semantically correct*. An LLM's judgment cannot be cryptographically proven right. The attestation establishes **provenance and integrity of the decision context**, not correctness of the conclusion.

### Notes

- Gateway + attestation are available on agent paths; your org chooses whether to require them in production (`VRP_ALLOW_DECLARED_INPUTS` should stay off in prod).
- VRP proofs append to the transparency log today; decision attestations may use the same log in a future release.

Implementation: [`lib/vrp/decision-attestation.js`](../lib/vrp/decision-attestation.js) · [`lib/vrp/proof-gateway.js`](../lib/vrp/proof-gateway.js) · wired in [`services/agent-mcp/server.js`](../services/agent-mcp/server.js)

---

## VRP features

Product features for proof-gated publish (`proof_version: "3"`; v2 proofs still verify).

### Proof & custody

- Content-bound sink (read-back Parquet footer or NDJSON digest)
- JCS canonicalization and decimal string coercion for numbers
- KMS signing in production; offline verifier and CLI
- Fail-closed verdicts (`UNVERIFIED` / `FAIL`, not silent `PASS`)
- Real Iceberg snapshot ids and snapshot pin SQL
- Transparency log for issued proofs
- Signed contract hash and environment binding in each proof
- Parquet via `@dsnp/parquetjs` with NDJSON fallback when needed

### Transform verification

**Identity mode** - row-preserving pipelines (copy, CDC, repartition, dedupe): source and sink multisets must match on declared fields.

**Aggregate mode** - set `spec.transform.pvdm.vrp.mode: aggregate` with `groupBy`, `amountField`, `feeMultiplier`, `moneyFields`, `numericTolerance`. The verifier checks derived sums, per-group lineage, and money invariants (swap attacks fail even when global totals match).

### Verification & operations

- Per-group lineage and invariants derived from the transform spec
- Money fields in minor units with rational multipliers
- Merkle-based failure localization with hashed keys (no raw PII in failure records)
- Compaction-safe `logical_content_hash` (primary after Iceberg `OPTIMIZE`)
- Reproducible computation claim (`transform_content_hash` + output logical hash)
- Published conformance vectors (`npm run verify:conformance`)
- Signing, transparency, or persistence failures block publish

### Reproducible attested computation

VRP v3 proofs include a **reproducible computation** claim: signed inputs, pinned transform spec, signed output logical digest. Consumers can re-run the declared transform and compare digests; correctness of the transform code is still a separate review step.

---

## Durable execution model

AWS Lambda has a 15-minute ceiling. Vaquar workloads may run 90+ minutes. The pattern uses **Step Functions** with a resume loop:

```mermaid
stateDiagram-v2
    [*] --> IntegrityGate
    IntegrityGate --> InvokeDomainWriter: PASS
    IntegrityGate --> [*]: FAIL
    InvokeDomainWriter --> CheckOutcome
    CheckOutcome --> Success: committed
    CheckOutcome --> WaitBeforeResume: rolled_back
    WaitBeforeResume --> InvokeDomainWriter: resume_offset++
    CheckOutcome --> Failed: verification_failed
    Success --> [*]
    Failed --> [*]
```

Implementation: [`lib/vaquar/pvdm-sfn.js`](../lib/vaquar/pvdm-sfn.js)

---

## Contract → mesh bridge

CogniMesh compiles `cognimesh.io/v1` **DataContract** manifests into `sdm/v1` **DataProductPipeline** mesh YAML for Vaquar-compatible runtimes.

```
DataContract.yaml  →  contract-to-mesh.js  →  mesh.pipeline.yaml
                    →  pvdm-sfn.js         →  orchestrator.asl.json
```

| DataContract field | Mesh mapping |
|--------------------|--------------|
| `spec.execution.pattern: vaquar` | `spec.runtime.pattern` |
| `spec.transform.pvdm.*` | `spec.workload` + `spec.boundary` |
| `spec.transform.sparkRules` | `spec.runtime.spark_rules_enabled` |
| `spec.target.catalog` | `spec.runtime.metadata` |
| `spec.governance` | `spec.governance` + consumer SLAs |

Compiler: [`lib/vaquar/contract-to-mesh.js`](../lib/vaquar/contract-to-mesh.js)

Example structured pipeline: [`contracts/examples/structured-cdc-pipeline.yaml`](../contracts/examples/structured-cdc-pipeline.yaml)

---

## CogniMesh deploy flow

```mermaid
flowchart TB
    subgraph Design["Design time"]
        G["Portal graph"]
        DC["DataContract.yaml"]
        IG["Integrity Gate"]
        G --> DC --> IG
    end

    subgraph Artifacts["Generated artifacts"]
        MESH["mesh.pipeline.yaml"]
        ASL["orchestrator.asl.json"]
        SFN["Step Functions ASL"]
    end

    subgraph Runtime["Runtime (AWS)"]
        L1["Integrity Gate λ"]
        L2["Domain Writer λ"]
        SF["Step Functions"]
        L1 --> L2 --> SF
    end

    subgraph Publish["Publication"]
        CAT["Marketplace catalog"]
        LF["Lake Formation"]
    end

    IG --> MESH & ASL & SFN
    SFN --> L1
    IG -->|PASS only| CAT --> LF
```

Generated output directory:

```
generated/{domain}/{pipeline-name}/
├── mesh.pipeline.yaml
├── orchestrator.asl.json
└── manifest.json
```

---

## When to use Vaquar vs cognitive pipelines

| Dimension | Vaquar PVDM (structured) | Cognitive (EKS + Bedrock) |
|-----------|--------------------------|---------------------------|
| Input | RDS CDC, S3, Kafka | Media URLs, unstructured |
| Transform | Spark SQL, Glue | Agentic (LLM extraction) |
| Correctness model | VRP multiset proof | Epoch / frontier / compensation |
| Runtime | Lambda + Step Functions | EKS controller + MCP |
| Contract flag | `execution.pattern: vaquar` | `transform.type: agentic` |

Both paths share the same **DataContract** schema and **integrity gate** at design time.

---

## Quick commands

```bash
# Validate + compile Vaquar bridge
npm run test:vaquar

# PVDM runtime unit tests (VRP, IceGuard, commit)
npm run test:pvdm

# VRP security hardening (fail-closed, JCS, KMS signing, field resolution)
npm run test:vrp-security

# Generate mesh.yaml from example contract
npm run vaquar:apply -- contracts/examples/structured-cdc-pipeline.yaml

# Package Lambdas for Terraform
npm run package:lambda
npm run package:domain-writer
```

---

## Reference implementation

The Vaquar Pattern is also embodied in the open-source **[AWS Serverless Data Mesh Framework](https://github.com/vaquarkhan/aws-serverless-datamesh-framework)** (`serverless-data-mesh` Python package). CogniMesh provides a **Node.js reference runtime** and **zero-code portal** on top of the same invariants.

| Layer | Repository path |
|-------|-----------------|
| Pattern specification | This document |
| Mesh compiler | `lib/vaquar/` |
| PVDM runtime | `services/pvdm-runtime/` |
| Python domain writer (optional) | `services/domain-writer/handler.py` |
| Terraform (prod) | `infra/terraform/` |

---

## Author & lineage

| | |
|---|---|
| **Pattern** | The Vaquar Pattern |
| **Author** | [Vaquarkhan](https://github.com/vaquarkhan) |
| **Platform** | [CogniMesh](https://github.com/vaquarkhan/CogniMesh) |
| **Invariant** | `commit_metadata ⟹ VRP = PASS` |
| **Phases** | Physical → Verify → Durable → Metadata |

<p align="center">
  <sub>Domain teams own the pipeline design. The mesh proves correctness before publication.</sub>
</p>
