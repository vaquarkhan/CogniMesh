/**
 * Shows a natural-language plan before loading pattern/agent on the canvas.
 */
export default function DesignPlanPreview({
  plan,
  onConfirm,
  onDismiss,
  confirmLabel = "Load on canvas",
  loading = false,
}) {
  if (!plan) return null;

  return (
    <div className="design-plan-preview" role="region" aria-label="Creation plan">
      <div className="design-plan-header">
        <h3 className="design-plan-title">{plan.title}</h3>
        {plan.badge && <span className="design-plan-badge">{plan.badge}</span>}
      </div>
      {plan.subtitle && <p className="design-plan-subtitle">{plan.subtitle}</p>}

      <section className="design-plan-section">
        <h4>What we&apos;ll create</h4>
        <p className="design-plan-summary">{stripMarkdownBold(plan.whatWeCreate)}</p>
      </section>

      <section className="design-plan-section">
        <h4>How it works</h4>
        <ol className="design-plan-steps">
          {plan.howItWorks.map((step, i) => (
            <li key={i}>{stripMarkdownBold(step)}</li>
          ))}
        </ol>
      </section>

      {plan.flow && (
        <p className="design-plan-flow">
          <strong>Flow:</strong> {plan.flow}
        </p>
      )}

      <div className="design-plan-meta">
        {plan.awsServices?.length > 0 && (
          <p>
            <strong>AWS:</strong>{" "}
            {plan.awsServices.map((s) => (
              <span key={s} className="aws-chip">{s}</span>
            ))}
          </p>
        )}
        {plan.features?.length > 0 && (
          <p className="design-plan-features">
            <strong>Features:</strong> {plan.features.join(" · ")}
          </p>
        )}
        {plan.blockCount > 0 && (
          <p className="properties-hint">{plan.blockCount} blocks pre-wired on the canvas</p>
        )}
      </div>

      {plan.tips?.length > 0 && (
        <ul className="pattern-tip-list design-plan-tips">
          {plan.tips.slice(0, 3).map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      )}

      <div className="design-plan-actions">
        <button type="button" className="deploy-btn" disabled={loading} onClick={onConfirm}>
          {loading ? "Loading…" : confirmLabel}
        </button>
        {onDismiss && (
          <button type="button" className="btn-secondary" onClick={onDismiss}>
            Edit description
          </button>
        )}
      </div>
    </div>
  );
}

function stripMarkdownBold(text) {
  return String(text || "").replace(/\*\*([^*]+)\*\*/g, "$1");
}
