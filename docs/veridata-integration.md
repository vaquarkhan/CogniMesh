# CogniMesh and veridata

How proof verification relates across **CogniMesh**, **[veridata](https://github.com/vaquarkhan/veridata)**, and the **[AWS Serverless Data Mesh Framework](https://github.com/vaquarkhan/aws-serverless-datamesh-framework)**.

This page is for integrators and maintainers. It states what runs where today and what is planned.

---

## Current state (accurate as of VRP v3 in CogniMesh)

| Component | Transform-aware verification (identity + aggregate) | Notes |
|-----------|-----------------------------------------------------|--------|
| **CogniMesh** (`lib/vrp/`, Node.js) | **Yes** - `proof_version: "3"` | Portal, PVDM runtime, tests, conformance vectors |
| **veridata** (Rust core) | **No** - multiset / recon only | Packaging fixes landed; transform items V1-V7 still open in veridata |
| **Datamesh framework** (Python, uses veridata) | **No** | Inherits veridata capabilities only |

**Important:** CogniMesh docs and UI still use the historical label **veridata-recon** for the verify phase. The **running implementation** in CogniMesh is the JavaScript VRP stack (`lib/vrp/`), not a call into veridata's Rust crate.

The v3 work **deepened divergence**: transform verification, per-group lineage, derived invariants, and related features were implemented in JS rather than added once to veridata and delegated.

---

## Target architecture (item C1)

**C1 - CogniMesh delegates verification to veridata** - not done.

Intended end state:

```
CogniMesh PVDM runtime  →  veridata (Rust)  →  same proof semantics
Datamesh framework      →  veridata (Rust)  →  inherits transform verification
```

**Fix once, both benefit** requires transform logic in **veridata core** first, then CogniMesh calling veridata instead of reimplementing in `lib/vrp/transform-verify.js`.

Maintaining two parallel implementations (JS + Rust) by hand is possible but fragile. Shared **conformance vectors** (`fixtures/vrp-conformance/`) should be the contract both sides pass.

---

## Recommended next step: port V1 and V2 into veridata

Scope the first Rust port to the two features that unlock aggregate pipelines for all consumers.

### V1 - Per-group lineage (`recon.rs` or `transform.rs`)

**Goal:** Detect swap attacks where global `SUM(amount)` is unchanged but group attribution is wrong.

**Inputs:**

- Source row set, sink row set
- `group_by: Vec<String>`
- `identity_field: String` (default `id`)

**Algorithm (match CogniMesh `lib/vrp/transform-verify.js`):**

1. Build `group_key = group_by fields joined by "|"`.
2. For each source row, append `hash_key_pii(identity_field value)` to that group's list.
3. Sort key hashes per group; `lineage_hash = sha256_canonical(sorted_hashes)`.
4. Every sink group key must exist in the source map.

**Output:** `group_lineage: HashMap<GroupKey, LineageRecord>`, `group_lineage_hash`, `pass: bool`.

**Tests:** Port scenarios from [Vaquar Pattern - Example 4](vaquar-pattern.md#example-4-swap-between-groups-aggregate-mode---fail) and `lib/__tests__/vrp-hardening.test.js` (swap attack).

---

### V2 - Derived invariants from transform spec

**Goal:** Expected checks come from the contract spec, not hand-maintained totals.

**Spec struct (JSON / YAML friendly):**

```yaml
mode: identity | aggregate
group_by: [region]
amount_field: amount
fee_multiplier: "0.98"
money_fields: [amount]
numeric_tolerance: "0"
```

**Algorithm:**

1. **Global `derived_sum`:** `sum_minor(source, amount_field) * fee_multiplier` vs `sum_minor(sink, amount_field)` within tolerance.
2. **Identity mode:** `row_count(source) == row_count(sink)`.
3. **Aggregate mode:** For each group key, `sum_minor(source in group) * fee_multiplier` vs sink group row amount (minor units, rational multiplier).

**Output:** `Vec<InvariantCheck>` with `id`, `pass`, `source_value`, `expected_sink_value`, `actual_sink_value`.

**Tests:** Examples 3 and 5 in [Data examples](vaquar-pattern.md#data-examples); `fixtures/vrp-conformance/aggregate-*.json`.

---

### After V1/V2 (veridata backlog)

| Item | CogniMesh (JS) today | veridata |
|------|----------------------|----------|
| V3 Money minor units | `lib/vrp/money.js` | Fold into V2 port |
| V4 Merkle failure localization | `lib/vrp/merkle.js` | New |
| V5 PII-safe key hashes | `hashKeyPII` | New |
| V6 Logical compaction digest | `lib/vrp/logical-digest.js` | New |
| V7 Contract / environment binding | `contract-bind.js`, `environment-bind.js` | New |

---

## CogniMesh follow-up after veridata ships V1/V2

1. Add veridata as dependency (CLI subprocess or `napi`/FFI binding).
2. Replace `runTransformVerification()` call path in `lib/vrp/generate.js` with veridata invoke.
3. Keep `lib/vrp/` for signing, envelope, gateway, attestations until those move too.
4. Run **same** `npm run verify:conformance` vectors against veridata output.
5. Deprecate duplicate logic in `transform-verify.js` once parity proven.

---

## Testing note: `VRP_FORCE_NDJSON`

If `npm run test:vrp-security` fails with `digest_type: full_file` vs `parquet_footer` mismatch, check for a **leftover shell environment variable**:

```bash
# PowerShell
Remove-Item Env:VRP_FORCE_NDJSON -ErrorAction SilentlyContinue

# bash
unset VRP_FORCE_NDJSON
```

That forces NDJSON read-back for all chunks. It is used intentionally in one test but must not stay set globally. This is an environment issue, not a code regression.

---

## Related docs

- [Vaquar Pattern](vaquar-pattern.md) - proof semantics and data examples
- [FAQ - aggregate mode](FAQ.md#row-preserving-vs-aggregation---which-verification-applies)
- [AWS Serverless Data Mesh Framework](https://github.com/vaquarkhan/aws-serverless-datamesh-framework)
