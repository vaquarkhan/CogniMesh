"use strict";

const { getPipelineVersion } = require("./pipeline-versions");

function schemaColumns(contract) {
  return (contract?.spec?.source?.schema || []).map((c) => c.name || c.field).filter(Boolean);
}

function diffContracts(left, right) {
  const leftMeta = left?.metadata || {};
  const rightMeta = right?.metadata || {};
  const leftCols = schemaColumns(left);
  const rightCols = schemaColumns(right);
  const leftSet = new Set(leftCols);
  const rightSet = new Set(rightCols);

  const addedColumns = rightCols.filter((c) => !leftSet.has(c));
  const removedColumns = leftCols.filter((c) => !rightSet.has(c));
  const commonColumns = leftCols.filter((c) => rightSet.has(c));

  const changes = [];
  if (leftMeta.version !== rightMeta.version) {
    changes.push({ field: "metadata.version", from: leftMeta.version, to: rightMeta.version });
  }
  if (leftMeta.schemaEvolutionPolicy !== rightMeta.schemaEvolutionPolicy) {
    changes.push({
      field: "schemaEvolutionPolicy",
      from: leftMeta.schemaEvolutionPolicy,
      to: rightMeta.schemaEvolutionPolicy,
    });
  }
  const leftTransform = left?.spec?.transform?.type;
  const rightTransform = right?.spec?.transform?.type;
  if (leftTransform !== rightTransform) {
    changes.push({ field: "transform.type", from: leftTransform, to: rightTransform });
  }
  const leftTarget = left?.spec?.target?.catalog?.table;
  const rightTarget = right?.spec?.target?.catalog?.table;
  if (leftTarget !== rightTarget) {
    changes.push({ field: "target.table", from: leftTarget, to: rightTarget });
  }

  const blastRadius =
    removedColumns.length > 2 || changes.length > 3
      ? "high"
      : addedColumns.length + removedColumns.length > 0
        ? "medium"
        : "low";

  return {
    leftVersion: leftMeta.version,
    rightVersion: rightMeta.version,
    schema: { addedColumns, removedColumns, commonColumns },
    metadataChanges: changes,
    blastRadius,
    summary:
      removedColumns.length > 0
        ? `${removedColumns.length} column(s) removed — downstream consumers may break`
        : addedColumns.length > 0
          ? `${addedColumns.length} column(s) added`
          : changes.length
            ? `${changes.length} metadata/transform change(s)`
            : "No material differences",
  };
}

function diffPipelineVersions(leftId, rightId) {
  const left = getPipelineVersion(leftId);
  const right = getPipelineVersion(rightId);
  if (!left || !right) {
    return { success: false, errors: ["One or both version IDs not found"] };
  }
  return {
    success: true,
    leftId,
    rightId,
    leftSavedAt: left.savedAt,
    rightSavedAt: right.savedAt,
    diff: diffContracts(left.contract, right.contract),
  };
}

module.exports = { diffContracts, diffPipelineVersions, schemaColumns };
