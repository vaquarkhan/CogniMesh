# Code Review Agent

<p align="center">
  <img src="../../images/portal-agent-builder-canvas.png" alt="Code Review Agent - Agent Builder canvas" width="720" />
  <br /><em>Code Interpreter · security guardrails</em>
</p>

[← All tutorials](../README.md) · [Agent Builder guide](../../AGENT_BUILDER.md)

---

## What you'll create

Reviews pull requests using Code Interpreter for static analysis snippets and guardrails blocking secrets exfiltration.

| | |
|---|---|
| **Template ID** | `code-review` |
| **Category** | Developer |
| **Framework** | openai-agents |
| **Agent name** | `code-review-agent` |

## Why use this agent

PR review automation, security linting, dependency checks.

## How it works

1. User message → **AgentCore Runtime** (session-isolated)
2. **Bedrock model** reasons over context
3. **Knowledge Base** retrieval (if enabled) augments the prompt
4. **Guardrails** filter input/output
5. **Gateway** routes tool calls to Lambda / MCP / REST
6. Response returned with observability traces

**Features:** Guardrails, Code interpreter

**AWS services:** `AgentCore Runtime` · `Code Interpreter` · `Guardrails`


---

## Step-by-step in CogniMesh

### 1. Start the portal

```bash
npm run start:dev
```

### 2. Generate this agent

1. **AI Builder → AI agent** (or **Agent Builder → Templates**)
2. Enable: Guardrails, Code interpreter
3. Paste: _"Code review agent with code interpreter and secrets guardrail"_
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

- Sandbox Code Interpreter - no network egress.
- Deny topics include credential patterns.
- Connect GitHub via Gateway OAuth.


## Related

- [Tutorial hub](../README.md)
- [Agent Builder guide](../../AGENT_BUILDER.md)
