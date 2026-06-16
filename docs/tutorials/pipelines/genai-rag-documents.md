# Documents → RAG Knowledge Base

<p align="center">
  <img src="../../images/portal-ai-agent-generator.png" alt="Documents → RAG Knowledge Base - CogniMesh canvas" width="720" />
  <br /><em>Cognitive · Bedrock · chunk + embed</em>
</p>

[← All tutorials](../README.md) · [Portal UI](../../PORTAL_UI.md)

---

## What you'll create

Ingest PDF/document URLs from S3, use Bedrock agent to chunk, summarize, and extract metadata, write vector-ready Parquet to gold for RAG retrieval.

**Real-world example:** S3 pdf/ prefix → Bedrock extracts title, summary, entities → gold chunks table for OpenSearch/Kendra.

| | |
|---|---|
| **Pattern ID** | `genai-rag-documents` |
| **Category** | Cognitive |
| **Difficulty** | Intermediate |
| **Architecture** | cognitive |

## Why use this pattern

Enterprise knowledge bases, support doc search, internal wiki indexing.

## How it works

```
S3 docs → Bedrock Agent → Gold Iceberg (chunks + embeddings metadata)
```



**AWS services:** `S3` · `Bedrock` · `OpenSearch` · `EKS` · `Iceberg`


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
2. Paste: _"Documents → RAG Knowledge Base - Cognitive · Bedrock · chunk + embed"_
3. Click **Preview pipeline plan** - read _what we'll create_ and _how it works_
4. Click **Load pipeline on canvas**

**Option B - Architectures library**

1. Sidebar → **Architectures**
2. Filter: **Cognitive**
3. Find **Documents → RAG Knowledge Base** → **Use pattern**

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

- Tune prompt for your chunk size.
- Wire OpenSearch index in a downstream consumer product.


## Related

- [Tutorial hub](../README.md)
- [Drag-and-drop E2E](../../drag-drop-pipeline-flow.md)
- [Vaquar Pattern](../../vaquar-pattern.md)

