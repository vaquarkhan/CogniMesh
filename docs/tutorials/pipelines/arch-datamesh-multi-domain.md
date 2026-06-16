# Data Mesh - Multi-Domain Parallel

<p align="center">
  <img src="../../images/cog1.jpeg" alt="Data Mesh - Multi-Domain Parallel - CogniMesh canvas" width="720" />
  <br /><em>3 domain ACs → merge → federated gold</em>
</p>

[← All tutorials](../README.md) · [Portal UI](../../PORTAL_UI.md)

---

## What you'll create

Three domain pipelines run in parallel (orders, inventory, customers) - each in its own producer AWS account and region - merge into a federated customer-360 gold product in the publisher account.

**Real-world example:** Retail mesh: orders (commerce AC) + inventory (supply AC) + customers (CRM AC) parallel ingest, merge on customer_id, publish 360 view to publisher AC.

| | |
|---|---|
| **Pattern ID** | `arch-datamesh-multi-domain` |
| **Category** | Data Mesh |
| **Difficulty** | Expert |
| **Architecture** | datamesh |

## Why use this pattern

Cross-domain analytics product built from multiple domain-owned pipelines without central ETL team bottleneck.

## How it works

```
Start → Parallel(orders|inventory|customers) → Merge → Enrichment → Steward Gate → Publisher Gold
```

**Diagram:**

```
AC-1111 orders/us-east-1 ──┐
AC-2222 inventory/us-west-2 ─┼→ Merge → Enrich → Gate → AC-3456 gold
AC-3333 customers/eu-west-1 ──┘
```


**AWS services:** _See canvas blocks._


---

## Step-by-step in CogniMesh

### 1. Start the portal

```bash
npm run start:dev
```

Open [http://localhost:3000](http://localhost:3000).

### 2. Load this pattern

**Option A - AI Builder (recommended)**

1. Sidebar → **AI Builder** → **Data pipeline**
2. Paste: _"Multi-domain data mesh customer 360 with parallel domains"_
3. Click **Preview pipeline plan** - read _what we'll create_ and _how it works_
4. Click **Load pipeline on canvas**

**Option B - Architectures library**

1. Sidebar → **Architectures**
2. Filter: **Data Mesh**
3. Find **Data Mesh - Multi-Domain Parallel** → **Use pattern**

### 3. Customize blocks

Click each block on the canvas and set real values in the properties panel.

### 4. Preview & validate

Click **Preview YAML** (Ctrl+S) - review `DataContract.yaml` and Step Functions ASL.

### 5. Deploy

**Deploy** when API is on port 4000 - integrity gate → catalog registration.

---

## Developer workflow

| Layer | What you do |
|-------|-------------|
| **Portal / contract** | Tune block properties; export YAML from preview |
| **`lib/contract-builder/`** | Graph → DataContract mapping |
| **`services/pipeline-engine/`** | Contract → Step Functions ASL |
| **`lib/integrity-gate/`** | PVDM / VRP rules before gold publish |
| **`infra/terraform/`** | AWS infrastructure modules |

**API:** `POST /api/v1/pipelines/preview` · `POST /api/v1/pipelines/deploy`

---

## Tips

- Each parallel branch = one domain producer AC + region (orders · inventory · customers).
- Merge / enrich / gold sink run in publisher AC - steward AC hosts VRP gate.
- Matches Vaquar SDM mesh accounts: producer / steward / publisher.


## Related

- [Tutorial hub](../README.md)
- [Drag-and-drop E2E](../../drag-drop-pipeline-flow.md)
- [Vaquar Pattern](../../vaquar-pattern.md)
- [External reference](https://github.com/vaquarkhan/aws-serverless-datamesh-framework/blob/main/docs/vaquar-pattern.md)
