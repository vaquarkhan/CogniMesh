"use strict";

const {
  validatePluginManifest,
  sandboxCompilePlugin,
  loadCustomPlugins,
  persistCustomPlugins,
} = require("./plugin-sandbox");

const builtins = [
  {
    id: "snowflake-sink",
    type: "sink",
    label: "Snowflake Sink",
    author: "cognimesh",
    version: "0.1.0",
    builtin: true,
    defaults: { targetType: "s3", detail: "Snowflake export via S3 stage" },
  },
  {
    id: "salesforce-source",
    type: "source",
    label: "Salesforce Source",
    author: "cognimesh",
    version: "0.1.0",
    builtin: true,
    defaults: { sourceType: "api", detail: "Salesforce Bulk API" },
  },
];

function listPlugins() {
  return [...builtins, ...loadCustomPlugins()];
}

function registerPlugin(entry) {
  const validation = validatePluginManifest(entry);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }
  const compiled = sandboxCompilePlugin(entry);
  if (!compiled.success) {
    return compiled;
  }

  const custom = loadCustomPlugins();
  const existing = custom.find((p) => p.id === entry.id);
  const plugin = {
    ...entry,
    custom: true,
    version: entry.version || "1.0.0",
    block: compiled.block,
  };

  if (existing) {
    Object.assign(existing, plugin);
  } else {
    custom.push(plugin);
  }
  persistCustomPlugins(custom);
  return { success: true, plugin, compiled, updated: Boolean(existing) };
}

function listPluginBlocks() {
  return listPlugins()
    .filter((p) => p.block || p.type)
    .map((p) => {
      if (p.block) return p.block;
      return sandboxCompilePlugin(p).block;
    })
    .filter(Boolean);
}

module.exports = { listPlugins, registerPlugin, listPluginBlocks, sandboxCompilePlugin };
