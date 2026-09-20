# Example: verify and diff VRP proofs

These are the HTTP contracts used by Marketplace **Verify proof** and **Diff proofs**. Replace `$TOKEN` with a portal session token (`npm run start:dev` disables auth unless Cognito is configured).

## Verify

```bash
curl -s -X POST http://localhost:4000/api/v1/proofs/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d @- <<'JSON'
{
  "requireSignature": false,
  "proof": {
    "proof_version": "3",
    "verdict": "PASS",
    "conformance_profile": "A",
    "schema_fingerprint": "abc",
    "source_snapshot_id": "inline:example",
    "not_before": "2026-01-01T00:00:00.000Z",
    "not_after": "2099-01-01T00:00:00.000Z",
    "multiset": {
      "source_hash": "aa",
      "sink_hash": "aa",
      "identity_source_hash": "bb",
      "identity_sink_hash": "bb",
      "sink_materialization": "read_back",
      "construction": "mset-add-hmac-sha256"
    }
  }
}
JSON
```

A real proof from `runPvdmWorkload` or Run History is preferred. The snippet above is a shape example; the engine also checks validity windows and transform invariants on v3 proofs.

Offline CLI:

```bash
node scripts/verify-vrp-proof.js .pvdm-proofs/<domain>/<name>/<run>.json
```

## Diff two proofs

```bash
curl -s -X POST http://localhost:4000/api/v1/proofs/diff \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"left\": {\"verdict\":\"PASS\",\"schema_fingerprint\":\"a\",\"source_snapshot_id\":\"s1\",\"multiset\":{\"source_hash\":\"1\",\"sink_hash\":\"1\"}}, \"right\": {\"verdict\":\"FAIL\",\"schema_fingerprint\":\"a\",\"source_snapshot_id\":\"s1\",\"multiset\":{\"source_hash\":\"1\",\"sink_hash\":\"2\"}}}"
```

Expected: `identical: false` with `verdict` and `multiset.sink_hash` in `changes`.

## Fail-closed samples

`GET /api/v1/products/:id/consumer-detail` returns `sampleRows: []` and `sampleRowsWithheld: true` unless the product trust card has VRP PASS.

## SLA

Set `PVDM_PROOF_SLA_HOURS` (default `24`). Marketplace freshness is hours since last VRP PASS, not hours since catalog register.

Tutorial: [Proof-gated marketplace](../tutorials/proof-gated-marketplace.md)
