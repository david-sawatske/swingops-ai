import { describe, expect, it } from "vitest";

import {
  getFieldRepairSuggestionMatrixValidationErrors,
  getGolfTermNormalizationMatrix
} from "./golf-term-normalization.js";

describe("golf term normalization matrix", () => {
  it("exposes read-only structured normalization entries", () => {
    const matrix = getGolfTermNormalizationMatrix();

    expect(matrix).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "shaft-tour-x-stiff",
          field: "shaftFlex",
          canonicalValue: "TOUR_X_STIFF",
          action: "NORMALIZE"
        }),
        expect.objectContaining({
          id: "category-utility-wood",
          field: "category",
          canonicalValue: null,
          action: "ROUTE_TO_REVIEW"
        }),
        expect.objectContaining({
          id: "negative-evidence",
          action: "BLOCK_REPAIR"
        })
      ])
    );
  });

  it("blocks shaft unknown from becoming Regular", () => {
    const errors = getFieldRepairSuggestionMatrixValidationErrors({
      fieldName: "shaftFlex",
      sourcePhrase: "shaft unknown",
      candidateValue: "REGULAR"
    });

    expect(errors.join(" ")).toContain("negative evidence");
  });

  it("blocks utility wood evidence from becoming Wedge", () => {
    const errors = getFieldRepairSuggestionMatrixValidationErrors({
      fieldName: "category",
      sourcePhrase: "UW 19 degree",
      candidateValue: "WEDGE"
    });

    expect(errors.join(" ")).toContain("utility wood evidence");
  });

  it("requires shaft-flex context for single-letter Regular evidence", () => {
    expect(
      getFieldRepairSuggestionMatrixValidationErrors({
        fieldName: "shaftFlex",
        sourcePhrase: "Ventus Blue R",
        candidateValue: "REGULAR"
      }).join(" ")
    ).toContain("single-letter R is ambiguous");

    expect(
      getFieldRepairSuggestionMatrixValidationErrors({
        fieldName: "shaftFlex",
        sourcePhrase: "shaft Ventus Blue R",
        candidateValue: "REGULAR"
      })
    ).toEqual([]);
  });
});
