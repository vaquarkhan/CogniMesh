import { useState } from "react";
import PatternLibrary from "./PatternLibrary";
import BlockPalette from "./BlockPalette";
import WorkflowGuide from "./WorkflowGuide";
import AiPipelineBuilder from "./AiPipelineBuilder";

const TABS = [
  { id: "ai", label: "AI Builder", hint: "Describe your pipeline in English" },
  { id: "patterns", label: "Architectures", hint: "Data Mesh, Lakehouse, Kappa, Lambda, Glue, Kinesis" },
  { id: "blocks", label: "AWS Blocks", hint: "Glue, Kinesis, MSK, DMS, ETL/ELT transforms" },
  { id: "guide", label: "Guide", hint: "Help" },
];

export default function DesignerSidebar({
  activePatternId,
  workflowStep,
  patternTips,
  onApplyPattern,
  token,
}) {
  const [tab, setTab] = useState("ai");

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
        {tab === "ai" && <AiPipelineBuilder token={token} onApplyPattern={onApplyPattern} />}
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
