# Data Lake - Raw / Curated / Consumption Zones

<p align="center">
  <img src="../../assets/portal-canvas-datamesh.png" alt="Data Lake - Raw / Curated / Consumption Zones - CogniMesh canvas" width="720" />
  <br /><em>Schema-on-read · S3 zones · Glue crawler</em>
</p>

[← All tutorials](../README.md) · [Portal UI](../../PORTAL_UI.md)

---

## What you'll create

Classic data lake: land everything raw (raw zone), curate with Glue ETL (curated zone), expose for Athena (consumption). No Iceberg required - Parquet on S3.

**Real-world example:** IoT sensors + app logs land raw, daily Glue job curates Parquet, analysts query via Athena external tables.

| | |
|---|---|
| **Pattern ID** | `arch-datalake-zones` |
| **Category** | Data Lake |
| **Difficulty** | Intermediate |
| **Architecture** | datalake |

## Why use this pattern

Exploratory analytics, data science sandboxes, or pre-lakehouse migration path.

## How it works

```
S3 raw → Glue Crawler → ELT bronze → ETL curated Parquet → Athena view
```

**Diagram:**

```
S3 raw/ → Glue ETL → S3 curated/ → Athena
         ↘ Crawler → Glue Catalog
```


**AWS services:** `S3` · `Glue` · `Athena` · `Lake Formation`


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
2. Paste: _"Data Lake - Raw / Curated / Consumption Zones - Schema-on-read · S3 zones · Glue crawler"_
3. Click **Preview pipeline plan** - read _what we'll create_ and _how it works_
4. Click **Load pipeline on canvas**

**Option B - Architectures library**

1. Sidebar → **Architectures**
2. Filter: **Data Lake**
3. Find **Data Lake - Raw / Curated / Consumption Zones** → **Use pattern**

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

- Raw zone = immutable landing.
- Curated = typed Parquet partitions.
- Add LF when sharing cross-team.


## Related

- [Tutorial hub](../README.md)
- [Drag-and-drop E2E](../../drag-drop-pipeline-flow.md)
- [Vaquar Pattern](../../vaquar-pattern.md)

