"use strict";

/**
 * Catalog host for proof-gated Metadata commit and consumer snapshot pins.
 * Paper §2.1: the gate is catalog-agnostic (Glue Iceberg REST or Apache Polaris / Iceberg REST).
 */
function resolveCatalogHost(overrides = {}) {
  const host = String(overrides.host || process.env.PVDM_CATALOG_HOST || "glue").toLowerCase();
  const restUri = overrides.restUri || process.env.ICEBERG_REST_URI || process.env.POLARIS_URI || null;
  const known = host === "polaris" || host === "iceberg-rest" || host === "glue";
  return {
    host: known ? host : "glue",
    restUri,
    engine: host === "glue" ? "athena" : "spark",
    note:
      host === "polaris" || host === "iceberg-rest"
        ? "Iceberg REST catalog (Polaris or compatible) — Steward-side Metadata host"
        : "AWS Glue Data Catalog / Iceberg REST — default CogniMesh Metadata host",
  };
}

module.exports = { resolveCatalogHost };
