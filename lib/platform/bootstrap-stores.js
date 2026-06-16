"use strict";

const { initPlatformStore } = require("./platform-store");
const { reloadPipelineVersions } = require("./pipeline-versions");
const { reloadDeployApprovals } = require("./deploy-approval");
const { reloadBilling } = require("./cross-org-billing");
const { reloadCustomPlugins } = require("./plugin-sandbox");

const STORE_KEYS = ["pipeline-versions", "deploy-approvals", "plugins", "cross-org-billing"];

async function bootstrapPlatformStores() {
  const info = await initPlatformStore(STORE_KEYS);
  reloadPipelineVersions();
  reloadDeployApprovals();
  reloadBilling();
  reloadCustomPlugins();
  return info;
}

module.exports = { bootstrapPlatformStores, STORE_KEYS };
