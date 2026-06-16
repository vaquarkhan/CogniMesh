import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DeployConfirmModal from "./DeployConfirmModal";

describe("DeployConfirmModal", () => {
  it("calls onConfirm when deploy is allowed", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <DeployConfirmModal
        open
        pipelineName="orders-cdc"
        awsReview={{ overall: { score: 90, grade: { label: "Good" }, criticalCount: 0, deployBlocked: false } }}
        awsDeployCheck={{ enabled: false, roleConfigured: false, message: "Local only" }}
        impact={{ deployBlocked: false, blastRadius: "low", recommendation: "Safe" }}
        impactLoading={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Yes, deploy/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("blocks confirm when AWS review is critical", () => {
    const onConfirm = vi.fn();
    render(
      <DeployConfirmModal
        open
        pipelineName="orders-cdc"
        awsReview={{ overall: { score: 40, deployBlocked: true, criticalCount: 2 } }}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />
    );
    const btn = screen.getByRole("button", { name: /Fix issues first/i });
    expect(btn).toBeDisabled();
  });
});
