import { useEffect, useState } from "react";
import { listWorkflowRuns, listReviewQueueItems } from "./api/workflows";
import type {
  GlobalReviewQueueItem,
  GlobalWorkflowRunSummary,
} from "./types/workflow";
import { APP_NAV_ITEMS, type AppView } from "./constants/appNav";
import { ReviewQueuePage } from "./components/review-queue/ReviewQueuePage";
import { AdminOpsDashboardPage } from "./components/admin/AdminOpsDashboardPage";
import { GuidedDemoPathPage } from "./components/guided-demo/GuidedDemoPathPage";
import { type GuidedStep } from "./components/guided-demo/guidedWorkflowSteps";
import { useGuidedWorkflowRun } from "./hooks/useGuidedWorkflowRun";
import { useReviewQueueActions } from "./hooks/useReviewQueueActions";
import { AppHeroNav } from "./components/layout/AppHeroNav";

function AppModeTabs({
  activeView,
  onViewChange,
}: {
  activeView: AppView;
  onViewChange: (view: AppView) => void;
}) {
  return (
    <nav className="app-mode-tabs" aria-label="Application mode">
      {APP_NAV_ITEMS.map((item) => (
        <button
          aria-pressed={activeView === item.view}
          className={
            activeView === item.view
              ? "app-mode-tabs__button app-mode-tabs__button--active"
              : "app-mode-tabs__button"
          }
          key={item.view}
          onClick={() => onViewChange(item.view)}
          type="button"
        >
          <span>{item.eyebrow}</span>
          <strong>{item.label}</strong>
        </button>
      ))}
    </nav>
  );
}

function App() {
  const [activeView, setActiveView] = useState<AppView>("GUIDED_DEMO");
  const [reviewQueueReturnView, setReviewQueueReturnView] =
    useState<Exclude<AppView, "REVIEW_QUEUE">>("GUIDED_DEMO");
  const [focusedReviewQueueIntakeItemId, setFocusedReviewQueueIntakeItemId] =
    useState<string | null>(null);
  const [guidedActiveStep, setGuidedActiveStep] = useState<GuidedStep>(
    "MESSY_SOURCE_INTAKE",
  );
  const [globalWorkflowRuns, setGlobalWorkflowRuns] = useState<
    GlobalWorkflowRunSummary[]
  >([]);
  const [, setIsLoadingGlobalWorkflowRuns] = useState(true);
  const [, setGlobalWorkflowRunsError] = useState<string | null>(null);
  const [globalReviewQueueItems, setGlobalReviewQueueItems] = useState<
    GlobalReviewQueueItem[]
  >([]);
  const [isLoadingGlobalReviewQueue, setIsLoadingGlobalReviewQueue] =
    useState(true);
  const [globalReviewQueueError, setGlobalReviewQueueError] = useState<
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
  });

  const {
    activeReviewQueueItemId,
    reviewQueueNotesById,
    reviewQueueActionError,
    reviewQueueActionSuccess,
    resetReviewQueueActionState,
    handleReviewQueueNotesChange,
    handleReviewQueueItemAction,
    handleResolveReviewQueueItemWithCorrections,
  } = useReviewQueueActions({
    refreshWorkflowData,
    refreshCurrentRunAiReadyIntakeRecords,
    upsertAiReadyIntakeRecord,
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

  async function refreshWorkflowData() {
    await loadGlobalWorkflowRuns();
    await loadGlobalReviewQueueItems();
  }

  function resetGuidedRunState() {
    setGuidedActiveStep("MESSY_SOURCE_INTAKE");
    resetGuidedWorkflowRunState();
    resetReviewQueueActionState();
  }

  function handleRunGuidedSourceIntake(
    request?: Parameters<typeof handleRunMultiSourceIntakeDemo>[0],
  ) {
    resetReviewQueueActionState();
    void handleRunMultiSourceIntakeDemo(request);
  }

  function handleRunGuidedTradeInWorkflow(
    event: Parameters<typeof handleExecuteEndToEndAgenticDemo>[0],
  ) {
    resetReviewQueueActionState();
    void handleExecuteEndToEndAgenticDemo(event);
  }

  function openReviewQueue(
    returnView: Exclude<AppView, "REVIEW_QUEUE">,
    intakeItemId: string | null = null,
  ) {
    setReviewQueueReturnView(returnView);
    setFocusedReviewQueueIntakeItemId(intakeItemId);
    setActiveView("REVIEW_QUEUE");
  }

  function returnFromReviewQueue() {
    setFocusedReviewQueueIntakeItemId(null);
    setActiveView(reviewQueueReturnView);
  }

  useEffect(() => {
    void loadGlobalWorkflowRuns();
    void loadGlobalReviewQueueItems();
  }, []);

  return (
    <main className="app-shell">
      <AppHeroNav />

      {activeView !== "REVIEW_QUEUE" ? (
        <AppModeTabs activeView={activeView} onViewChange={setActiveView} />
      ) : null}

      {activeView === "REVIEW_QUEUE" ? (
        <section className="guided-return-panel">
          <button onClick={returnFromReviewQueue} type="button">
            ← Back to{" "}
            {reviewQueueReturnView === "ADMIN_OPS"
              ? "Admin Ops"
              : "Main Workflow"}
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
          onRunSourceIntake={handleRunGuidedSourceIntake}
          onRunTradeInWorkflow={handleRunGuidedTradeInWorkflow}
          onViewChange={(view) => {
            if (view === "REVIEW_QUEUE") {
              openReviewQueue("GUIDED_DEMO");
              return;
            }

            setActiveView(view);
          }}
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

      {activeView === "ADMIN_OPS" ? (
        <AdminOpsDashboardPage
          workflowRuns={globalWorkflowRuns}
          workflowRunCount={globalWorkflowRuns.length}
          openReviewQueueItemCount={openReviewQueueItemCount}
          toolCallLogCount={totalToolCallLogCount}
          onOpenReviewQueueForRecord={(intakeItemId) =>
            openReviewQueue("ADMIN_OPS", intakeItemId)
          }
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
          focusedIntakeItemId={focusedReviewQueueIntakeItemId}
          reviewQueueNotesById={reviewQueueNotesById}
          onReturnToSource={returnFromReviewQueue}
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
