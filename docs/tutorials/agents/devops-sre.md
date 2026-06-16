# DevOps / SRE Agent

<p align="center">
  <img src="../../images/portal-agent-builder-canvas.png" alt="DevOps / SRE Agent - Agent Builder canvas" width="720" />
  <br /><em>Runbooks KB · CI/CD · CloudWatch · prod HITL</em>
</p>

[← All tutorials](../README.md) · [Agent Builder guide](../../AGENT_BUILDER.md)

---

## What you'll create

Site reliability agent with runbook Knowledge Base, Gateway tools for CloudWatch alarms, ECS/EKS status, Terraform plan summaries, and human approval before production changes.

| | |
|---|---|
| **Template ID** | `devops-sre` |
| **Category** | DevOps |
| **Framework** | strands |
| **Agent name** | `devops-sre-agent` |

## Why use this agent

On-call triage, deployment assistance, incident runbooks, infra Q&A - needs guardrails on destructive actions.

## How it works

1. User message → **AgentCore Runtime** (session-isolated)
2. **Bedrock model** reasons over context
3. **Knowledge Base** retrieval (if enabled) augments the prompt
4. **Guardrails** filter input/output
5. **Gateway** routes tool calls to Lambda / MCP / REST
6. Response returned with observability traces

**Features:** Guardrails, Session memory, Knowledge base, Gateway & tools, Observability, Human-in-the-loop

**AWS services:** `AgentCore Runtime` · `Bedrock` · `Knowledge Base` · `Lambda` · `CloudWatch` · `Guardrails` · `Step Functions`


---

## Step-by-step in CogniMesh

### 1. Start the portal

```bash
npm run start:dev
```

### 2. Generate this agent

1. **AI Builder → AI agent** (or **Agent Builder → Templates**)
2. Enable: Guardrails, Session memory, Knowledge base, Gateway & tools, Observability, Human-in-the-loop
3. Paste: _"DevOps SRE agent with runbooks KB, CloudWatch tools, and prod deploy approval"_
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

- Load runbooks KB from S3 (Confluence export, markdown on-call docs).
- Wire deploy Lambda to CodePipeline / GitHub Actions trigger with approval token.
- Human-in-the-loop required before production deploy tool fires.
- Denied topics block destructive CLI suggestions in guardrail.


## Related

- [Tutorial hub](../README.md)
- [Agent Builder guide](../../AGENT_BUILDER.md)
