import { useState } from "react";
import { PIPELINE_PATTERNS, PATTERN_CATEGORIES, instantiatePattern } from "../lib/pipeline-patterns";

export default function PatternLibrary({ activePatternId, onApplyPattern }) {
  const [category, setCategory] = useState("All");
  const [expandedId, setExpandedId] = useState(null);

  const filtered =
    category === "All"
      ? PIPELINE_PATTERNS.filter((p) => p.id !== "blank")
      : PIPELINE_PATTERNS.filter((p) => p.category === category && p.id !== "blank");

  return (
    <div className="pattern-library">
      <h2>Pattern library</h2>
      <p className="pattern-library-intro">
        Start from a proven template, then customize blocks on the canvas. No need to build from scratch.
      </p>

      <div className="pattern-filters">
        <button
          type="button"
          className={category === "All" ? "active" : ""}
          onClick={() => setCategory("All")}
        >
          All
        </button>
        {PATTERN_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            className={category === c ? "active" : ""}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <ul className="pattern-list">
        {filtered.map((pattern) => {
          const isActive = activePatternId === pattern.id;
          const isExpanded = expandedId === pattern.id;
          return (
            <li key={pattern.id} className={`pattern-card ${isActive ? "active" : ""}`}>
              <button
                type="button"
                className="pattern-card-header"
                onClick={() => setExpandedId(isExpanded ? null : pattern.id)}
              >
                <span className="pattern-icon">{pattern.icon}</span>
                <span className="pattern-card-text">
                  <span className="pattern-name">
                    {pattern.name}
                    {pattern.badge && <span className="pattern-badge">{pattern.badge}</span>}
                  </span>
                  <span className="pattern-subtitle">{pattern.subtitle}</span>
                </span>
                <span className="pattern-difficulty">{pattern.difficulty}</span>
              </button>

              {isExpanded && (
                <div className="pattern-detail">
                  <p>{pattern.description}</p>
                  <p className="pattern-when">
                    <strong>When to use:</strong> {pattern.whenToUse}
                  </p>
                  {pattern.awsServices?.length > 0 && (
                    <p className="pattern-aws">
                      <strong>AWS:</strong> {pattern.awsServices.join(" · ")}
                    </p>
                  )}
                  <ol className="pattern-tip-list">
                    {(pattern.customizeTips || []).map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ol>
                  <button
                    type="button"
                    className="pattern-use-btn"
                    onClick={() => onApplyPattern(instantiatePattern(pattern))}
                  >
                    Use this pattern
                  </button>
                </div>
              )}

              {!isExpanded && (
                <button
                  type="button"
                  className="pattern-use-btn compact"
                  onClick={() => onApplyPattern(instantiatePattern(pattern))}
                >
                  Use pattern
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="pattern-blank">
        <button
          type="button"
          className="btn-secondary pattern-blank-btn"
          onClick={() => {
            const blank = PIPELINE_PATTERNS.find((p) => p.id === "blank");
            onApplyPattern(instantiatePattern(blank));
          }}
        >
          ✨ Start blank canvas
        </button>
      </div>
    </div>
  );
}
