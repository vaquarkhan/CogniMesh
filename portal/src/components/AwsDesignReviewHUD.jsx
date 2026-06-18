import { useCallback, useEffect, useMemo, useState } from "react";
import AwsScoreRing from "./AwsScoreRing";
import AwsTopologyMap from "./AwsTopologyMap";
import { getDesignReviewFixHelp } from "../lib/api";

const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
const SEV_CLASS = {
  critical: "sev-critical",
  high: "sev-high",
  medium: "sev-medium",
  low: "sev-low",
  info: "sev-info",
};
const SEV_LABEL = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

function countBySeverity(findings) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) {
    if (counts[f.severity] != null) counts[f.severity] += 1;
  }
  return counts;
}

function FindingRow({
  f,
  expanded,
  onToggle,
  onFocusNode,
  onApplyNodeFix,
  onApplyFindingFix,
  applyingFindingId,
  token,
  nodes,
  edges,
  pipelineMeta,
  isActive,
  autoLoadFixForId,
  onAutoLoadFixHandled,
}) {
  const [fixPlan, setFixPlan] = useState(null);
  const [fixLoading, setFixLoading] = useState(false);
  const [fixError, setFixError] = useState(null);
  const [showSteps, setShowSteps] = useState(
    expanded && (f.severity === "critical" || f.severity === "high")
  );

  useEffect(() => {
    if (isActive) setShowSteps(true);
  }, [isActive]);

  useEffect(() => {
    if (autoLoadFixForId !== f.id || fixPlan || fixLoading || !token) return;
    loadFixHelp();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-load once when opened from Properties
  }, [autoLoadFixForId, f.id, token]);

  const loadFixHelp = async () => {
    setFixLoading(true);
    setFixError(null);
    try {
      const data = await getDesignReviewFixHelp({
        token,
        nodes,
        edges,
        pipelineMeta,
        findingId: f.id,
      });
      const plan = data.plans?.[0];
      if (!plan) throw new Error("No fix plan returned");
      setFixPlan(plan);
      setShowSteps(true);
      if (!expanded) onToggle?.();
      onAutoLoadFixHandled?.();
    } catch (err) {
      setFixError(err.message);
    } finally {
      setFixLoading(false);
    }
  };

  const steps = fixPlan?.steps?.length ? fixPlan.steps : f.fix ? [f.fix] : [];

  return (
    <li
      className={`aws-finding-card ${SEV_CLASS[f.severity] || ""} ${isActive ? "aws-finding-active" : ""} ${expanded ? "is-open" : ""}`}
      id={`aws-finding-${f.id}`}
    >
      <button type="button" className="aws-finding-card-head" onClick={onToggle}>
        <span className={`sev-pill ${SEV_CLASS[f.severity]}`}>{SEV_LABEL[f.severity] || f.severity}</span>
        <span className="aws-finding-card-title">{f.title}</span>
        {f.waReference && <code className="wa-ref">{f.waReference}</code>}
        <span className="aws-finding-chevron">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className="aws-finding-card-body">
          <p className="aws-finding-msg">{f.message}</p>

          {showSteps && steps.length > 0 && (
            <div className="aws-fix-steps-wrap">
              <p className="aws-fix-steps-label">Steps to fix</p>
              <ol className="aws-fix-steps">
                {steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          {fixPlan?.fields?.length > 0 && (
            <p className="aws-finding-fields">
              Edit in Properties:{" "}
              {fixPlan.fields.map((field) => (
                <code key={field}>{field}</code>
              ))}
            </p>
          )}

          {fixPlan?.aiExplanation && (
            <div className="aws-ai-fix-box">
              <strong>AI fix guide</strong>
              <p>{fixPlan.aiExplanation}</p>
              {fixPlan.mode === "amazon_q" && (
                <span className="properties-hint">Amazon Q · AMAZON_Q_FIX_ENABLED</span>
              )}
              {fixPlan.mode === "llm" && (
                <span className="properties-hint">Amazon Bedrock · COPILOT_LLM_ENABLED</span>
              )}
            </div>
          )}

          {fixError && <p className="deploy-errors">{fixError}</p>}

          {f.awsServices?.length > 0 && (
            <p className="aws-finding-services">{f.awsServices.join(" · ")}</p>
          )}

          <div className="aws-finding-actions">
            {f.nodeIds?.length > 0 && (
              <button
                type="button"
                className="btn-secondary compact"
                onClick={() => onFocusNode?.(f.nodeIds[0])}
              >
                Go to block
              </button>
            )}
            <button
              type="button"
              className="deploy-btn compact aws-ai-fix-btn"
              data-testid={`aws-fix-guide-${f.id}`}
              onClick={loadFixHelp}
              disabled={fixLoading || !token}
            >
              {fixLoading ? "Loading guide…" : fixPlan ? "Refresh AI guide" : "Get fix guide"}
            </button>
            {fixPlan?.propertyPatch && fixPlan.nodeId && onApplyNodeFix && (
              <button
                type="button"
                className="btn-secondary compact aws-apply-fix-btn"
                onClick={() => onApplyNodeFix(fixPlan.nodeId, fixPlan.propertyPatch)}
              >
                Apply suggested values
              </button>
            )}
            {onApplyFindingFix && (
              <button
                type="button"
                className="deploy-btn compact aws-apply-fix-btn"
                data-testid={`aws-apply-fix-${f.id}`}
                disabled={applyingFindingId === f.id}
                onClick={() => onApplyFindingFix(f)}
              >
                {applyingFindingId === f.id ? "Applying…" : "Apply fix"}
              </button>
            )}
            {steps.length > 0 && (
              <button type="button" className="btn-ghost compact" onClick={() => setShowSteps((v) => !v)}>
                {showSteps ? "Hide steps" : "Show steps"}
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

export default function AwsDesignReviewHUD({
  review,
  reviewError,
  loading,
  expanded,
  onToggleExpand,
  onFocusNode,
  onRunReview,
  onApplyNodeFix,
  onApplyFindingFix,
  applyingFindingId,
  onExportDrawio,
  onExportTerraform,
  focusFindingId,
  autoLoadFixForId,
  onFocusFindingHandled,
  onAutoLoadFixHandled,
  token,
  nodes,
  edges,
  pipelineMeta,
}) {
  const actionable = useMemo(
    () =>
      (review?.findings || [])
        .filter((f) => f.severity === "critical" || f.severity === "high")
        .sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9)),
    [review?.findings]
  );

  const [tab, setTab] = useState("action");
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (!review) return;
    const items = (review.findings || []).filter(
      (f) => f.severity === "critical" || f.severity === "high"
    );
    if (review.overall?.deployBlocked && items.length) {
      setTab("action");
      setExpandedIds(new Set(items.slice(0, 2).map((f) => f.id)));
      setActiveIdx(0);
    } else if (review.overall?.score >= 90) {
      setTab("all");
    }
  }, [review?.reviewedAt]);

  const counts = useMemo(() => countBySeverity(review?.findings || []), [review?.findings]);

  const findings =
    tab === "action"
      ? actionable
      : tab === "security"
        ? review?.security?.findings || []
        : tab === "architecture"
          ? review?.architecture?.findings || []
          : review?.findings || [];

  const sorted = [...findings].sort(
    (a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9)
  );

  const toggleFinding = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const goToIssue = (idx) => {
    if (!actionable.length) return;
    const clamped = ((idx % actionable.length) + actionable.length) % actionable.length;
    setActiveIdx(clamped);
    const f = actionable[clamped];
    setExpandedIds((prev) => new Set(prev).add(f.id));
    setTab("action");
    if (f.nodeIds?.[0]) onFocusNode?.(f.nodeIds[0]);
    document.getElementById(`aws-finding-${f.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const focusFindingById = useCallback(
    (findingId) => {
      if (!findingId || !review?.findings?.length) return;
      const f = review.findings.find((item) => item.id === findingId);
      if (!f) return;

      const actionIdx = actionable.findIndex((item) => item.id === findingId);
      if (actionIdx >= 0) {
        setActiveIdx(actionIdx);
        setTab("action");
      } else if (f.category === "security" || String(f.id).startsWith("sec.")) {
        setTab("security");
      } else if (f.category === "architecture" || String(f.id).startsWith("arch.")) {
        setTab("architecture");
      } else {
        setTab("all");
      }

      setExpandedIds((prev) => new Set(prev).add(findingId));
      if (f.nodeIds?.[0]) onFocusNode?.(f.nodeIds[0]);
      requestAnimationFrame(() => {
        document.getElementById(`aws-finding-${findingId}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    },
    [review?.findings, actionable, onFocusNode]
  );

  useEffect(() => {
    if (!focusFindingId || !review) return;
    focusFindingById(focusFindingId);
    onFocusFindingHandled?.();
  }, [focusFindingId, review?.reviewedAt, focusFindingById, onFocusFindingHandled]);

  if (!review && !loading && !reviewError) {
    return (
      <div className="aws-review-hud aws-review-empty">
        <p className="aws-review-empty-title">AWS Well-Architected review</p>
        <p className="properties-hint">Load a pattern or add blocks — we scan security, architecture, and deploy readiness automatically.</p>
      </div>
    );
  }

  const deployBlocked = review?.overall?.deployBlocked;
  const allClear = review && !deployBlocked && (review.overall?.score ?? 0) >= 85;

  return (
    <div
      className={`aws-review-hud ${expanded ? "expanded" : "collapsed"} ${reviewError ? "aws-review-error-state" : ""} ${deployBlocked ? "aws-review-blocked" : ""} ${allClear ? "aws-review-pass" : ""}`}
      role="region"
      aria-label="AWS Design Review"
      data-testid="aws-review-hud"
    >
      <button type="button" className="aws-review-header" onClick={onToggleExpand} aria-expanded={expanded}>
        <div className="aws-review-scores">
          {loading ? (
            <div className="aws-review-loading-ring" aria-hidden="true" />
          ) : (
            review && (
              <>
                <AwsScoreRing
                  score={review.security?.score ?? 0}
                  label="Security"
                  grade={review.security?.grade}
                  size={52}
                />
                <AwsScoreRing
                  score={review.architecture?.score ?? 0}
                  label="Arch"
                  grade={review.architecture?.grade}
                  size={52}
                />
              </>
            )
          )}
        </div>
        <div className="aws-review-summary">
          <strong>AWS Design Review</strong>
          {loading && <span className="aws-review-loading">Scanning your pipeline…</span>}
          {reviewError && !loading && (
            <span className="aws-review-error-banner">Could not complete review</span>
          )}
          {review && !loading && !reviewError && (
            <>
              <span className={`overall-grade grade-${deployBlocked ? "blocked" : "ok"}`}>
                {review.overall?.grade?.label} · {review.overall?.score}/100
              </span>
              {deployBlocked ? (
                <span className="aws-critical-banner">
                  {counts.critical} critical · {counts.high} high — fix before deploy
                </span>
              ) : allClear ? (
                <span className="aws-pass-banner">Ready for deploy</span>
              ) : (
                <span className="properties-hint">{counts.medium + counts.low} minor items to review</span>
              )}
            </>
          )}
        </div>
        {!loading && review && !reviewError && (
          <div className="aws-review-mini-stats" onClick={(e) => e.stopPropagation()}>
            {counts.critical > 0 && <span className="aws-stat-pill stat-critical">{counts.critical}</span>}
            {counts.high > 0 && <span className="aws-stat-pill stat-high">{counts.high}</span>}
          </div>
        )}
        <span className="aws-review-chevron" aria-hidden="true">
          {expanded ? "▾" : "▴"}
        </span>
      </button>

      {expanded && reviewError && (
        <div className="aws-review-body aws-review-error-body">
          <p className="aws-review-error-title">Review unavailable</p>
          <p className="deploy-errors">{(reviewError.errors || []).join(" · ")}</p>
          {reviewError.fixHint && <p className="properties-hint">{reviewError.fixHint}</p>}
          <button type="button" className="deploy-btn compact" onClick={onRunReview}>
            Retry review
          </button>
        </div>
      )}

      {expanded && review && !reviewError && (
        <div className="aws-review-body">
          <div className="aws-review-stats-row">
            {["critical", "high", "medium", "low"].map((sev) =>
              counts[sev] > 0 ? (
                <span key={sev} className={`aws-stat-chip ${SEV_CLASS[sev]}`}>
                  {counts[sev]} {SEV_LABEL[sev]}
                </span>
              ) : null
            )}
          </div>

          {actionable.length > 0 && (
            <div className="aws-review-wizard">
              <div className="aws-review-wizard-text">
                <strong>
                  Issue {activeIdx + 1} of {actionable.length}
                </strong>
                <span className="properties-hint">{actionable[activeIdx]?.title}</span>
              </div>
              <div className="aws-review-wizard-nav">
                <button type="button" className="btn-secondary compact" onClick={() => goToIssue(activeIdx - 1)}>
                  ← Prev
                </button>
                <button type="button" className="btn-secondary compact" onClick={() => goToIssue(activeIdx + 1)}>
                  Next →
                </button>
                <button
                  type="button"
                  className="deploy-btn compact"
                  disabled={!actionable[activeIdx] || applyingFindingId === actionable[activeIdx]?.id}
                  onClick={() => {
                    const f = actionable[activeIdx];
                    if (!f) return;
                    if (onApplyFindingFix) {
                      onApplyFindingFix(f);
                    }
                    goToIssue(activeIdx);
                  }}
                >
                  {applyingFindingId === actionable[activeIdx]?.id ? "Applying…" : "Fix this"}
                </button>
              </div>
            </div>
          )}

          <div className="aws-review-tabs" role="tablist">
            {[
              { id: "action", label: `Fix first (${actionable.length})`, hidden: !actionable.length },
              { id: "security", label: `Security (${review.security?.findings?.length || 0})` },
              { id: "architecture", label: `Architecture (${review.architecture?.findings?.length || 0})` },
              { id: "all", label: `All (${review.findings?.length || 0})` },
            ]
              .filter((t) => !t.hidden)
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className={tab === t.id ? "active" : ""}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            <button type="button" className="btn-secondary compact aws-refresh-btn" onClick={onRunReview}>
              Re-scan
            </button>
          </div>

          <details className="aws-topology-details" open>
            <summary>Service topology map &amp; export</summary>
            <AwsTopologyMap topology={review.topology} />
            <div className="aws-export-row">
              <button
                type="button"
                className="btn-secondary compact"
                data-testid="export-drawio-architecture"
                onClick={() => onExportDrawio?.()}
              >
                Export draw.io diagram
              </button>
              <button
                type="button"
                className="btn-secondary compact"
                data-testid="export-terraform-infra"
                onClick={() => onExportTerraform?.()}
              >
                Export infrastructure (Terraform)
              </button>
            </div>
            <p className="properties-hint">
              Open .drawio in diagrams.net → Export as PNG/SVG. Terraform covers RDS sources set to Create new.
            </p>
          </details>

          <ul className="aws-findings-list">
            {sorted.length === 0 && (
              <li className="aws-finding-card sev-info is-open">
                <div className="aws-finding-card-body aws-finding-success">
                  <strong>No issues in this view</strong>
                  <p className="properties-hint">Switch tabs or re-scan after editing blocks.</p>
                </div>
              </li>
            )}
            {sorted.map((f) => (
              <FindingRow
                key={f.id}
                f={f}
                expanded={expandedIds.has(f.id)}
                onToggle={() => toggleFinding(f.id)}
                onFocusNode={onFocusNode}
                onApplyNodeFix={onApplyNodeFix}
                onApplyFindingFix={onApplyFindingFix}
                applyingFindingId={applyingFindingId}
                token={token}
                nodes={nodes}
                edges={edges}
                pipelineMeta={pipelineMeta}
                isActive={tab === "action" && actionable[activeIdx]?.id === f.id}
                autoLoadFixForId={autoLoadFixForId}
                onAutoLoadFixHandled={onAutoLoadFixHandled}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
