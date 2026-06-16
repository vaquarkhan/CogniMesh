# Customer Support Agent

<p align="center">
  <img src="../../images/portal-agent-builder-full.png" alt="Customer Support Agent - Agent Builder canvas" width="720" />
  <br /><em>AgentCore Runtime · KB · PII guardrail</em>
</p>

[← All tutorials](../README.md) · [Agent Builder guide](../../AGENT_BUILDER.md)

---

## What you'll create

Production support agent with Bedrock Knowledge Base for FAQs, Lambda order lookup, and strict PII guardrails on inputs/outputs.

| | |
|---|---|
| **Template ID** | `customer-support` |
| **Category** | Customer Experience |
| **Framework** | strands |
| **Agent name** | `customer-support-agent` |

## Why use this agent

Tier-1 support, order status, returns - needs session isolation and PII filtering.

## How it works

1. User message → **AgentCore Runtime** (session-isolated)
2. **Bedrock model** reasons over context
3. **Knowledge Base** retrieval (if enabled) augments the prompt
4. **Guardrails** filter input/output
5. **Gateway** routes tool calls to Lambda / MCP / REST
6. Response returned with observability traces

**Features:** Guardrails, Session memory, Knowledge base, Gateway & tools

**AWS services:** `AgentCore Runtime` · `Bedrock` · `Knowledge Base` · `Lambda` · `Guardrails`


---

## Step-by-step in CogniMesh

### 1. Start the portal

```bash
npm run start:dev
```

### 2. Generate this agent

1. **AI Builder → AI agent** (or **Agent Builder → Templates**)
2. Enable: Guardrails, Session memory, Knowledge base, Gateway & tools
3. Paste: _"Customer support agent with FAQ knowledge base and PII guardrails"_
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

- Point Knowledge Base to your S3 FAQ corpus and sync with Bedrock.
- Wire Lambda to your order API - Gateway handles auth per user session.
- Keep PII guardrail on ANONYMIZE for support transcripts stored in logs.


## Related

- [Tutorial hub](../README.md)
- [Agent Builder guide](../../AGENT_BUILDER.md)
