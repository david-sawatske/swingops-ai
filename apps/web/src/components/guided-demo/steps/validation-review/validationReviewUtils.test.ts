import { describe, expect, it } from "vitest";

import { getParserEvidenceForField } from "./validationReviewUtils";

describe("getParserEvidenceForField", () => {
  it("returns exact parser evidence for a normalized field", () => {
    expect(
      getParserEvidenceForField(
        {
          parserEvidence: {
            shaftFlex: {
              value: "STIFF",
              sourceText: "shaft stiff",
            },
          },
        },
        ["shaftFlex"],
      ),
    ).toEqual({
      value: "STIFF",
      sourceText: "shaft stiff",
    });
  });

  it("does not return parser evidence without a known source phrase", () => {
    expect(
      getParserEvidenceForField(
        {
          parserEvidence: {
            shaftFlex: {
              value: "STIFF",
              sourceText: "",
            },
          },
        },
        ["shaftFlex"],
      ),
    ).toBeNull();
  });
});
