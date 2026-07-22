import {
  applyDataHandlingPolicy,
  DATA_HANDLING_POLICY_VERSION
} from "../security/data-handling-policy.js";
import type { AgentToolDefinition } from "./tool-registry.types.js";

export type SanitizedMcpToolOutput = {
  data: unknown;
  metadata: {
    sanitized: true;
    sanitizerVersion: typeof DATA_HANDLING_POLICY_VERSION;
    redactionNotes: string;
    intentionallyExposedFieldsOnly: true;
  };
};

export function sanitizeMcpToolOutput(input: {
  data: unknown;
  tool: AgentToolDefinition | null;
}): SanitizedMcpToolOutput {
  const sanitized = applyDataHandlingPolicy({
    value: input.data,
    context: "EXTERNAL_TOOL_OUTPUT",
    mode: "OMIT_SENSITIVE_FIELDS"
  });

  return {
    data: sanitized.value,
    metadata: {
      sanitized: true,
      sanitizerVersion: DATA_HANDLING_POLICY_VERSION,
      redactionNotes:
        input.tool?.redactionNotes ??
        "Unknown tool output was sanitized using generic sensitive-field omission and content redaction.",
      intentionallyExposedFieldsOnly: true
    }
  };
}
