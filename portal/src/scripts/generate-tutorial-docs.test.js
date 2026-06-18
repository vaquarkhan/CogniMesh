/**
 * Generates docs/tutorials/* from live pattern and agent catalogs.
 * Run: npm run docs:tutorials (from repo root)
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PIPELINE_PATTERNS } from "../lib/pipeline-patterns.js";
import { AGENT_TEMPLATES } from "../lib/agent-templates.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..", "..");
const TUTORIALS = path.join(ROOT, "docs", "tutorials");
const PIPELINES_DIR = path.join(TUTORIALS, "pipelines");
const AGENTS_DIR = path.join(TUTORIALS, "agents");

const SKIP_PIPELINE = new Set(["pick", "customize", "connect", "preview", "deploy", "blank"]);
const SKIP_AGENT = new Set(["blank-agent"]);

const PIPELINE_IMAGES = {
  "arch-datamesh-multi-domain": "images/cog1-datamesh-canvas.png",
  "arch-datamesh-domain-product": "images/cog1-datamesh-canvas.png",
  "arch-lambda-batch-speed": "images/cog2-lambda-canvas.png",
  "arch-kappa-stream-only": "assets/portal-overview.png",
  "vaquar-cdc-orders": "assets/portal-overview.png",
  "medallion-full-stack": "assets/portal-canvas-datamesh.png",
  "cognitive-media": "images/portal-agent-builder-canvas.png",
  "genai-rag-documents": "images/portal-ai-agent-generator.png",
};

const AGENT_IMAGES = {
  "customer-support": "images/portal-agent-builder-full.png",
  "rag-doc-qa": "images/portal-ai-agent-generator.png",
  "data-analyst": "images/portal-agent-builder-canvas.png",
  "fraud-detection": "images/portal-agent-builder-full.png",
  "cognimesh-steward": "images/portal-agent-builder-canvas.png",
};

function imgPath(kind, id) {
  const map = kind === "pipeline" ? PIPELINE_IMAGES : AGENT_IMAGES;
  const def = kind === "pipeline" ? "assets/portal-canvas-datamesh.png" : "images/portal-agent-builder-canvas.png";
  return `../../${map[id] || def}`;
}

function mdList(items) {
  if (!items?.length) return "_None listed._\n";
  return `${items.map((i) => `- ${i}`).join("\n")}\n`;
}

function mdChips(items) {
  if (!items?.length) return "_See canvas blocks._\n";
  return `${items.map((s) => `\`${s}\``).join(" · ")}\n`;
}

function suggestPipelinePrompt(p) {
  const hints = {
    datamesh: "Multi-domain data mesh customer 360 with parallel domains",
    kappa: "Kappa stream-only from Kinesis with Glue streaming",
    lambda: "Lambda batch and speed layers merged in Athena serving view",
    lakehouse: "Lakehouse Iceberg medallion with CDC merge",
    medallion: "Full medallion bronze silver gold from RDS CDC",
  };
  const arch = (p.architecture || "").toLowerCase();
  for (const [k, v] of Object.entries(hints)) {
    if (arch.includes(k) || p.name.toLowerCase().includes(k)) return v;
  }
  return `${p.name} - ${p.subtitle || p.category || "data pipeline"}`;
}

function suggestAgentPrompt(t) {
  const map = {
    "customer-support": "Customer support agent with FAQ knowledge base and PII guardrails",
    "rag-doc-qa": "RAG document Q&A over enterprise PDFs with content guardrails",
    "data-analyst": "Data analyst agent with Athena SQL and CogniMesh marketplace tools",
    "fraud-detection": "Fraud investigation agent with human-in-the-loop and strict PII block",
    "code-review": "Code review agent with code interpreter and secrets guardrail",
    "hr-policy": "HR policy assistant with handbook KB and topic restrictions",
    "multi-agent-supervisor": "Multi-agent supervisor routing to browser and code sub-agents",
    "cognimesh-steward": "CogniMesh data steward for access requests and Lake Formation grants",
    "devops-sre": "DevOps SRE agent with runbooks KB, CloudWatch tools, and prod deploy approval",
    "custom-agent-starter": "Custom agent starter - build my own agent with guardrails and gateway tools",
  };
  return map[t.id] || `${t.name} with guardrails and Bedrock tools`;
}

function suggestAgentFeatures(t) {
  const blocks = new Set((t.nodes || []).map((n) => n.data?.blockType));
  const f = [];
  if ([...blocks].some((b) => b === "guardrail")) f.push("Guardrails");
  if (blocks.has("memory_session")) f.push("Session memory");
  if (blocks.has("memory_long")) f.push("Long-term memory");
  if (blocks.has("knowledge_base")) f.push("Knowledge base");
  if ([...blocks].some((b) => ["gateway", "tool_lambda", "tool_mcp"].includes(b))) f.push("Gateway & tools");
  if (blocks.has("code_interpreter")) f.push("Code interpreter");
  if (blocks.has("browser")) f.push("Browser tool");
  if (blocks.has("identity")) f.push("AgentCore Identity");
  if (blocks.has("observability")) f.push("Observability");
  if (blocks.has("human_loop")) f.push("Human-in-the-loop");
  return f.length ? f : ["Guardrails", "Observability"];
}

function pipelineTutorial(p) {
  const img = imgPath("pipeline", p.id);
  const aiPrompt = suggestPipelinePrompt(p);
  return `# ${p.name}

<p align="center">
  <img src="${img}" alt="${p.name} - CogniMesh canvas" width="720" />
  <br /><em>${p.subtitle || p.category || ""}</em>
</p>

[← All tutorials](../README.md) · [Portal UI](../../PORTAL_UI.md)

---

## What you'll create

${p.description}

${p.exampleScenario ? `**Real-world example:** ${p.exampleScenario}` : ""}

| | |
|---|---|
| **Pattern ID** | \`${p.id}\` |
| **Category** | ${p.category || "-"} |
| **Difficulty** | ${p.difficulty || "-"} |
| **Architecture** | ${p.architecture || p.badge || "-"} |

## Why use this pattern

${p.whenToUse || "Use when this architecture matches your latency, governance, and team ownership model."}

## How it works

\`\`\`
${p.exampleFlow || p.architectureDiagram || "Source → Transform → Sink (see canvas)"}
\`\`\`

${p.architectureDiagram && p.exampleFlow ? `**Diagram:**\n\n\`\`\`\n${p.architectureDiagram}\n\`\`\`\n` : ""}

**AWS services:** ${mdChips(p.awsServices)}

---

## Step-by-step in CogniMesh

### 1. Start the portal

\`\`\`bash
npm run start:dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000).

### 2. Load this pattern

**Option A - AI Builder (recommended)**

1. Sidebar → **AI Builder** → **Data pipeline**
2. Paste: _"${aiPrompt}"_
3. Click **Preview pipeline plan** - read _what we'll create_ and _how it works_
4. Click **Load pipeline on canvas**

**Option B - Architectures library**

1. Sidebar → **Architectures**
2. Filter: **${p.category || "All"}**
3. Find **${p.name}** → **Use pattern**

### 3. Customize blocks

Click each block on the canvas and set real values in the properties panel.

### 4. Preview & validate

Click **Preview YAML** (Ctrl+S) - review \`DataContract.yaml\` and Step Functions ASL.

### 5. Deploy

**Deploy** when API is on port 4000 - integrity gate → catalog registration.

---

## Developer workflow

| Layer | What you do |
|-------|-------------|
| **Portal / contract** | Tune block properties; export YAML from preview |
| **\`lib/contract-builder/\`** | Graph → DataContract mapping |
| **\`services/pipeline-engine/\`** | Contract → Step Functions ASL |
| **\`lib/integrity-gate/\`** | PVDM / VRP rules before gold publish |
| **\`infra/terraform/\`** | AWS infrastructure modules |

**API:** \`POST /api/v1/pipelines/preview\` · \`POST /api/v1/pipelines/deploy\`

---

## Tips

${mdList(p.customizeTips)}

## Related

- [Tutorial hub](../README.md)
- [Drag-and-drop E2E](../../drag-drop-pipeline-flow.md)
- [Vaquar Pattern](../../vaquar-pattern.md)
${p.diagramReference ? `- [External reference](${p.diagramReference})` : ""}
`;
}

function agentTutorial(t) {
  const img = imgPath("agent", t.id);
  const aiPrompt = suggestAgentPrompt(t);
  const features = suggestAgentFeatures(t);
  return `# ${t.name}

<p align="center">
  <img src="${img}" alt="${t.name} - Agent Builder canvas" width="720" />
  <br /><em>${t.subtitle || t.category || ""}</em>
</p>

[← All tutorials](../README.md) · [Agent Builder guide](../../AGENT_BUILDER.md)

---

## What you'll create

${t.description}

| | |
|---|---|
| **Template ID** | \`${t.id}\` |
| **Category** | ${t.category || "-"} |
| **Framework** | ${t.framework || "strands"} |
| **Agent name** | \`${t.agentMeta?.name || t.id}\` |

## Why use this agent

${t.whenToUse || "Production AgentCore agent with guardrails and tools pre-wired."}

## How it works

1. User message → **AgentCore Runtime** (session-isolated)
2. **Bedrock model** reasons over context
3. **Knowledge Base** retrieval (if enabled) augments the prompt
4. **Guardrails** filter input/output
5. **Gateway** routes tool calls to Lambda / MCP / REST
6. Response returned with observability traces

**Features:** ${features.join(", ")}

**AWS services:** ${mdChips(t.awsServices)}

---

## Step-by-step in CogniMesh

### 1. Start the portal

\`\`\`bash
npm run start:dev
\`\`\`

### 2. Generate this agent

1. **AI Builder → AI agent** (or **Agent Builder → Templates**)
2. Enable: ${features.join(", ")}
3. Paste: _"${aiPrompt}"_
4. **Preview agent plan** → **Open in Agent Builder**

### 3. Customize · 4. Preview manifest · 5. Export

Edit guardrail IDs, tool names, KB IDs on canvas → **Preview manifest** → **Export manifest** (downloads YAML). AWS Bedrock provisioning is not wired in CogniMesh yet - use the manifest with \`aws bedrock-agent create-agent\` or Terraform.

---

## Developer workflow

| Layer | Path |
|-------|------|
| Manifest export | \`portal/src/lib/agent-export.js\` |
| Validation | \`portal/src/lib/validate-agent-blocks.js\` |
| MCP server | \`services/agent-mcp/\` |
| Cognitive runtime | \`services/cognitive-runtime/\` |

---

## Tips

${mdList(t.customizeTips)}

## Related

- [Tutorial hub](../README.md)
- [Agent Builder guide](../../AGENT_BUILDER.md)
`;
}

function groupBy(items, key) {
  const m = new Map();
  for (const item of items) {
    const k = item[key] || "Other";
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(item);
  }
  return m;
}

function writeIndex(pipelines, agents) {
  const pipelineGroups = groupBy(pipelines, "category");
  const agentGroups = groupBy(agents, "category");

  let md = `# CogniMesh Tutorials

<p align="center">
  <img src="../images/cog1-datamesh-canvas.png" alt="Data Mesh pipeline" width="360" />
  &nbsp;
  <img src="../images/portal-agent-builder-full.png" alt="Agent Builder" width="360" />
</p>

<p align="center"><strong>Real-world guides</strong> - one tutorial per architecture pattern and per AgentCore template.</p>

---

## Quick start

| Goal | Start here |
|------|------------|
| **Data pipeline** | [Pipeline tutorials](#data-pipeline-tutorials) |
| **AI agent** | [Agent tutorials](#agent-tutorials) |
| Local dev | \`npm run start:dev\` → http://localhost:3000 |
| Regenerate pages | \`npm run docs:tutorials\` |

\`\`\`mermaid
flowchart LR
  A[Describe in English] --> B[Preview plan]
  B --> C[Load canvas]
  C --> D[Customize]
  D --> E[Preview YAML]
  E --> F[Deploy]
\`\`\`

---

## Data pipeline tutorials

`;

  for (const [cat, items] of [...pipelineGroups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    md += `### ${cat}\n\n| Tutorial | Level | Summary |\n|----------|-------|--------|\n`;
    for (const p of items.sort((a, b) => a.name.localeCompare(b.name))) {
      const summary = (p.description || "").slice(0, 85).replace(/\|/g, "/") + (p.description?.length > 85 ? "…" : "");
      md += `| [${p.name}](pipelines/${p.id}.md) | ${p.difficulty || "-"} | ${summary} |\n`;
    }
    md += "\n";
  }

  md += `---

## Agent tutorials

`;

  for (const [cat, items] of [...agentGroups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    md += `### ${cat}\n\n| Tutorial | Framework | Summary |\n|----------|-----------|--------|\n`;
    for (const t of items.sort((a, b) => a.name.localeCompare(b.name))) {
      const summary = (t.description || "").slice(0, 85).replace(/\|/g, "/") + (t.description?.length > 85 ? "…" : "");
      md += `| [${t.name}](agents/${t.id}.md) | ${t.framework || "strands"} | ${summary} |\n`;
    }
    md += "\n";
  }

  md += `---

## Screenshots

| Image | Topic |
|-------|-------|
| [cog1-datamesh-canvas.png](../images/cog1-datamesh-canvas.png) | Data Mesh Customer 360 |
| [cog2-lambda-canvas.png](../images/cog2-lambda-canvas.png) | Lambda λ architecture |
| [portal-ai-pipeline-designer.png](../images/portal-ai-pipeline-designer.png) | AI pipeline designer |
| [portal-agent-builder-full.png](../images/portal-agent-builder-full.png) | Agent Builder |

\`npm run docs:screenshots\` · \`npm run docs:tutorials\`

## See also

- [PORTAL_UI.md](../PORTAL_UI.md) · [AGENT_BUILDER.md](../AGENT_BUILDER.md) · [PORTAL_DEV.md](../PORTAL_DEV.md)
`;

  fs.writeFileSync(path.join(TUTORIALS, "README.md"), md, "utf8");
}

function generateTutorialDocs() {
  fs.mkdirSync(PIPELINES_DIR, { recursive: true });
  fs.mkdirSync(AGENTS_DIR, { recursive: true });

  const pipelines = PIPELINE_PATTERNS.filter((p) => !SKIP_PIPELINE.has(p.id));
  const agents = AGENT_TEMPLATES.filter((t) => !SKIP_AGENT.has(t.id));

  for (const p of pipelines) {
    fs.writeFileSync(path.join(PIPELINES_DIR, `${p.id}.md`), pipelineTutorial(p), "utf8");
  }
  for (const t of agents) {
    fs.writeFileSync(path.join(AGENTS_DIR, `${t.id}.md`), agentTutorial(t), "utf8");
  }
  writeIndex(pipelines, agents);
  return { pipelines: pipelines.length, agents: agents.length };
}

describe("generate tutorial docs", () => {
  it("writes pipeline and agent tutorials to docs/tutorials/", () => {
    const { pipelines, agents } = generateTutorialDocs();
    expect(pipelines).toBeGreaterThan(20);
    expect(agents).toBeGreaterThanOrEqual(10);
    expect(fs.existsSync(path.join(TUTORIALS, "README.md"))).toBe(true);
    expect(fs.existsSync(path.join(PIPELINES_DIR, "arch-datamesh-multi-domain.md"))).toBe(true);
    expect(fs.existsSync(path.join(AGENTS_DIR, "customer-support.md"))).toBe(true);
  });
});
