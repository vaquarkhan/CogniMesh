"use strict";

const { generateSparkDeclarativeProject } = require("./spark-declarative");
const { generateDbtProject } = require("./dbt-project");
const { zipStore } = require("./zip-store");

function exportProjectBundle(kind, contract, options = {}) {
  const project =
    kind === "dbt"
      ? generateDbtProject(contract, options)
      : generateSparkDeclarativeProject(contract, options);
  if (project.status !== "success") return project;
  const zip = zipStore(project.files);
  return {
    ...project,
    zipBase64: zip.toString("base64"),
    zipBytes: zip.length,
    fileCount: Object.keys(project.files).length,
  };
}

module.exports = {
  generateSparkDeclarativeProject,
  generateDbtProject,
  exportProjectBundle,
  zipStore,
};
