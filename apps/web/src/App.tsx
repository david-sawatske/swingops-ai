import { FormEvent, useEffect, useState } from "react";
import {
  executeEndToEndAgenticTradeInDemo,
  executeMultiSourceIntakeDemo,
  listAiReadyIntakeRecords,
  dismissReviewQueueItem,
  listWorkflowRuns,
  listReviewQueueItems,
  resolveReviewQueueItem,
  resolveReviewQueueItemWithCorrections,
} from "./api/workflows";
import type {
  ExecuteEndToEndAgenticTradeInDemoResponse,
  AiReadyIntakeRecord,
  ExecuteMultiSourceIntakeDemoRequest,
  ExecuteMultiSourceIntakeDemoResponse,
  GlobalReviewQueueItem,
  ResolveReviewQueueItemWithCorrectionsRequest,
  GlobalWorkflowRunSummary,
  ReviewQueueItem,
} from "./types/workflow";
import { type AppView } from "./constants/appNav";
import { getReviewActionFallbackNote } from "./utils/reviewQueueDisplay";
import { ReviewQueuePage } from "./components/review-queue/ReviewQueuePage";
import { GuidedDemoPathPage } from "./components/guided-demo/GuidedDemoPathPage";
import { type GuidedStep } from "./components/guided-demo/guidedWorkflowSteps";
import { formatGuidedWorkflowInputFromSourceResult } from "./components/guided-demo/formatGuidedWorkflowInput";
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
  const [endToEndAgenticDemoRawInput, setEndToEndAgenticDemoRawInput] = useState(
    "",
  );
  const [endToEndAgenticDemoResult, setEndToEndAgenticDemoResult] =
    useState<ExecuteEndToEndAgenticTradeInDemoResponse | null>(null);
  const [isRunningEndToEndAgenticDemo, setIsRunningEndToEndAgenticDemo] =
    useState(false);
  const [endToEndAgenticDemoError, setEndToEndAgenticDemoError] = useState<
    string | null
  >(null);
  const [endToEndAgenticDemoSuccess, setEndToEndAgenticDemoSuccess] = useState<
    string | null
  >(null);

  const [multiSourceIntakeDemoResult, setMultiSourceIntakeDemoResult] =
    useState<ExecuteMultiSourceIntakeDemoResponse | null>(null);
  const [persistedAiReadyIntakeRecords, setPersistedAiReadyIntakeRecords] =
    useState<AiReadyIntakeRecord[]>([]);
  const [currentRunAiReadyIntakeRecords, setCurrentRunAiReadyIntakeRecords] =
    useState<AiReadyIntakeRecord[]>([]);
  const [isRunningMultiSourceIntakeDemo, setIsRunningMultiSourceIntakeDemo] =
    useState(false);
  const [multiSourceIntakeDemoError, setMultiSourceIntakeDemoError] = useState<
    string | null
  >(null);
  const [multiSourceIntakeDemoSuccess, setMultiSourceIntakeDemoSuccess] =
    useState<string | null>(null);

  const openReviewQueueItemCount = globalReviewQueueItems.filter(
    (item) => item.status === "OPEN" || item.status === "IN_REVIEW",
  ).length;
  const totalToolCallLogCount = globalWorkflowRuns.reduce(
    (count, run) => count + run.totalToolCallLogCount,
    0,
  );

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

  async function loadCurrentRunAiReadyIntakeRecords(
    workflowRunId: string | null | undefined,
  ) {
    if (!workflowRunId) {
      setCurrentRunAiReadyIntakeRecords([]);
      return;
    }

    const response = await listAiReadyIntakeRecords({
      workflowRunId,
      limit: 100,
    });

    setCurrentRunAiReadyIntakeRecords(response.records);
  }

  function resetGuidedRunState() {
    setGuidedActiveStep("MESSY_SOURCE_INTAKE");
    setMultiSourceIntakeDemoResult(null);
    setPersistedAiReadyIntakeRecords([]);
    setCurrentRunAiReadyIntakeRecords([]);
    setEndToEndAgenticDemoResult(null);
    setEndToEndAgenticDemoRawInput("");
    setMultiSourceIntakeDemoError(null);
    setMultiSourceIntakeDemoSuccess(null);
    setEndToEndAgenticDemoError(null);
    setEndToEndAgenticDemoSuccess(null);
    setReviewQueueActionError(null);
    setReviewQueueActionSuccess(null);
    setActiveReviewQueueItemId(null);
    setReviewQueueNotesById({});
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

  async function handleExecuteEndToEndAgenticDemo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsRunningEndToEndAgenticDemo(true);
      setEndToEndAgenticDemoResult(null);
      setEndToEndAgenticDemoError(null);
      setEndToEndAgenticDemoSuccess(null);
      setCurrentRunAiReadyIntakeRecords([]);
      setReviewQueueActionError(null);
      setReviewQueueActionSuccess(null);
      setActiveReviewQueueItemId(null);
      setReviewQueueNotesById({});

      const generatedTradeInRawInput = multiSourceIntakeDemoResult
        ? formatGuidedWorkflowInputFromSourceResult(multiSourceIntakeDemoResult, {
            includeMissingFields: true,
          })
        : "";

      const result = await executeEndToEndAgenticTradeInDemo({
        rawInput: endToEndAgenticDemoRawInput.trim() || generatedTradeInRawInput,
      });

      setEndToEndAgenticDemoResult(result);
      await loadCurrentRunAiReadyIntakeRecords(result.persisted.workflowRunId);
      setEndToEndAgenticDemoSuccess(
        "Demo created workflow " +
          result.persisted.workflowRunId +
          ": " +
          result.finalSummary.parsedItemCount +
          " parsed, " +
          result.finalSummary.knowledgeMatchCount +
          " RAG matches, " +
          result.finalSummary.reviewQueueItemCount +
          " review items, " +
          result.finalSummary.blockedMutationToolCallCount +
          " mutation blocked.",
      );

      await loadGlobalWorkflowRuns();
      await loadGlobalReviewQueueItems();
    } catch (error) {
      setEndToEndAgenticDemoError(
        error instanceof Error
          ? error.message
          : "Unable to run end-to-end agentic trade-in demo.",
      );
    } finally {
      setIsRunningEndToEndAgenticDemo(false);
    }
  }

  async function handleRunMultiSourceIntakeDemo(
    request: ExecuteMultiSourceIntakeDemoRequest = {},
  ) {
    try {
      setIsRunningMultiSourceIntakeDemo(true);
      setMultiSourceIntakeDemoResult(null);
      setPersistedAiReadyIntakeRecords([]);
      setCurrentRunAiReadyIntakeRecords([]);
      setEndToEndAgenticDemoResult(null);
      setMultiSourceIntakeDemoError(null);
      setMultiSourceIntakeDemoSuccess(null);
      setEndToEndAgenticDemoError(null);
      setEndToEndAgenticDemoSuccess(null);
      setReviewQueueActionError(null);
      setReviewQueueActionSuccess(null);
      setActiveReviewQueueItemId(null);
      setReviewQueueNotesById({});

      const result = await executeMultiSourceIntakeDemo(request);
      const persistedRecordsResponse = await listAiReadyIntakeRecords({
        workflowRunId: result.persistedIds.workflowRunId,
        limit: result.recordsExtracted,
      });

      setMultiSourceIntakeDemoResult(result);
      setPersistedAiReadyIntakeRecords(persistedRecordsResponse.records);

      const generatedTradeInRawInput = formatGuidedWorkflowInputFromSourceResult(
        result,
        {
          includeMissingFields: true,
        },
      );

      setEndToEndAgenticDemoRawInput(generatedTradeInRawInput);
      setEndToEndAgenticDemoResult(null);
      setCurrentRunAiReadyIntakeRecords([]);
      setEndToEndAgenticDemoSuccess(null);
      setEndToEndAgenticDemoError(null);

      setMultiSourceIntakeDemoSuccess(
        "Persisted " +
          persistedRecordsResponse.count +
          " AI-ready records from " +
          result.sourcesProcessed +
          " source types into " +
          result.recordsExtracted +
          " normalized records, " +
          result.assetsCreated +
          " AI-ready asset summaries, and " +
          result.reviewNeeded +
          " review signals.",
      );

      await loadGlobalWorkflowRuns();
      await loadGlobalReviewQueueItems();
    } catch (error) {
      setMultiSourceIntakeDemoResult(null);
      setPersistedAiReadyIntakeRecords([]);
      setCurrentRunAiReadyIntakeRecords([]);
      setEndToEndAgenticDemoResult(null);
      setMultiSourceIntakeDemoError(
        error instanceof Error
          ? error.message
          : "Unable to run multi-source intake demo.",
      );
    } finally {
      setIsRunningMultiSourceIntakeDemo(false);
    }
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

      await loadGlobalWorkflowRuns();
      await loadGlobalReviewQueueItems();

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
        setPersistedAiReadyIntakeRecords((current) => {
          const exists = current.some(
            (record) => record.id === response.aiReadyIntakeRecord?.id,
          );

          if (!exists) {
            return [...current, response.aiReadyIntakeRecord!];
          }

          return current.map((record) =>
            record.id === response.aiReadyIntakeRecord?.id
              ? response.aiReadyIntakeRecord!
              : record,
          );
        });

        setCurrentRunAiReadyIntakeRecords((current) => {
          const exists = current.some(
            (record) => record.id === response.aiReadyIntakeRecord?.id,
          );

          if (!exists) {
            return [...current, response.aiReadyIntakeRecord!];
          }

          return current.map((record) =>
            record.id === response.aiReadyIntakeRecord?.id
              ? response.aiReadyIntakeRecord!
              : record,
          );
        });
      }

      await loadCurrentRunAiReadyIntakeRecords(
        input.workflowRunId ?? response.reviewQueueItem.workflowRunId,
      );

      await loadGlobalWorkflowRuns();
      await loadGlobalReviewQueueItems();


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
