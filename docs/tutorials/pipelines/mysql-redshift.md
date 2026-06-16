# MySQL → Redshift

<p align="center">
  <img src="../../assets/portal-canvas-datamesh.png" alt="MySQL → Redshift - CogniMesh canvas" width="720" />
  <br /><em>Warehouse sync</em>
</p>

[← All tutorials](../README.md) · [Portal UI](../../PORTAL_UI.md)

---

## What you'll create

Extract from MySQL, transform in Spark SQL, load into Redshift for BI dashboards.



| | |
|---|---|
| **Pattern ID** | `mysql-redshift` |
| **Category** | Analytics |
| **Difficulty** | Intermediate |
| **Architecture** | - |

## Why use this pattern

Reporting workloads that need a columnar warehouse copy of OLTP data.

## How it works

```
Source → Transform → Sink (see canvas)
```



**AWS services:** `RDS` · `Glue` · `Redshift` · `S3`


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
2. Paste: _"MySQL → Redshift - Warehouse sync"_
3. Click **Preview pipeline plan** - read _what we'll create_ and _how it works_
4. Click **Load pipeline on canvas**

**Option B - Architectures library**

1. Sidebar → **Architectures**
2. Filter: **Analytics**
3. Find **MySQL → Redshift** → **Use pattern**

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

- Provide MySQL database and table in Source properties.
- Set Redshift staging S3 path before deploy.


## Related

- [Tutorial hub](../README.md)
- [Drag-and-drop E2E](../../drag-drop-pipeline-flow.md)
- [Vaquar Pattern](../../vaquar-pattern.md)

