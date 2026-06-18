# CogniMesh positioning

Product scope for evaluators, product owners, and architects: what CogniMesh delivers today, how it fits the Vaquar ecosystem, and where we are headed.

---

## What CogniMesh is

CogniMesh is a **visual control plane** for trustworthy data products on AWS:

- Zero-code **portal** for pipeline and agent design
- **Data contracts** and integrity gate
- **PVDM runtime** (Physical → Verify → Durable → Metadata) on the Vaquar path
- **Marketplace**, steward approvals, and operations UI
- **Verifiable Reconciliation Proofs (VRP)** before Iceberg / catalog commit when verification succeeds

**Platform release:** `1.0.0` (portal, API, SDK on GitHub, PyPI, GHCR).

---

## What ships today

| Capability | Summary |
|------------|---------|
| **Proof-gated publication** | On the Vaquar path, catalog commit proceeds when verification **PASS**es. Runs are recorded in Run History with clear outcomes. |
| **VRP v3** | Identity and aggregate transform verification, contract binding, logical content digest, offline verify CLI |
| **27 pipeline canvases** | 26 wired examples + blank canvas; 8 agent tutorials in Agent Builder |
| **Integrity gate** | Design-time policy checks before deploy |
| **KMS signing** | Production proofs via AWS KMS when configured |
| **Gateway + attestations** | Proof-aware data serve and signed decision attestations on agent paths |
| **CI quality** | Automated tests on every push/PR ([CI workflow](https://github.com/vaquarkhan/CogniMesh/actions/workflows/ci.yml)) |
| **Conformance vectors** | Published proof fixtures (`npm run verify:conformance`) |

Full proof semantics and data examples: [Vaquar Pattern](vaquar-pattern.md).

---

## Configuration highlights

CogniMesh is designed to scale from **local demo** to **production AWS**. These settings unlock the full experience:

| Goal | Configuration |
|------|----------------|
| **Signed production proofs** | `VRP_KMS_KEY_ID`, `PROOF_BUCKET` |
| **Aggregate pipelines** | `spec.transform.pvdm.vrp.mode: aggregate` with `groupBy`, `amountField`, `feeMultiplier` |
| **Agent gateway enforcement** | `VRP_GATEWAY_SECRET`; keep `VRP_ALLOW_DECLARED_INPUTS` off in production |
| **AWS deploy** | Credentials, Terraform modules, design-review pass, optional `DEPLOY_APPROVAL_REQUIRED` |

VRP focuses on **integrity and declared invariants** on chosen fields. Business semantics of SQL, ML, and LLM outputs remain governed by your contracts and review processes.

---

## Vaquar ecosystem

CogniMesh, [veridata](https://github.com/vaquarkhan/veridata), and the [AWS Serverless Data Mesh Framework](https://github.com/vaquarkhan/aws-serverless-datamesh-framework) share the **Vaquar Pattern** vision: prove sink matches source before publish.

```
┌─────────────────┐                       ┌──────────────┐
│   CogniMesh     │   shared target       │   veridata   │
│   portal + PVDM │ ───────────────────►  │   Rust VRP   │
│   (VRP v3 JS)   │                       └──────┬───────┘
└─────────────────┘                              │
                                                   ▼
                                          ┌──────────────────┐
                                          │ Datamesh framework│
                                          │ (Python)          │
                                          └──────────────────┘
```

| Project | Role today |
|---------|------------|
| **CogniMesh** | Visual control plane; VRP v3 in JavaScript (`lib/vrp/`) |
| **veridata** | Rust VRP engine and spec (`0.1.x`); multiset recon + conformance suite |
| **Datamesh framework** | Python serverless runtime consuming veridata |

**The Vaquar Pattern** is [Vaquarkhan](https://github.com/vaquarkhan)'s reference architecture, documented in [vaquar-pattern.md](vaquar-pattern.md).

Technical integration plan: [veridata integration](veridata-integration.md).

---

## Adoption path

| Stage | Experience |
|-------|------------|
| **Explore** | Portal, pattern library, sample PVDM run locally |
| **Develop** | AWS dev account, Step Functions, Run History, proof artifacts |
| **Operate** | KMS, proof bucket, Lake Formation, steward approvals |
| **Unify** | Shared veridata engine across CogniMesh and datamesh framework (see roadmap) |

---

## Future roadmap

| Phase | Focus | Outcome |
|-------|--------|---------|
| **C1** | CogniMesh delegates transform verification to **veridata** | One Rust implementation; CogniMesh calls veridata instead of duplicate JS |
| **V1** | Per-group lineage in veridata `recon.rs` | Swap-attack detection in Rust; datamesh framework inherits |
| **V2** | Derived invariants from transform spec in veridata | Aggregate pipelines shared across all Vaquar consumers |
| **V3–V7** | Money model, Merkle localization, logical digest, contract/env binding in veridata | Feature parity with CogniMesh v3 proof envelope |
| **Shared conformance** | Same `fixtures/vrp-conformance/` for JS and Rust | Both engines pass identical vectors in CI |
| **Attestation log** | Extend transparency log to decision attestations | End-to-end audit trail across data and agent layers |
| **Portal** | Deeper veridata status in Run History | Single pane for proof engine version and verify source |

Prioritized engineering detail for C1 and V1/V2: [veridata-integration.md](veridata-integration.md).

---

## Messaging guide

**Lead with:** visual data-mesh control plane · Vaquar Pattern · proof before publish · marketplace and steward workflows · offline-verifiable proofs.

**Highlight when relevant:** aggregate mode for roll-ups · KMS-signed proofs in production · gateway-enforced agent inputs · 27 ready-made pipeline canvases.

---

## Related docs

- [Vaquar Pattern](vaquar-pattern.md) - architecture, data examples, VRP features
- [FAQ](FAQ.md)
- [veridata integration](veridata-integration.md)
- [Business steward guide](README-business-stewards.md)
