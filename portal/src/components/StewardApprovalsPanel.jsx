import { useEffect, useState } from "react";
import { listPendingAccessRequests, approveAccessRequest, rejectAccessRequest } from "../lib/api";

export default function StewardApprovalsPanel({ token, refreshKey }) {
  const [requests, setRequests] = useState([]);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await listPendingAccessRequests({ token });
        setRequests(data.requests || []);
      } catch {
        setRequests([]);
      }
    })();
  }, [token, refreshKey, msg]);

  return (
    <aside className="steward-panel">
      <h2>Steward approvals</h2>
      <p className="properties-hint">Approve consumer access — Lake Formation SELECT grant applied on approve.</p>
      {msg && <p className="properties-hint">{msg}</p>}
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
                  setMsg(ok ? `Approved ${r.productName} — LF grant applied` : data.error);
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
