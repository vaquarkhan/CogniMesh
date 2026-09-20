# Example: verify and diff VRP proofs

HTTP contracts used by Marketplace **Verify proof** and **Diff proofs**. Prefer a real proof from Run History or `fixtures/vrp-conformance/identity-pass.json`.

With `AUTH_DISABLED=true` (default local), omit the `Authorization` header.

## Verify (curl)

```bash
curl -s -X POST http://localhost:4000/api/v1/proofs/verify \
  -H "Content-Type: application/json" \
  -d "{\"requireSignature\":false,\"proof\":$(cat fixtures/vrp-conformance/identity-pass.json)}"
```

Expect `valid: true` (or a clear `reason` when the envelope fails validity / multiset checks).

## Verify (PowerShell)

```powershell
$proof = Get-Content .\fixtures\vrp-conformance\identity-pass.json -Raw
$body = @{ requireSignature = $false; proof = ($proof | ConvertFrom-Json) } | ConvertTo-Json -Depth 20
Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/v1/proofs/verify -ContentType application/json -Body $body
```

## Offline CLI

```bash
node scripts/verify-vrp-proof.js fixtures/vrp-conformance/identity-pass.json
# optional: --public-key producer-public.pem
```

## Diff two proofs

```bash
curl -s -X POST http://localhost:4000/api/v1/proofs/diff \
  -H "Content-Type: application/json" \
  -d "{\"left\":$(cat fixtures/vrp-conformance/identity-pass.json),\"right\":$(cat fixtures/vrp-conformance/identity-tampered.json)}"
```

Expect `identical: false` with changes on integrity fields (for example `multiset.sink_hash` / `verdict`).

## Fail-closed samples

`GET /api/v1/products/:id/consumer-detail` returns `sampleRows: []` and `sampleRowsWithheld: true` unless the product trust card has VRP PASS.

## SLA freshness

Set `PVDM_PROOF_SLA_HOURS` (default `24`). Marketplace freshness is hours since last VRP PASS, not hours since catalog register.

## UI

Panels → **Marketplace** → open a product → paste JSON → **Verify proof** / **Diff proofs**.

Video: [cognimesh-marketplace-proof-demo.mp4](../assets/cognimesh-marketplace-proof-demo.mp4)  
Tutorial: [Proof-gated marketplace](../tutorials/proof-gated-marketplace.md)
