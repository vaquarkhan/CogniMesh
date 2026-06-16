# Payment Ledger (Double-Entry)

<p align="center">
  <img src="../../assets/portal-canvas-datamesh.png" alt="Payment Ledger (Double-Entry) - CogniMesh canvas" width="720" />
  <br /><em>Finance · audit trail · strict DQ</em>
</p>

[← All tutorials](../README.md) · [Portal UI](../../PORTAL_UI.md)

---

## What you'll create

Ingest payment events from Kafka, validate debit/credit balance in silver, publish immutable gold ledger with strict-zero-drop quality policy and VRP proof for SOX audit.

**Real-world example:** Stripe-style webhooks → bronze events → silver balanced journal entries → gold ledger partitioned by business_date.

| | |
|---|---|
| **Pattern ID** | `finance-payment-ledger` |
| **Category** | Finance |
| **Difficulty** | Advanced |
| **Architecture** | medallion |

## Why use this pattern

Payment processors, fintech, or any double-entry accounting feed requiring proof of correctness.

## How it works

```
Kafka payments.raw → Bronze → Silver (balance check) → Integrity Gate → Gold Iceberg ledger
```

**Diagram:**

```
Kafka → Bronze → Silver (Σ debits = Σ credits) → PVDM Gate → Gold ledger
```


**AWS services:** `MSK` · `Glue` · `Iceberg` · `Lambda` · `Step Functions`


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
2. Paste: _"Full medallion bronze silver gold from RDS CDC"_
3. Click **Preview pipeline plan** - read _what we'll create_ and _how it works_
4. Click **Load pipeline on canvas**

**Option B - Architectures library**

1. Sidebar → **Architectures**
2. Filter: **Finance**
3. Find **Payment Ledger (Double-Entry)** → **Use pattern**

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

- Set quality policy to strict-zero-drop.
- VRP content fields = event_id, amount, direction.


## Related

- [Tutorial hub](../README.md)
- [Drag-and-drop E2E](../../drag-drop-pipeline-flow.md)
- [Vaquar Pattern](../../vaquar-pattern.md)

