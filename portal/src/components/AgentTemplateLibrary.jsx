import { useEffect, useRef, useState } from "react";
import { AGENT_TEMPLATES, AGENT_TEMPLATE_CATEGORIES, instantiateAgentTemplate } from "../lib/agent-templates";
import { defaultAgentFeatures } from "../lib/agent-feature-options";
import AgentFeatureOptions from "./AgentFeatureOptions";

function scrollSidebarToTop(containerRef) {
  const panel = containerRef.current?.closest(".sidebar-panel");
  if (panel) panel.scrollTo({ top: 0, behavior: "instant" });
}

export default function AgentTemplateLibrary({ activeTemplateId, onApplyTemplate }) {
  const rootRef = useRef(null);
  const [category, setCategory] = useState("All");
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState("");
  const [features, setFeatures] = useState(() => defaultAgentFeatures());

  const launchTemplate = (template) => {
    onApplyTemplate(instantiateAgentTemplate(template, features));
  };

  useEffect(() => {
    scrollSidebarToTop(rootRef);
  }, [category, search]);

  const templates = AGENT_TEMPLATES.filter((t) => {
    if (t.id === "blank-agent") return category === "All" || category === "Developer";
    if (category !== "All" && t.category !== category) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${t.name} ${t.description} ${t.subtitle} ${(t.awsServices || []).join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="pattern-library agent-template-library" ref={rootRef}>
      <div className="pattern-library-sticky">
        <h2>Agent templates</h2>
        <p className="pattern-library-intro">
          {AGENT_TEMPLATES.filter((t) => t.id !== "blank-agent").length} pre-built AgentCore agents with guardrails, tools, and memory configured.
        </p>

        <input
          className="pattern-search"
          type="search"
          placeholder="Search support, RAG, fraud, steward…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="pattern-filters">
          {["All", ...AGENT_TEMPLATE_CATEGORIES].map((c) => (
            <button
              key={c}
              type="button"
              className={category === c ? "active" : ""}
              onClick={() => { setExpandedId(null); setCategory(c); }}
            >
              {c}
            </button>
          ))}
        </div>

        <AgentFeatureOptions features={features} onChange={setFeatures} compact />
      </div>

      <ul className="pattern-list">
        {templates.map((template) => {
          const isActive = activeTemplateId === template.id;
          const isExpanded = expandedId === template.id;
          return (
            <li key={template.id} className={`pattern-card ${isActive ? "active" : ""}`}>
              <button
                type="button"
                className="pattern-card-header"
                onClick={() => setExpandedId(isExpanded ? null : template.id)}
              >
                <span className="pattern-icon">{template.icon}</span>
                <span className="pattern-card-text">
                  <span className="pattern-name">
                    {template.name}
                    {template.badge && <span className="pattern-badge">{template.badge}</span>}
                  </span>
                  <span className="pattern-subtitle">{template.subtitle}</span>
                </span>
                <span className="pattern-difficulty">{template.difficulty}</span>
              </button>

              {isExpanded && (
                <div className="pattern-detail">
                  <p>{template.description}</p>
                  <p className="pattern-when">
                    <strong>When to use:</strong> {template.whenToUse}
                  </p>
                  {template.awsServices?.length > 0 && (
                    <p className="pattern-aws">
                      <strong>AWS:</strong>{" "}
                      {template.awsServices.map((s) => (
                        <span key={s} className="aws-chip">{s}</span>
                      ))}
                    </p>
                  )}
                  <ol className="pattern-tip-list">
                    {(template.customizeTips || []).map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ol>
                  <button
                    type="button"
                    className="pattern-use-btn"
                    onClick={() => launchTemplate(template)}
                  >
                    Use this agent template
                  </button>
                </div>
              )}

              {!isExpanded && (
                <button
                  type="button"
                  className="pattern-use-btn compact"
                  onClick={() => launchTemplate(template)}
                >
                  Use template
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
          onClick={() => launchTemplate(AGENT_TEMPLATES.find((t) => t.id === "blank-agent"))}
        >
          ✨ Start blank agent
        </button>
      </div>
    </div>
  );
}
