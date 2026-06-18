# CogniMesh FAQ

Answers to questions that come up repeatedly. Share this link in onboarding, PRs, and stakeholder reviews so everyone starts from the same facts.

| Audience | Jump to |
|----------|---------|
| Executives & stewards | [Business & governance](#business--governance) |
| Proof & trust | [VRP, proof, and verification](#vrp-proof-and-verification) |
| Engineers | [Technical & development](#technical--development) |
| AI / agents | [Agents & attestations](#agents--attestations) |
| Ops & incidents | [Operations & troubleshooting](#operations--troubleshooting) |

---

## Business & governance

### What is CogniMesh in one sentence?

A **control plane for trustworthy data products on AWS**: design pipelines visually, run governance checks, attach cryptographic proof before publish, and let consumers discover data in a marketplace with steward-approved access.

### Who should read which guide?

| Role | Start here |
|------|------------|
| CEO, CFO, CDO, CISO | [Business guide - C-suite summary](README-business-stewards.md#for-c-suite--executive-leadership) |
| Data steward / governance | [Business & steward guide](README-business-stewards.md) |
| Engineer / architect | [README](../README.md) + [Vaquar Pattern](vaquar-pattern.md) |

### Do stewards need to write code?

No. Stewards work in the portal: **Approvals**, **Run History**, **Marketplace**, and **Operations**. Engineering owns the canvas, contracts, and AWS wiring.

### What should I block as a steward?

Per your org policy, typically:

- VRP **FAIL** (verification failed - do not promote output)
- VRP **UNVERIFIED** (empty run, error, or PVDM not executed - not the same as PASS)
- Critical **AWS Design Review** findings
- Missing owner, domain, or required metadata on the data contract

### Can consumers see full data before I approve access?

When access control is enabled: they see **schema and samples**; full table access follows your **Approve** action in the Approvals queue.

### How is this different from a normal data lake?

A data lake **stores** files. CogniMesh adds **contracts, proof-gated publish, marketplace discovery, steward approvals, lineage, and run history** on top of AWS (Glue, Iceberg, Step Functions, Lake Formation).

### Is CogniMesh "100% foolproof"?

No. CogniMesh proves **provenance, integrity, and declared invariants**. It does not prove that business judgment, SQL logic, or an LLM answer is semantically correct.

### What VRP features are included?

See [VRP features](vaquar-pattern.md#vrp-features): transform verification (identity + aggregate), contract and environment binding, compaction-safe logical digests, conformance vectors, and fail-closed publish. Proofs use `proof_version: "3"`; v2 still verifies.

---

## VRP, proof, and verification

### What is VRP?

**Verifiable Reconciliation Proof** - a signed envelope that binds source data, sink data, table snapshot, contract, and environment. Metadata commit (Iceberg snapshot / marketplace publish) is blocked unless verification **PASS**es.

### What does proof PASS actually mean?

- For **row-preserving** pipelines (copy, CDC, dedupe without changing grain): source and sink **multisets** match on declared fields.
- For **aggregations** (when configured): **derived invariants** hold (sums, multipliers, tolerances) and **per-group lineage** catches swap attacks even when global totals match.
- Sink data was **read back from persisted bytes**, not trusted from memory alone.
- The proof is **signed** (KMS in production) and tied to a **real Iceberg snapshot id**.

### What does proof **not** mean?

- Business rules or ML models are "correct"
- Columns outside declared `identityFields` + `contentFields` are protected
- An AI agent's judgment is right (only that **verified inputs** were used when attestations are enforced)

### What is the difference between PASS, FAIL, and UNVERIFIED?

| Verdict | Meaning | Trust the run? |
|---------|---------|----------------|
| **PASS** | Verification succeeded; catalog commit allowed | Yes (for declared fields / invariants) |
| **FAIL** | Mismatch, invariant failure, signing failure, or publish path blocked | **No** |
| **UNVERIFIED** | Empty workload, all rows filtered, runtime error, or PVDM not run | **No** - this is **not** a pass |

Empty pipelines and caught errors yield **UNVERIFIED** or **FAIL**, never silent **PASS**.

### Row-preserving vs aggregation - which verification applies?

| Pipeline type | Contract setting | Check |
|---------------|------------------|-------|
| Copy, CDC, format change | Default (`identity` mode) | Multiset equality |
| Sum by customer, fee calculation | `spec.transform.pvdm.vrp.mode: aggregate` | Derived sums + per-group lineage |

Example aggregate config:

```yaml
spec:
  transform:
    pvdm:
      vrp:
        mode: aggregate
        groupBy: ["customer_id"]
        amountField: amount
        feeMultiplier: "0.98"
        moneyFields: ["amount"]
        numericTolerance: "0"
```

Details: [Vaquar Pattern - Data examples](vaquar-pattern.md#data-examples) and [VRP features](vaquar-pattern.md#vrp-features).

### Does verification catch "swap" attacks (same total, wrong groups)?

**Yes**, in **aggregate** mode with `groupBy`. Per-group sum checks and lineage hashes fail when amounts are swapped between groups while the global sum stays the same. Covered by `lib/__tests__/vrp-hardening.test.js`.

### What happens after Iceberg compaction (`OPTIMIZE`)?

Physical file byte digests can change. VRP v3 uses **`logical_content_hash`** as the primary trust anchor; file digests are marked `physical_binding: secondary`. Re-verify with sink rows or logical digest, not stale file paths alone.

### Can I verify a proof without AWS credentials?

Yes. Use the producer's published public key:

```bash
node scripts/verify-vrp-proof.js path/to/proof.json --public-key producer-public.pem
```

Or `verifyVrpProof()` in `lib/vrp/verify.js`.

### What is `npm run verify:conformance`?

Runs published **known-good and tampered** proof fixtures in `fixtures/vrp-conformance/` so a buggy verifier cannot silently always return PASS. Run in CI alongside `npm run test:vrp-security`.

### Do KMS or transparency log outages allow publish anyway?

**No.** Signing failure → `signing_failed`. Transparency log failure → `publish_blocked`. Both yield **FAIL**, not PASS. Fault-injection tests cover this in `lib/__tests__/vrp-hardening.test.js`.

---

## Technical & development

### Where is the proof implementation?

[`lib/vrp/`](../lib/vrp/) - generate, verify, sign, transform verification, contract binding, logical digest, gateway, attestations. Runtime wiring: [`services/pvdm-runtime/`](../services/pvdm-runtime/).

### What proof version should new pipelines emit?

**v3** (`proof_version: "3"`). The verifier accepts v2 and v3.

### Why NDJSON fallback for Parquet?

Clean installs can hit broken `parquetjs`/thrift dependency chains. CogniMesh uses `@dsnp/parquetjs` when available and falls back to **durable NDJSON read-back** with full-file digest. Force with `VRP_FORCE_NDJSON=true`; require Parquet with `VRP_PARQUET_REQUIRED=true`.

### What tests should pass before merge?

| Command | Covers |
|---------|--------|
| `npm run test:vrp-security` | VRP, PVDM failure paths, gateway, attestations, hardening |
| `npm run test:unit` | Broader unit suite |
| `npm run verify:conformance` | Verifier regression vectors |
| `npm test` | E2E, Vaquar bridge, PVDM runtime, integrity gate |

### Key environment variables (VRP)

| Variable | Purpose |
|----------|---------|
| `VRP_KMS_KEY_ID` | Production signing (KMS) |
| `VRP_SIGNING_MODE` | `kms` or `dev` (local only) |
| `VRP_SIGN_ON_GENERATE` | `false` in tests |
| `PROOF_BUCKET` | S3 proofs + transparency objects |
| `VRP_GATEWAY_SECRET` | HMAC for proof-aware gateway tokens |
| `VRP_ALLOW_DECLARED_INPUTS` | Tests only - do **not** enable in prod |
| `VRP_FAIL_CLOSED` | Block publish when persistence fails |

Full list: [Vaquar Pattern - Environment](vaquar-pattern.md#trust-model).

---

## Agents & attestations

### Can an agent claim it read a proof without actually reading it?

**Not by default.** Decision attestations require a **`gatewayToken`** from `serveProofGatedDataset()` - proof verified, rows served, HMAC issued. Self-declared `inputProofs` are rejected unless `VRP_ALLOW_DECLARED_INPUTS=true` (tests only).

### What is PVDM-A?

**Decision attestation** - a signed record binding an agent's output hash to **gateway-verified** input proofs and session context. See [PVDM-A in Vaquar Pattern](vaquar-pattern.md#pvdm-a-carrying-proof-into-agent-decisions).

### Does attestation prove the AI decision is correct?

No. It proves **which verified data** was in scope and that the output hash matches what was attested - not that the model's reasoning is right.

---

## Operations & troubleshooting

### Run History shows UNVERIFIED - what do I do?

1. Check if the workload was **empty** or all rows were **filtered** by quality rules.
2. Check for **runtime errors** (rolled back chunks).
3. If unexpected, send **Run History** details to engineering - do not publish to consumers.

### Run History shows FAIL - what do I do?

1. Do **not** promote the output or approve consumer access on that run.
2. Expand the run for **localization** hints (hashed keys, invariant id) if present.
3. Engineering investigates source/sink mismatch, transform invariants, or signing/publish path failures.

### Where are proof artifacts stored?

Local: `.pvdm-proofs/` (or `VRP_PROOF_DIR`). Production: `PROOF_BUCKET` on S3 plus transparency log entries. `proofS3Uri` appears in Run History only when a **signed** proof was persisted.

### How do I run a local demo?

[GETTING_STARTED.md](GETTING_STARTED.md) and `npm run start:dev`. Stewards can use the portal without installing Terraform.

### Where are step-by-step tutorials?

[docs/tutorials/README.md](tutorials/README.md) - pipelines and agents by industry and architecture pattern.

---

## Still stuck?

| Topic | Doc |
|-------|-----|
| Portal buttons & screens | [PORTAL_UI.md](PORTAL_UI.md) |
| Local dev & env | [LOCAL_DEV.md](LOCAL_DEV.md) |
| Errors & fixes | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| Full proof spec | [vaquar-pattern.md](vaquar-pattern.md) |
| Business workflows | [README-business-stewards.md](README-business-stewards.md) |

If your question is not listed here, add it to this file when answered so the next person does not ask again.
