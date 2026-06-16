import { AGENT_FRAMEWORKS, GUARDRAIL_PII_ACTIONS } from "../lib/agent-blocks";
import { BEDROCK_MIN_INSTRUCTION_LENGTH, validateAgentInstruction } from "../lib/agent-instruction";

function Field({ label, tip, children }) {
  return (
    <label className="field">
      <span className="field-label-row"><span>{label}</span></span>
      {children}
      {tip && <p className="field-tip">{tip}</p>}
    </label>
  );
}

export default function AgentPropertiesPanel({ node, onChange, agentMeta, onMetaChange, validation }) {
  if (!node) {
    return (
      <aside className="properties agent-properties">
        <h2>Agent settings</h2>
        <p className="properties-intro">
          Settings for the whole agent. Click a block on the canvas to edit Runtime, Guardrails, Tools, or Model.
        </p>
        <Field label="Agent name" tip="AgentCore runtime name - used in deployment manifest">
          <input
            value={agentMeta.name}
            onChange={(e) => onMetaChange({ ...agentMeta, name: e.target.value })}
            placeholder="customer-support-agent"
          />
        </Field>
        <Field label="Domain" tip="Logical domain for governance and mesh tagging">
          <input
            value={agentMeta.domain}
            onChange={(e) => onMetaChange({ ...agentMeta, domain: e.target.value })}
            placeholder="support"
          />
        </Field>
        <Field label="Version">
          <input
            value={agentMeta.version}
            onChange={(e) => onMetaChange({ ...agentMeta, version: e.target.value })}
            placeholder="1.0.0"
          />
        </Field>
        <Field label="Description" tip={`Bedrock CreateAgent requires at least ${BEDROCK_MIN_INSTRUCTION_LENGTH} characters`}>
          <textarea
            rows={3}
            minLength={BEDROCK_MIN_INSTRUCTION_LENGTH}
            value={agentMeta.description || ""}
            onChange={(e) => onMetaChange({ ...agentMeta, description: e.target.value })}
            placeholder="What this agent does…"
            data-testid="agent-description"
          />
          {(() => {
            const v = validateAgentInstruction(agentMeta.description);
            if (v.valid) return null;
            return <p className="agent-warning">{v.message}</p>;
          })()}
        </Field>

        {validation && (
          <div className="agent-validation-summary">
            <h3>Graph summary</h3>
            <ul className="properties-hint">
              <li>Runtimes: {validation.summary?.runtimeCount ?? 0}</li>
              <li>Models: {validation.summary?.modelCount ?? 0}</li>
              <li>Guardrails: {validation.summary?.guardrailCount ?? 0}</li>
              <li>Tools: {validation.summary?.toolCount ?? 0}</li>
            </ul>
            {validation.warnings?.map((w, i) => (
              <p key={i} className="agent-warning">{w}</p>
            ))}
          </div>
        )}
      </aside>
    );
  }

  const d = node.data;
  const update = (patch) => onChange(node.id, patch);

  return (
    <aside className="properties agent-properties">
      <h2>{d.label}</h2>
      <p className="properties-intro">Block type: <strong>{d.blockType}</strong></p>

      <Field label="Label">
        <input value={d.label || ""} onChange={(e) => update({ label: e.target.value })} />
      </Field>

      {d.blockType === "runtime" && (
        <>
          <Field label="Framework" tip="AgentCore supports Strands, LangChain, CrewAI, OpenAI Agents SDK">
            <select value={d.framework || "strands"} onChange={(e) => update({ framework: e.target.value })}>
              {AGENT_FRAMEWORKS.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Session isolation" tip="Firecracker microVM per session - required for sensitive data">
            <select
              value={d.sessionIsolation !== false ? "true" : "false"}
              onChange={(e) => update({ sessionIsolation: e.target.value === "true" })}
            >
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </Field>
          <Field label="Max duration (hours)" tip="AgentCore supports up to 8 hours">
            <input
              type="number"
              min={1}
              max={8}
              value={d.maxDurationHours || 8}
              onChange={(e) => update({ maxDurationHours: Number(e.target.value) })}
            />
          </Field>
        </>
      )}

      {d.blockType === "supervisor" && (
        <>
          <Field label="Sub-agent count">
            <input type="number" min={2} max={10} value={d.subAgentCount || 2} onChange={(e) => update({ subAgentCount: Number(e.target.value) })} />
          </Field>
          <Field label="Routing strategy">
            <select value={d.routingStrategy || "capability"} onChange={(e) => update({ routingStrategy: e.target.value })}>
              <option value="capability">By capability</option>
              <option value="round_robin">Round robin</option>
              <option value="load">Load balanced</option>
            </select>
          </Field>
        </>
      )}

      {d.blockType === "foundation_model" && (
        <>
          <Field label="Model ID" tip="Bedrock foundation model ID">
            <input value={d.modelId || ""} onChange={(e) => update({ modelId: e.target.value })} />
          </Field>
          <Field label="Temperature">
            <input type="number" step={0.1} min={0} max={1} value={d.temperature ?? 0.3} onChange={(e) => update({ temperature: Number(e.target.value) })} />
          </Field>
          <Field label="Max tokens">
            <input type="number" min={256} max={8192} value={d.maxTokens || 4096} onChange={(e) => update({ maxTokens: Number(e.target.value) })} />
          </Field>
        </>
      )}

      {d.blockType === "guardrail" && (
        <>
          <Field label="Guardrail ID" tip="Bedrock Guardrail resource ID - set as BEDROCK_GUARDRAIL_ID on deploy">
            <input value={d.guardrailId || ""} onChange={(e) => update({ guardrailId: e.target.value })} />
          </Field>
          <Field label="Version">
            <input value={d.version || "1"} onChange={(e) => update({ version: e.target.value })} />
          </Field>
          <Field label="PII action">
            <select value={d.piiAction || "BLOCK"} onChange={(e) => update({ piiAction: e.target.value })}>
              {GUARDRAIL_PII_ACTIONS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </Field>
          <Field label="Denied topics" tip="Comma-separated topics the agent must not discuss">
            <input
              value={(d.deniedTopics || []).join(", ")}
              onChange={(e) => update({ deniedTopics: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            />
          </Field>
        </>
      )}

      {d.blockType === "knowledge_base" && (
        <>
          <Field label="Knowledge Base ID">
            <input value={d.kbId || ""} onChange={(e) => update({ kbId: e.target.value })} />
          </Field>
          <Field label="Retrieval mode">
            <select value={d.retrievalMode || "hybrid"} onChange={(e) => update({ retrievalMode: e.target.value })}>
              <option value="hybrid">Hybrid</option>
              <option value="semantic">Semantic</option>
              <option value="keyword">Keyword</option>
            </select>
          </Field>
        </>
      )}

      {d.blockType === "tool_lambda" && (
        <>
          <Field label="Lambda function">
            <input value={d.functionName || ""} onChange={(e) => update({ functionName: e.target.value })} />
          </Field>
          <Field label="Description">
            <input value={d.description || ""} onChange={(e) => update({ description: e.target.value })} />
          </Field>
        </>
      )}

      {d.blockType === "tool_mcp" && (
        <>
          <Field label="MCP server URL">
            <input value={d.serverUrl || ""} onChange={(e) => update({ serverUrl: e.target.value })} />
          </Field>
          <Field label="Tools" tip="Comma-separated tool names">
            <input
              value={(d.tools || []).join(", ")}
              onChange={(e) => update({ tools: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            />
          </Field>
        </>
      )}

      {d.blockType === "tool_api" && (
        <>
          <Field label="OpenAPI spec URL">
            <input value={d.openApiSpec || ""} onChange={(e) => update({ openApiSpec: e.target.value })} />
          </Field>
          <Field label="Auth type">
            <select value={d.authType || "oauth2"} onChange={(e) => update({ authType: e.target.value })}>
              <option value="oauth2">OAuth 2</option>
              <option value="api_key">API key</option>
              <option value="iam">IAM</option>
            </select>
          </Field>
        </>
      )}

      {d.blockType === "gateway" && (
        <>
          <Field label="Auth mode" tip="Dual auth for inbound requests and outbound tool calls">
            <select value={d.authMode || "dual"} onChange={(e) => update({ authMode: e.target.value })}>
              <option value="dual">Dual (inbound + outbound)</option>
              <option value="inbound">Inbound only</option>
            </select>
          </Field>
        </>
      )}

      {d.blockType === "memory_session" && (
        <Field label="TTL (minutes)">
          <input type="number" min={5} max={480} value={d.ttlMinutes || 60} onChange={(e) => update({ ttlMinutes: Number(e.target.value) })} />
        </Field>
      )}

      {d.blockType === "memory_long" && (
        <>
          <Field label="Retention (days)">
            <input type="number" min={1} max={365} value={d.retentionDays || 90} onChange={(e) => update({ retentionDays: Number(e.target.value) })} />
          </Field>
          <Field label="Extraction mode">
            <select value={d.extractionMode || "semantic"} onChange={(e) => update({ extractionMode: e.target.value })}>
              <option value="semantic">Semantic</option>
              <option value="summary">Summary</option>
            </select>
          </Field>
        </>
      )}

      {d.blockType === "human_loop" && (
        <>
          <Field label="Approval threshold">
            <select value={d.approvalThreshold || "high_risk"} onChange={(e) => update({ approvalThreshold: e.target.value })}>
              <option value="high_risk">High risk actions</option>
              <option value="access_grant">Access grants</option>
              <option value="all">All tool calls</option>
            </select>
          </Field>
          <Field label="Timeout (minutes)">
            <input type="number" min={5} max={120} value={d.timeoutMinutes || 30} onChange={(e) => update({ timeoutMinutes: Number(e.target.value) })} />
          </Field>
        </>
      )}

      {d.validationError && (
        <p className="login-error">{d.validationError}</p>
      )}
    </aside>
  );
}
