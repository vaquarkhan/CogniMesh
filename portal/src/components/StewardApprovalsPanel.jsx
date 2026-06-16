import { useEffect, useState } from "react";
import { listPendingAccessRequests, approveAccessRequest, rejectAccessRequest } from "../lib/api";
import { listDeployApprovals, approveDeployRequest, rejectDeployRequest } from "../lib/platform-api";

export default function StewardApprovalsPanel({ token, refreshKey, onCatalogRefresh }) {
  const [requests, setRequests] = useState([]);
  const [deployApprovals, setDeployApprovals] = useState([]);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await listPendingAccessRequests({ token });
        setRequests(data.requests || []);
      } catch {
        setRequests([]);
      }
      try {
        const dep = await listDeployApprovals(token);
        setDeployApprovals(dep.pending || []);
      } catch {
        setDeployApprovals([]);
      }
    })();
  }, [token, refreshKey, msg]);

  return (
    <aside className="steward-panel">
      <h2>Steward approvals</h2>
      <p className="properties-hint">Approve consumer access and pipeline deploys (when DEPLOY_APPROVAL_REQUIRED=true).</p>
      {msg && <p className="properties-hint">{msg}</p>}

      <h3 className="steward-section-title">Pipeline deploys</h3>
      {deployApprovals.length === 0 && (
        <p className="properties-hint">No pending deploy approvals.</p>
      )}
      <ul className="steward-list">
        {deployApprovals.map((r) => (
          <li key={r.id} className="steward-card">
            <div className="steward-product">{r.pipelineName}</div>
            <div className="steward-meta">{r.userEmail || r.userId} · {r.domain} · v{r.version}</div>
            <div className="steward-actions">
              <button
                type="button"
                className="deploy-btn compact"
                onClick={async () => {
                  try {
                    const data = await approveDeployRequest(token, r.id);
                    if (!data) {
                      setMsg("Deploy approval API unavailable");
                      return;
                    }
                    setMsg(
                      data.status === "success"
                        ? `Deployed ${r.pipelineName} after approval`
                        : data.errors?.[0] || "Deploy failed after approval"
                    );
                    if (data.status === "success") onCatalogRefresh?.();
                  } catch (e) {
                    setMsg(e.message);
                  }
                }}
              >
                Approve deploy
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={async () => {
                  try {
                    await rejectDeployRequest(token, r.id, "Rejected by steward");
                    setMsg("Deploy rejected");
                  } catch (e) {
                    setMsg(e.message);
                  }
                }}
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>

      <h3 className="steward-section-title">Consumer access</h3>
      {requests.length === 0 && <p className="properties-hint">No pending access requests.</p>}
      <ul className="steward-list">
        {requests.map((r) => (
          <li key={r.id} className="steward-card">
            <div className="steward-product">{r.productName || r.productId}</div>
            <div className="steward-meta">{r.userEmail || r.userId} · {r.domain}</div>
            <p className="steward-reason">{r.reason}</p>
            <div className="steward-actions">
              <button
                type="button"
                className="deploy-btn compact"
                onClick={async () => {
                  const { ok, data } = await approveAccessRequest({ token, requestId: r.id });
                  setMsg(
                    ok
                      ? `Approved ${r.productName} - LF ${data.record?.lakeFormationGrant?.permission || "SELECT"}: ${data.record?.lakeFormationGrant?.note || "granted"}`
                      : data.error
                  );
                }}
              >
                Approve
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={async () => {
                  const { ok, data } = await rejectAccessRequest({ token, requestId: r.id });
                  setMsg(ok ? "Request rejected" : data.error);
                }}
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
