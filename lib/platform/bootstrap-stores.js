"use strict";

const { initPlatformStore } = require("./platform-store");
const { reloadPipelineVersions } = require("./pipeline-versions");
const { reloadDeployApprovals } = require("./deploy-approval");
const { reloadBilling } = require("./cross-org-billing");
const { reloadCustomPlugins } = require("./plugin-sandbox");
const { reloadExecutionRuns } = require("../execution-history");

const STORE_KEYS = ["pipeline-versions", "deploy-approvals", "plugins", "cross-org-billing", "execution-runs"];

async function bootstrapPlatformStores() {
  const info = await initPlatformStore(STORE_KEYS);
  reloadPipelineVersions();
  reloadDeployApprovals();
  reloadBilling();
  reloadCustomPlugins();
  reloadExecutionRuns();
  return info;
}

module.exports = { bootstrapPlatformStores, STORE_KEYS };
