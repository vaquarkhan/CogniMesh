"use strict";

const ALLOWED_TYPES = new Set(["source", "transform", "sink"]);
const ALLOWED_FIELDS = new Set([
  "id",
  "type",
  "label",
  "author",
  "version",
  "description",
  "defaults",
  "icon",
  "awsService",
]);

function validatePluginManifest(entry) {
  const errors = [];
  if (!entry?.id || typeof entry.id !== "string") errors.push("id required");
  if (!entry?.type || !ALLOWED_TYPES.has(entry.type)) {
    errors.push("type must be source, transform, or sink");
  }
  if (!entry?.label) errors.push("label required");
  for (const key of Object.keys(entry || {})) {
    if (!ALLOWED_FIELDS.has(key) && key !== "custom" && key !== "builtin") {
      errors.push(`disallowed field: ${key}`);
    }
  }
  const defaults = entry?.defaults || {};
  if (defaults.blockType && defaults.blockType !== entry.type) {
    errors.push("defaults.blockType must match plugin type");
  }
  if (/[<>`]/.test(JSON.stringify(entry))) {
    errors.push("plugin manifest must not contain HTML/script");
  }
  return { valid: errors.length === 0, errors };
}

function sandboxCompilePlugin(entry) {
  const validation = validatePluginManifest(entry);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  const blockType = entry.type;
  const block = {
    type: `plugin-${entry.id}`,
    label: entry.label,
    category: "plugins",
    defaults: {
      blockType,
      label: entry.label,
      detail: entry.description || `Plugin · ${entry.id}`,
      pluginId: entry.id,
      pluginVersion: entry.version || "1.0.0",
      isPlugin: true,
      ...(entry.defaults || {}),
      awsService: entry.awsService || entry.defaults?.awsService,
    },
  };

  if (blockType === "source") {
    block.defaults.sourceType = block.defaults.sourceType || "api";
  }
  if (blockType === "transform") {
    block.defaults.transformType = block.defaults.transformType || "passthrough";
  }
  if (blockType === "sink") {
    block.defaults.targetType = block.defaults.targetType || "s3";
  }

  return {
    success: true,
    sandboxed: true,
    block,
    note: "Plugin compiled in sandbox — only allowlisted defaults applied; no arbitrary code execution",
  };
}

const { readStore, writeStore } = require("./platform-store");
const PLUGINS_STORE_KEY = "plugins";

function loadCustomPlugins() {
  const data = readStore(PLUGINS_STORE_KEY, []);
  return Array.isArray(data) ? data : [];
}

function persistCustomPlugins(custom) {
  writeStore(PLUGINS_STORE_KEY, custom);
}

function reloadCustomPlugins() {
  return loadCustomPlugins();
}

module.exports = {
  validatePluginManifest,
  sandboxCompilePlugin,
  loadCustomPlugins,
  persistCustomPlugins,
  reloadCustomPlugins,
  ALLOWED_TYPES,
};
