import { useState } from "react";
import AwsScoreRing from "./AwsScoreRing";
import AwsTopologyMap from "./AwsTopologyMap";

const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
const SEV_CLASS = {
  critical: "sev-critical",
  high: "sev-high",
  medium: "sev-medium",
  low: "sev-low",
  info: "sev-info",
};

function FindingRow({ f, onFocusNode }) {
  return (
    <li className={`aws-finding ${SEV_CLASS[f.severity] || ""}`}>
      <div className="aws-finding-head">
        <span className={`sev-pill ${SEV_CLASS[f.severity]}`}>{f.severity}</span>
        <strong>{f.title}</strong>
        {f.waReference && <code className="wa-ref">{f.waReference}</code>}
      </div>
      <p className="aws-finding-msg">{f.message}</p>
      <p className="aws-finding-fix">
        <strong>Fix:</strong> {f.fix}
      </p>
      {f.awsServices?.length > 0 && (
        <p className="aws-finding-services">
          AWS: {f.awsServices.join(" · ")}
        </p>
      )}
      {f.nodeIds?.length > 0 && (
        <button type="button" className="btn-secondary compact" onClick={() => onFocusNode?.(f.nodeIds[0])}>
          Focus block on canvas
        </button>
      )}
    </li>
  );
}

export default function AwsDesignReviewHUD({
  review,
  loading,
  expanded,
  onToggleExpand,
  onFocusNode,
  onRunReview,
}) {
  const [tab, setTab] = useState("security");

  if (!review && !loading) {
    return (
      <div className="aws-review-hud aws-review-empty">
        <p>Add blocks to run AWS Security + Architecture review</p>
      </div>
    );
  }

  const findings =
    tab === "security"
      ? review?.security?.findings || []
      : tab === "architecture"
        ? review?.architecture?.findings || []
        : review?.findings || [];

  const sorted = [...findings].sort(
    (a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9)
  );

  return (
    <div className={`aws-review-hud ${expanded ? "expanded" : "collapsed"}`}>
      <button type="button" className="aws-review-header" onClick={onToggleExpand}>
        <div className="aws-review-scores">
          {review && (
            <>
              <AwsScoreRing
                score={review.security?.score ?? 0}
                label="Security"
                grade={review.security?.grade}
                size={56}
              />
              <AwsScoreRing
                score={review.architecture?.score ?? 0}
                label="Architecture"
                grade={review.architecture?.grade}
                size={56}
              />
            </>
          )}
        </div>
        <div className="aws-review-summary">
          <strong>AWS Design Review</strong>
          {loading && <span className="aws-review-loading">Analyzing…</span>}
          {review && !loading && (
            <>
              <span className={`overall-grade grade-${review.overall?.deployBlocked ? "blocked" : "ok"}`}>
                {review.overall?.grade?.label} · {review.overall?.score}/100
              </span>
              {review.overall?.criticalCount > 0 && (
                <span className="aws-critical-banner">
                  {review.overall.criticalCount} critical - fix before deploy
                </span>
              )}
            </>
          )}
        </div>
        <span className="aws-review-chevron">{expanded ? "▾" : "▴"}</span>
      </button>

      {expanded && review && (
        <div className="aws-review-body">
          <div className="aws-review-tabs">
            {[
              { id: "security", label: `Security (${review.security?.findings?.length || 0})` },
              { id: "architecture", label: `Architecture (${review.architecture?.findings?.length || 0})` },
              { id: "all", label: "All" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
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

          <AwsTopologyMap topology={review.topology} />

          <ul className="aws-findings-list">
            {sorted.length === 0 && (
              <li className="aws-finding sev-info">
                <strong>No issues - production-ready AWS design</strong>
              </li>
            )}
            {sorted.map((f) => (
              <FindingRow key={f.id} f={f} onFocusNode={onFocusNode} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
