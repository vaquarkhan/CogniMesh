import { WORKFLOW_STEPS } from "../lib/pipeline-patterns";

export default function WorkflowGuide({ currentStep, patternTips }) {
  const stepIndex = WORKFLOW_STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="workflow-guide">
      <h3>How to build a pipeline</h3>
      <ol className="workflow-steps">
        {WORKFLOW_STEPS.map((step, i) => {
          const state = i < stepIndex ? "done" : i === stepIndex ? "current" : "upcoming";
          return (
            <li key={step.id} className={`workflow-step workflow-step-${state}`}>
              <span className="workflow-step-num">{i + 1}</span>
              <div>
                <strong>{step.title}</strong>
                {state === "current" && <p>{step.detail}</p>}
              </div>
            </li>
          );
        })}
      </ol>

      {patternTips?.length > 0 && (
        <div className="pattern-active-tips">
          <h4>Next steps for this pattern</h4>
          <ul>
            {patternTips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="properties-hint workflow-tutorial-link">
        Customize pipelines: <code>docs/developer/CUSTOMIZE_PIPELINES.md</code> · Tutorials: <code>docs/tutorials/README.md</code>
      </p>
    </div>
  );
}
