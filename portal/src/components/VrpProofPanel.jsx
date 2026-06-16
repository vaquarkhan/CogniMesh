import PvdmFlowDiagram from "./PvdmFlowDiagram";
import { s3ConsoleUrl } from "../lib/s3-console";

export default function VrpProofPanel({ pvdmSummary, vaquar, aws }) {
  if (!pvdmSummary && !vaquar) {
    return <p className="properties-hint">Deploy a Vaquar/PVDM pipeline to see VRP proof details.</p>;
  }

  const summary = pvdmSummary || {};
  const verdict = summary.vrpVerdict || "UNKNOWN";

  return (
    <div className="vrp-proof-panel">
      <div className="vrp-proof-header">
        <span className={`vrp-badge ${verdict === "PASS" ? "vrp-pass" : verdict === "FAIL" ? "vrp-fail" : "vrp-unknown"}`}>
          VRP {verdict}
        </span>
        {summary.proofGated && <span className="proof-gated-tag">🛡 Proof-gated Iceberg commit</span>}
      </div>

      <PvdmFlowDiagram verdict={verdict} proofGated={summary.proofGated} />

      <dl className="proof-dl vrp-proof-dl">
        <dt>PVDM outcome</dt>
        <dd>{summary.pvdmOutcome || summary.message || "-"}</dd>
        <dt>Quality policy</dt>
        <dd>{summary.qualityPolicyId || "-"}</dd>
        <dt>Rows processed</dt>
        <dd>{summary.rowsProcessed ?? "-"}</dd>
        <dt>Rows written</dt>
        <dd>{summary.rowsWritten ?? "-"}</dd>
        <dt>Rows dropped (SparkRules)</dt>
        <dd className={summary.rowsDropped > 0 ? "rows-dropped" : ""}>{summary.rowsDropped ?? 0}</dd>
        <dt>Iceberg snapshot</dt>
        <dd><code>{summary.icebergSnapshotId || "-"}</code></dd>
        <dt>Proof artifact (S3)</dt>
        <dd>
          {summary.proofS3Uri ? (
            <>
              <code className="proof-link">{summary.proofS3Uri}</code>
              {s3ConsoleUrl(summary.proofS3Uri) && (
                <a href={s3ConsoleUrl(summary.proofS3Uri)} target="_blank" rel="noreferrer" className="aws-console-link">
                  Open proof in S3 ↗
                </a>
              )}
            </>
          ) : "-"}
        </dd>
        <dt>Checkpoint (S3)</dt>
        <dd>
          {summary.checkpointS3Uri ? (
            <>
              <code className="proof-link">{summary.checkpointS3Uri}</code>
              {s3ConsoleUrl(summary.checkpointS3Uri) && (
                <a href={s3ConsoleUrl(summary.checkpointS3Uri)} target="_blank" rel="noreferrer" className="aws-console-link">
                  Open checkpoint in S3 ↗
                </a>
              )}
            </>
          ) : "-"}
        </dd>
      </dl>

      {aws?.executionStatus && (
        <div className="vrp-aws-block">
          <h4>AWS Step Functions</h4>
          <p>
            Status: <span className={`aws-status aws-${aws.executionStatus.status}`}>{aws.executionStatus.status}</span>
          </p>
          {aws.execution?.executionArn && (
            <code className="proof-link">{aws.execution.executionArn}</code>
          )}
          {aws.executionStatus.consoleUrl && (
            <a href={aws.executionStatus.consoleUrl} target="_blank" rel="noreferrer" className="aws-console-link">
              Open execution in AWS Console ↗
            </a>
          )}
        </div>
      )}

      {vaquar?.phases?.length > 0 && (
        <p className="properties-hint">Vaquar phases: {vaquar.phases.join(" → ")}</p>
      )}
    </div>
  );
}
