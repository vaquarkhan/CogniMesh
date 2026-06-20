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
        awsRegion="eu-west-1"
        onRegionChange={() => {}}
        awsReview={{ overall: { score: 90, grade: { label: "Good" }, criticalCount: 0, deployBlocked: false } }}
        awsDeployCheck={{ enabled: false, roleConfigured: false, message: "Local only" }}
        impact={{ deployBlocked: false, blastRadius: "low", recommendation: "Safe" }}
        impactLoading={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    expect(screen.getByTestId("deploy-aws-region")).toHaveValue("eu-west-1");
    fireEvent.click(screen.getByRole("button", { name: /Yes, deploy to eu-west-1/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("allows deploy with an advisory note when AWS review has criticals (never blocks)", () => {
    const onConfirm = vi.fn();
    render(
      <DeployConfirmModal
        open
        pipelineName="orders-cdc"
        awsRegion="us-east-1"
        awsReview={{ overall: { score: 40, deployBlocked: true, criticalCount: 2 } }}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />
    );
    const btn = screen.getByRole("button", { name: /Yes, deploy to us-east-1/i });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(onConfirm).toHaveBeenCalled();
    expect(screen.getByText(/advisory/i)).toBeInTheDocument();
  });
});
