# Custom Agent Starter

<p align="center">
  <img src="../../images/portal-agent-builder-canvas.png" alt="Custom Agent Starter - Agent Builder canvas" width="720" />
  <br /><em>Model + guardrails + gateway - you wire tools</em>
</p>

[← All tutorials](../README.md) · [Agent Builder guide](../../AGENT_BUILDER.md)

---

## What you'll create

Blueprint for a custom AgentCore agent: Runtime, Bedrock model, content guardrail, Gateway shell, and observability - add your own Lambda, MCP, KB, or browser tools on the canvas.

| | |
|---|---|
| **Template ID** | `custom-agent-starter` |
| **Category** | Developer |
| **Framework** | strands |
| **Agent name** | `my-custom-agent` |

## Why use this agent

Starting a bespoke agent when no template fits; faster than blank canvas with safe defaults.

## How it works

1. User message → **AgentCore Runtime** (session-isolated)
2. **Bedrock model** reasons over context
3. **Knowledge Base** retrieval (if enabled) augments the prompt
4. **Guardrails** filter input/output
5. **Gateway** routes tool calls to Lambda / MCP / REST
6. Response returned with observability traces

**Features:** Guardrails, Session memory, Gateway & tools, Observability

**AWS services:** `AgentCore Runtime` · `Bedrock` · `Gateway` · `Guardrails` · `CloudWatch`


---

## Step-by-step in CogniMesh

### 1. Start the portal

```bash
npm run start:dev
```

### 2. Generate this agent

1. **AI Builder → AI agent** (or **Agent Builder → Templates**)
2. Enable: Guardrails, Session memory, Gateway & tools, Observability
3. Paste: _"Custom agent starter - build my own agent with guardrails and gateway tools"_
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

- Rename agent in properties: name, domain, description.
- Drag MCP, KB, browser, or code interpreter blocks from the Blocks tab.
- Connect new tools to Gateway; connect guardrails and memory to Runtime.
- Use feature checkboxes when loading to strip blocks you do not need.
- See docs/developer/CUSTOMIZE_AGENTS.md for step-by-step customization.


## Related

- [Tutorial hub](../README.md)
- [Agent Builder guide](../../AGENT_BUILDER.md)
