import { describe, expect, it } from "vitest";

import { getRecentModelEvidenceEmptyMessage } from "./AdminOpsModelTelemetryPanel";

describe("AdminOpsModelTelemetryPanel", () => {
  it("does not tell baseline reviewers to create data that already exists", () => {
    expect(getRecentModelEvidenceEmptyMessage("SEEDED_BASELINE")).toContain(
      "complete synthetic baseline",
    );
    expect(getRecentModelEvidenceEmptyMessage("SEEDED_BASELINE")).not.toContain(
      "Run the main workflow",
    );
  });

  it("gives live scopes an actionable empty state", () => {
    expect(getRecentModelEvidenceEmptyMessage("LIVE_DEMO")).toContain(
      "Run the main workflow",
    );
  });
});
