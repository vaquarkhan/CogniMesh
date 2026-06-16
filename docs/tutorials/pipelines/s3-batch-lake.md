# S3 Files → Iceberg

<p align="center">
  <img src="../../assets/portal-canvas-datamesh.png" alt="S3 Files → Iceberg - CogniMesh canvas" width="720" />
  <br /><em>Batch file landing zone</em>
</p>

[← All tutorials](../README.md) · [Portal UI](../../PORTAL_UI.md)

---

## What you'll create

Land CSV/JSON files from S3, apply Spark SQL cleansing, register as an Iceberg table.



| | |
|---|---|
| **Pattern ID** | `s3-batch-lake` |
| **Category** | Analytics |
| **Difficulty** | Beginner |
| **Architecture** | - |

## Why use this pattern

File drops, partner feeds, or batch exports without CDC.

## How it works

```
Source → Transform → Sink (see canvas)
```



**AWS services:** `S3` · `Glue` · `Step Functions`


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
2. Paste: _"S3 Files → Iceberg - Batch file landing zone"_
3. Click **Preview pipeline plan** - read _what we'll create_ and _how it works_
4. Click **Load pipeline on canvas**

**Option B - Architectures library**

1. Sidebar → **Architectures**
2. Filter: **Analytics**
3. Find **S3 Files → Iceberg** → **Use pattern**

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

- Point Source endpoint to your landing bucket prefix.
- Adjust Spark SQL for column typing and null handling.


## Related

- [Tutorial hub](../README.md)
- [Drag-and-drop E2E](../../drag-drop-pipeline-flow.md)
- [Vaquar Pattern](../../vaquar-pattern.md)

