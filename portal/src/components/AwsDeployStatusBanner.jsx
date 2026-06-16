import { useEffect, useState } from "react";
import { getExecutionStatus } from "../lib/api";
import { stepFunctionsStateMachineConsoleUrl } from "../lib/aws-console-urls";

const TERMINAL = new Set(["SUCCEEDED", "FAILED", "TIMED_OUT", "ABORTED"]);

export default function AwsDeployStatusBanner({ aws, token, onStatusChange }) {
  const arn = aws?.execution?.executionArn;
  const [status, setStatus] = useState(aws?.executionStatus || null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    setStatus(aws?.executionStatus || null);
  }, [aws?.executionStatus]);

  useEffect(() => {
    if (!arn || !token) return;
    if (status && TERMINAL.has(status.status)) return;

    let cancelled = false;
    setPolling(true);

    const poll = async () => {
      try {
        const s = await getExecutionStatus({ token, executionArn: arn });
        if (!cancelled) {
          setStatus(s);
          onStatusChange?.(s);
        }
      } catch {
        /* keep last status */
      }
    };

    poll();
    const id = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
      setPolling(false);
    };
  }, [arn, token, status?.status, onStatusChange]);

  if (!aws) return null;
  if (aws.deployed === undefined && !aws.reason && !aws.error) return null;

  const isWarning = !aws.deployed;

  return (
    <div
      className={`aws-deploy-banner ${isWarning ? "aws-deploy-banner-warn" : ""} ${status?.status ? `aws-banner-${status.status}` : ""}`}
    >
      <strong>{aws.deployed ? "AWS deploy" : "AWS deploy skipped"}</strong>
      {isWarning && (
        <>
          <p className="aws-deploy-banner-msg">{aws.error || aws.reason || "Local compile only"}</p>
          {aws.hint && (
            <p className="properties-hint">
              Fix: <code>{aws.hint}</code>
            </p>
          )}
        </>
      )}
      {aws.deployed && (
        <>
          <p>
            State machine: <code>{aws.stateMachineName || "deployed"}</code>
          </p>
          {arn && status && (
            <p>
              Execution: <span className={`aws-status aws-${status.status}`}>{status.status}</span>
              {polling && !TERMINAL.has(status.status) && <span className="aws-polling"> · live polling…</span>}
            </p>
          )}
          {status?.consoleUrl && (
            <a href={status.consoleUrl} target="_blank" rel="noreferrer" className="aws-console-link">
              Open execution in AWS Step Functions Console ↗
            </a>
          )}
          {!arn && aws.stateMachineArn && (
            <a
              href={stepFunctionsStateMachineConsoleUrl(aws.stateMachineArn)}
              target="_blank"
              rel="noreferrer"
              className="aws-console-link"
            >
              Open state machine in AWS Console ↗
            </a>
          )}
          {!arn && !aws.stateMachineArn && (
            <p className="properties-hint">Set AWS_DEPLOY_EXECUTE=true to start an execution and poll live status.</p>
          )}
        </>
      )}
    </div>
  );
}
