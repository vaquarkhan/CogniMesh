import { describe, it, expect } from "vitest";
import { sortFindingsForWizard, filterFindings } from "./fix-wizard-findings";

describe("fix-wizard-findings", () => {
  it("sorts critical before high", () => {
    const sorted = sortFindingsForWizard([
      { id: "a", severity: "high", title: "H" },
      { id: "b", severity: "critical", title: "C" },
    ]);
    expect(sorted[0].severity).toBe("critical");
  });

  it("filters by search text", () => {
    const items = [
      { id: "1", severity: "high", title: "RDS secret", message: "x" },
      { id: "2", severity: "low", title: "Other", message: "encryption" },
    ];
    expect(filterFindings(items, "encryption")).toHaveLength(1);
  });
});
