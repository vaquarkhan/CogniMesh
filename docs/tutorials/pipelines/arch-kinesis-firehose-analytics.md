# Kinesis → Firehose → Analytics

<p align="center">
  <img src="../../assets/portal-canvas-datamesh.png" alt="Kinesis → Firehose → Analytics - CogniMesh canvas" width="720" />
  <br /><em>Real-time ingest · delivery · SQL analytics</em>
</p>

[← All tutorials](../README.md) · [Portal UI](../../PORTAL_UI.md)

---

## What you'll create

Production streaming stack: producers → Kinesis Data Streams → optional Firehose delivery to S3/Iceberg → Glue streaming ETL → enriched gold → fan-out to analytics.

**Real-world example:** Mobile app events → Kinesis → Firehose buffers to S3 bronze → Glue enriches → Iceberg gold → Athena dashboard.

| | |
|---|---|
| **Pattern ID** | `arch-kinesis-firehose-analytics` |
| **Category** | Streaming |
| **Difficulty** | Intermediate |
| **Architecture** | streaming |

## Why use this pattern

Clickstream, IoT telemetry, application logs, or event-driven microservices.

## How it works

```
API → Kinesis → Firehose → S3 bronze → Glue enrich → Iceberg → Athena
```

**Diagram:**

```
Producers → Kinesis → Firehose → S3
                ↘ Glue Streaming → Iceberg gold
```


**AWS services:** `Kinesis` · `Firehose` · `Glue` · `Iceberg` · `Athena` · `Lambda`


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
2. Paste: _"Kinesis → Firehose → Analytics - Real-time ingest · delivery · SQL analytics"_
3. Click **Preview pipeline plan** - read _what we'll create_ and _how it works_
4. Click **Load pipeline on canvas**

**Option B - Architectures library**

1. Sidebar → **Architectures**
2. Filter: **Streaming**
3. Find **Kinesis → Firehose → Analytics** → **Use pattern**

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

- Firehose = managed delivery to S3.
- Glue streaming reads bronze or Kinesis directly.


## Related

- [Tutorial hub](../README.md)
- [Drag-and-drop E2E](../../drag-drop-pipeline-flow.md)
- [Vaquar Pattern](../../vaquar-pattern.md)

