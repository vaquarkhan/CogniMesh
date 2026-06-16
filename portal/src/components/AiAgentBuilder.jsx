import { useCallback, useEffect, useState } from "react";
import { designAgentFromMessage } from "../lib/ai-agent-designer";
import { getAgentTemplateById, instantiateAgentTemplate } from "../lib/agent-templates";
import { defaultAgentFeatures, inferAgentFeaturesFromMessage } from "../lib/agent-feature-options";
import { buildAgentCreationPlan } from "../lib/design-explanations";
import AgentFeatureOptions from "./AgentFeatureOptions";
import DesignPlanPreview from "./DesignPlanPreview";

const EXAMPLE_PROMPTS = [
  "Customer support agent with FAQ knowledge base and PII guardrails",
  "RAG document Q&A over enterprise PDFs with content guardrails",
  "Data analyst agent with Athena SQL and CogniMesh marketplace tools",
  "Fraud investigation agent with human-in-the-loop and strict PII block",
  "Code review agent with code interpreter and secrets guardrail",
  "HR policy assistant with handbook KB and topic restrictions",
  "Multi-agent supervisor routing to browser and code sub-agents",
  "CogniMesh data steward for access requests and Lake Formation grants",
  "DevOps SRE agent with runbooks KB, CloudWatch tools, and prod deploy approval",
  "Custom agent starter - build my own agent with guardrails and gateway tools",
];

export default function AiAgentBuilder({ onLaunchAgent }) {
  const [message, setMessage] = useState("");
  const [features, setFeatures] = useState(() => defaultAgentFeatures());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pendingPlan, setPendingPlan] = useState(null);
  const [pendingTemplate, setPendingTemplate] = useState(null);
  const [livePlan, setLivePlan] = useState(null);

  const applyInferredFeatures = (text) => {
    setFeatures(inferAgentFeaturesFromMessage(text));
  };

  const resolvePlan = useCallback(
    (msg, featureSet) => {
      const result = designAgentFromMessage(msg);
      if (!result.success) {
        return { error: result.errors?.[0] || "Could not interpret request" };
      }
      const template = getAgentTemplateById(result.templateId);
      if (!template) {
        return { error: `Agent template "${result.templateId}" not found.` };
      }
      return {
        plan: buildAgentCreationPlan(template, featureSet),
        template,
        result,
      };
    },
    []
  );

  useEffect(() => {
    const msg = message.trim();
    if (msg.length < 12) {
      setLivePlan(null);
      return;
    }
    const t = window.setTimeout(() => {
      const resolved = resolvePlan(msg, features);
      setLivePlan(resolved.plan || null);
    }, 450);
    return () => window.clearTimeout(t);
  }, [message, features, resolvePlan]);

  const preview = (text) => {
    const msg = (text || message).trim();
    if (!msg) return;
    setLoading(true);
    setError(null);
    setPendingPlan(null);
    setPendingTemplate(null);

    try {
      const resolved = resolvePlan(msg, features);
      if (resolved.error) {
        setError(resolved.error);
        return;
      }
      setPendingPlan(resolved.plan);
      setPendingTemplate(resolved.template);
    } catch (err) {
      setError(err.message || "Agent designer failed");
    } finally {
      setLoading(false);
    }
  };

  const confirmLaunch = () => {
    if (!pendingTemplate) return;
    const instance = instantiateAgentTemplate(pendingTemplate, features);
    onLaunchAgent(instance, pendingTemplate.name);
    setPendingPlan(null);
    setPendingTemplate(null);
  };

  const onExampleClick = (prompt) => {
    setMessage(prompt);
    applyInferredFeatures(prompt);
    preview(prompt);
  };

  return (
    <div className="ai-builder ai-agent-builder">
      <h2>AI Agent Generator</h2>
      <p className="ai-builder-intro">
        Describe your Bedrock <strong>AgentCore</strong> agent. We&apos;ll explain what will be built and how it works before opening the canvas.
      </p>

      <AgentFeatureOptions features={features} onChange={setFeatures} compact />

      <textarea
        className="ai-builder-input"
        rows={4}
        value={message}
        onChange={(e) => {
          setMessage(e.target.value);
          if (e.target.value.trim().length > 12) {
            applyInferredFeatures(e.target.value);
          }
          if (pendingPlan) {
            setPendingPlan(null);
            setPendingTemplate(null);
          }
        }}
        placeholder="Example: Build a customer support agent with Bedrock KB, Lambda order lookup, and PII guardrails..."
      />

      {livePlan && !pendingPlan && message.trim().length >= 12 && (
        <div className="design-plan-live-hint">
          <p className="properties-hint">
            <strong>Preview:</strong> {livePlan.title} - {livePlan.whatWeCreate.slice(0, 120)}
            {livePlan.whatWeCreate.length > 120 ? "…" : ""}
          </p>
        </div>
      )}

      <button type="button" className="deploy-btn agent-deploy-btn ai-builder-submit" disabled={loading} onClick={() => preview()}>
        {loading ? "Analyzing…" : "🤖 Preview agent plan"}
      </button>

      {error && <p className="login-error">{error}</p>}

      {pendingPlan && (
        <DesignPlanPreview
          plan={pendingPlan}
          confirmLabel="Open in Agent Builder"
          loading={loading}
          onConfirm={confirmLaunch}
          onDismiss={() => {
            setPendingPlan(null);
            setPendingTemplate(null);
          }}
        />
      )}

      <div className="ai-builder-examples">
        <p className="properties-hint"><strong>Try an example:</strong></p>
        {EXAMPLE_PROMPTS.map((p) => (
          <button key={p} type="button" className="ai-example-chip" onClick={() => onExampleClick(p)}>
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
