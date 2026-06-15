const TYPE_ICONS = {
  vpc: "🌐",
  rds: "🗄",
  s3: "🪣",
  secrets: "🔐",
  sfn: "⚡",
  glue: "🧊",
  lf: "🏛",
  lambda: "λ",
  pvdm: "🛡",
  kafka: "📨",
  ai: "🤖",
  events: "⏰",
  audit: "📋",
};

export default function AwsTopologyMap({ topology }) {
  if (!topology?.services?.length) return null;

  return (
    <div className="aws-topology">
      <h4>AWS architecture map</h4>
      <p className="properties-hint">Live topology inferred from your canvas · Vaquar {topology.pattern}</p>
      <div className="aws-topology-grid">
        {topology.services.map((svc) => (
          <div
            key={svc.id}
            className={`aws-topology-node status-${svc.status}`}
            title={svc.label}
          >
            <span className="aws-topo-icon">{TYPE_ICONS[svc.type] || "☁"}</span>
            <span className="aws-topo-label">{svc.label}</span>
          </div>
        ))}
      </div>
      {topology.connections?.length > 0 && (
        <p className="aws-topo-flow">
          Flow: {topology.connections.slice(0, 6).map(([a, b]) => `${a}→${b}`).join(" · ")}
          {topology.connections.length > 6 ? " …" : ""}
        </p>
      )}
    </div>
  );
}
