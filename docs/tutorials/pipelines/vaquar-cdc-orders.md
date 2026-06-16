# RDS CDC → Iceberg

<p align="center">
  <img src="../../assets/portal-overview.png" alt="RDS CDC → Iceberg - CogniMesh canvas" width="720" />
  <br /><em>Vaquar PVDM · proof-gated writes</em>
</p>

[← All tutorials](../README.md) · [Portal UI](../../PORTAL_UI.md)

---

## What you'll create

Capture changes from Amazon RDS (MySQL) into a Bronze → Silver → Gold medallion, with Vaquar PVDM verification before Iceberg commit.

**Real-world example:** Shopify-style orders table with order_id PK → hourly CDC → gold orders Iceberg table for analytics.

| | |
|---|---|
| **Pattern ID** | `vaquar-cdc-orders` |
| **Category** | Structured |
| **Difficulty** | Beginner |
| **Architecture** | medallion |

## Why use this pattern

Operational databases that need reliable CDC into the data mesh.

## How it works

```
RDS CDC → Spark SQL (silver cleanse) → PVDM VRP proof → Iceberg gold
```

**Diagram:**

```
RDS ──▶ Bronze ──▶ Silver SQL ──▶ Gold Iceberg (VRP gated)
```


**AWS services:** `RDS` · `Glue` · `S3` · `Step Functions` · `Lambda`


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
2. Filter: **Structured**
3. Find **RDS CDC → Iceberg** → **Use pattern**

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

- Click the green Source block → set your database and table names.
- Click the blue Transform block → edit Spark SQL for your columns.
- Click the orange Sink block → set your S3 path and Glue catalog table.
- Use Preview YAML before Deploy to review the generated contract.


## Related

- [Tutorial hub](../README.md)
- [Drag-and-drop E2E](../../drag-drop-pipeline-flow.md)
- [Vaquar Pattern](../../vaquar-pattern.md)

