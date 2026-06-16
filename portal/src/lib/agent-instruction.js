export const BEDROCK_MIN_INSTRUCTION_LENGTH = 40;

export function validateAgentInstruction(text) {
  const trimmed = (text || "").trim();
  if (trimmed.length >= BEDROCK_MIN_INSTRUCTION_LENGTH) {
    return { valid: true, message: null };
  }
  return {
    valid: false,
    message: `Description must be at least ${BEDROCK_MIN_INSTRUCTION_LENGTH} characters for Bedrock CreateAgent (${trimmed.length}/${BEDROCK_MIN_INSTRUCTION_LENGTH}).`,
  };
}
