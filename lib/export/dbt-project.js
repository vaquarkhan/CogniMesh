"use strict";

/**
 * Export a CogniMesh DataContract as a dbt project (models + sources + schema tests).
 * dbt owns SQL transform authorship; CogniMesh owns proof-gated Iceberg publication.
 */

function slug(value, fallback = "pipeline") {
  return String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "") || fallback;
}

function modelSql(contract) {
  const sql = (contract?.spec?.transform?.sparkSql || "").trim();
  const src = contract?.spec?.source || {};
  const table = slug(src.connection?.table || "input");
  const sourceName = slug(contract?.metadata?.domain || "raw");
  if (sql && /^select\b/i.test(sql)) {
    return `-- CogniMesh → dbt model\n${sql.replace(/;+\s*$/, "")}\n`;
  }
  if (sql && !/^create\b/i.test(sql)) {
    return `-- CogniMesh → dbt model\n${sql.replace(/;+\s*$/, "")}\n`;
  }
  return `-- CogniMesh → dbt model (edit me)
select *
from {{ source('${sourceName}', '${table}') }}
where 1 = 1
`;
}

function generateDbtProject(contract, options = {}) {
  if (!contract?.metadata?.name) {
    return { status: "error", errors: ["contract.metadata.name is required"] };
  }

  const name = slug(contract.metadata.name);
  const domain = slug(contract.metadata.domain || "default");
  const catalog = contract.spec?.target?.catalog || {};
  const src = contract.spec?.source || {};
  const sourceName = slug(domain);
  const sourceTable = slug(src.connection?.table || "input");
  const pk = src.cdc?.primaryKey || contract.spec?.transform?.pvdm?.identityFields || ["id"];
  const profile = options.profile || "cognimesh";
  const materialization = options.materialization || "table";

  const dbtProject = `name: '${name}'
version: '${contract.metadata.version || "1.0.0"}'
config-version: 2
profile: '${profile}'
model-paths: ["models"]
macro-paths: ["macros"]
target-path: "target"
clean-targets: ["target", "dbt_packages"]

models:
  ${name}:
    +materialized: ${materialization}
    +schema: ${catalog.database || domain}
    +tags: ["cognimesh", "domain:${domain}"]
`;

  const profilesExample = `# Example profiles.yml (do not commit secrets)
${profile}:
  target: dev
  outputs:
    dev:
      type: spark
      method: session
      schema: ${catalog.database || domain}
      host: localhost
      # Or use Athena / Databricks / Snowflake adapters as needed
`;

  const sources = `version: 2

sources:
  - name: ${sourceName}
    description: "CogniMesh source from DataContract ${contract.metadata.name}"
    tables:
      - name: ${sourceTable}
        description: "${src.type || "source"} · ${src.connection?.database || ""}"
        columns:
${pk.map((c) => `          - name: ${c}\n            tests: [not_null]`).join("\n")}
`;

  const schemaYml = `version: 2

models:
  - name: ${catalog.table || name}
    description: "Gold model exported from CogniMesh. Publish only after VRP PASS."
    columns:
${(contract.spec?.transform?.pvdm?.contentFields || pk)
  .map((c) => `      - name: ${c}\n        tests:\n          - not_null`)
  .join("\n")}
`;

  const onRunHook = `{% macro cognimesh_pvdm_reminder() %}
  {{ log("CogniMesh: after dbt run, submit sink bytes to PVDM verify-before-commit before catalog publish", info=True) }}
{% endmacro %}
`;

  const readme = `# ${name} - dbt project

Exported from CogniMesh DataContract \`${domain}/${contract.metadata.name}\`.

## Why dbt here?

- **dbt** authors and tests SQL models (silver/gold).
- **CogniMesh** still owns marketplace, contracts, and **VRP proof-gated Iceberg commit**.

A green \`dbt test\` is observational. It does not replace keyed multiset VRP.

## Run

\`\`\`bash
dbt deps
dbt run --select ${catalog.table || name}
dbt test --select ${catalog.table || name}
\`\`\`

Then publish through CogniMesh Vaquar path so \`commit_metadata ⇒ VRP = PASS\`.

## PVDM fields

\`\`\`yaml
identityFields: ${JSON.stringify(contract.spec?.transform?.pvdm?.identityFields || pk)}
contentFields: ${JSON.stringify(contract.spec?.transform?.pvdm?.contentFields || pk)}
\`\`\`
`;

  const modelName = catalog.table || name;
  const files = {
    "dbt_project.yml": dbtProject,
    "profiles.yml.example": profilesExample,
    "models/sources.yml": sources,
    [`models/${modelName}.sql`]: modelSql(contract),
    "models/schema.yml": schemaYml,
    "macros/cognimesh_pvdm.sql": onRunHook,
    "README.md": readme,
  };

  return {
    status: "success",
    format: "dbt",
    projectName: name,
    files,
    runHint: `dbt run --select ${modelName} && dbt test --select ${modelName}`,
    pvdmRequired: Boolean(contract.spec?.transform?.pvdm),
  };
}

module.exports = { generateDbtProject, slug };
