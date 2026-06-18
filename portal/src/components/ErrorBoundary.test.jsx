import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ErrorBoundary from "./ErrorBoundary";

function Boom() {
  throw new Error("panel exploded");
}

describe("ErrorBoundary", () => {
  it("renders fallback when child throws", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary name="Test panel">
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Test panel failed");
    expect(screen.getByText("panel exploded")).toBeInTheDocument();
    spy.mockRestore();
  });
});
