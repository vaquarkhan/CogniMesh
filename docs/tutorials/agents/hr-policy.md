# HR Policy Assistant

<p align="center">
  <img src="../../images/portal-agent-builder-canvas.png" alt="HR Policy Assistant - Agent Builder canvas" width="720" />
  <br /><em>KB · topic restrictions · identity</em>
</p>

[← All tutorials](../README.md) · [Agent Builder guide](../../AGENT_BUILDER.md)

---

## What you'll create

HR policy Q&A with employee-scoped identity, handbook KB, and strict topic guardrails for legal/compensation advice.

| | |
|---|---|
| **Template ID** | `hr-policy` |
| **Category** | Enterprise |
| **Framework** | langchain |
| **Agent name** | `hr-policy-assistant` |

## Why use this agent

Employee self-service on benefits, PTO, policies - must not give legal advice.

## How it works

1. User message → **AgentCore Runtime** (session-isolated)
2. **Bedrock model** reasons over context
3. **Knowledge Base** retrieval (if enabled) augments the prompt
4. **Guardrails** filter input/output
5. **Gateway** routes tool calls to Lambda / MCP / REST
6. Response returned with observability traces

**Features:** Guardrails, Knowledge base, AgentCore Identity

**AWS services:** `AgentCore Runtime` · `KB` · `Identity` · `Guardrails`


---

## Step-by-step in CogniMesh

### 1. Start the portal

```bash
npm run start:dev
```

### 2. Generate this agent

1. **AI Builder → AI agent** (or **Agent Builder → Templates**)
2. Enable: Guardrails, Knowledge base, AgentCore Identity
3. Paste: _"HR policy assistant with handbook KB and topic restrictions"_
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

- Scope KB to public handbook only - not personnel files.
- Identity maps to department for localized policies.


## Related

- [Tutorial hub](../README.md)
- [Agent Builder guide](../../AGENT_BUILDER.md)
