import type { AgentToolDefinition } from "./tool-registry.types.js";

export type SanitizedMcpToolOutput = {
  data: unknown;
  metadata: {
    sanitized: true;
    sanitizerVersion: "2026-06-06";
    redactionNotes: string;
    intentionallyExposedFieldsOnly: true;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !isInternalOnlyKey(key))
      .map(([key, nestedValue]) => [key, sanitizeValue(nestedValue)])
  );
}

function isInternalOnlyKey(key: string): boolean {
  const normalizedKey = key.toLowerCase();

  return (
    normalizedKey.includes("password") ||
    normalizedKey.includes("secret") ||
    normalizedKey.includes("token") ||
    normalizedKey.includes("apikey") ||
    normalizedKey.includes("api_key") ||
    normalizedKey.includes("authorization")
  );
}

export function sanitizeMcpToolOutput(input: {
  data: unknown;
  tool: AgentToolDefinition | null;
}): SanitizedMcpToolOutput {
  return {
    data: sanitizeValue(input.data),
    metadata: {
      sanitized: true,
      sanitizerVersion: "2026-06-06",
      redactionNotes:
        input.tool?.redactionNotes ??
        "Unknown tool output was sanitized using generic internal-only key filtering.",
      intentionallyExposedFieldsOnly: true
    }
  };
}
