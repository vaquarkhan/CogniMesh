# Agent Builder tutorial

Build Amazon Bedrock **AgentCore** agents in CogniMesh with drag-and-drop blocks, feature checkboxes, and manifest export.

## Where to create an agent

| Entry point | Location |
|-------------|----------|
| **AI Agent Generator** | Sidebar → **AI Builder** → **AI agent** tab |
| **Templates** | Header → **Agent Builder** → sidebar **Templates** |
| **Blank canvas** | Agent Builder → Templates → **Start blank agent** |

## Step 1 - Choose agent features (checkboxes)

Before you generate or load a template, use the **Agent features** panel to include only what you need:

| Checkbox | What it adds |
|----------|----------------|
| **Guardrails** | Content filters, denied topics, PII block/anonymize |
| **Session memory** | Short-term context (TTL, max turns) |
| **Long-term memory** | Semantic memory across sessions |
| **Knowledge base** | Bedrock KB for RAG over documents |
| **Gateway & tools** | AgentCore Gateway, Lambda, MCP, REST |
| **Code interpreter** | Sandboxed Python execution |
| **Browser tool** | Headless web browsing |
| **AgentCore Identity** | Cognito / IAM scoped tool access |
| **Observability** | CloudWatch traces and X-Ray |
| **Human-in-the-loop** | Approval queue for high-risk actions |

Unchecked features are **removed** from the template graph. Enabled features **missing** from a template (e.g. session memory on a blank agent) are **added automatically** and wired to Runtime.

### Auto-suggest from natural language

In **AI agent** mode, typing or clicking an example prompt updates checkboxes:

- “PII guardrails” → Guardrails on  
- “human-in-the-loop” → HITL on  
- “knowledge base” / “RAG” → Knowledge base on  
- “Athena” / “Lambda” / “MCP” → Gateway & tools on  
- “code interpreter” → Code interpreter on  

## Step 2 - Preview the plan (natural language)

Click **Preview agent plan** (or **Preview pipeline plan** for data pipelines). CogniMesh explains:

1. **What we'll create** - template/pattern name, description, and your selected features  
2. **How it works** - step-by-step narrative (Runtime → KB → model → guardrails → tools → response)  
3. **Flow** - end-to-end path and AWS services involved  

A live one-line preview appears as you type. Click **Open in Agent Builder** or **Load pipeline on canvas** to confirm.

## Step 3 - Pick or generate a template

**AI agent tab:** describe the agent in English → **Preview agent plan** → review explanation → **Open in Agent Builder**.

**Templates tab:** expand a card (Customer Support, RAG Document Q&A, Data Analyst, Fraud Investigation, etc.) → **Use template**.

Feature selections apply to both flows via `instantiateAgentTemplate(template, features)`.

## Step 4 - Customize on the canvas

| Block category | Examples |
|----------------|----------|
| AgentCore Runtime | Orchestrator, session isolation, Strands/LangChain framework |
| Foundation model | Claude Sonnet, Amazon Nova |
| Knowledge & memory | Bedrock KB, session/long-term memory |
| Tools & Gateway | Lambda, MCP, OpenAPI, Code Interpreter, Browser |
| Guardrails & identity | Content + PII guardrails, AgentCore Identity |
| Observability | Traces, HITL approval |

Wire edges: **Runtime** ← model, guardrails, KB, memory; **Gateway** ← tools.

## Step 5 - Preview manifest

Open **Preview** in the Agent Builder panel. The YAML includes:

- `spec.guardrails[]` with `BEDROCK_GUARDRAIL_ID` env vars  
- `spec.memory` when session/long-term memory blocks are present  
- `spec.tools` for Gateway-connected Lambda/MCP actions  

Selected features are stored in `agentMeta.features` on the canvas instance.

## Step 6 - Validate and export

Validation warns when guardrails are missing (production best practice). **Export manifest** downloads AgentCore YAML - the canvas is a **design tool**, not a live AWS provisioner.

## Design tool vs AWS deploy

| Capability | Data pipeline designer | Agent Builder |
|------------|------------------------|---------------|
| Canvas → artifact | DataContract YAML + Step Functions ASL | AgentCore manifest YAML |
| CogniMesh **Deploy** button | **Wired** - integrity gate → catalog → optional Step Functions (`AWS_DEPLOY_ENABLED`) | **Not wired** - export manifest only |
| AWS APIs called | Step Functions create/update (when enabled) | None (by design today) |
| Natural next step | Run pipeline in AWS | `aws bedrock-agent create-agent`, Terraform module, or future agent-deploy API |

Agent Builder is **working correctly** as a design + manifest generator. Zero bugs in that scope. One-click deploy to real Bedrock agents requires separate integration:

- Bedrock agent IAM execution role
- Knowledge base creation (OpenSearch Serverless / AOSS)
- Lambda action group registration
- Guardrail creation in Bedrock
- Agent alias and runtime association

The exported manifest is **ready** for those tools - see `portal/src/lib/agent-export.js` and the cognitive runtime in `services/cognitive-runtime/`.

**Pipeline deploy** (for comparison): `portal/src/App.jsx` → `deployPipeline()` → `lib/contract-builder/index.js` → `lib/aws/stepfunctions-deploy.js`.

## Developer reference

| File | Role |
|------|------|
| `portal/src/lib/design-explanations.js` | Natural-language “what we’ll create” and “how it works” plans |
| `portal/src/components/DesignPlanPreview.jsx` | Plan preview UI before loading canvas |
| `portal/src/components/AgentFeatureOptions.jsx` | Checkbox UI (shared by AI generator + template library) |
| `portal/src/lib/agent-templates.js` | Templates + `instantiateAgentTemplate(template, features)` |
| `portal/src/lib/agent-blocks.js` | Drag palette block defaults |
| `portal/src/lib/agent-export.js` | Manifest YAML generation |
| `portal/src/lib/validate-agent-blocks.js` | Pre-deploy graph validation |

## Related docs

- **[Developer customization hub](developer/README.md)** - 21 UI screenshots · customize & extend
- **[Tutorial hub](tutorials/README.md)** - one guide per agent template & pipeline pattern
- [Portal UI - Agent Builder](PORTAL_UI.md#agent-builder)
- [Portal development guide](PORTAL_DEV.md)
- [Drag-and-drop pipeline flow](drag-drop-pipeline-flow.md)
