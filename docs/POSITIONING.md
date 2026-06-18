# CogniMesh positioning

Plain-language scope for evaluators, product owners, and architects. Modeled on [veridata POSITIONING](https://github.com/vaquarkhan/veridata/blob/main/POSITIONING.md): say what is real today, what is not, and how this repo relates to sibling projects.

---

## What CogniMesh is

CogniMesh is a **visual control plane** for designing data products on AWS: portal, data contracts, integrity gate, PVDM runtime, marketplace, and operations UI. Structured pipelines can attach a **Verifiable Reconciliation Proof (VRP)** before Iceberg / catalog commit when the Vaquar execution path is enabled.

**Platform packaging:** `1.0.0` (portal, API, SDK artifacts on GitHub / PyPI / GHCR).

**Proof implementation today:** CogniMesh's own **JavaScript** stack (`lib/vrp/`, proof v3). It is **not** a wrapper around the [veridata](https://github.com/vaquarkhan/veridata) Rust crate yet.

---

## What CogniMesh is NOT (do not claim these today)

| Do not claim | Reality |
|--------------|---------|
| "CogniMesh runs on veridata" | Verification runs in **CogniMesh JS**. [veridata integration](veridata-integration.md) (item C1) is **planned**, not shipped. |
| "Industry-standard Vaquar Pattern" | The **Vaquar Pattern** is a **proposed** reference architecture by [Vaquarkhan](https://github.com/vaquarkhan), documented in [vaquar-pattern.md](vaquar-pattern.md). It is not an external standard body. |
| "Cryptographic proof in every install" | **Production** proofs use **AWS KMS** when `VRP_KMS_KEY_ID` is set. Local/dev uses ephemeral Ed25519. Unsigned runs are `UNVERIFIED`. |
| "Transform verification everywhere" | **Identity** multiset checks are default. **Aggregate** mode (per-group lineage, derived invariants) requires explicit `pvdm.vrp` config. Transform logic exists in **CogniMesh JS only**; [veridata](https://github.com/vaquarkhan/veridata) and the datamesh framework do not inherit it yet. |
| "One-click deploy to production AWS" | Deploy compiles artifacts and can trigger Step Functions when credentials and Terraform/modules are configured. You still need AWS accounts, IAM, buckets, and review of design-review findings. Success toasts mean **compile/register succeeded**, not that every AWS resource is live. |
| "28+ distinct products" | **27 ready-made pipeline canvases** (26 wired examples + blank) plus **8 agent tutorials** (separate from pipeline patterns). |
| "Proof = semantically correct data" | VRP proves **integrity and declared invariants** on chosen fields, not that SQL, ML, or LLM conclusions are business-correct. |
| "Same maturity as veridata 1.0" | veridata is **`0.1.x`** with Rust spec + conformance focus. CogniMesh platform is **`1.0.0`** packaging with a **newer but separate** JS proof path. Version numbers are **not** aligned across repos. |

---

## Claims sometimes made vs reality

| Claim sometimes made | Reality today |
|----------------------|---------------|
| Proof-gated publication | **Yes**, when `execution.pattern: vaquar` and PVDM runs: metadata commit blocked on VRP `FAIL`. Empty runs → `UNVERIFIED`, not `PASS`. |
| Offline-verifiable proofs | **Yes**, with producer public key + proof JSON (`scripts/verify-vrp-proof.js`). |
| Tests-passing | **CI runs on push/PR** ([workflow](https://github.com/vaquarkhan/CogniMesh/actions/workflows/ci.yml)): lint, unit tests, portal build, e2e scripts. Check the badge, not a static green label. |
| Gateway-enforced agent inputs | **Implemented**; production enforcement is an **org policy** choice (`VRP_ALLOW_DECLARED_INPUTS` off). |
| Datamesh framework gets CogniMesh v3 features | **No**, until features land in **veridata** and consumers upgrade. |
| Zero-code forever | **Zero-code to start**; production needs contracts, AWS, stewards, and optional Terraform. |

---

## How CogniMesh relates to veridata and the datamesh framework

```
┌─────────────────┐     planned (C1)      ┌──────────────┐
│   CogniMesh     │ ───────────────────►  │   veridata   │
│   (JS lib/vrp)  │      not wired yet    │   (Rust)     │
└─────────────────┘                       └──────┬───────┘
                                                   │
                                                   ▼
                                          ┌──────────────────┐
                                          │ Datamesh framework│
                                          │ (Python)          │
                                          └──────────────────┘
```

- **[veridata](https://github.com/vaquarkhan/veridata)** - VRP engine, spec, Rust conformance suite (`0.1.x`).
- **CogniMesh** - Portal + PVDM runtime; **currently reimplements** verification in JS (v3).
- **[AWS Serverless Data Mesh Framework](https://github.com/vaquarkhan/aws-serverless-datamesh-framework)** - Python runtime; uses **veridata**, not CogniMesh JS.

**Single source of truth (target):** port transform verification into veridata, then CogniMesh delegates (see [veridata-integration.md](veridata-integration.md)).

---

## Adoption path (realistic)

| Stage | You get |
|-------|---------|
| **Local demo** | Portal + API + sample PVDM run; dev signing; no AWS required for basic proof flow. |
| **AWS dev** | Step Functions, S3 proofs, Glue/Iceberg with credentials; review Run History PASS/FAIL. |
| **Production** | KMS signing, `PROOF_BUCKET`, Lake Formation, steward approvals, disable test-only flags. |
| **Shared proof engine** | After C1: CogniMesh + datamesh framework on same veridata verification. |

---

## What to say publicly

**Say:** visual data-mesh control plane; proof before publish when Vaquar path enabled; fail-closed verdicts; offline verification; steward marketplace workflows.

**Say with caveats:** transform verification (aggregate mode + contract config); KMS-signed proofs (production config); agent attestations (gateway policy).

**Do not say:** "100% foolproof," "runs on veridata today," "industry-standard Vaquar Pattern," or "one-click production AWS" without setup caveats.

---

## Related docs

- [FAQ](FAQ.md)
- [Vaquar Pattern](vaquar-pattern.md) (proposed architecture + data examples)
- [veridata integration](veridata-integration.md)
- [Business steward guide](README-business-stewards.md)
