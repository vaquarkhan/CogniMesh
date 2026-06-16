import { describe, it, expect } from "vitest";
import { validateAgentInstruction, BEDROCK_MIN_INSTRUCTION_LENGTH } from "./agent-instruction";

describe("validateAgentInstruction", () => {
  it("accepts descriptions meeting Bedrock minimum", () => {
    const text = "x".repeat(BEDROCK_MIN_INSTRUCTION_LENGTH);
    expect(validateAgentInstruction(text).valid).toBe(true);
  });

  it("rejects short descriptions with helpful message", () => {
    const result = validateAgentInstruction("Short agent");
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/40/);
  });
});
