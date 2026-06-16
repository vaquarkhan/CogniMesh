# Multi-Source → Parallel → Choice

<p align="center">
  <img src="../../assets/portal-canvas-datamesh.png" alt="Multi-Source → Parallel → Choice - CogniMesh canvas" width="720" />
  <br /><em>Step Functions workflow · many sources & sinks</em>
</p>

[← All tutorials](../README.md) · [Portal UI](../../PORTAL_UI.md)

---

## What you'll create

Ingest from RDS and S3 in parallel, merge, then route to Iceberg gold or S3 archive based on a Choice state - like AWS Step Functions.

**Real-world example:** RDS orders + S3 partner files run in parallel, merge, route high-value orders to gold Iceberg and others to archive.

| | |
|---|---|
| **Pattern ID** | `multi-source-mesh` |
| **Category** | Structured |
| **Difficulty** | Intermediate |
| **Architecture** | workflow |

## Why use this pattern

Multiple upstream systems feeding one mesh product with conditional routing.

## How it works

```
Start → Parallel(RDS, S3) → Merge → Integrity Gate → Choice → Gold | Archive
```

**Diagram:**

```
Parallel ingest → Merge → PVDM Gate → Choice routing
```


**AWS services:** `RDS` · `S3` · `Glue` · `Step Functions` · `Lambda`


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
2. Paste: _"Multi-Source → Parallel → Choice - Step Functions workflow · many sources & sinks"_
3. Click **Preview pipeline plan** - read _what we'll create_ and _how it works_
4. Click **Load pipeline on canvas**

**Option B - Architectures library**

1. Sidebar → **Architectures**
2. Filter: **Structured**
3. Find **Multi-Source → Parallel → Choice** → **Use pattern**

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

- This is a Step Functions–style graph: Start → Parallel → Merge → Choice.
- Add more Source blocks and wire them into Parallel branches.
- Click Choice → connect each route to a different Sink.
- Preview YAML to see the generated state machine ASL.


## Related

- [Tutorial hub](../README.md)
- [Drag-and-drop E2E](../../drag-drop-pipeline-flow.md)
- [Vaquar Pattern](../../vaquar-pattern.md)

