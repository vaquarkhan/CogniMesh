"use strict";

const fs = require("fs");
const path = require("path");

/** Pipeline version store — in-memory with optional file persistence. */
const versionsByKey = new Map();

const storePath = () =>
  process.env.PIPELINE_VERSIONS_PATH ||
  path.join(process.cwd(), "data", "pipeline-versions.json");

function pipelineKey(domain, name) {
  return `${domain}/${name}`;
}

function loadStore() {
  try {
    const file = storePath();
    if (!fs.existsSync(file)) return;
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const [key, list] of Object.entries(data)) {
      if (Array.isArray(list)) versionsByKey.set(key, list);
    }
  } catch {
    // non-fatal in dev
  }
}

function persistStore() {
  if (process.env.PIPELINE_VERSIONS_PERSIST === "false") return;
  try {
    const file = storePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const obj = Object.fromEntries(versionsByKey);
    fs.writeFileSync(file, JSON.stringify(obj, null, 2), "utf8");
  } catch {
    // non-fatal in dev
  }
}

loadStore();

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
};
