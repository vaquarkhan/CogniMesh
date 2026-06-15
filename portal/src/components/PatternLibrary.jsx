import { useState } from "react";
import { PIPELINE_PATTERNS, PATTERN_CATEGORIES, instantiatePattern, ARCHITECTURE_LABELS } from "../lib/pipeline-patterns";
import { ARCHITECTURE_TYPES } from "../lib/aws-services";

export default function PatternLibrary({ activePatternId, onApplyPattern }) {
  const [category, setCategory] = useState("All");
  const [archFilter, setArchFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState("");

  const filtered = PIPELINE_PATTERNS.filter((p) => {
    if (p.id === "blank") return false;
    if (category !== "All" && p.category !== category) return false;
    if (archFilter !== "all") {
      const tags = p.architectureTags || [p.architecture];
      if (!tags.includes(archFilter)) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const hay = `${p.name} ${p.description} ${p.whenToUse} ${p.exampleScenario || ""} ${(p.awsServices || []).join(" ")} ${p.architecture || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="pattern-library">
      <h2>Pattern library</h2>
      <p className="pattern-library-intro">
        {PIPELINE_PATTERNS.filter((p) => p.id !== "blank").length} data architectures — Data Mesh, Lakehouse, Kappa, Lambda λ, Glue, Kinesis, ETL/ELT.
      </p>

      <input
        className="pattern-search"
        type="search"
        placeholder="Search mesh, lakehouse, kinesis, glue…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="pattern-arch-filters">
        <span className="pattern-filter-label">Architecture:</span>
        <button type="button" className={archFilter === "all" ? "active" : ""} onClick={() => setArchFilter("all")}>
          All
        </button>
        {ARCHITECTURE_TYPES.map((a) => (
          <button
            key={a.id}
            type="button"
            className={archFilter === a.id ? "active" : ""}
            onClick={() => setArchFilter(a.id)}
            title={a.desc}
          >
            {a.icon} {a.label}
          </button>
        ))}
      </div>

      <div className="pattern-filters">
        {["All", ...PATTERN_CATEGORIES].map((c) => (
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
                  {pattern.architecture && (
                    <p className="pattern-arch">
                      <strong>Architecture:</strong> {ARCHITECTURE_LABELS[pattern.architecture] || pattern.architecture}
                    </p>
                  )}
                  {pattern.medallionLayers?.length > 0 && (
                    <p className="pattern-layers">
                      <strong>Medallion layers:</strong>{" "}
                      {pattern.medallionLayers.map((l) => (
                        <span key={l} className={`layer-badge layer-${l}`}>{l}</span>
                      ))}
                    </p>
                  )}
                  <p>{pattern.description}</p>
                  <p className="pattern-when">
                    <strong>When to use:</strong> {pattern.whenToUse}
                  </p>
                  {pattern.exampleScenario && (
                    <p className="pattern-example">
                      <strong>Example:</strong> {pattern.exampleScenario}
                    </p>
                  )}
                  {pattern.exampleFlow && (
                    <p className="pattern-flow">
                      <strong>Flow:</strong> <code>{pattern.exampleFlow}</code>
                    </p>
                  )}
                  {pattern.architectureDiagram && (
                    <pre className="pattern-diagram">{pattern.architectureDiagram}</pre>
                  )}
                  {pattern.awsServices?.length > 0 && (
                    <p className="pattern-aws">
                      <strong>AWS:</strong>{" "}
                      {pattern.awsServices.map((s) => (
                        <span key={s} className="aws-chip">{s}</span>
                      ))}
                    </p>
                  )}
                  <ol className="pattern-tip-list">
                    {(pattern.customizeTips || []).map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ol>
                  <button type="button" className="pattern-use-btn" onClick={() => onApplyPattern(instantiatePattern(pattern))}>
                    Use this pattern
                  </button>
                </div>
              )}

              {!isExpanded && (
                <button type="button" className="pattern-use-btn compact" onClick={() => onApplyPattern(instantiatePattern(pattern))}>
                  Use pattern
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {filtered.length === 0 && (
        <p className="properties-hint">No patterns match — try another architecture filter.</p>
      )}

      <div className="pattern-blank">
        <button
          type="button"
          className="btn-secondary pattern-blank-btn"
          onClick={() => onApplyPattern(instantiatePattern(PIPELINE_PATTERNS.find((p) => p.id === "blank")))}
        >
          ✨ Start blank canvas
        </button>
      </div>
    </div>
  );
}
