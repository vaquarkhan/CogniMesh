import { useState } from "react";
import { designPipelineFromAi } from "../lib/api";
import { getPatternById, instantiatePattern } from "../lib/pipeline-patterns";

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

export default function AiPipelineBuilder({ onApplyPattern, token }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState(null);

  const submit = async (text) => {
    const msg = (text || message).trim();
    if (!msg) return;
    setLoading(true);
    setError(null);
    try {
      const result = await designPipelineFromAi({ message: msg, token });
      if (!result.success) {
        setError(result.errors?.[0] || "Could not interpret request");
        return;
      }
      setLastResult(result);
      const pattern = getPatternById(result.patternId);
      if (pattern) {
        onApplyPattern(instantiatePattern(pattern));
      }
    } catch (err) {
      setError(err.message || "AI designer unavailable");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-builder">
      <h2>AI Pipeline Designer</h2>
      <p className="ai-builder-intro">
        Describe what you want in plain English. CogniMesh matches your intent to a proven pattern and loads it on the canvas.
      </p>

      <textarea
        className="ai-builder-input"
        rows={4}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Example: Ingest RDS order CDC into bronze/silver/gold Iceberg with Vaquar proof and data quality gates..."
      />

      <button type="button" className="deploy-btn ai-builder-submit" disabled={loading} onClick={() => submit()}>
        {loading ? "Designing…" : "✨ Build my pipeline"}
      </button>

      {error && <p className="login-error">{error}</p>}

      {lastResult?.success && (
        <div className="ai-builder-result">
          <p className="ai-result-explanation">{lastResult.explanation}</p>
          <p className="properties-hint">Pattern: <strong>{lastResult.patternId}</strong> · mode: {lastResult.aiMode}</p>
          <ul className="pattern-tip-list">
            {(lastResult.suggestions || []).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="ai-builder-examples">
        <p className="properties-hint"><strong>Try an example:</strong></p>
        {EXAMPLE_PROMPTS.map((p) => (
          <button key={p} type="button" className="ai-example-chip" onClick={() => { setMessage(p); submit(p); }}>
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
