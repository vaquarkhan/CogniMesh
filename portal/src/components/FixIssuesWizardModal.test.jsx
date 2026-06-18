import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import FixIssuesWizardModal from "./FixIssuesWizardModal";

vi.mock("../lib/api", () => ({
  getDesignReviewFixHelp: vi.fn().mockResolvedValue({
    plans: [
      {
        steps: ["Step one", "Step two"],
        fields: ["encryption"],
        propertyPatch: { encryption: "AES256" },
        nodeId: "sink-1",
      },
    ],
  }),
}));

const findings = [
  {
    id: "sec.s3_encryption.sink-1",
    severity: "critical",
    title: "S3 encryption missing",
    message: "Enable encryption on sink",
    fix: "Set AES256",
    nodeIds: ["sink-1"],
  },
  {
    id: "arch.no_source",
    severity: "high",
    title: "No source",
    message: "Add a source block",
    fix: "Drag a source",
    nodeIds: [],
  },
];

const nodes = [
  {
    id: "sink-1",
    data: { label: "Gold", blockType: "sink", targetType: "s3", location: "s3://x/" },
  },
];

describe("FixIssuesWizardModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders issue dropdown and steps", async () => {
    render(
      <FixIssuesWizardModal
        open
        onClose={() => {}}
        findings={findings}
        nodes={nodes}
        edges={[]}
        pipelineMeta={{ name: "t", domain: "d" }}
        token="tok"
        onApplyFindingFix={() => {}}
        onApplyNodeFix={() => {}}
      />
    );
    expect(screen.getByTestId("fix-issues-wizard")).toBeInTheDocument();
    expect(screen.getByTestId("fix-wizard-select")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Enable AES256 encryption/i)).toBeInTheDocument();
    });
  });

  it("filters issues by search", async () => {
    render(
      <FixIssuesWizardModal
        open
        onClose={() => {}}
        findings={findings}
        nodes={nodes}
        token="tok"
      />
    );
    fireEvent.change(screen.getByTestId("fix-wizard-search"), { target: { value: "source" } });
    await waitFor(() => {
      const select = screen.getByTestId("fix-wizard-select");
      expect(select.options.length).toBe(1);
      expect(select.options[0].text).toMatch(/No source/i);
    });
  });
});
