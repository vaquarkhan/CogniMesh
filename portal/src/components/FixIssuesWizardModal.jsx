import { useCallback, useEffect, useMemo, useState } from "react";
import FormField from "./FormField";
import { getDesignReviewFixHelp } from "../lib/api";
import { filterFindings, sortFindingsForWizard } from "../lib/fix-wizard-findings";

const SEV_LABEL = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

function FieldEditor({ field, node, onApplyField }) {
  if (!node) return null;
  const d = node.data || {};

  if (field === "secretArn") {
    return (
      <FormField label="Secrets Manager ARN" tip="Paste ARN for your existing database">
        <input
          data-testid="fix-wizard-secret-arn"
          value={d.secretArn || ""}
          placeholder="arn:aws:secretsmanager:..."
          onChange={(e) => onApplyField(node.id, { secretArn: e.target.value })}
        />
      </FormField>
    );
  }
  if (field === "encryption") {
    return (
      <FormField label="Encryption at rest">
        <select
          data-testid="fix-wizard-encryption"
          value={d.encryption || "AES256"}
          onChange={(e) => onApplyField(node.id, { encryption: e.target.value })}
        >
          <option value="AES256">AES256 (recommended)</option>
          <option value="aws:kms">AWS KMS</option>
        </select>
      </FormField>
    );
  }
  if (field === "location") {
    return (
      <FormField label="S3 location">
        <input
          value={d.location || ""}
          placeholder="s3://bucket/prefix/"
          onChange={(e) => onApplyField(node.id, { location: e.target.value })}
        />
      </FormField>
    );
  }
  if (field === "endpoint") {
    return (
      <FormField label="S3 / endpoint path">
        <input
          value={d.endpoint || ""}
          placeholder="s3://bucket/prefix/"
          onChange={(e) => onApplyField(node.id, { endpoint: e.target.value })}
        />
      </FormField>
    );
  }
  if (field === "rdsProvisioningMode") {
    return (
      <p className="properties-hint fix-wizard-hint">
        Or switch the RDS block to <strong>Create new</strong> in Properties — no ARN required.
      </p>
    );
  }
  return (
    <p className="properties-hint fix-wizard-hint">
      Edit <code>{field}</code> in the Properties panel for block <strong>{d.label || node.id}</strong>.
    </p>
  );
}

export default function FixIssuesWizardModal({
  open,
  onClose,
  findings = [],
  nodes = [],
  edges,
  pipelineMeta,
  token,
  onFocusNode,
  onApplyFindingFix,
  onApplyNodeFix,
  applyingFindingId,
  title = "Fix pipeline issues",
}) {
  const sorted = useMemo(() => sortFindingsForWizard(findings), [findings]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [plan, setPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState(null);

  const visible = useMemo(() => filterFindings(sorted, search), [sorted, search]);
  const selected = visible.find((f) => f.id === selectedId) || visible[0] || null;
  const node = selected?.nodeIds?.[0] ? nodes.find((n) => n.id === selected.nodeIds[0]) : null;

  const loadPlan = useCallback(
    async (findingId) => {
      if (!findingId || !token) return;
      setPlanLoading(true);
      setPlanError(null);
      try {
        const data = await getDesignReviewFixHelp({
          token,
          nodes,
          edges,
          pipelineMeta,
          findingId,
        });
        setPlan(data.plans?.[0] || null);
      } catch (err) {
        setPlan(null);
        setPlanError(err.message);
      } finally {
        setPlanLoading(false);
      }
    },
    [token, nodes, edges, pipelineMeta]
  );

  useEffect(() => {
    if (!open) return;
    const first = visible[0];
    if (first && !selectedId) setSelectedId(first.id);
  }, [open, visible, selectedId]);

  useEffect(() => {
    if (!open || !selected?.id) return;
    setPlan(null);
    loadPlan(selected.id);
  }, [open, selected?.id, loadPlan]);

  if (!open) return null;

  const steps = plan?.steps?.length
    ? plan.steps
    : selected?.fix
      ? [selected.fix]
      : selected?.message
        ? [selected.message]
        : [];

  return (
    <div className="modal-backdrop fix-wizard-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-dialog fix-wizard-dialog"
        role="dialog"
        aria-labelledby="fix-wizard-title"
        onClick={(e) => e.stopPropagation()}
        data-testid="fix-issues-wizard"
      >
        <header className="fix-wizard-header">
          <div>
            <h2 id="fix-wizard-title">{title}</h2>
            <p className="properties-hint">
              Pick an issue below — we show guided steps and fields to update. No hunting through the canvas HUD.
            </p>
          </div>
          <button type="button" className="btn-ghost fix-wizard-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        {sorted.length === 0 ? (
          <p className="properties-hint">No issues to fix right now.</p>
        ) : (
          <>
            <FormField label="Search issues" tip="Filter by title, message, or ID">
              <input
                data-testid="fix-wizard-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="e.g. encryption, RDS, integrity gate"
              />
            </FormField>

            <FormField label="What should we fix?" tip="Critical issues are listed first">
              <select
                data-testid="fix-wizard-select"
                value={selected?.id || ""}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {visible.map((f) => (
                  <option key={f.id} value={f.id}>
                    [{SEV_LABEL[f.severity] || f.severity}] {f.title}
                  </option>
                ))}
              </select>
            </FormField>

            {selected && (
              <div className="fix-wizard-detail">
                <p className={`fix-wizard-sev sev-${selected.severity}`}>
                  {SEV_LABEL[selected.severity] || selected.severity} — {selected.title}
                </p>
                <p className="fix-wizard-msg">{selected.message}</p>

                {steps.length > 0 && (
                  <div className="aws-fix-steps-wrap">
                    <p className="aws-fix-steps-label">Steps to fix</p>
                    <ol className="aws-fix-steps">
                      {steps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {planLoading && <p className="properties-hint">Loading AI fix guide…</p>}
                {planError && <p className="deploy-errors">{planError}</p>}

                {plan?.aiExplanation && (
                  <div className="aws-ai-fix-box">
                    <strong>AI fix guide</strong>
                    <p>{plan.aiExplanation}</p>
                    {plan.mode === "amazon_q" && (
                      <span className="properties-hint">Amazon Q</span>
                    )}
                    {plan.mode === "llm" && (
                      <span className="properties-hint">Amazon Bedrock</span>
                    )}
                  </div>
                )}

                {(plan?.fields?.length > 0 || node) && (
                  <div className="fix-wizard-fields">
                    <p className="aws-fix-steps-label">Update on canvas</p>
                    {(plan?.fields || []).map((field) => (
                      <FieldEditor
                        key={field}
                        field={field}
                        node={node}
                        onApplyField={onApplyNodeFix}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div className="modal-actions fix-wizard-actions">
          {selected?.nodeIds?.[0] && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onFocusNode?.(selected.nodeIds[0])}
            >
              Go to block
            </button>
          )}
          {plan?.propertyPatch && plan.nodeId && onApplyNodeFix && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onApplyNodeFix(plan.nodeId, plan.propertyPatch)}
            >
              Apply suggested values
            </button>
          )}
          {selected && onApplyFindingFix && (
            <button
              type="button"
              className="deploy-btn"
              data-testid="fix-wizard-apply"
              disabled={applyingFindingId === selected.id}
              onClick={() => onApplyFindingFix(selected)}
            >
              {applyingFindingId === selected.id ? "Applying…" : "Apply fix"}
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
