# ELT - Load First → Redshift Transform

<p align="center">
  <img src="../../assets/portal-canvas-datamesh.png" alt="ELT - Load First → Redshift Transform - CogniMesh canvas" width="720" />
  <br /><em>S3 copy → Redshift SQL → marts</em>
</p>

[← All tutorials](../README.md) · [Portal UI](../../PORTAL_UI.md)

---

## What you'll create

Classic cloud ELT: land raw files on S3, COPY into Redshift staging, transform with SQL inside the warehouse, publish marts. Glue orchestrates the COPY.

**Real-world example:** Nightly CSV drops on S3 → Glue triggers COPY → Redshift staging → SQL marts → BI tools.

| | |
|---|---|
| **Pattern ID** | `arch-elt-redshift` |
| **Category** | ETL / ELT |
| **Difficulty** | Intermediate |
| **Architecture** | warehouse |

## Why use this pattern

Warehouse-centric teams; transforms live in Redshift SQL not Spark.

## How it works

```
S3 files → Glue COPY → Redshift staging → SQL mart → Redshift sink
```

**Diagram:**

```
S3 landing → Glue COPY → Redshift staging → SQL transforms → marts
```


**AWS services:** `S3` · `Glue` · `Redshift` · `Step Functions`


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
2. Paste: _"ELT - Load First → Redshift Transform - S3 copy → Redshift SQL → marts"_
3. Click **Preview pipeline plan** - read _what we'll create_ and _how it works_
4. Click **Load pipeline on canvas**

**Option B - Architectures library**

1. Sidebar → **Architectures**
2. Filter: **ETL / ELT**
3. Find **ELT - Load First → Redshift Transform** → **Use pattern**

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

- Transform SQL runs inside Redshift.
- Glue = orchestrator + COPY.


## Related

- [Tutorial hub](../README.md)
- [Drag-and-drop E2E](../../drag-drop-pipeline-flow.md)
- [Vaquar Pattern](../../vaquar-pattern.md)

