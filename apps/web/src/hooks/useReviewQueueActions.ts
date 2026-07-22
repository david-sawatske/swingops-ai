import { useState } from "react";

import {
  dismissReviewQueueItem,
  resolveReviewQueueItem,
  resolveReviewQueueItemWithCorrections,
  routeReviewQueueItemForInspection,
} from "../api/workflows";
import type {
  AiReadyIntakeRecord,
  ResolveReviewQueueItemWithCorrectionsRequest,
} from "../types/workflow";
import { getReviewActionFallbackNote } from "../utils/reviewQueueDisplay";

type UseReviewQueueActionsOptions = {
  refreshWorkflowData: () => Promise<void>;
  refreshCurrentRunAiReadyIntakeRecords: (
    workflowRunId: string | null | undefined,
  ) => Promise<void>;
  upsertAiReadyIntakeRecord: (record: AiReadyIntakeRecord) => void;
};

type ReviewQueueItemActionInput = {
  reviewQueueItemId: string;
  action: "resolve" | "dismiss" | "inspect";
  workflowRunId?: string | null;
  intakeBatchId?: string | null;
};

type ResolveReviewQueueItemWithCorrectionsInput = {
  reviewQueueItemId: string;
  request: ResolveReviewQueueItemWithCorrectionsRequest;
  workflowRunId?: string | null;
  intakeBatchId?: string | null;
};

export function useReviewQueueActions({
  refreshWorkflowData,
  refreshCurrentRunAiReadyIntakeRecords,
  upsertAiReadyIntakeRecord,
}: UseReviewQueueActionsOptions) {
  const [activeReviewQueueItemId, setActiveReviewQueueItemId] = useState<
    string | null
  >(null);
  const [reviewQueueNotesById, setReviewQueueNotesById] = useState<
    Record<string, string>
  >({});
  const [reviewQueueActionError, setReviewQueueActionError] = useState<
    string | null
  >(null);
  const [reviewQueueActionSuccess, setReviewQueueActionSuccess] = useState<
    string | null
  >(null);

  function resetReviewQueueActionState() {
    setReviewQueueActionError(null);
    setReviewQueueActionSuccess(null);
    setActiveReviewQueueItemId(null);
    setReviewQueueNotesById({});
  }

  function handleReviewQueueNotesChange(
    reviewQueueItemId: string,
    reviewerNotes: string,
  ) {
    setReviewQueueNotesById((current) => ({
      ...current,
      [reviewQueueItemId]: reviewerNotes,
    }));
  }

  async function handleReviewQueueItemAction(
    input: ReviewQueueItemActionInput,
  ) {
    const reviewerNotes =
      reviewQueueNotesById[input.reviewQueueItemId]?.trim() ||
      (input.action === "inspect"
        ? "Store inspection required because the available evidence could not verify the product identity or required trade-in details."
        : getReviewActionFallbackNote(input.action));

    try {
      setActiveReviewQueueItemId(input.reviewQueueItemId);
      setReviewQueueActionError(null);
      setReviewQueueActionSuccess(null);

      if (input.action === "resolve") {
        await resolveReviewQueueItem(input.reviewQueueItemId, {
          reviewerNotes,
        });
      } else if (input.action === "dismiss") {
        await dismissReviewQueueItem(input.reviewQueueItemId, {
          reviewerNotes,
        });
      } else {
        await routeReviewQueueItemForInspection(input.reviewQueueItemId, {
          reviewerNotes,
        });
      }

      await refreshWorkflowData();

      setReviewQueueNotesById((current) => {
        const next = { ...current };
        delete next[input.reviewQueueItemId];

        return next;
      });
      setReviewQueueActionSuccess(
        input.action === "resolve"
          ? "Review queue item resolved."
          : input.action === "dismiss"
            ? "Review queue item dismissed."
            : "Store inspection requested. The review item remains open.",
      );
    } catch (error) {
      setReviewQueueActionError(
        error instanceof Error
          ? error.message
          : "Unable to update review queue item.",
      );
    } finally {
      setActiveReviewQueueItemId(null);
    }
  }

  async function handleResolveReviewQueueItemWithCorrections(
    input: ResolveReviewQueueItemWithCorrectionsInput,
  ) {
    try {
      setActiveReviewQueueItemId(input.reviewQueueItemId);
      setReviewQueueActionError(null);
      setReviewQueueActionSuccess(null);

      const response = await resolveReviewQueueItemWithCorrections(
        input.reviewQueueItemId,
        input.request,
      );

      if (response.aiReadyIntakeRecord) {
        upsertAiReadyIntakeRecord(response.aiReadyIntakeRecord);
      }

      await refreshCurrentRunAiReadyIntakeRecords(
        input.workflowRunId ?? response.reviewQueueItem.workflowRunId,
      );

      await refreshWorkflowData();

      setReviewQueueNotesById((current) => {
        const next = { ...current };
        delete next[input.reviewQueueItemId];

        return next;
      });
      setReviewQueueActionSuccess(
        "Review queue item resolved with structured corrections.",
      );
    } catch (error) {
      setReviewQueueActionError(
        error instanceof Error
          ? error.message
          : "Unable to resolve review queue item with structured corrections.",
      );
    } finally {
      setActiveReviewQueueItemId(null);
    }
  }

  return {
    activeReviewQueueItemId,
    reviewQueueNotesById,
    reviewQueueActionError,
    reviewQueueActionSuccess,
    resetReviewQueueActionState,
    handleReviewQueueNotesChange,
    handleReviewQueueItemAction,
    handleResolveReviewQueueItemWithCorrections,
  };
}
