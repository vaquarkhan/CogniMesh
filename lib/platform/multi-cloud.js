"use strict";

const TARGETS = {
  aws: {
    id: "aws",
    label: "AWS",
    runtime: "Lambda + Step Functions",
    storage: "S3 + Iceberg",
    catalog: "Glue",
    status: "production",
  },
  databricks: {
    id: "databricks",
    label: "Databricks",
    runtime: "Delta Live Tables",
    storage: "Delta Lake",
    catalog: "Unity Catalog",
    status: "preview",
  },
  gcp: {
    id: "gcp",
    label: "Google Cloud",
    runtime: "Cloud Run + Workflows",
    storage: "BigQuery",
    catalog: "Dataplex",
    status: "preview",
  },
};

function listDeployTargets() {
  return Object.values(TARGETS);
}

function compileForTarget(contract, targetId = "aws") {
  const target = TARGETS[targetId] || TARGETS.aws;
  if (targetId === "aws") {
    return {
      target: target.id,
      status: "ready",
      artifact: "DataContract.yaml + Step Functions ASL",
      note: "Default CogniMesh deploy path",
    };
  }
  return {
    target: target.id,
    status: "preview",
    artifact: `${target.label} export bundle (generated)`,
    mapping: {
      bronze: `${target.storage}/bronze`,
      orchestration: target.runtime,
      governance: target.catalog,
    },
    note: `Multi-cloud export for ${target.label} — implement target-specific compiler`,
  };
}

module.exports = { listDeployTargets, compileForTarget, TARGETS };
