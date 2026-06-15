# CogniMesh Pipeline Engine

Compiles `DataContract.yaml` manifests into AWS Step Functions definitions.

## Usage

```bash
node compile.js ../../contracts/examples/structured-cdc-pipeline.yaml
```

## Flow

1. **ExtractSource** - Glue/CDC extraction to Bronze
2. **Transform** - Spark SQL or EKS agentic job
3. **LoadTarget** - Write to Iceberg/S3/Redshift Gold
