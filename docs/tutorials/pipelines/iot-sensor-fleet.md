# IoT Sensor Fleet → Timestream Gold

<p align="center">
  <img src="../../assets/portal-canvas-datamesh.png" alt="IoT Sensor Fleet → Timestream Gold - CogniMesh canvas" width="720" />
  <br /><em>IoT · high volume · parallel ingest</em>
</p>

[← All tutorials](../README.md) · [Portal UI](../../PORTAL_UI.md)

---

## What you'll create

Ingest telemetry from multiple device fleets in parallel, merge, apply anomaly detection SQL, write curated gold metrics.

**Real-world example:** 10k devices → two Kafka topics (fleet A/B) → parallel ingest → merged silver → gold hourly aggregates.

| | |
|---|---|
| **Pattern ID** | `iot-sensor-fleet` |
| **Category** | Streaming |
| **Difficulty** | Advanced |
| **Architecture** | workflow |

## Why use this pattern

Manufacturing, fleet management, smart building sensor networks.

## How it works

```
Parallel(Kafka A, Kafka B) → Merge → Anomaly SQL → Gold
```



**AWS services:** `IoT Core` · `MSK` · `Glue` · `Iceberg` · `Step Functions`


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
2. Paste: _"IoT Sensor Fleet → Timestream Gold - IoT · high volume · parallel ingest"_
3. Click **Preview pipeline plan** - read _what we'll create_ and _how it works_
4. Click **Load pipeline on canvas**

**Option B - Architectures library**

1. Sidebar → **Architectures**
2. Filter: **Streaming**
3. Find **IoT Sensor Fleet → Timestream Gold** → **Use pattern**

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

- Add more fleet branches to Parallel as needed.
- Tune hourly aggregation SQL for your metrics.


## Related

- [Tutorial hub](../README.md)
- [Drag-and-drop E2E](../../drag-drop-pipeline-flow.md)
- [Vaquar Pattern](../../vaquar-pattern.md)

