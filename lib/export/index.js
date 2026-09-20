"use strict";

const { generateSparkDeclarativeProject } = require("./spark-declarative");
const { generateDbtProject } = require("./dbt-project");
const { zipStore } = require("./zip-store");

function exportProjectBundle(kind, contract, options = {}) {
  if (!contract || typeof contract !== "object") {
    return {
      status: "error",
      code: "EXPORT_CONTRACT_REQUIRED",
      errors: ["A DataContract object is required for export."],
      fixHint: "Send { nodes, edges, pipelineMeta } from the canvas, or a compiled contract from Preview YAML.",
    };
  }
  if (!contract.metadata?.name) {
    return {
      status: "error",
      code: "EXPORT_NAME_REQUIRED",
      errors: ["contract.metadata.name is required."],
      fixHint: "Set Pipeline settings → name (click empty canvas), or load an Architectures pattern first.",
    };
  }

  let project;
  try {
    project =
      kind === "dbt"
        ? generateDbtProject(contract, options)
        : generateSparkDeclarativeProject(contract, options);
  } catch (err) {
    return {
      status: "error",
      code: "EXPORT_GENERATE_FAILED",
      errors: [err.message || String(err)],
      fixHint:
        kind === "dbt"
          ? "Check transform SQL is a SELECT (or leave blank for a starter model). See docs/examples/sdp-dbt-export.md."
          : "Check bronze/silver/gold SQL. See docs/tutorials/sdp-and-dbt.md.",
    };
  }

  if (project.status !== "success") {
    return {
      ...project,
      code: project.code || "EXPORT_GENERATE_FAILED",
      fixHint:
        project.fixHint ||
        (kind === "dbt"
          ? "Load pattern dbt-silver-gold, then Export dbt project from AWS Design Review."
          : "Load pattern spark-declarative-medallion, then Export Spark Declarative Pipelines."),
    };
  }

  try {
    const zip = zipStore(project.files);
    return {
      ...project,
      zipBase64: zip.toString("base64"),
      zipBytes: zip.length,
      fileCount: Object.keys(project.files).length,
    };
  } catch (err) {
    return {
      status: "error",
      code: "EXPORT_ZIP_FAILED",
      errors: [err.message || "Failed to build zip archive"],
      fixHint: "Retry export. If it persists, check API logs for EXPORT_ZIP_FAILED.",
    };
  }
}

module.exports = {
  generateSparkDeclarativeProject,
  generateDbtProject,
  exportProjectBundle,
  zipStore,
};
