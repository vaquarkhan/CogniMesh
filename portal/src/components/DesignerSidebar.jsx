import { useState } from "react";
import PatternLibrary from "./PatternLibrary";
import BlockPalette from "./BlockPalette";
import WorkflowGuide from "./WorkflowGuide";

const TABS = [
  { id: "patterns", label: "Patterns", hint: "Start here" },
  { id: "blocks", label: "Blocks", hint: "Customize" },
  { id: "guide", label: "Guide", hint: "Help" },
];

export default function DesignerSidebar({
  activePatternId,
  workflowStep,
  patternTips,
  onApplyPattern,
}) {
  const [tab, setTab] = useState("patterns");

  return (
    <aside className="designer-sidebar">
      <div className="sidebar-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
            title={t.hint}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="sidebar-panel">
        {tab === "patterns" && (
          <PatternLibrary activePatternId={activePatternId} onApplyPattern={onApplyPattern} />
        )}
        {tab === "blocks" && <BlockPalette />}
        {tab === "guide" && (
          <WorkflowGuide currentStep={workflowStep} patternTips={patternTips} />
        )}
      </div>
    </aside>
  );
}
