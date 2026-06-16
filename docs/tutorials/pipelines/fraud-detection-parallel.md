# Fraud Scoring (Parallel Rules + ML)

<p align="center">
  <img src="../../assets/portal-canvas-datamesh.png" alt="Fraud Scoring (Parallel Rules + ML) - CogniMesh canvas" width="720" />
  <br /><em>Finance · parallel branches · choice route</em>
</p>

[← All tutorials](../README.md) · [Portal UI](../../PORTAL_UI.md)

---

## What you'll create

Score transactions in parallel: rules engine branch + ML feature branch, merge scores, route high-risk to quarantine sink vs normal gold.

**Real-world example:** Payment stream → parallel(rule-based score, ML score) → merge → choice(score>threshold) → quarantine or gold.

| | |
|---|---|
| **Pattern ID** | `fraud-detection-parallel` |
| **Category** | Finance |
| **Difficulty** | Advanced |
| **Architecture** | workflow |

## Why use this pattern

Real-time fraud detection combining deterministic rules and ML scores.

## How it works

```
Kafka txns → Parallel(Rules, ML) → Merge → Choice → Quarantine | Gold
```



**AWS services:** `MSK` · `SageMaker` · `Glue` · `Step Functions` · `S3`


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
2. Paste: _"Fraud Scoring (Parallel Rules + ML) - Finance · parallel branches · choice route"_
3. Click **Preview pipeline plan** - read _what we'll create_ and _how it works_
4. Click **Load pipeline on canvas**

**Option B - Architectures library**

1. Sidebar → **Architectures**
2. Filter: **Finance**
3. Find **Fraud Scoring (Parallel Rules + ML)** → **Use pattern**

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

- Connect SageMaker batch transform as ML branch in production.
- Tune choice threshold in Step Functions.


## Related

- [Tutorial hub](../README.md)
- [Drag-and-drop E2E](../../drag-drop-pipeline-flow.md)
- [Vaquar Pattern](../../vaquar-pattern.md)

