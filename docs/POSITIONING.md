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
| **Gateway + attestations** | Proof-aware data serve and signed decision attestations on agent paths (**CogniMesh extension**, not the PVDM paper protocol) |
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

**The Vaquar Pattern** is [Vaquar Khan](https://github.com/vaquarkhan)'s method (operational acronym **PVDM**), specified in [vaquar-pattern.md](vaquar-pattern.md).

### Read the paper & reference gate

| | |
|---|---|
| **arXiv preprint** | [arXiv:2608.14643](https://arxiv.org/abs/2608.14643) — *Proof-Gated Publication: Verify-Before-Commit Content Integrity for Serverless Data-Mesh Lakehouses* |
| **Reference gate + adversarial suite** | [github.com/vaquarkhan/Proof-gated-publication-PVDM](https://github.com/vaquarkhan/Proof-gated-publication-PVDM) (stdlib Python gate, 30/30 suite, Spark/Iceberg benchmarks) |
| **This repo** | CogniMesh control plane + JS VRP gate (portal, contracts, marketplace). Not the Python IceGuard/veridata-recon package. |

| | |
|---|---|
| **Method name** | Vaquar Pattern |
| **Operational acronym** | PVDM (Physical · Verify · Durable · Metadata) |
| **Inventor** | Vaquar Khan |
| **Copyright** | © 2024–2026 Vaquar Khan — proprietary method (name + invariants) |
| **Status** | Proprietary method · open reference implementation (Apache-2.0) |
| **Cite** | [arXiv:2608.14643](https://arxiv.org/abs/2608.14643) · [docs/vaquar-pattern.md](vaquar-pattern.md) · [NOTICE](../NOTICE) |

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

## Where CogniMesh differs (catalogs, governance, lakehouses)

| Product | What it does well | Gap vs CogniMesh |
|---------|-------------------|------------------|
| **Apache Polaris / Iceberg REST** | Multi-engine catalog, RBAC, credential vending | Catalog correctness ≠ content integrity. Polaris is a natural **Steward-side catalog host** for PVDM; it does not prove rows were not dropped or mutated. |
| **AWS Glue + Lake Formation** | IAM, LF grants, Iceberg REST, catalog federation | Same gap: a successful Glue job is not a VRP. CogniMesh gates the Metadata commit. |
| **OpenMetadata / DataHub** | Discovery, contracts UI, lineage, quality dashboards | Quality tests are observational. Marketplace **trust grade** here is bound to VRP PASS + snapshot pin + source snapshot. |
| **Starburst Icehouse / Iceberg v3** | REST catalog, row lineage (`_row_id`), deletion vectors | Row lineage tracks *what changed*, not that intended rows equal written rows. |
| **Bauplan (arXiv:2602.02335)** | Pipeline-level branches and atomic multi-table publish | Complements Iceberg atomicity; does not ship a keyed multiset proof at commit. |

**Shipped differentiator in this branch:** marketplace **trust card** (grade + Profile A/T/O + source snapshot + consumer snapshot pin). Iceberg v3 row lineage remains complementary, not a substitute for VRP.

---

## Messaging guide

**Lead with:** visual data-mesh control plane · Vaquar Pattern · proof before publish · marketplace and steward workflows · offline-verifiable proofs.

**Highlight when relevant:** aggregate mode for roll-ups · KMS-signed proofs in production · gateway-enforced agent inputs · 27 ready-made pipeline canvases.

---

## Related docs

- [Vaquar Pattern](vaquar-pattern.md) - architecture, data examples, VRP features, [paper](https://arxiv.org/abs/2608.14643)
- [NOTICE](../NOTICE) - PVDM method attribution
- [FAQ](FAQ.md)
- [veridata integration](veridata-integration.md)
- [Business steward guide](README-business-stewards.md)
