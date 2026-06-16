import { useRef, useState } from "react";
import AgentTemplateLibrary from "./AgentTemplateLibrary";
import AgentBlockPalette from "./AgentBlockPalette";

const TABS = [
  { id: "templates", label: "Templates", hint: "Pre-built AgentCore agents with guardrails" },
  { id: "blocks", label: "Blocks", hint: "Runtime, Gateway, Guardrails, KB, Tools" },
  { id: "guide", label: "Guide", hint: "How to build agents" },
];

const GUIDE_STEPS = [
  { title: "Pick a template", detail: "Start from Customer Support, RAG, Data Analyst, or Fraud Investigation — guardrails pre-configured." },
  { title: "Customize blocks", detail: "Drag AgentCore Runtime, Gateway, Guardrails, KB, Memory, and Tools onto the canvas." },
  { title: "Wire connections", detail: "Connect tools to Gateway; connect model, guardrails, KB, and memory to Runtime." },
  { title: "Preview manifest", detail: "Review AgentCore deployment YAML with guardrail IDs and environment variables." },
  { title: "Deploy", detail: "Deploy to AgentCore Runtime with session isolation and observability." },
];

export default function AgentDesignerSidebar({ activeTemplateId, templateTips, onApplyTemplate }) {
  const [tab, setTab] = useState("templates");
  const panelRef = useRef(null);

  const selectTab = (id) => {
    setTab(id);
    requestAnimationFrame(() => {
      panelRef.current?.scrollTo({ top: 0, behavior: "instant" });
    });
  };

  return (
    <aside className="designer-sidebar agent-sidebar">
      <div className="sidebar-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "active" : ""}
            onClick={() => selectTab(t.id)}
            title={t.hint}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="sidebar-panel" ref={panelRef}>
        {tab === "templates" && (
          <AgentTemplateLibrary activeTemplateId={activeTemplateId} onApplyTemplate={onApplyTemplate} />
        )}
        {tab === "blocks" && <AgentBlockPalette />}
        {tab === "guide" && (
          <div className="workflow-guide agent-guide">
            <h2>Agent Builder guide</h2>
            <p className="palette-hint">
              Build production agents on <strong>Amazon Bedrock AgentCore</strong> — Runtime, Gateway, Memory, Identity, and Guardrails.
            </p>
            <ol className="guide-steps">
              {GUIDE_STEPS.map((s, i) => (
                <li key={i}>
                  <strong>{s.title}</strong>
                  <p>{s.detail}</p>
                </li>
              ))}
            </ol>
            {templateTips?.length > 0 && (
              <div className="guide-tips">
                <h3>Template tips</h3>
                <ul className="pattern-tip-list">
                  {templateTips.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
