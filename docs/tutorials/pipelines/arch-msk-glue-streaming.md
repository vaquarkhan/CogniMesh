# MSK → Glue Streaming → Lakehouse

<p align="center">
  <img src="../../assets/portal-canvas-datamesh.png" alt="MSK → Glue Streaming → Lakehouse - CogniMesh canvas" width="720" />
  <br /><em>Kafka-compatible · at-least-once + idempotent MERGE · MSK</em>
</p>

[← All tutorials](../README.md) · [Portal UI](../../PORTAL_UI.md)

---

## What you'll create

Amazon MSK (Managed Kafka) as durable log, Glue streaming ETL with window aggregations, MERGE into Iceberg silver, publish gold metrics.

**Real-world example:** Order events on MSK topic orders.events → 1-min windows → MERGE silver → hourly gold KPIs.

| | |
|---|---|
| **Pattern ID** | `arch-msk-glue-streaming` |
| **Category** | Streaming |
| **Difficulty** | Advanced |
| **Architecture** | streaming |

## Why use this pattern

Event-driven architecture already on Kafka/MSK; need managed AWS streaming to lakehouse.

## How it works

```
MSK topic → Glue streaming window → CDC merge silver → aggregate gold
```

**Diagram:**

```
MSK topic → Glue Streaming (windows) → Iceberg silver MERGE → gold KPIs
```


**AWS services:** `MSK` · `Glue` · `Iceberg` · `Schema Registry` · `Lambda`


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
2. Paste: _"Lakehouse Iceberg medallion with CDC merge"_
3. Click **Preview pipeline plan** - read _what we'll create_ and _how it works_
4. Click **Load pipeline on canvas**

**Option B - Architectures library**

1. Sidebar → **Architectures**
2. Filter: **Streaming**
3. Find **MSK → Glue Streaming → Lakehouse** → **Use pattern**

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

- MSK = managed Kafka.
- Use Glue Schema Registry for Avro/Protobuf.


## Related

- [Tutorial hub](../README.md)
- [Drag-and-drop E2E](../../drag-drop-pipeline-flow.md)
- [Vaquar Pattern](../../vaquar-pattern.md)

