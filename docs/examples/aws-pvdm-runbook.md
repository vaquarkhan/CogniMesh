# AWS PVDM runbook (mock → live)

Run a small Vaquar PVDM workload locally, then the same shape on AWS.

## 1. Local mock (no AWS bill)

```bash
# Happy path: chunked write → VRP → metadata
node scripts/run-pvdm-mock-workload.js

# Force IceGuard timeout abort (remaining time below threshold)
node scripts/run-pvdm-mock-workload.js --resume-demo

# Larger batch
node scripts/run-pvdm-mock-workload.js --rows 20 --chunk-size 5
```

Expected happy path: `outcome=committed`, `vrp=PASS`, snapshot id printed.

Also:

```bash
npm run vaquar:apply -- contracts/examples/structured-cdc-pipeline.yaml
npm run test:pvdm
npm run test:vrp-security
```

## 2. Wire AWS (one-time)

1. `terraform apply` in `infra/terraform/environments/dev` or `prod` (platform-ops + Lambdas).
2. Copy outputs into API `.env`:

```bash
AWS_DEPLOY_ENABLED=true
AWS_REGION=us-east-1
AWS_STEP_FUNCTIONS_ROLE_ARN=arn:aws:iam::ACCOUNT:role/...
AWS_ACCOUNT_ID=ACCOUNT
PROOF_BUCKET_NAME=cognimesh-...-proofs-ACCOUNT
CHECKPOINT_BUCKET_NAME=cognimesh-...-checkpoints-ACCOUNT
# optional live Glue snapshot:
# GLUE_ICEBERG_ENABLED=true
# VRP_KMS_KEY_ID=arn:aws:kms:...
```

3. Package and deploy Lambdas:

```bash
npm run package:domain-writer
npm run package:integrity-gate
# terraform apply / update Lambda code from infra/terraform/build/*.zip
```

4. Restart API (`npm run dev:api` or ECS redeploy).

## 3. Portal path on AWS

1. Open portal → load **Vaquar CDC** / structured pattern (or paste contract).
2. **Preview** → **Deploy**.
3. Watch **DeployProgress** / Step Functions console:
   - `IntegrityGate` → `InvokeDomainWriter`
   - On IceGuard rollback: wait → re-invoke with advanced **`resume_offset`**
4. Confirm catalog / proof artifacts in proof bucket when configured.

## 4. Direct Step Functions payload shape

```json
{
  "contract": { "...DataContract..." },
  "source_rows": [{ "order_id": "ord-0001", "amount": 10.5 }],
  "workload_id": "manual-1",
  "resume_offset": 0
}
```

Domain Writer (Node) returns `outcome`: `committed` | `rolled_back` | `verification_failed`.  
On `rolled_back`, ASL copies `resume_offset` from the payload into the next invoke.

## 5. Honest Python stub

`services/domain-writer/handler.py` **never** returns a fake VRP PASS. Production is `services/lambda/domain-writer` (Node `runPvdmWorkload`).

## Related

- [E2E architecture](../E2E_ARCHITECTURE.md)
- [Vaquar Pattern](../vaquar-pattern.md) · [NOTICE](../../NOTICE)
- Paper: [arXiv:2608.14643](https://arxiv.org/abs/2608.14643)
- Reference gate: [Proof-gated-publication-PVDM](https://github.com/vaquarkhan/Proof-gated-publication-PVDM)
- Example contract: [`contracts/examples/structured-cdc-pipeline.yaml`](../../contracts/examples/structured-cdc-pipeline.yaml)
