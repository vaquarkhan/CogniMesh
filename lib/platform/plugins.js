"use strict";

/** Custom block plugin registry (Tier 4). */
const plugins = [
  {
    id: "snowflake-sink",
    type: "sink",
    label: "Snowflake Sink",
    author: "cognimesh",
    version: "0.1.0",
    builtin: true,
  },
  {
    id: "salesforce-source",
    type: "source",
    label: "Salesforce Source",
    author: "cognimesh",
    version: "0.1.0",
    builtin: true,
  },
];

function listPlugins() {
  return plugins;
}

function registerPlugin(entry) {
  if (!entry?.id || !entry?.type) {
    return { success: false, errors: ["id and type required"] };
  }
  const existing = plugins.find((p) => p.id === entry.id);
  if (existing) {
    Object.assign(existing, entry, { custom: true });
    return { success: true, plugin: existing, updated: true };
  }
  const plugin = { ...entry, custom: true, version: entry.version || "1.0.0" };
  plugins.push(plugin);
  return { success: true, plugin };
}

module.exports = { listPlugins, registerPlugin };
