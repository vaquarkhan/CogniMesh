# Data Analyst Agent

<p align="center">
  <img src="../../images/portal-agent-builder-canvas.png" alt="Data Analyst Agent - Agent Builder canvas" width="720" />
  <br /><em>Athena · Glue · mesh catalog tools</em>
</p>

[← All tutorials](../README.md) · [Agent Builder guide](../../AGENT_BUILDER.md)

---

## What you'll create

Natural-language data analyst with Gateway tools for Athena SQL, Glue catalog, and CogniMesh marketplace products.

| | |
|---|---|
| **Template ID** | `data-analyst` |
| **Category** | Data & Analytics |
| **Framework** | strands |
| **Agent name** | `data-analyst-agent` |

## Why use this agent

Self-serve analytics on mesh data products with governed tool access.

## How it works

1. User message → **AgentCore Runtime** (session-isolated)
2. **Bedrock model** reasons over context
3. **Knowledge Base** retrieval (if enabled) augments the prompt
4. **Guardrails** filter input/output
5. **Gateway** routes tool calls to Lambda / MCP / REST
6. Response returned with observability traces

**Features:** Guardrails, Gateway & tools, AgentCore Identity

**AWS services:** `AgentCore Runtime` · `Gateway` · `Athena` · `Glue` · `Guardrails`


---

## Step-by-step in CogniMesh

### 1. Start the portal

```bash
npm run start:dev
```

### 2. Generate this agent

1. **AI Builder → AI agent** (or **Agent Builder → Templates**)
2. Enable: Guardrails, Gateway & tools, AgentCore Identity
3. Paste: _"Data analyst agent with Athena SQL and CogniMesh marketplace tools"_
4. **Preview agent plan** → **Open in Agent Builder**

### 3. Customize · 4. Preview manifest · 5. Export

Edit guardrail IDs, tool names, KB IDs on canvas → **Preview manifest** → **Export manifest** (downloads YAML). AWS Bedrock provisioning is not wired in CogniMesh yet - use the manifest with `aws bedrock-agent create-agent` or Terraform.

---

## Developer workflow

| Layer | Path |
|-------|------|
| Manifest export | `portal/src/lib/agent-export.js` |
| Validation | `portal/src/lib/validate-agent-blocks.js` |
| MCP server | `services/agent-mcp/` |
| Cognitive runtime | `services/cognitive-runtime/` |

---

## Tips

- Bind Identity to Lake Formation tags for row-level access.
- Add denied SQL topics in guardrail for destructive statements.
- MCP connects to CogniMesh marketplace for product discovery.


## Related

- [Tutorial hub](../README.md)
- [Agent Builder guide](../../AGENT_BUILDER.md)
