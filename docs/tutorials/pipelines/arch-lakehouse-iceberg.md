# Lakehouse - Iceberg Medallion + ACID

<p align="center">
  <img src="../../assets/portal-canvas-datamesh.png" alt="Lakehouse - Iceberg Medallion + ACID - CogniMesh canvas" width="720" />
  <br /><em>Open table format · time travel · schema evolution</em>
</p>

[← All tutorials](../README.md) · [Portal UI](../../PORTAL_UI.md)

---

## What you'll create

Modern lakehouse: Iceberg tables at each medallion layer with ACID commits, time travel, and hidden partitioning. Glue catalog + PVDM proof on gold commits.

**Real-world example:** CDC from Postgres → Iceberg bronze → MERGE silver → aggregate gold with VRP proof per commit.

| | |
|---|---|
| **Pattern ID** | `arch-lakehouse-iceberg` |
| **Category** | Lakehouse |
| **Difficulty** | Intermediate |
| **Architecture** | lakehouse |

## Why use this pattern

Replace Hive tables or data lake Parquet with ACID guarantees and concurrent writers.

## How it works

```
DMS CDC → Iceberg bronze → MERGE silver → Agg gold → VRP proof
```

**Diagram:**

```
DMS → Iceberg bronze → Iceberg silver (MERGE) → Iceberg gold (ACID + VRP)
```


**AWS services:** `DMS` · `Glue` · `Iceberg` · `S3` · `Athena`


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
2. Filter: **Lakehouse**
3. Find **Lakehouse - Iceberg Medallion + ACID** → **Use pattern**

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

- Iceberg = ACID + time travel.
- Use MERGE in silver for CDC.
- VRP gates gold commits.


## Related

- [Tutorial hub](../README.md)
- [Drag-and-drop E2E](../../drag-drop-pipeline-flow.md)
- [Vaquar Pattern](../../vaquar-pattern.md)

