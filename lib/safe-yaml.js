"use strict";

const yaml = require("js-yaml");

const DEFAULT_MAX_BYTES = 512 * 1024;
const DEFAULT_MAX_ALIASES = 16;

/**
 * Parse YAML safely — mitigates alias bombs and oversized payloads.
 * Uses JSON_SCHEMA (no custom tags) and caps alias count.
 */
function safeYamlLoad(input, options = {}) {
  const text = typeof input === "string" ? input : String(input);
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    const err = new Error(`YAML exceeds maximum size (${maxBytes} bytes)`);
    err.code = "YAML_TOO_LARGE";
    throw err;
  }

  try {
    return yaml.load(text, {
      schema: yaml.JSON_SCHEMA,
      maxAliasCount: options.maxAliasCount ?? DEFAULT_MAX_ALIASES,
    });
  } catch (err) {
    err.code = err.code || "YAML_PARSE_ERROR";
    throw err;
  }
}

function safeYamlDump(obj, options = {}) {
  return yaml.dump(obj, {
    lineWidth: options.lineWidth ?? 120,
    noRefs: true,
  });
}

module.exports = { safeYamlLoad, safeYamlDump, DEFAULT_MAX_BYTES, DEFAULT_MAX_ALIASES };
