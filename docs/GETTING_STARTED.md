# Getting Started in 5 Minutes

CogniMesh is a zero-code portal for designing data mesh pipelines and Bedrock agents. This guide is for **operators and data engineers**.

Need the full map? → [Documentation index](README.md)

## 1. Start the portal (2 min)

```bash
git clone https://github.com/vaquarkhan/CogniMesh.git
cd CogniMesh
npm ci
npm run start:dev
```

Open **http://localhost:3000** in your browser. (`dev:minimal` also works if you only need the portal shell.)

## 2. Load a pipeline pattern (30 sec)

1. On the canvas empty state, click **Load: Multi-Source workflow** (if shown).
2. Or open **Architectures** in the left sidebar → expand a pattern → **Use this pattern** / **Use pattern**.

You will see a Step Functions-style graph: sources, transforms, integrity gate, and sinks.

Try next: **SDP Medallion** or **dbt Silver → Gold** when you want portable Spark / dbt exports.

## 3. Preview and deploy (1 min)

1. Click **Preview YAML** in the toolbar - review the generated DataContract.
2. Click **Deploy Pipeline** - CogniMesh runs the integrity gate, PVDM simulation, and catalog registration.

With AWS disabled (default local dev), deploy compiles locally and shows a clear banner. Enable real AWS deploy via Terraform outputs in [CONTRIBUTING.md](../CONTRIBUTING.md).

## 4. Fix AWS Design Review issues (1 min)

The **AWS Design Review** panel at the bottom scans your graph automatically.

1. Click a block with a red badge (e.g. **RDS Orders**).
2. In the **Properties** panel on the right, each finding has **Fix this →** (step guide) and **Apply fix** (one-click patch).
3. For sinks, set **Encryption at rest** to **AES256** in Properties.
4. For mesh governance, enable **Lake Formation** under **Pipeline settings** (click empty canvas).
5. Optional: open **Service topology map & export** to download **SDP** or **dbt** project zips.

## 5. Try Agent Builder (30 sec)

1. Click **Agent Builder** in the header.
2. Expand **Customer Support Agent** → **Use this agent template**.
3. Click **Preview manifest** or **Deploy to AWS** (simulated locally unless `AWS_AGENT_DEPLOY_ENABLED=true`).

Agent descriptions must be at least 40 characters for Bedrock.

## What's next?

| Goal | Where to go |
|------|-------------|
| Operations & lineage | **Panels → Operations** |
| Marketplace & proof verify | **Panels → Marketplace** · [tutorial](tutorials/proof-gated-marketplace.md) · [video](assets/cognimesh-marketplace-proof-demo.mp4) |
| SDP / dbt export | Patterns above · [tutorial](tutorials/sdp-and-dbt.md) · [API example](examples/sdp-dbt-export.md) |
| Real AWS deploy | [CONTRIBUTING.md](../CONTRIBUTING.md) · [aws-pvdm-runbook](examples/aws-pvdm-runbook.md) |
| Developer customization | [developer/README.md](developer/README.md) |
| All docs | [Documentation map](README.md) |

Watch how it works: [Captioned tutorial](tutorials/getting-started-ui.md) · [How-to video](assets/cognimesh-howto-demo.mp4)

Screenshots: `docs/images/dev/` · regenerate demos with `npm run docs:demo`.
