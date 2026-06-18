const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

export function sortFindingsForWizard(findings = []) {
  return [...findings]
    .filter((f) => f.severity !== "info")
    .sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9));
}

export function filterFindings(findings, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return findings;
  return findings.filter(
    (f) =>
      f.title?.toLowerCase().includes(q) ||
      f.message?.toLowerCase().includes(q) ||
      f.id?.toLowerCase().includes(q) ||
      f.fix?.toLowerCase().includes(q)
  );
}

export function countActionable(findings = []) {
  return findings.filter((f) => f.severity === "critical" || f.severity === "high").length;
}
