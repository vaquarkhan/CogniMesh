# Example: export SDP or dbt from a DataContract / canvas

CogniMesh remains the control plane. These endpoints return a zip (`zipBase64`) you can save and run with `spark-pipelines` or `dbt`. **Success here is not a catalog publish** - Iceberg commit still requires VRP PASS.

## Portal (recommended)

1. Load **Spark Declarative Pipelines (SDP) Medallion** or **dbt Silver → Gold (+ PVDM)**.
2. Open **AWS Design Review** → **Service topology map & export**.
3. Click **Export Spark Declarative Pipelines** or **Export dbt project**.

Captioned demos: [SDP video](../assets/cognimesh-sdp-export-demo.mp4) · [dbt video](../assets/cognimesh-dbt-export-demo.mp4)

## API

Both accept either a compiled `contract` or the same `{ nodes, edges, pipelineMeta }` body as preview/deploy.

### Spark Declarative Pipelines

```bash
curl -s -X POST http://localhost:4000/api/v1/pipelines/export/spark-declarative \
  -H "Content-Type: application/json" \
  -d @graph.json
```

Response fields: `projectName`, `files` (paths → text), `zipBase64`, `runHint` (e.g. `spark-pipelines dry-run && spark-pipelines run`).

### dbt project

```bash
curl -s -X POST http://localhost:4000/api/v1/pipelines/export/dbt \
  -H "Content-Type: application/json" \
  -d @graph.json
```

Unzipped layout includes `dbt_project.yml`, `models/`, `models/schema.yml`, `profiles.yml.example`.

### Save the zip (Node)

```bash
node -e "const fs=require('fs'); const j=JSON.parse(fs.readFileSync(0,'utf8')); fs.writeFileSync(j.projectName+'.zip', Buffer.from(j.zipBase64,'base64'));" < response.json
```

### PowerShell

```powershell
$body = Get-Content .\graph.json -Raw
$res = Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/v1/pipelines/export/spark-declarative -ContentType application/json -Body $body
[IO.File]::WriteAllBytes("$($res.projectName)-sdp.zip", [Convert]::FromBase64String($res.zipBase64))
```

## Minimal graph.json shape

```json
{
  "pipelineMeta": {
    "name": "sdp-orders-medallion",
    "domain": "commerce",
    "version": "1.0.0",
    "ownerEmail": "local-dev@cognimesh.local"
  },
  "nodes": [],
  "edges": []
}
```

Easiest path: load a pattern in the portal, **Preview YAML**, then reuse that graph from the browser network tab, or call export with the same payload as `POST /api/v1/pipelines/preview`.

## After export

```bash
# SDP (Spark 4.1+)
pip install "pyspark[pipelines]"
spark-pipelines dry-run
spark-pipelines run

# dbt
dbt run --select <model>
dbt test --select <model>
```

Then publish through CogniMesh Deploy so Run History shows **VRP PASS** before consumers see gold.

Code: `lib/export/` · Schema: `transform.type` = `spark_declarative` | `dbt` in [data-contract-spec](../data-contract-spec.md)

Tutorial: [SDP and dbt](../tutorials/sdp-and-dbt.md)
