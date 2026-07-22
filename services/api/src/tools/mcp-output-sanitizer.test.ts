import { describe, expect, it } from "vitest";

import { sanitizeMcpToolOutput } from "./mcp-output-sanitizer.js";

describe("MCP output sanitizer", () => {
  it("omits classified fields and redacts sensitive content recursively", () => {
    const result = sanitizeMcpToolOutput({
      tool: null,
      data: {
        id: "record-1",
        promptTokens: 42,
        accessToken: "private-access-token",
        records: [
          {
            summary:
              "Contact customer@example.com or 612-555-0101 for follow-up.",
            api_key: "private-provider-key",
          },
        ],
      },
    });

    expect(result).toEqual({
      data: {
        id: "record-1",
        promptTokens: 42,
        records: [
          {
            summary:
              "Contact [REDACTED:EMAIL_ADDRESS] or [REDACTED:PHONE_NUMBER] for follow-up.",
          },
        ],
      },
      metadata: {
        sanitized: true,
        sanitizerVersion: "2026-07-21",
        redactionNotes:
          "Unknown tool output was sanitized using generic sensitive-field omission and content redaction.",
        intentionallyExposedFieldsOnly: true,
      },
    });
  });
});
