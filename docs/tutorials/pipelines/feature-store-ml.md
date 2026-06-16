# Feature Store Pipeline

<p align="center">
  <img src="../../assets/portal-canvas-datamesh.png" alt="Feature Store Pipeline - CogniMesh canvas" width="720" />
  <br /><em>ML · batch features for SageMaker</em>
</p>

[← All tutorials](../README.md) · [Portal UI](../../PORTAL_UI.md)

---

## What you'll create

Build ML feature tables from multiple sources, publish versioned feature groups to gold Iceberg for SageMaker Feature Store sync.

**Real-world example:** Orders + clickstream → silver joins → gold feature table customer_features_v3.

| | |
|---|---|
| **Pattern ID** | `feature-store-ml` |
| **Category** | Analytics |
| **Difficulty** | Advanced |
| **Architecture** | medallion |

## Why use this pattern

ML teams needing reproducible, versioned feature pipelines feeding training and inference.

## How it works

```
Multi-source → Silver join → Gold features → SageMaker FS
```



**AWS services:** `SageMaker Feature Store` · `Glue` · `Iceberg` · `S3`


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
2. Filter: **Analytics**
3. Find **Feature Store Pipeline** → **Use pattern**

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

- Version feature table in metadata.version on schema changes.
- Register as ML marketplace product for consumers.


## Related

- [Tutorial hub](../README.md)
- [Drag-and-drop E2E](../../drag-drop-pipeline-flow.md)
- [Vaquar Pattern](../../vaquar-pattern.md)

