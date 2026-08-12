import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { GetAdminOpsSummaryResponse } from "../../types/workflow";
import { AdminOpsOperationalBriefing } from "./AdminOpsOperationalBriefing";

const summary = {
  scope: { dataOrigin: "SEEDED_BASELINE" },
  aiReadyRecords: {
    total: 56,
    active: 48,
    superseded: 8,
    reviewNeeded: 17,
    ragReady: 31,
    missingFieldHotspots: [{ label: "conditionGrade", count: 10 }],
    sourceQuality: [
      {
        sourceType: "LOG",
        total: 10,
        active: 8,
        reviewNeeded: 6,
        groundingReady: 2,
        superseded: 2,
      },
    ],
    storeMix: [
      { label: "104", count: 21 },
      { label: "207", count: 16 },
      { label: "312", count: 11 },
    ],
  },
  workflowRuns: {
    total: 14,
    byStatus: { COMPLETED: 8, NEEDS_REVIEW: 5, FAILED: 1 },
  },
  reviewQueue: {
    total: 34,
    active: 17,
    handled: 17,
    reasonHotspots: [{ label: "MISSING_REQUIRED_FIELDS", count: 15 }],
  },
  toolActivity: {
    total: 126,
    succeeded: 124,
    successRate: 98.4,
    blockedMutations: 2,
  },
  modelExecutions: {
    fallbackCount: 2,
    executionSuccessRate: 100,
    validationTrackedCalls: 20,
    validationPassedCalls: 20,
  },
} as unknown as GetAdminOpsSummaryResponse;

describe("AdminOpsOperationalBriefing", () => {
  it("turns scoped operational metrics into a reviewer-readable narrative", () => {
    const html = renderToStaticMarkup(
      <AdminOpsOperationalBriefing
        error={null}
        isLoading={false}
        onScopeChange={() => undefined}
        scope="SEEDED_BASELINE"
        summary={summary}
      />,
    );

    expect(html).toContain("What needs attention this week?");
    expect(html).toContain("No customer activity is included.");
    expect(html).toContain("Log has the highest review pressure: 6 of 8");
    expect(html).toContain(
      "Condition Grade is the most common missing field across 10 active records.",
    );
    expect(html).toContain("2 unsafe mutation attempts were blocked");
    expect(html).toContain("Store 104");
    expect(html).toContain("21 active records");
  });
});
