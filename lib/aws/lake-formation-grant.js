"use strict";

/**
 * Opt-in Lake Formation GrantPermissions for marketplace access approve.
 * Set LAKE_FORMATION_GRANT_ENABLED=true and provide principal + Glue table.
 * Without the flag (or missing SDK/creds), returns a simulated grant for local demos.
 */

function grantEnabled() {
  return String(process.env.LAKE_FORMATION_GRANT_ENABLED || "").toLowerCase() === "true";
}

function resolvePrincipalArn(input = {}) {
  return (
    input.principalArn ||
    input.principal ||
    process.env.LAKE_FORMATION_CONSUMER_PRINCIPAL_ARN ||
    process.env.AWS_CONSUMER_ROLE_ARN ||
    null
  );
}

/**
 * @param {{ principalArn?: string, database: string, table: string, permissions?: string[], catalogId?: string }} opts
 */
async function grantConsumerSelect(opts = {}) {
  const database = opts.database;
  const table = opts.table;
  const permissions = opts.permissions || ["SELECT"];
  const principalArn = resolvePrincipalArn(opts);

  if (!database || !table) {
    return {
      granted: false,
      implemented: true,
      simulated: false,
      permission: permissions[0] || "SELECT",
      note: "Missing Glue database/table on product — cannot grant Lake Formation SELECT.",
      fixHint: "Set catalogDatabase / catalogTable on the product manifest.",
    };
  }

  if (!principalArn) {
    return {
      granted: false,
      implemented: true,
      simulated: !grantEnabled(),
      permission: permissions[0] || "SELECT",
      database,
      table,
      note: grantEnabled()
        ? "principalArn required when LAKE_FORMATION_GRANT_ENABLED=true"
        : "Simulated grant skipped — no principal. Pass principalArn on approve or set LAKE_FORMATION_CONSUMER_PRINCIPAL_ARN.",
      fixHint: "POST /access-requests/:id/approve with { principalArn } or set LAKE_FORMATION_CONSUMER_PRINCIPAL_ARN.",
    };
  }

  if (!grantEnabled()) {
    return {
      granted: true,
      implemented: true,
      simulated: true,
      permission: permissions.join(","),
      principalArn,
      database,
      table,
      note: "Simulated Lake Formation SELECT (set LAKE_FORMATION_GRANT_ENABLED=true for live GrantPermissions).",
    };
  }

  try {
    const { LakeFormationClient, GrantPermissionsCommand } = require("@aws-sdk/client-lakeformation");
    const client = new LakeFormationClient({ region: process.env.AWS_REGION || "us-east-1" });
    const input = {
      Principal: { DataLakePrincipalIdentifier: principalArn },
      Resource: {
        Table: {
          DatabaseName: database,
          Name: table,
          ...(opts.catalogId ? { CatalogId: opts.catalogId } : {}),
        },
      },
      Permissions: permissions,
      PermissionsWithGrantOption: [],
    };
    await client.send(new GrantPermissionsCommand(input));
    return {
      granted: true,
      implemented: true,
      simulated: false,
      permission: permissions.join(","),
      principalArn,
      database,
      table,
      note: "Lake Formation GrantPermissions succeeded.",
    };
  } catch (err) {
    const missingSdk = /Cannot find module '@aws-sdk\/client-lakeformation'/.test(err.message || "");
    return {
      granted: false,
      implemented: true,
      simulated: false,
      permission: permissions.join(","),
      principalArn,
      database,
      table,
      error: err.message,
      note: missingSdk
        ? "Install @aws-sdk/client-lakeformation and retry with LAKE_FORMATION_GRANT_ENABLED=true."
        : `Lake Formation GrantPermissions failed: ${err.message}`,
      fixHint: missingSdk
        ? "npm install @aws-sdk/client-lakeformation"
        : "Check IAM lakeformation:GrantPermissions and Glue table names.",
    };
  }
}

function catalogFromProduct(product = {}) {
  const yaml = product.manifestYaml || "";
  const tags = product.tags || {};
  const dbMatch = yaml.match(/catalogDatabase:\s*(\S+)/);
  const tableMatch = yaml.match(/catalogTable:\s*(\S+)/);
  return {
    database: tags.catalogDatabase || dbMatch?.[1] || product.catalogDatabase || product.domain || "default",
    table: tags.catalogTable || tableMatch?.[1] || product.catalogTable || product.name || "output",
  };
}

module.exports = {
  grantConsumerSelect,
  grantEnabled,
  resolvePrincipalArn,
  catalogFromProduct,
};
