import { useEffect, useState } from "react";
import { getExecutionStatus } from "../lib/api";

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

  if (!aws?.deployed && !aws?.executionStatus && !aws?.reason) return null;

  return (
    <div className={`aws-deploy-banner ${status?.status ? `aws-banner-${status.status}` : ""}`}>
      <strong>AWS deploy</strong>
      {!aws?.deployed && (
        <p className="properties-hint">{aws?.reason || aws?.error || "Local compile only - set AWS_DEPLOY_ENABLED=true"}</p>
      )}
      {aws?.deployed && (
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
              Open in AWS Step Functions Console ↗
            </a>
          )}
          {!arn && aws.deployed && (
            <p className="properties-hint">Set AWS_DEPLOY_EXECUTE=true to start an execution and poll live status.</p>
          )}
        </>
      )}
    </div>
  );
}
