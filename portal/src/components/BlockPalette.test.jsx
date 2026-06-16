import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import BlockPalette from "./BlockPalette";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ token: null }),
}));

vi.mock("../lib/platform-api", () => ({
  listPlugins: vi.fn().mockResolvedValue({ blocks: [] }),
}));

describe("BlockPalette", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders workflow blocks heading and integrity gate item", () => {
    render(<BlockPalette />);
    expect(screen.getByText("Workflow blocks")).toBeInTheDocument();
    expect(screen.getByText(/Integrity Gate/i)).toBeInTheDocument();
  });
});
