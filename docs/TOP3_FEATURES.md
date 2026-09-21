# Top 3 product features

CogniMesh’s highest-value loop: **prove → deploy → consume**.

Honest status: **MVP / demo-capable locally**. Live AWS requires env flags + Terraform. Items marked **Demo** work without AWS; **Opt-in AWS** need credentials and config.

## 1. Run observability with VRP proof

**Outcome:** Users go from “I drew a pipeline” to “I proved this dataset is correct.”

| Requirement | Status | Where |
|-------------|--------|--------|
| VRP PASS/FAIL/UNVERIFIED per run | Demo | Run History · VRP badge (fail-closed JS engine) |
| Rows processed vs dropped (SparkRules) | Demo | Run list + observability dashboard |
| Proof/checkpoint S3 links | Opt-in AWS | Links when proof/checkpoint buckets configured; else local paths |
| Proof-gated Iceberg commit | Demo / Opt-in | Local snapshot file by default; live Glue when `GLUE_ICEBERG_ENABLED` |
| PVDM flow visualization | Demo | Physical → Verify → Metadata diagram |
| Trends (pass rate, drop %) | Demo | Run observability dashboard |
| Deploy-time proof summary | Demo | Deploy panel · **Vaquar** tab (`VrpProofPanel`); often synthetic rows at deploy |
| Offline VRP verify | Demo | `lib/vrp/verify.js` · `scripts/verify-vrp-proof.js` |
| Agent decision attestation | Demo | `lib/vrp/decision-attestation.js` · Agent MCP `/mcp/invoke` |

**Try it:** `npm run test:pvdm-mock` or Deploy a Vaquar/medallion pattern → **Panels → Run History** → **Vaquar** tab.

**Not the same as:** veridata (Rust) - not wired. See [POSITIONING.md](POSITIONING.md).

---

## 2. AWS deploy with live status (needs AWS env)

**Outcome:** Deploy → Step Functions ARN → live Running/Succeeded/Failed + AWS Console link.

| Requirement | Status | Where |
|-------------|--------|--------|
| Create/update state machine | Opt-in AWS | `lib/aws/stepfunctions-deploy.js` when `AWS_DEPLOY_ENABLED=true` + role ARN |
| Start execution (optional) | Opt-in AWS | `AWS_DEPLOY_EXECUTE=true` |
| Poll DescribeExecution | Opt-in AWS | `lib/aws/sfn-execution-status.js` |
| Live status in portal | Opt-in AWS | Deploy banner (auto-poll) · Run History |
| AWS Console deep link | Opt-in AWS | Step Functions + S3 proof links |

**Enable real AWS:** see [examples/aws-pvdm-runbook.md](examples/aws-pvdm-runbook.md).

Without flags, deploy **compiles + registers catalog + local/demo VRP** - portal shows an info toast that Step Functions was not pushed.

---

## 3. Consumer mesh experience

**Outcome:** Two-sided marketplace - producers publish, consumers discover and request access.

| Requirement | Status | Where |
|-------------|--------|--------|
| Schema + sample rows | Demo | Marketplace → click product |
| Request access | Demo | Request Access button |
| Steward approval UI | Demo | **Panels → Approvals** |
| Lake Formation grant on approve | **Not implemented** | Access is approved in CogniMesh only; LF `GrantPermissions` is not called |
| Open in Athena | Demo | Pre-filled `SELECT * … LIMIT 10` link |
| Access status for consumer | Demo | Pending / approved / rejected in product detail |
| Proof-gated product banner + trust grade | Demo | Marketplace detail: VRP PASS, Profile A/T/O, source snapshot, consumer snapshot pin |
| Offline proof verify + diff | Demo | Marketplace paste JSON, `POST /api/v1/proofs/verify`, `POST /api/v1/proofs/diff` |
| Fail-closed samples + proof SLA | Demo | Samples withheld without VRP PASS; freshness is hours since last PASS |
| Spark Declarative Pipelines export | Demo | AWS Design Review → Export SDP zip (`spark-pipelines run`) |
| dbt project export | Demo | AWS Design Review → Export dbt zip (`dbt run` / `dbt test`) |

**Try it:** Deploy pipeline → **Panels → Marketplace** → Request Access → **Approvals** → Approve (catalog status only until LF is wired).

---

## Tier 2 (MVP APIs - depth varies)

| Item | Status | Notes |
|------|--------|--------|
| Data quality dashboard over time | Partial | Drop trends in Run History |
| Domain pattern packs | Partial | finance/healthcare/retail patterns on canvas |
| Deploy approval workflow | Demo | `DEPLOY_APPROVAL_REQUIRED=true` |
| Contract diff / version compare | Demo | Panels → Versions (file/memory store) |
| Import existing Glue/SFN | Opt-in | `AWS_IMPORT_ENABLED=true` |
| LLM copilot (Bedrock) | Opt-in / rules fallback | `COPILOT_LLM_ENABLED=true` else rule-based |
| Athena / JDBC / live S3 preview | Opt-in | `DATA_PREVIEW_*=true` |
| Audit HTML/Markdown export | Demo | Panels → Audit |
| Agent KB/guardrail deploy | Opt-in / simulated | Needs agent role + IDs |
| Plugin sandbox | Demo | In-memory registry |
| Cross-org billing | Demo | Heuristic estimates, not Cost Explorer |
| Open spec site | Demo | `/api/v1/platform/open-spec/site` |
| Self-heal from Run History | Demo | API exists; not a full production healer |

---

## Quick validation (`npm run start:dev`)

1. Load **Multi-Source** or **Data Mesh** pattern → Preview → Deploy  
2. Expect **local compile success** toast unless AWS flags are set  
3. **Panels → Run History** / **Vaquar** tab for proof UI  
4. **Panels → Marketplace** → request access → **Approvals**  
5. With AWS env from the runbook, expect live Step Functions status  

For local PVDM without the portal: `npm run test:pvdm-mock`.
