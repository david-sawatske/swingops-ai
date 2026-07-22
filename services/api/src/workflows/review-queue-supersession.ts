import { prisma } from "../lib/prisma.js";

import type { ParsedTradeInDemoItem } from "./trade-in-demo-parser.js";

function normalizeReviewSourceText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/^\s*\d+\s*[).:-]\s*/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export async function resolveSupersededIntakeReviewMarkers(input: {
  authoritativeReviewQueueItemId: string;
  currentWorkflowRunId: string;
  item: ParsedTradeInDemoItem;
  sourceRowNumber: number;
}) {
  const normalizedSourceText = normalizeReviewSourceText(input.item.rawLine);

  if (!normalizedSourceText) {
    return 0;
  }

  const upstreamReviewItems = await prisma.reviewQueueItem.findMany({
    where: {
      id: {
        not: input.authoritativeReviewQueueItemId,
      },
      workflowRunId: {
        not: input.currentWorkflowRunId,
      },
      status: {
        in: ["OPEN", "IN_REVIEW"],
      },
    },
    include: {
      workflowRun: true,
      intakeItem: true,
    },
  });

  const matchingReviewItemIds = upstreamReviewItems
    .filter((reviewItem) => {
      return (
        reviewItem.workflowRun?.workflowName === "multi-source-intake-demo" &&
        reviewItem.intakeItem?.sourceRowNumber === input.sourceRowNumber &&
        normalizeReviewSourceText(reviewItem.originalText) ===
          normalizedSourceText
      );
    })
    .map((reviewItem) => reviewItem.id);

  if (matchingReviewItemIds.length === 0) {
    return 0;
  }

  const affectedWorkflowRunIds = [
    ...new Set(
      upstreamReviewItems
        .filter((reviewItem) => matchingReviewItemIds.includes(reviewItem.id))
        .map((reviewItem) => reviewItem.workflowRunId)
        .filter((workflowRunId): workflowRunId is string =>
          Boolean(workflowRunId),
        ),
    ),
  ];

  const result = await prisma.reviewQueueItem.updateMany({
    where: {
      id: {
        in: matchingReviewItemIds,
      },
    },
    data: {
      status: "SUPERSEDED",
      supersededByReviewQueueItemId: input.authoritativeReviewQueueItemId,
      supersededAt: new Date(),
      supersededReason: `Superseded by guarded workflow review item ${input.authoritativeReviewQueueItemId}.`,
    },
  });

  for (const workflowRunId of affectedWorkflowRunIds) {
    const remainingOpenReviewCount = await prisma.reviewQueueItem.count({
      where: {
        workflowRunId,
        status: {
          in: ["OPEN", "IN_REVIEW"],
        },
      },
    });

    if (remainingOpenReviewCount === 0) {
      await prisma.workflowRun.update({
        where: {
          id: workflowRunId,
        },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });
    }
  }

  return result.count;
}
