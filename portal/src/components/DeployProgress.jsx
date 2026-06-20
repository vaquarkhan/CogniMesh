import { useEffect, useRef, useState } from "react";
import { getExecutionStatus } from "../lib/api";

const TERMINAL = new Set(["SUCCEEDED", "FAILED", "TIMED_OUT", "ABORTED"]);

export default function DeployProgress({ deploying, result, token }) {
  const [animStage, setAnimStage] = useState(0);
  const [execStatus, setExecStatus] = useState(null);
  const timerRef = useRef(null);
  const arn = result?.aws?.execution?.executionArn;
  const deployedOk = result?.aws?.deployed === true;
  const deployFailed = result && result.status === "error";

  useEffect(() => {
    if (deploying) {
      setAnimStage(0);
      setExecStatus(null);
      timerRef.current = setInterval(() => {
        setAnimStage((s) => Math.min(s + 1, 2));
      }, 700);
      return () => clearInterval(timerRef.current);
    }
    clearInterval(timerRef.current);
  }, [deploying]);

  useEffect(() => {
    setExecStatus(result?.aws?.executionStatus || null);
    if (!arn || !token) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const s = await getExecutionStatus({ token, executionArn: arn });
        if (!cancelled) setExecStatus(s);
        if (s && TERMINAL.has(s.status)) return true;
      } catch { /* keep last */ }
      return false;
    };
    (async () => {
      if (await poll()) return;
      const id = setInterval(async () => {
        if (await poll()) clearInterval(id);
      }, 4000);
      timerRef.current = id;
    })();
    return () => { cancelled = true; clearInterval(timerRef.current); };
  }, [arn, token, result]);

  if (!deploying && !result) return null;

  const execState = execStatus?.status;
  const stages = [
    { key: "validate", label: "Validate & integrity gate" },
    { key: "compile", label: "Compile Step Functions" },
    { key: "provision", label: "Create state machine in AWS" },
    { key: "execute", label: "Run pipeline (live)" },
  ];

  function stateFor(i) {
    if (deploying) return i <= animStage ? "active" : "pending";
    if (deployFailed) {
      if (i < 3) return result?.stage === "vrp_verification" || deployedOk ? "done" : i === 0 ? "error" : "pending";
      return "pending";
    }
    if (i < 3) return "done";
    if (!arn) return deployedOk ? "done" : "pending";
    if (execState === "SUCCEEDED") return "done";
    if (execState && execState !== "RUNNING") return "error";
    return "active";
  }

  const pct = (() => {
    if (deploying) return 25 + animStage * 15;
    if (deployFailed) return 100;
    if (!arn) return deployedOk ? 100 : 60;
    if (execState === "SUCCEEDED") return 100;
    if (execState && execState !== "RUNNING") return 100;
    return 85;
  })();

  const barClass = deployFailed || (execState && execState !== "RUNNING" && execState !== "SUCCEEDED")
    ? "deploy-progress-bar-error"
    : execState === "SUCCEEDED" || (!deploying && deployedOk && !arn)
      ? "deploy-progress-bar-done"
      : "deploy-progress-bar-active";

  const headline = deploying
    ? "Deploying…"
    : deployFailed
      ? "Deploy blocked"
      : execState === "SUCCEEDED"
        ? "Pipeline run succeeded ✓"
        : execState === "RUNNING"
          ? "Pipeline running in AWS…"
          : execState && execState !== "RUNNING"
            ? `Execution ${execState}`
            : deployedOk
              ? "Deployed to AWS"
              : "Compiled locally";

  return (
    <div className="deploy-progress">
      <div className="deploy-progress-head">
        <strong>{headline}</strong>
        {execStatus?.consoleUrl && (
          <a href={execStatus.consoleUrl} target="_blank" rel="noreferrer" className="deploy-progress-link">
            View execution in AWS ↗
          </a>
        )}
      </div>
      <div className="deploy-progress-track">
        <div className={`deploy-progress-bar ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
      <ol className="deploy-progress-steps">
        {stages.map((s, i) => {
          const st = stateFor(i);
          const icon = st === "done" ? "✓" : st === "error" ? "✕" : st === "active" ? "●" : "○";
          return (
            <li key={s.key} className={`deploy-step deploy-step-${st}`}>
              <span className="deploy-step-icon">{icon}</span>
              <span className="deploy-step-label">{s.label}</span>
              {i === 3 && arn && execState && (
                <span className="deploy-step-status"> · {execState}</span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
