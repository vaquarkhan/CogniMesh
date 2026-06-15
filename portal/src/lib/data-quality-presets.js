/** Data quality policy presets — map to spec.transform.pvdm.qualityPolicyId */

export const QUALITY_POLICIES = [
  {
    id: "strict-zero-drop",
    label: "Strict (zero drop tolerance)",
    description: "Reject rows with null identity keys. VRP must PASS before Iceberg commit.",
  },
  {
    id: "compatible-nulls",
    label: "Compatible (nullable keys)",
    description: "Allow nullable identity fields; still run VRP on non-null rows.",
  },
  {
    id: "audit-only",
    label: "Audit only",
    description: "Log quality violations but do not filter rows at runtime.",
  },
];

export const SCHEMA_EVOLUTION_POLICIES = [
  { id: "compatible", label: "Compatible", description: "Allow new nullable columns; reject removed columns." },
  { id: "strict", label: "Strict", description: "Reject any schema change without a version bump." },
  { id: "ignore", label: "Ignore", description: "Do not block deploy on schema drift (dev only)." },
];

export function qualityPolicyLabel(id) {
  return QUALITY_POLICIES.find((p) => p.id === id)?.label || id;
}
