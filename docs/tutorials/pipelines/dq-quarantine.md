# Data Quality Quarantine Lane

<p align="center">
  <img src="../../assets/portal-canvas-datamesh.png" alt="Data Quality Quarantine Lane - CogniMesh canvas" width="720" />
  <br /><em>Compliance · bad rows routed to quarantine</em>
</p>

[← All tutorials](../README.md) · [Portal UI](../../PORTAL_UI.md)

---

## What you'll create

Run SparkRules quality checks after transform; route passing rows to gold Iceberg and failing rows to S3 quarantine for steward review.

**Real-world example:** Supplier feed → validate null rates → good rows to gold, bad rows to quarantine/ bucket with VRP audit.

| | |
|---|---|
| **Pattern ID** | `dq-quarantine` |
| **Category** | Compliance |
| **Difficulty** | Intermediate |
| **Architecture** | workflow |

## Why use this pattern

Regulated domains that must never silently drop bad data - quarantine instead.

## How it works

```
Source → Transform (DQ) → Choice(pass/fail) → Gold | Quarantine
```



**AWS services:** `Glue` · `S3` · `Iceberg` · `Lambda` · `Step Functions`


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
2. Paste: _"Data Quality Quarantine Lane - Compliance · bad rows routed to quarantine"_
3. Click **Preview pipeline plan** - read _what we'll create_ and _how it works_
4. Click **Load pipeline on canvas**

**Option B - Architectures library**

1. Sidebar → **Architectures**
2. Filter: **Compliance**
3. Find **Data Quality Quarantine Lane** → **Use pattern**

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

- Set max null % threshold on transform.
- Stewards review quarantine bucket daily.


## Related

- [Tutorial hub](../README.md)
- [Drag-and-drop E2E](../../drag-drop-pipeline-flow.md)
- [Vaquar Pattern](../../vaquar-pattern.md)

