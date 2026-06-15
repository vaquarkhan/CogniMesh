export default function PvdmFlowDiagram({ verdict, proofGated, compact }) {
  const steps = [
    { id: "physical", label: "Physical", sub: "Ingest + checkpoint" },
    { id: "verify", label: "Verify", sub: "SparkRules + VRP hash" },
    { id: "metadata", label: "Metadata", sub: proofGated ? "Proof-gated Iceberg commit" : "Catalog + lineage" },
  ];
  const failAt = verdict === "FAIL" ? "verify" : null;
  return (
    <div className={`pvdm-flow ${compact ? "pvdm-flow-compact" : ""}`} aria-label="PVDM flow">
      {steps.map((s, i) => (
        <div key={s.id} className="pvdm-flow-step-wrap">
          <div className={`pvdm-flow-step ${failAt === s.id ? "pvdm-fail" : verdict === "PASS" ? "pvdm-ok" : ""}`}>
            <strong>{s.label}</strong>
            {!compact && <small>{s.sub}</small>}
          </div>
          {i < steps.length - 1 && <span className="pvdm-flow-arrow">→</span>}
        </div>
      ))}
    </div>
  );
}
