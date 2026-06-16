import { useCallback, useEffect, useState } from "react";
import { designPipelineFromMessage } from "../lib/ai-pipeline-designer";
import { getPatternById, instantiatePattern } from "../lib/pipeline-patterns";
import { buildPipelineCreationPlan } from "../lib/design-explanations";
import DesignPlanPreview from "./DesignPlanPreview";

const EXAMPLE_PROMPTS = [
  "Data mesh domain product with Lake Formation and Iceberg gold",
  "Kappa architecture stream-only from Kinesis with Glue streaming",
  "Lambda batch + speed layers merged in Athena serving view",
  "Glue ETL factory: DMS extract, enrichment, dedupe, aggregate chain",
  "MSK Kafka streaming to Iceberg lakehouse with CDC merge",
  "Data lake raw and curated zones with Glue crawler and Athena",
  "Multi-domain data mesh customer 360 with parallel domains",
  "Kinesis Firehose clickstream to enriched Iceberg gold",
];

function runLocalDesign(message) {
  try {
    return designPipelineFromMessage(message);
  } catch (err) {
    console.warn("AI pipeline designer error:", err);
    return {
      success: false,
      errors: ["Could not interpret your request. Try one of the example prompts below."],
    };
  }
}

export default function AiPipelineBuilder({ onApplyPattern }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pendingPlan, setPendingPlan] = useState(null);
  const [pendingPatternId, setPendingPatternId] = useState(null);
  const [livePlan, setLivePlan] = useState(null);

  const resolvePlan = useCallback((msg) => {
    const result = runLocalDesign(msg);
    if (!result?.success) return { error: result?.errors?.[0] || "Could not interpret request" };
    const pattern = getPatternById(result.patternId);
    if (!pattern) return { error: `Pattern "${result.patternId}" is not registered.` };
    return { plan: buildPipelineCreationPlan(pattern), patternId: result.patternId, pattern };
  }, []);

  useEffect(() => {
    const msg = message.trim();
    if (msg.length < 12) {
      setLivePlan(null);
      return;
    }
    const t = window.setTimeout(() => {
      const resolved = resolvePlan(msg);
      setLivePlan(resolved.plan || null);
    }, 450);
    return () => window.clearTimeout(t);
  }, [message, resolvePlan]);

  const preview = (text) => {
    const msg = (text || message).trim();
    if (!msg) return;
    setLoading(true);
    setError(null);
    setPendingPlan(null);
    setPendingPatternId(null);

    window.setTimeout(() => {
      const resolved = resolvePlan(msg);
      if (resolved.error) {
        setError(resolved.error);
        setLoading(false);
        return;
      }
      setPendingPlan(resolved.plan);
      setPendingPatternId(resolved.patternId);
      setLoading(false);
    }, 0);
  };

  const confirmLoad = () => {
    if (!pendingPatternId) return;
    const pattern = getPatternById(pendingPatternId);
    if (!pattern) return;
    onApplyPattern(instantiatePattern(pattern));
    setPendingPlan(null);
    setPendingPatternId(null);
  };

  const onExampleClick = (prompt) => {
    setMessage(prompt);
    preview(prompt);
  };

  return (
    <div className="ai-builder">
      <h2>AI Pipeline Designer</h2>
      <p className="ai-builder-intro">
        Describe your pipeline in plain English. We&apos;ll explain what will be created and how it works before loading the canvas.
      </p>

      <textarea
        className="ai-builder-input"
        rows={4}
        value={message}
        onChange={(e) => {
          setMessage(e.target.value);
          if (pendingPlan) {
            setPendingPlan(null);
            setPendingPatternId(null);
          }
        }}
        placeholder="Example: Multi-domain data mesh customer 360 with parallel domains..."
      />

      {livePlan && !pendingPlan && message.trim().length >= 12 && (
        <div className="design-plan-live-hint">
          <p className="properties-hint">
            <strong>Preview:</strong> {livePlan.title} - {livePlan.whatWeCreate.slice(0, 120)}
            {livePlan.whatWeCreate.length > 120 ? "…" : ""}
          </p>
        </div>
      )}

      <button type="button" className="deploy-btn ai-builder-submit" disabled={loading} onClick={() => preview()}>
        {loading ? "Analyzing…" : "✨ Preview pipeline plan"}
      </button>

      {error && <p className="login-error">{error}</p>}

      {pendingPlan && (
        <DesignPlanPreview
          plan={pendingPlan}
          confirmLabel="Load pipeline on canvas"
          loading={loading}
          onConfirm={confirmLoad}
          onDismiss={() => {
            setPendingPlan(null);
            setPendingPatternId(null);
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
