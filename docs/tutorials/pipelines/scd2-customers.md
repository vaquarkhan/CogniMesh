# SCD Type 2 Customer Dimension

<p align="center">
  <img src="../../assets/portal-canvas-datamesh.png" alt="SCD Type 2 Customer Dimension - CogniMesh canvas" width="720" />
  <br /><em>Lakehouse · slowly changing dimensions</em>
</p>

[← All tutorials](../README.md) · [Portal UI](../../PORTAL_UI.md)

---

## What you'll create

Track customer attribute changes over time using SCD2 merge logic - valid_from, valid_to, is_current flags in Iceberg gold.

**Real-world example:** CRM daily export → detect changed addresses → merge into dim_customer with SCD2 columns.

| | |
|---|---|
| **Pattern ID** | `scd2-customers` |
| **Category** | Medallion |
| **Difficulty** | Intermediate |
| **Architecture** | lakehouse |

## Why use this pattern

CRM or master data where historical attribute values must be preserved for reporting.

## How it works

```
MySQL customers → Silver (hash compare) → Gold Iceberg MERGE (SCD2)
```



**AWS services:** `RDS` · `Glue` · `Iceberg` · `Step Functions`


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
2. Paste: _"Lakehouse Iceberg medallion with CDC merge"_
3. Click **Preview pipeline plan** - read _what we'll create_ and _how it works_
4. Click **Load pipeline on canvas**

**Option B - Architectures library**

1. Sidebar → **Architectures**
2. Filter: **Medallion**
3. Find **SCD Type 2 Customer Dimension** → **Use pattern**

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

- Gold table uses Iceberg MERGE for SCD2 (configured in contract).
- Primary key = customer_id for CDC.


## Related

- [Tutorial hub](../README.md)
- [Drag-and-drop E2E](../../drag-drop-pipeline-flow.md)
- [Vaquar Pattern](../../vaquar-pattern.md)

