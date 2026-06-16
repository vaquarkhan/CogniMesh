"use strict";

const { readStore, writeStore } = require("./platform-store");

const STORE_KEY = "pipeline-versions";
const versionsByKey = new Map();

function reloadPipelineVersions() {
  versionsByKey.clear();
  const data = readStore(STORE_KEY, {});
  for (const [key, list] of Object.entries(data)) {
    if (Array.isArray(list)) versionsByKey.set(key, list);
  }
}

function persistStore() {
  if (process.env.PIPELINE_VERSIONS_PERSIST === "false") return;
  writeStore(STORE_KEY, Object.fromEntries(versionsByKey));
}

reloadPipelineVersions();

function pipelineKey(domain, name) {
  return `${domain}/${name}`;
}

function savePipelineVersion({ contract, manifestYaml, nodes, edges, aws, userEmail }) {
  const key = pipelineKey(contract.metadata.domain, contract.metadata.name);
  const list = versionsByKey.get(key) || [];
  const entry = {
    id: `ver-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    version: contract.metadata.version,
    savedAt: new Date().toISOString(),
    contract,
    manifestYaml,
    nodes: nodes || null,
    edges: edges || null,
    aws: aws || null,
    userEmail: userEmail || null,
  };
  list.unshift(entry);
  if (list.length > 25) list.length = 25;
  versionsByKey.set(key, list);
  persistStore();
  return entry;
}

function listPipelineVersions(domain, name) {
  const list = versionsByKey.get(pipelineKey(domain, name)) || [];
  return list.map(({ id, version, savedAt, userEmail, aws }) => ({
    id,
    version,
    savedAt,
    userEmail,
    deployed: Boolean(aws?.deployed),
    stateMachineArn: aws?.stateMachineArn || null,
  }));
}

function getPipelineVersion(versionId) {
  for (const list of versionsByKey.values()) {
    const found = list.find((v) => v.id === versionId);
    if (found) return found;
  }
  return null;
}

function getLatestPipelineVersion(domain, name) {
  const list = versionsByKey.get(pipelineKey(domain, name)) || [];
  return list[0] || null;
}

function rollbackPayload(versionId) {
  const v = getPipelineVersion(versionId);
  if (!v) return { success: false, errors: ["Version not found"] };
  return {
    success: true,
    version: v.version,
    contract: v.contract,
    manifestYaml: v.manifestYaml,
    nodes: v.nodes,
    edges: v.edges,
    message: `Rollback snapshot v${v.version} from ${v.savedAt}`,
  };
}

module.exports = {
  savePipelineVersion,
  listPipelineVersions,
  getPipelineVersion,
  getLatestPipelineVersion,
  rollbackPayload,
  reloadPipelineVersions,
};
