# FHIR Resources → HIPAA Gold

<p align="center">
  <img src="../../assets/portal-canvas-datamesh.png" alt="FHIR Resources → HIPAA Gold - CogniMesh canvas" width="720" />
  <br /><em>Healthcare · PII masks · restricted</em>
</p>

[← All tutorials](../README.md) · [Portal UI](../../PORTAL_UI.md)

---

## What you'll create

Ingest FHIR JSON bundles from S3, parse Patient/Observation resources in silver with PII classification restricted, write de-identified gold tables with column masks for MRN.

**Real-world example:** Hospital exports FHIR bundles to S3 → bronze raw JSON → silver parsed fields → gold de-identified cohort table.

| | |
|---|---|
| **Pattern ID** | `healthcare-fhir` |
| **Category** | Healthcare |
| **Difficulty** | Advanced |
| **Architecture** | compliance |

## Why use this pattern

Healthcare data mesh products sharing clinical data with researchers or downstream analytics under HIPAA.

## How it works

```
S3 FHIR export → Bronze → Silver (parse) → Governance gate → Gold (masked MRN)
```

**Diagram:**

```
S3 FHIR → Bronze → Silver → Integrity Gate (PII) → Gold (hash MRN)
```


**AWS services:** `S3` · `Glue` · `Lake Formation` · `Iceberg` · `KMS`


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
2. Paste: _"FHIR Resources → HIPAA Gold - Healthcare · PII masks · restricted"_
3. Click **Preview pipeline plan** - read _what we'll create_ and _how it works_
4. Click **Load pipeline on canvas**

**Option B - Architectures library**

1. Sidebar → **Architectures**
2. Filter: **Healthcare**
3. Find **FHIR Resources → HIPAA Gold** → **Use pattern**

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

- Set PII classification to restricted in pipeline settings.
- Add column masks for MRN in contract governance.


## Related

- [Tutorial hub](../README.md)
- [Drag-and-drop E2E](../../drag-drop-pipeline-flow.md)
- [Vaquar Pattern](../../vaquar-pattern.md)

