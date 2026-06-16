"use strict";

const fs = require("fs");
const path = require("path");

function loadSchema() {
  const schemaPath = path.join(process.cwd(), "schemas", "data-contract-v1.schema.json");
  try {
    return JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  } catch {
    return { title: "CogniMesh DataContract", description: "Schema unavailable" };
  }
}

function generateOpenSpecSite() {
  const schema = loadSchema();
  const schemaJson = JSON.stringify(schema, null, 2);
  const required = schema.required || ["metadata", "spec"];
  const props = Object.keys(schema.properties || {});

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>cognimesh.io/v1 — Open DataContract Specification</title>
  <style>
    :root { --bg: #0f1419; --card: #1e293b; --text: #e2e8f0; --accent: #3b82f6; }
    @media (prefers-color-scheme: light) {
      :root { --bg: #f8fafc; --card: #ffffff; --text: #0f172a; --accent: #2563eb; }
      header { background: #e2e8f0; border-bottom-color: #cbd5e1; }
      h1 { color: #0f172a; }
      h2 { color: #1d4ed8; }
      code, pre { background: #f1f5f9; }
    }
    body { font-family: system-ui, sans-serif; background: var(--bg); color: var(--text); margin: 0; line-height: 1.6; }
    header { padding: 2rem; border-bottom: 1px solid #334155; background: #111827; }
    h1 { margin: 0 0 0.5rem; color: #fff; }
    .badge { display: inline-block; background: var(--accent); color: #fff; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem; }
    main { max-width: 960px; margin: 0 auto; padding: 2rem 1.5rem; }
    section { background: var(--card); border-radius: 8px; padding: 1.25rem; margin-bottom: 1.25rem; }
    h2 { color: #93c5fd; margin-top: 0; }
    code, pre { background: #0f172a; padding: 0.15rem 0.35rem; border-radius: 4px; font-size: 0.85rem; }
    pre { padding: 1rem; overflow-x: auto; }
    a { color: #60a5fa; }
    ul { padding-left: 1.25rem; }
  </style>
</head>
<body>
  <header>
    <span class="badge">Reference implementation</span>
    <h1>cognimesh.io/v1</h1>
    <p>Open DataContract specification for cognitive data mesh pipelines · CogniMesh</p>
  </header>
  <main>
    <section>
      <h2>Overview</h2>
      <p>
        <strong>cognimesh.io/v1</strong> defines a portable YAML contract for data products:
        source schema, transform (Spark/Glue/PVDM), integrity gate, lineage, and marketplace registration.
      </p>
      <p>Companion spec: <code>agentcore.cognimesh/v1</code> for Bedrock AgentCore manifests.</p>
    </section>
    <section>
      <h2>Required top-level fields</h2>
      <ul>${required.map((r) => `<li><code>${r}</code></li>`).join("")}</ul>
    </section>
    <section>
      <h2>Properties</h2>
      <ul>${props.map((p) => `<li><code>${p}</code></li>`).join("")}</ul>
    </section>
    <section>
      <h2>Minimal example</h2>
      <pre>apiVersion: cognimesh.io/v1
kind: DataContract
metadata:
  name: customer-orders
  domain: commerce
  version: 1.0.0
spec:
  source:
    type: rds
    connection:
      database: shop
      table: orders
  transform:
    type: spark_sql
  target:
    catalog:
      table: orders_curated</pre>
    </section>
    <section>
      <h2>JSON Schema</h2>
      <pre>${schemaJson.replace(/</g, "&lt;")}</pre>
    </section>
    <section>
      <h2>Links</h2>
      <ul>
        <li><a href="/schemas/data-contract-v1.schema.json">Download JSON Schema</a></li>
        <li><a href="https://github.com/vaquarkhan/CogniMesh">CogniMesh on GitHub</a></li>
      </ul>
    </section>
  </main>
</body>
</html>`;
}

function getOpenSpecMeta() {
  return {
    spec: "cognimesh.io/v1",
    schemaUrl: "/schemas/data-contract-v1.schema.json",
    siteUrl: "/api/v1/platform/open-spec/site",
    agentSpec: "agentcore.cognimesh/v1",
    status: "reference-implementation",
    publishUrl: "https://github.com/vaquarkhan/CogniMesh",
    required: loadSchema().required || [],
  };
}

module.exports = { generateOpenSpecSite, getOpenSpecMeta, loadSchema };
