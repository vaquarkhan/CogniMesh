# RAG Document Q&A

<p align="center">
  <img src="../../images/portal-ai-agent-generator.png" alt="RAG Document Q&A - Agent Builder canvas" width="720" />
  <br /><em>KB retrieval · content guardrails</em>
</p>

[← All tutorials](../README.md) · [Agent Builder guide](../../AGENT_BUILDER.md)

---

## What you'll create

Document Q&A agent using Bedrock Knowledge Base with hybrid retrieval and content/topic guardrails.

| | |
|---|---|
| **Template ID** | `rag-doc-qa` |
| **Category** | Enterprise |
| **Framework** | langchain |
| **Agent name** | `rag-doc-qa` |

## Why use this agent

Internal docs, policies, runbooks - answers must cite sources and block harmful content.

## How it works

1. User message → **AgentCore Runtime** (session-isolated)
2. **Bedrock model** reasons over context
3. **Knowledge Base** retrieval (if enabled) augments the prompt
4. **Guardrails** filter input/output
5. **Gateway** routes tool calls to Lambda / MCP / REST
6. Response returned with observability traces

**Features:** Guardrails, Knowledge base, Observability

**AWS services:** `AgentCore Runtime` · `Bedrock KB` · `Guardrails` · `OpenSearch`


---

## Step-by-step in CogniMesh

### 1. Start the portal

```bash
npm run start:dev
```

### 2. Generate this agent

1. **AI Builder → AI agent** (or **Agent Builder → Templates**)
2. Enable: Guardrails, Knowledge base, Observability
3. Paste: _"RAG document Q&A over enterprise PDFs with content guardrails"_
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

- Enable citation in system prompt.
- Use hybrid retrieval for technical PDFs.
- Tune denied topics for your compliance domain.


## Related

- [Tutorial hub](../README.md)
- [Agent Builder guide](../../AGENT_BUILDER.md)
