# Top 3 product features — status

CogniMesh’s highest-value loop: **prove → deploy → consume**.

## 1. Run observability with VRP proof ✅

**Outcome:** Users go from “I drew a pipeline” to “I proved this dataset is correct.”

| Requirement | Status | Where |
|-------------|--------|--------|
| VRP PASS/FAIL per run | ✅ | Run History · VRP badge per run |
| Rows processed vs dropped (SparkRules) | ✅ | Run list + observability dashboard |
| Proof/checkpoint S3 links | ✅ | Expand run · **Open in S3 Console** links |
| Proof-gated Iceberg commit | ✅ | 🛡 tag on runs + marketplace products |
| PVDM flow visualization | ✅ | Physical → Verify → Metadata diagram |
| Trends (pass rate, drop %) | ✅ | Run observability dashboard |
| Deploy-time proof summary | ✅ | Deploy panel · **Vaquar tab** (`VrpProofPanel`) |

**Try it:** Deploy any Vaquar/medallion pattern → **Run History** → expand a run → **Vaquar** tab on deploy panel.

---

## 2. AWS deploy with live status ✅ (needs AWS env)

**Outcome:** Deploy → Step Functions ARN → live Running/Succeeded/Failed + AWS Console link.

| Requirement | Status | Where |
|-------------|--------|--------|
| Create/update state machine | ✅ | `lib/aws/stepfunctions-deploy.js` |
| Start execution (optional) | ✅ | `AWS_DEPLOY_EXECUTE=true` |
| Poll DescribeExecution | ✅ | `lib/aws/sfn-execution-status.js` |
| Live status in portal | ✅ | Deploy banner (auto-poll) · Run History |
| AWS Console deep link | ✅ | Step Functions + S3 proof links |

**Enable real AWS:**

```bash
export AWS_DEPLOY_ENABLED=true
export AWS_STEP_FUNCTIONS_ROLE_ARN=arn:aws:iam::ACCOUNT:role/...
export AWS_DEPLOY_EXECUTE=true   # start execution on deploy
export AWS_REGION=us-east-1
```

Without these, deploy still compiles + registers catalog + records **local VRP proof** (demo mode).

---

## 3. Consumer mesh experience ✅

**Outcome:** Two-sided marketplace — producers publish, consumers discover and query.

| Requirement | Status | Where |
|-------------|--------|--------|
| Schema + sample rows | ✅ | Marketplace → click product |
| Request access | ✅ | Request Access button |
| Steward approval UI | ✅ | Header → **Approvals** |
| Lake Formation grant on approve | ✅ | Simulated locally · real when `AWS_DEPLOY_ENABLED` |
| Open in Athena | ✅ | Pre-filled `SELECT * … LIMIT 10` link |
| Access status for consumer | ✅ | Pending / approved / rejected in product detail |
| Proof-gated product banner | ✅ | Marketplace detail modal |

**Try it:** Deploy pipeline → **Marketplace** → open product → **Request Access** → **Approvals** → Approve → refresh product (access: approved + LF SELECT).

---

## Tier 2 (not started)

- Data quality dashboard over time (partial: drop trend in run observability)
- Domain pattern packs (partial: finance/healthcare/retail patterns exist)
- Deploy approval workflow (PR-style)
- Contract diff / version compare
- Import existing Glue/SFN

---

## Quick validation (`npm run start:dev`)

1. Load **Data Mesh — Domain Data Product** → Deploy  
2. **Run History** — VRP PASS, rows, proof S3 links  
3. **Deploy → Vaquar tab** — full proof panel  
4. **Marketplace** — schema, Athena, request access  
5. **Approvals** — steward approve → LF grant message  

With AWS credentials + env vars above, step 2 also shows **live Step Functions status**.
