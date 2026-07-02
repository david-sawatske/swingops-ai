import { type FormEvent, useState } from "react";

import {
  executeEndToEndAgenticTradeInDemo,
  executeMultiSourceIntakeDemo,
  listAiReadyIntakeRecords,
} from "../api/workflows";
import { formatGuidedWorkflowInputFromSourceResult } from "../components/guided-demo/formatGuidedWorkflowInput";
import type {
  AiReadyIntakeRecord,
  ExecuteEndToEndAgenticTradeInDemoResponse,
  ExecuteMultiSourceIntakeDemoRequest,
  ExecuteMultiSourceIntakeDemoResponse,
} from "../types/workflow";

type UseGuidedWorkflowRunOptions = {
  refreshWorkflowData: () => Promise<void>;
  resetReviewQueueActionState: () => void;
};

function upsertRecord(
  records: AiReadyIntakeRecord[],
  nextRecord: AiReadyIntakeRecord,
) {
  const exists = records.some((record) => record.id === nextRecord.id);

  if (!exists) {
    return [...records, nextRecord];
  }

  return records.map((record) =>
    record.id === nextRecord.id ? nextRecord : record,
  );
}

export function useGuidedWorkflowRun({
  refreshWorkflowData,
  resetReviewQueueActionState,
}: UseGuidedWorkflowRunOptions) {
  const [endToEndAgenticDemoRawInput, setEndToEndAgenticDemoRawInput] =
    useState("");
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

  async function refreshCurrentRunAiReadyIntakeRecords(
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

  function upsertAiReadyIntakeRecord(record: AiReadyIntakeRecord) {
    setPersistedAiReadyIntakeRecords((current) => upsertRecord(current, record));
    setCurrentRunAiReadyIntakeRecords((current) => upsertRecord(current, record));
  }

  function resetGuidedRunState() {
    setMultiSourceIntakeDemoResult(null);
    setPersistedAiReadyIntakeRecords([]);
    setCurrentRunAiReadyIntakeRecords([]);
    setEndToEndAgenticDemoResult(null);
    setEndToEndAgenticDemoRawInput("");
    setMultiSourceIntakeDemoError(null);
    setMultiSourceIntakeDemoSuccess(null);
    setEndToEndAgenticDemoError(null);
    setEndToEndAgenticDemoSuccess(null);
    resetReviewQueueActionState();
  }

  async function handleExecuteEndToEndAgenticDemo(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setIsRunningEndToEndAgenticDemo(true);
      setEndToEndAgenticDemoResult(null);
      setEndToEndAgenticDemoError(null);
      setEndToEndAgenticDemoSuccess(null);
      setCurrentRunAiReadyIntakeRecords([]);
      resetReviewQueueActionState();

      const generatedTradeInRawInput = multiSourceIntakeDemoResult
        ? formatGuidedWorkflowInputFromSourceResult(multiSourceIntakeDemoResult, {
            includeMissingFields: true,
          })
        : "";

      const result = await executeEndToEndAgenticTradeInDemo({
        rawInput: endToEndAgenticDemoRawInput.trim() || generatedTradeInRawInput,
      });

      setEndToEndAgenticDemoResult(result);
      await refreshCurrentRunAiReadyIntakeRecords(result.persisted.workflowRunId);
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

      await refreshWorkflowData();
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
      resetReviewQueueActionState();

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

      await refreshWorkflowData();
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

  return {
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
    resetGuidedRunState,
    upsertAiReadyIntakeRecord,
  };
}
