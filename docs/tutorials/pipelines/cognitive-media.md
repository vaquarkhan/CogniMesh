# Media → AI Enrichment

<p align="center">
  <img src="../../images/portal-agent-builder-canvas.png" alt="Media → AI Enrichment - CogniMesh canvas" width="720" />
  <br /><em>Bedrock agent · EKS runtime</em>
</p>

[← All tutorials](../README.md) · [Portal UI](../../PORTAL_UI.md)

---

## What you'll create

Ingest media URLs, run an agentic Bedrock transform, and write structured Parquet to Iceberg with compensation on failure.



| | |
|---|---|
| **Pattern ID** | `cognitive-media` |
| **Category** | Cognitive |
| **Difficulty** | Intermediate |
| **Architecture** | AI |

## Why use this pattern

Unstructured media, transcripts, or multimodal content needing AI extraction.

## How it works

```
Source → Transform → Sink (see canvas)
```



**AWS services:** `S3` · `Bedrock` · `EKS` · `Step Functions`


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
2. Paste: _"Media → AI Enrichment - Bedrock agent · EKS runtime"_
3. Click **Preview pipeline plan** - read _what we'll create_ and _how it works_
4. Click **Load pipeline on canvas**

**Option B - Architectures library**

1. Sidebar → **Architectures**
2. Filter: **Cognitive**
3. Find **Media → AI Enrichment** → **Use pattern**

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

- Set the S3 ingest path where raw media files land.
- Tune the prompt template for the fields you need extracted.
- Compensation handler enables rollback if the agent fails mid-run.


## Related

- [Tutorial hub](../README.md)
- [Drag-and-drop E2E](../../drag-drop-pipeline-flow.md)
- [Vaquar Pattern](../../vaquar-pattern.md)

