import { useEffect, useState } from "react";
import {
  dismissReviewQueueItem,
  listWorkflowRuns,
  listReviewQueueItems,
  resolveReviewQueueItem,
  resolveReviewQueueItemWithCorrections,
} from "./api/workflows";
import type {
  GlobalReviewQueueItem,
  ResolveReviewQueueItemWithCorrectionsRequest,
  GlobalWorkflowRunSummary,
} from "./types/workflow";
import { type AppView } from "./constants/appNav";
import { getReviewActionFallbackNote } from "./utils/reviewQueueDisplay";
import { ReviewQueuePage } from "./components/review-queue/ReviewQueuePage";
import { GuidedDemoPathPage } from "./components/guided-demo/GuidedDemoPathPage";
import { type GuidedStep } from "./components/guided-demo/guidedWorkflowSteps";
import { useGuidedWorkflowRun } from "./hooks/useGuidedWorkflowRun";
import { AppHeroNav } from "./components/layout/AppHeroNav";

function App() {
  const [activeView, setActiveView] = useState<AppView>("GUIDED_DEMO");
  const [guidedActiveStep, setGuidedActiveStep] = useState<GuidedStep>("MESSY_SOURCE_INTAKE");
  const [globalWorkflowRuns, setGlobalWorkflowRuns] = useState<
    GlobalWorkflowRunSummary[]
  >([]);
  const [isLoadingGlobalWorkflowRuns, setIsLoadingGlobalWorkflowRuns] =
    useState(true);
  const [globalWorkflowRunsError, setGlobalWorkflowRunsError] = useState<
    string | null
  >(null);
  const [globalReviewQueueItems, setGlobalReviewQueueItems] = useState<
    GlobalReviewQueueItem[]
  >([]);
  const [isLoadingGlobalReviewQueue, setIsLoadingGlobalReviewQueue] =
    useState(true);
  const [globalReviewQueueError, setGlobalReviewQueueError] = useState<
    string | null
  >(null);

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
  const openReviewQueueItemCount = globalReviewQueueItems.filter(
    (item) => item.status === "OPEN" || item.status === "IN_REVIEW",
  ).length;
  const totalToolCallLogCount = globalWorkflowRuns.reduce(
    (count, run) => count + run.totalToolCallLogCount,
    0,
  );

  const {
    endToEndAgenticDemoRawInput,
    setEndToEndAgenticDemoRawInput,
    endToEndAgenticDemoResult,
    isRunningEndToEndAgenticDemo,
    endToEndAgenticDemoError,
    endToEndAgenticDemoSuccess,
    multiSourceIntakeDemoResult,
    persistedAiReadyIntakeRecords,
    currentRunAiReadyIntakeRecords,
    isRunningMultiSourceIntakeDemo,
    multiSourceIntakeDemoError,
    multiSourceIntakeDemoSuccess,
    handleExecuteEndToEndAgenticDemo,
    handleRunMultiSourceIntakeDemo,
    refreshCurrentRunAiReadyIntakeRecords,
    resetGuidedRunState: resetGuidedWorkflowRunState,
    upsertAiReadyIntakeRecord,
  } = useGuidedWorkflowRun({
    refreshWorkflowData,
    resetReviewQueueActionState,
  });

  async function loadGlobalWorkflowRuns() {
    try {
      setIsLoadingGlobalWorkflowRuns(true);
      setGlobalWorkflowRunsError(null);

      const response = await listWorkflowRuns();

      setGlobalWorkflowRuns(response.workflowRuns);
    } catch (error) {
      setGlobalWorkflowRunsError(
        error instanceof Error
          ? error.message
          : "Unable to load workflow runs.",
      );
    } finally {
      setIsLoadingGlobalWorkflowRuns(false);
    }
  }

  async function loadGlobalReviewQueueItems() {
    try {
      setIsLoadingGlobalReviewQueue(true);
      setGlobalReviewQueueError(null);

      const response = await listReviewQueueItems();

      setGlobalReviewQueueItems(response.reviewQueueItems);
    } catch (error) {
      setGlobalReviewQueueError(
        error instanceof Error
          ? error.message
          : "Unable to load review queue items.",
      );
    } finally {
      setIsLoadingGlobalReviewQueue(false);
    }
  }

  function resetReviewQueueActionState() {
    setReviewQueueActionError(null);
    setReviewQueueActionSuccess(null);
    setActiveReviewQueueItemId(null);
    setReviewQueueNotesById({});
  }

  async function refreshWorkflowData() {
    await loadGlobalWorkflowRuns();
    await loadGlobalReviewQueueItems();
  }

  function resetGuidedRunState() {
    setGuidedActiveStep("MESSY_SOURCE_INTAKE");
    resetGuidedWorkflowRunState();
  }

  useEffect(() => {
    void loadGlobalWorkflowRuns();
    void loadGlobalReviewQueueItems();
  }, []);

  function handleReviewQueueNotesChange(
    reviewQueueItemId: string,
    reviewerNotes: string,
  ) {
    setReviewQueueNotesById((current) => ({
      ...current,
      [reviewQueueItemId]: reviewerNotes,
    }));
  }

  async function handleReviewQueueItemAction(input: {
    reviewQueueItemId: string;
    action: "resolve" | "dismiss";
    workflowRunId?: string | null;
    intakeBatchId?: string | null;
  }) {
    const reviewerNotes =
      reviewQueueNotesById[input.reviewQueueItemId]?.trim() ||
      getReviewActionFallbackNote(input.action);

    try {
      setActiveReviewQueueItemId(input.reviewQueueItemId);
      setReviewQueueActionError(null);
      setReviewQueueActionSuccess(null);

      if (input.action === "resolve") {
        await resolveReviewQueueItem(input.reviewQueueItemId, {
          reviewerNotes,
        });
      } else {
        await dismissReviewQueueItem(input.reviewQueueItemId, {
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
          : "Review queue item dismissed.",
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

  async function handleResolveReviewQueueItemWithCorrections(input: {
    reviewQueueItemId: string;
    request: ResolveReviewQueueItemWithCorrectionsRequest;
    workflowRunId?: string | null;
    intakeBatchId?: string | null;
  }) {
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

  return (
    <main className="app-shell">
      <AppHeroNav />

      {activeView !== "GUIDED_DEMO" ? (
        <section className="guided-return-panel">
          <button onClick={() => setActiveView("GUIDED_DEMO")} type="button">
            ← Back to Guided Workflow
          </button>
        </section>
      ) : null}

      {activeView === "GUIDED_DEMO" ? (
        <GuidedDemoPathPage
          sourceIntakeResult={multiSourceIntakeDemoResult}
          sourceIntakeError={multiSourceIntakeDemoError}
          sourceIntakeSuccess={multiSourceIntakeDemoSuccess}
          sourceIntakePersistedRecords={persistedAiReadyIntakeRecords}
          currentRunAiReadyRecords={currentRunAiReadyIntakeRecords}
          isRunningSourceIntake={isRunningMultiSourceIntakeDemo}
          tradeInRawInput={endToEndAgenticDemoRawInput}
          tradeInResult={endToEndAgenticDemoResult}
          tradeInError={endToEndAgenticDemoError}
          tradeInSuccess={endToEndAgenticDemoSuccess}
          isRunningTradeInWorkflow={isRunningEndToEndAgenticDemo}
          workflowRuns={globalWorkflowRuns}
          reviewQueueItems={globalReviewQueueItems}
          openReviewQueueItemCount={openReviewQueueItemCount}
          toolCallLogCount={totalToolCallLogCount}
          onTradeInRawInputChange={setEndToEndAgenticDemoRawInput}
          onRunSourceIntake={handleRunMultiSourceIntakeDemo}
          onRunTradeInWorkflow={handleExecuteEndToEndAgenticDemo}
          onViewChange={setActiveView}
          reviewQueueActionSuccess={reviewQueueActionSuccess}
          reviewQueueActionError={reviewQueueActionError}
          activeReviewQueueItemId={activeReviewQueueItemId}
          reviewQueueNotesById={reviewQueueNotesById}
          onReviewQueueNotesChange={handleReviewQueueNotesChange}
          onReviewQueueItemAction={(input) =>
            void handleReviewQueueItemAction(input)
          }
          onResolveReviewQueueItemWithCorrections={(input) =>
            void handleResolveReviewQueueItemWithCorrections(input)
          }
          onResetGuidedRun={resetGuidedRunState}
          activeStep={guidedActiveStep}
          onActiveStepChange={setGuidedActiveStep}
        />
      ) : null}

      {activeView === "REVIEW_QUEUE" ? (
        <ReviewQueuePage
          items={globalReviewQueueItems}
          openReviewQueueItemCount={openReviewQueueItemCount}
          isLoading={isLoadingGlobalReviewQueue}
          error={globalReviewQueueError}
          actionSuccess={reviewQueueActionSuccess}
          actionError={reviewQueueActionError}
          activeReviewQueueItemId={activeReviewQueueItemId}
          reviewQueueNotesById={reviewQueueNotesById}
          onNotesChange={handleReviewQueueNotesChange}
          onReviewQueueItemAction={(input) =>
            void handleReviewQueueItemAction(input)
          }
        />
      ) : null}

    </main>
  );
}

export default App;
