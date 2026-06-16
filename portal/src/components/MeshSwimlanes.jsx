import { MESH_SWIMLANES } from "../lib/patterns/mesh-constants";

export default function MeshSwimlanes() {
  return (
    <div className="mesh-swimlanes" aria-hidden>
      {MESH_SWIMLANES.map((lane) => (
        <div key={lane.id} className={`mesh-swimlane mesh-lane-${lane.id}`}>
          <span className="mesh-swimlane-label">
            {lane.label} · AC …{lane.accountId.slice(-4)} · {lane.region}
          </span>
        </div>
      ))}
    </div>
  );
}
