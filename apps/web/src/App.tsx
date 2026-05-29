import { FormEvent, useEffect, useState } from "react";
import { previewModelRouting } from "./api/modelRouting";
import {
  executeReadOnlyToolInvocation,
  listConnectorCatalog,
  listConnectorInvocationHistory,
} from "./api/mcp";
import {
  createIntakeBatch,
  getIntakeBatch,
  listIntakeBatches,
} from "./api/intakeBatches";
import {
  dismissReviewQueueItem,
  executeWorkflowRun,
  executeWorkflowToolCallingPlan,
  getWorkflowRun,
  listWorkflowRuns,
  listReviewQueueItems,
  resolveReviewQueueItem,
  startWorkflowForIntakeBatch,
} from "./api/workflows";
import { DashboardSection } from "./components/DashboardSection";
import { EmptyState } from "./components/EmptyState";
import type {
  ConnectorCatalogItem,
  ConnectorInvocationHistoryItem,
  ExecuteReadOnlyToolInvocationResponse,
} from "./types/mcp";
import type {
  ModelRouteCandidateSummary,
  ModelRouteRejectedCandidate,
  ModelRoutingGoal,
  ModelTaskType,
  PreviewModelRoutingResponse,
} from "./types/ai";
import type {
  IntakeBatchDetail,
  IntakeBatchSourceType,
  IntakeBatchSummary,
} from "./types/intake";
import type {
  GlobalReviewQueueItem,
  ExecuteWorkflowToolCallingPlanResponse,
  GlobalWorkflowRunSummary,
  ModelCallLog,
  ReviewQueueItem,
  ToolCallLog,
  WorkflowExecutionScenario,
  WorkflowRunDetail,
  WorkflowRunStatus,
} from "./types/workflow";
import { buildCreateIntakeBatchRequest } from "./utils/intakeForm";
import {
  formatIntakeBatchSourceType,
  formatIntakeBatchStatus,
} from "./utils/intakeLabels";

type WorkflowRunStatusFilter = "ALL" | WorkflowRunStatus;

type AppView =
  | "OVERVIEW"
  | "INTAKE"
  | "WORKFLOW_RUNS"
  | "REVIEW_QUEUE"
  | "MODEL_ROUTING"
  | "MCP_CONNECTORS";

type AppNavItem = {
  view: AppView;
  label: string;
  eyebrow: string;
};

const APP_NAV_ITEMS: AppNavItem[] = [
  {
    view: "OVERVIEW",
    label: "Overview",
    eyebrow: "Product story",
  },
  {
    view: "INTAKE",
    label: "Intake",
    eyebrow: "Messy notes",
  },
  {
    view: "WORKFLOW_RUNS",
    label: "Workflow Runs",
    eyebrow: "Orchestration",
  },
  {
    view: "REVIEW_QUEUE",
    label: "Review Queue",
    eyebrow: "Human-in-loop",
  },
  {
    view: "MODEL_ROUTING",
    label: "Model Routing",
    eyebrow: "Cost / latency / quality",
  },
  {
    view: "MCP_CONNECTORS",
    label: "MCP Connectors",
    eyebrow: "Tool safety",
  },
];

const MODEL_TASK_TYPES: ModelTaskType[] = [
  "INTAKE_PARSING",
  "FIELD_NORMALIZATION",
  "VALIDATION",
  "REVIEW_SUMMARY",
];

const MODEL_ROUTING_GOALS: ModelRoutingGoal[] = [
  "LOW_COST",
  "LOW_LATENCY",
  "HIGH_QUALITY",
  "LOCAL_ONLY",
];

const WORKFLOW_RUN_STATUS_FILTERS: WorkflowRunStatusFilter[] = [
  "ALL",
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "NEEDS_REVIEW",
  "FAILED",
  "CANCELLED",
];

type ReadOnlyMcpToolName =
  | "swingops.clubReference.search"
  | "swingops.workflowRuns.list"
  | "swingops.workflowRuns.get"
  | "swingops.reviewQueueItems.list"
  | "swingops.intakeBatches.list"
  | "swingops.reviewQueueItems.resolve";

type ReadOnlyMcpToolDemoOption = {
  name: ReadOnlyMcpToolName;
  label: string;
  description: string;
  category: "INTAKE" | "WORKFLOW" | "REVIEW_QUEUE";
  riskLevel: "LOW" | "HIGH";
  enabled: boolean;
  mutatesData: boolean;
  requiresHumanApproval: boolean;
  blockedDemo: boolean;
};

const READ_ONLY_MCP_TOOL_OPTIONS: ReadOnlyMcpToolDemoOption[] = [
  {
    name: "swingops.clubReference.search",
    label: "Search club reference",
    description:
      "Reads a local golf club reference dataset to ground ambiguous trade-in notes before human review.",
    category: "WORKFLOW",
    riskLevel: "LOW",
    enabled: true,
    mutatesData: false,
    requiresHumanApproval: false,
    blockedDemo: false,
  },
  {
    name: "swingops.workflowRuns.list",
    label: "List workflow runs",
    description: "Reads workflow run summaries from internal SwingOps data.",
    category: "WORKFLOW",
    riskLevel: "LOW",
    enabled: true,
    mutatesData: false,
    requiresHumanApproval: false,
    blockedDemo: false,
  },
  {
    name: "swingops.reviewQueueItems.list",
    label: "List review queue items",
    description: "Reads human-review queue items without changing their status.",
    category: "REVIEW_QUEUE",
    riskLevel: "LOW",
    enabled: true,
    mutatesData: false,
    requiresHumanApproval: false,
    blockedDemo: false,
  },
  {
    name: "swingops.intakeBatches.list",
    label: "List intake batches",
    description: "Reads imported golf trade-in intake batches.",
    category: "INTAKE",
    riskLevel: "LOW",
    enabled: true,
    mutatesData: false,
    requiresHumanApproval: false,
    blockedDemo: false,
  },
  {
    name: "swingops.workflowRuns.get",
    label: "Get workflow run detail",
    description:
      "Reads one workflow run with steps, model logs, tool logs, and review items.",
    category: "WORKFLOW",
    riskLevel: "LOW",
    enabled: true,
    mutatesData: false,
    requiresHumanApproval: false,
    blockedDemo: false,
  },
  {
    name: "swingops.reviewQueueItems.resolve",
    label: "Blocked demo: resolve review item",
    description:
      "Mutation tool intentionally blocked by the read-only connector surface.",
    category: "REVIEW_QUEUE",
    riskLevel: "HIGH",
    enabled: false,
    mutatesData: true,
    requiresHumanApproval: true,
    blockedDemo: true,
  },
];

function formatEnumLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function formatEnabledLabel(value: boolean): string {
  return value ? "Enabled" : "Disabled";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getStringField(
  record: Record<string, unknown> | null,
  fieldName: string,
): string {
  if (!record) {
    return "—";
  }

  const value = record[fieldName];

  return typeof value === "string" ? value : "—";
}

function getRoutingDecision(
  modelCallLog: ModelCallLog | null,
): Record<string, unknown> | null {
  if (!modelCallLog || !isRecord(modelCallLog.responseJson)) {
    return null;
  }

  const routingDecision = modelCallLog.responseJson.routingDecision;

  return isRecord(routingDecision) ? routingDecision : null;
}

function getRoutingGoal(modelCallLog: ModelCallLog | null): string {
  if (!modelCallLog || !isRecord(modelCallLog.requestJson)) {
    return "—";
  }

  const routingGoal = modelCallLog.requestJson.routingGoal;

  return typeof routingGoal === "string" ? routingGoal : "—";
}

function getBooleanField(
  record: Record<string, unknown> | null,
  fieldName: string,
): string {
  if (!record) {
    return "—";
  }

  const value = record[fieldName];

  return typeof value === "boolean" ? String(value) : "—";
}

function getStringListField(
  record: Record<string, unknown> | null,
  fieldName: string,
): string {
  if (!record) {
    return "—";
  }

  const value = record[fieldName];

  if (!Array.isArray(value)) {
    return "—";
  }

  const strings = value.filter((item): item is string => typeof item === "string");

  return strings.length > 0 ? strings.join(", ") : "—";
}

function getToolCallOutputJson(
  toolCallLog: ToolCallLog,
): Record<string, unknown> | null {
  return isRecord(toolCallLog.outputJson) ? toolCallLog.outputJson : null;
}

function getConnectorResultData(
  toolCallLog: ToolCallLog,
): Record<string, unknown> | null {
  const outputJson = getToolCallOutputJson(toolCallLog);
  const connectorResult = isRecord(outputJson?.connectorResult)
    ? outputJson.connectorResult
    : null;
  const data = isRecord(connectorResult?.data) ? connectorResult.data : null;

  return data;
}

function isGroundingToolCallLog(toolCallLog: ToolCallLog): boolean {
  return toolCallLog.toolName === "swingops.clubReference.search";
}

function getClubReferenceSearchData(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  const clubReferenceSearch = value.clubReferenceSearch;

  return isRecord(clubReferenceSearch) ? clubReferenceSearch : null;
}

function getGroundingSummaryFromToolCall(toolCallLog: ToolCallLog): string {
  const data = getConnectorResultData(toolCallLog);
  const clubReferenceSearch = getClubReferenceSearchData(data);
  const summary = clubReferenceSearch?.summary;

  return typeof summary === "string" ? summary : "No grounding summary returned.";
}

function getGroundingSummaryFromReviewItem(item: ReviewQueueItem): string | null {
  if (!isRecord(item.proposedGolfClubJson)) {
    return null;
  }

  const grounding = item.proposedGolfClubJson.grounding;

  if (!isRecord(grounding)) {
    return null;
  }

  return typeof grounding.summary === "string" ? grounding.summary : null;
}

function getGroundingMatchNamesFromReviewItem(item: ReviewQueueItem): string {
  if (!isRecord(item.proposedGolfClubJson)) {
    return "—";
  }

  const grounding = item.proposedGolfClubJson.grounding;

  if (!isRecord(grounding) || !Array.isArray(grounding.matches)) {
    return "—";
  }

  const names = grounding.matches
    .filter(isRecord)
    .map((match) => {
      const brand = typeof match.brand === "string" ? match.brand : null;
      const model = typeof match.model === "string" ? match.model : null;

      return brand && model ? `${brand} ${model}` : null;
    })
    .filter((name): name is string => Boolean(name));

  return names.length > 0 ? names.join(", ") : "—";
}

function isAuditOnlyToolCallLog(toolCallLog: ToolCallLog): boolean {
  const outputJson = getToolCallOutputJson(toolCallLog);

  return outputJson?.previewOnly === true;
}

function formatToolCallTimestamp(value: string | null): string {
  return value ?? "—";
}

function formatJson(value: unknown): string {
  if (value === null || value === undefined) {
    return "No proposed golf club data captured.";
  }

  return JSON.stringify(value, null, 2);
}

function formatConnectorJson(value: unknown): string {
  if (value === null || value === undefined) {
    return "No connector result returned.";
  }

  return JSON.stringify(value, null, 2);
}

function getNeedsReviewWorkflowRunSummary(count: number): string {
  if (count === 0) {
    return "No workflow runs currently need review.";
  }

  if (count === 1) {
    return "1 workflow run currently needs review.";
  }

  return `${count} workflow runs currently need review.`;
}

function getWorkflowRunSourcePreview(run: GlobalWorkflowRunSummary): string {
  return run.intakeItem?.rawText ?? "No item-level source preview captured yet.";
}

function formatShortId(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  return value.length <= 14 ? value : `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function getGlobalReviewQueueDisplayText(item: GlobalReviewQueueItem): string {
  return (
    item.originalText ??
    item.intakeItem?.rawText ??
    "No original text captured."
  );
}

function getWorkflowReviewQueueDisplayText(
  item: ReviewQueueItem,
  rawItems: { rawText: string }[] | undefined,
): string {
  if (item.originalText) {
    return item.originalText;
  }

  if (rawItems?.length === 1) {
    return rawItems[0].rawText;
  }

  return "Review source context: see raw intake items above. This simulated review item does not store item-level original text yet.";
}

function getReadOnlyMcpToolInput(
  toolName: ReadOnlyMcpToolName,
  workflowRunId: string,
): unknown {
  if (toolName === "swingops.clubReference.search") {
    return {
      query:
        "Titleist TSR3 fairway wood, 15 degree, stiff shaft. Customer wrote TSR maybe TS2.",
    };
  }

  if (toolName === "swingops.workflowRuns.get") {
    return {
      id: workflowRunId,
    };
  }

  if (toolName === "swingops.reviewQueueItems.resolve") {
    return {
      id: "blocked-demo-review-item",
      reviewerNotes: "Blocked demo only. Mutations are disabled on this surface.",
    };
  }

  return {};
}

function getReviewActionFallbackNote(action: "resolve" | "dismiss") {
  return action === "resolve"
    ? "Resolved during human review."
    : "Dismissed during human review.";
}

function getReviewQueueItemBatchId(item: GlobalReviewQueueItem): string | null {
  return item.intakeBatch?.id ?? item.workflowRun?.intakeBatchId ?? null;
}

function ModelRouteCard({
  modelCallLog,
  title = "Model Route Logged",
}: {
  modelCallLog: ModelCallLog;
  title?: string;
}) {
  const routingDecision = getRoutingDecision(modelCallLog);
  const routingGoal = getRoutingGoal(modelCallLog);

  return (
    <article className="model-route-card">
      <div>
        <span className="model-route-card__eyebrow">{title}</span>
        <h4>
          {modelCallLog.provider} / {modelCallLog.model}
        </h4>
        <p>Mock model call recorded for workflow run {modelCallLog.workflowRunId}</p>
      </div>

      <dl>
        <div>
          <dt>Status</dt>
          <dd>{modelCallLog.status}</dd>
        </div>

        <div>
          <dt>Goal</dt>
          <dd>{routingGoal}</dd>
        </div>

        <div>
          <dt>Cost</dt>
          <dd>{getStringField(routingDecision, "estimatedCostTier")}</dd>
        </div>

        <div>
          <dt>Latency</dt>
          <dd>{getStringField(routingDecision, "expectedLatencyTier")}</dd>
        </div>

        <div>
          <dt>Quality</dt>
          <dd>{getStringField(routingDecision, "qualityTier")}</dd>
        </div>
      </dl>

      <p className="model-route-card__reason">
      </p>
    </article>
  );
}

function WorkflowToolCallingPlanPanel({
  workflowRunId,
  result,
  isRunning,
  error,
  success,
  onRun,
}: {
  workflowRunId: string;
  result: ExecuteWorkflowToolCallingPlanResponse | null;
  isRunning: boolean;
  error: string | null;
  success: string | null;
  onRun: (workflowRunId: string) => void;
}) {
  return (
    <section className="workflow-tool-calling-plan">
      <div className="workflow-tool-calling-plan__header">
        <div>
          <h5>Tool-Calling Plan</h5>
          <p>
            Deterministic agent plan → policy check → safe read-only execution → persisted ToolCallLog audit records.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onRun(workflowRunId)}
          disabled={isRunning}
        >
          {isRunning ? "Running Plan…" : "Run Tool-Calling Plan"}
        </button>
      </div>

      {error ? (
        <p className="form-message form-message--error">{error}</p>
      ) : null}

      {success ? (
        <p className="form-message form-message--success">{success}</p>
      ) : null}

      {result ? (
        <div className="workflow-tool-calling-plan__result">
          <dl className="workflow-tool-calling-plan__metadata">
            <div>
              <dt>Plan</dt>
              <dd>{formatShortId(result.plan.planId)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{result.plan.status}</dd>
            </div>
            <div>
              <dt>Planner</dt>
              <dd>{result.executionMetadata.planner}</dd>
            </div>
            <div>
              <dt>Mutation tools</dt>
              <dd>{result.executionMetadata.mutationToolsEnabled ? "Enabled" : "Disabled"}</dd>
            </div>
          </dl>

          <div className="workflow-tool-calling-plan__steps">
            {result.results.map((toolResult) => (
              <article
                className={
                  toolResult.status === "SUCCEEDED"
                    ? "workflow-tool-calling-plan-card workflow-tool-calling-plan-card--success"
                    : "workflow-tool-calling-plan-card workflow-tool-calling-plan-card--blocked"
                }
                key={toolResult.planCallId}
              >
                <div className="workflow-tool-calling-plan-card__header">
                  <div>
                    <strong>
                      {toolResult.orderIndex}. {toolResult.toolName}
                    </strong>
                    <p>{toolResult.reason}</p>
                  </div>
                  <span>{toolResult.status}</span>
                </div>

                <dl className="workflow-tool-calling-plan-card__metadata">
                  <div>
                    <dt>Policy</dt>
                    <dd>{toolResult.policyDecision}</dd>
                  </div>
                  <div>
                    <dt>Reason Codes</dt>
                    <dd>{toolResult.policyReasonCodes.join(", ")}</dd>
                  </div>
                  <div>
                    <dt>Execution Attempted</dt>
                    <dd>{toolResult.executionAttempted ? "true" : "false"}</dd>
                  </div>
                  <div>
                    <dt>ToolCallLog</dt>
                    <dd>{formatShortId(toolResult.toolCallLogId)}</dd>
                  </div>
                  <div>
                    <dt>Expected Risk</dt>
                    <dd>{toolResult.expectedRiskLevel}</dd>
                  </div>
                  <div>
                    <dt>Mutates Data</dt>
                    <dd>{toolResult.expectedMutatesData ? "true" : "false"}</dd>
                  </div>
                </dl>

                <p className="workflow-tool-calling-plan-card__reason">
                  {toolResult.failurePreview ?? toolResult.policyReason}
                </p>

                <details className="workflow-tool-calling-plan-card__preview">
                  <summary>Connector result / failure preview</summary>
                  <pre>
                    {formatConnectorJson(
                      toolResult.connectorResultPreview ?? toolResult.failurePreview,
                    )}
                  </pre>
                </details>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <p className="workflow-tool-calling-plan__empty">
          No tool-calling plan has been run for this selected workflow run in the current UI session.
        </p>
      )}
    </section>
  );
}

function ToolCallLogCard({ toolCallLog }: { toolCallLog: ToolCallLog }) {
  const outputJson = getToolCallOutputJson(toolCallLog);
  const isAuditOnly = isAuditOnlyToolCallLog(toolCallLog);
  const isGroundingCall = isGroundingToolCallLog(toolCallLog);
  const groundingSummary = isGroundingCall
    ? getGroundingSummaryFromToolCall(toolCallLog)
    : null;

  return (
    <article
      className={
        isAuditOnly
          ? "workflow-tool-log-card workflow-tool-log-card--audit-only"
          : "workflow-tool-log-card workflow-tool-log-card--executed"
      }
    >
      <div className="workflow-tool-log-card__body">
        <div className="workflow-tool-log-card__header">
          <div>
            <span className="model-route-card__eyebrow">
              {isAuditOnly
                ? "Audit-only planned MCP invocation"
                : "Executed tool call"}
            </span>
            <strong>{toolCallLog.toolName}</strong>
            <p>{toolCallLog.workflowStepId ?? "Run-level tool log"}</p>
          </div>

          <span>{toolCallLog.status}</span>
        </div>

        {groundingSummary ? (
          <p className="workflow-tool-log-card__audit-note">
            {groundingSummary}
          </p>
        ) : null}

        {isAuditOnly ? (
          <>
            <p className="workflow-tool-log-card__audit-note">
              Planned preview log only. No tool execution was attempted and no
              actual tool output is present.
            </p>

            <dl className="workflow-tool-log-card__metadata">
              <div>
                <dt>Policy Decision</dt>
                <dd>{getStringField(outputJson, "policyDecision")}</dd>
              </div>

              <div>
                <dt>Reason Codes</dt>
                <dd>{getStringListField(outputJson, "policyReasonCodes")}</dd>
              </div>

              <div>
                <dt>Invocation Status</dt>
                <dd>{getStringField(outputJson, "invocationStatus")}</dd>
              </div>

              <div>
                <dt>Requested By</dt>
                <dd>{getStringField(outputJson, "requestedBy")}</dd>
              </div>

              <div>
                <dt>Execution Attempted</dt>
                <dd>{getBooleanField(outputJson, "executionAttempted")}</dd>
              </div>

              <div>
                <dt>Preview Only</dt>
                <dd>{getBooleanField(outputJson, "previewOnly")}</dd>
              </div>
            </dl>
          </>
        ) : (
          <dl className="workflow-tool-log-card__metadata">
            <div>
              <dt>Started</dt>
              <dd>{formatToolCallTimestamp(toolCallLog.startedAt)}</dd>
            </div>

            <div>
              <dt>Completed</dt>
              <dd>{formatToolCallTimestamp(toolCallLog.completedAt)}</dd>
            </div>

            <div>
              <dt>Workflow Run</dt>
              <dd>{toolCallLog.workflowRunId ?? "—"}</dd>
            </div>

            <div>
              <dt>Workflow Step</dt>
              <dd>{toolCallLog.workflowStepId ?? "—"}</dd>
            </div>
          </dl>
        )}
      </div>
    </article>
  );
}

function ConnectorCatalogCard({ connector }: { connector: ConnectorCatalogItem }) {
  return (
    <article className="mcp-connector-catalog-card">
      <div className="mcp-connector-catalog-card__header">
        <div>
          <span className="model-route-card__eyebrow">
            {connector.policyDecision === "ALLOW" ? "Allowed read-only tool" : "Blocked or disabled tool"}
          </span>
          <h3>{connector.displayName}</h3>
          <p>{connector.description}</p>
        </div>

        <span className={connector.policyDecision === "ALLOW" ? "mcp-policy-pill mcp-policy-pill--allow" : "mcp-policy-pill mcp-policy-pill--block"}>
          {connector.policyDecision}
        </span>
      </div>

      <dl className="mcp-connector-catalog-card__metadata">
        <div>
          <dt>Tool ID</dt>
          <dd title={connector.name}>{connector.name}</dd>
        </div>

        <div>
          <dt>Risk</dt>
          <dd>{connector.riskLevel}</dd>
        </div>

        <div>
          <dt>Mutates Data</dt>
          <dd>{String(connector.mutatesData)}</dd>
        </div>

        <div>
          <dt>Approval</dt>
          <dd>{String(connector.requiresHumanApproval)}</dd>
        </div>

        <div>
          <dt>Enabled</dt>
          <dd>{formatEnabledLabel(connector.enabled)}</dd>
        </div>

        <div>
          <dt>Allowed Mode</dt>
          <dd>{formatEnumLabel(connector.allowedExecutionMode)}</dd>
        </div>

        <div>
          <dt>Last Invoked</dt>
          <dd>{formatToolCallTimestamp(connector.lastInvokedAt)}</dd>
        </div>

        <div>
          <dt>Counts</dt>
          <dd>
            {connector.invocationCounts.succeeded} ok /{" "}
            {connector.invocationCounts.failed} failed /{" "}
            {connector.invocationCounts.blocked} blocked
          </dd>
        </div>
      </dl>

      <p className="mcp-connector-catalog-card__reason">
        {connector.policyReason}
      </p>
    </article>
  );
}

function ConnectorInvocationHistoryCard({
  invocation,
}: {
  invocation: ConnectorInvocationHistoryItem;
}) {
  return (
    <article className="mcp-invocation-history-card">
      <div className="mcp-invocation-history-card__header">
        <div>
          <span className="model-route-card__eyebrow">
            {invocation.executionAttempted ? "Execution attempted" : "Blocked before execution"}
          </span>
          <h3>{invocation.displayName}</h3>
          <p>{invocation.toolName}</p>
        </div>

        <span className={invocation.policyDecision === "ALLOW" ? "mcp-policy-pill mcp-policy-pill--allow" : "mcp-policy-pill mcp-policy-pill--block"}>
          {invocation.policyDecision}
        </span>
      </div>

      <dl className="mcp-invocation-history-card__metadata">
        <div>
          <dt>Status</dt>
          <dd>{invocation.status}</dd>
        </div>

        <div>
          <dt>Execution Attempted</dt>
          <dd>{String(invocation.executionAttempted)}</dd>
        </div>

        <div>
          <dt>Risk</dt>
          <dd>{invocation.riskLevel ?? "—"}</dd>
        </div>

        <div>
          <dt>Requested By</dt>
          <dd>{invocation.requestedBy ?? "—"}</dd>
        </div>

        <div>
          <dt>Workflow Run</dt>
          <dd title={invocation.workflowRunId ?? undefined}>
            {invocation.workflowRunId ? formatShortId(invocation.workflowRunId) : "—"}
          </dd>
        </div>

        <div>
          <dt>Workflow Step</dt>
          <dd title={invocation.workflowStepId ?? undefined}>
            {invocation.workflowStepId ? formatShortId(invocation.workflowStepId) : "—"}
          </dd>
        </div>

        <div>
          <dt>Started</dt>
          <dd>{formatToolCallTimestamp(invocation.startedAt)}</dd>
        </div>

        <div>
          <dt>Completed</dt>
          <dd>{formatToolCallTimestamp(invocation.completedAt)}</dd>
        </div>
      </dl>

      <p className="mcp-invocation-history-card__reason">
        {invocation.failureReason ??
          invocation.resultPreview ??
          invocation.policyReason ??
          "ToolCallLog persisted."}
      </p>

      {invocation.policyReasonCodes.length > 0 ? (
        <p className="mcp-invocation-history-card__codes">
          {invocation.policyReasonCodes.join(", ")}
        </p>
      ) : null}
    </article>
  );
}

function ReadOnlyMcpConnectorResultCard({
  result,
}: {
  result: ExecuteReadOnlyToolInvocationResponse;
}) {
  const tool = result.policyEvaluation.tool;

  return (
    <article className="read-only-mcp-result-card">
      <div className="read-only-mcp-result-card__header">
        <div>
          <span className="model-route-card__eyebrow">
            {result.invocation.status === "SUCCEEDED"
              ? "Executed read-only connector"
              : "Blocked by connector policy"}
          </span>
          <h3>{result.invocation.toolName}</h3>
          <p>
            Policy checked before execution. External MCP transport remains off;
            this demo uses the internal connector invocation surface.
          </p>
        </div>

        <span>{result.invocation.status}</span>
      </div>

      <dl className="read-only-mcp-result-card__metadata">
        <div>
          <dt>Policy Decision</dt>
          <dd>{result.policyEvaluation.decision}</dd>
        </div>

        <div>
          <dt>Reason Codes</dt>
          <dd>{result.policyEvaluation.reasonCodes.join(", ")}</dd>
        </div>

        <div>
          <dt>Execution Attempted</dt>
          <dd>{String(result.invocation.executionAttempted)}</dd>
        </div>

        <div>
          <dt>Persisted ToolCallLog</dt>
          <dd title={result.invocation.toolCallLogId}>
            {formatShortId(result.invocation.toolCallLogId)}
          </dd>
        </div>

        <div>
          <dt>Risk Level</dt>
          <dd>{tool?.riskLevel ?? "—"}</dd>
        </div>

        <div>
          <dt>Mutates Data</dt>
          <dd>{tool ? String(tool.mutatesData) : "—"}</dd>
        </div>

        <div>
          <dt>Requires Approval</dt>
          <dd>{tool ? String(tool.requiresHumanApproval) : "—"}</dd>
        </div>

        <div>
          <dt>Enabled</dt>
          <dd>{tool ? String(tool.enabled) : "—"}</dd>
        </div>
      </dl>

      <p className="read-only-mcp-result-card__reason">
        {result.policyEvaluation.reason}
      </p>

      <div className="read-only-mcp-result-card__preview">
        <strong>Connector Result Preview</strong>
        <pre>
          {formatConnectorJson(
            result.connectorResult?.data ?? result.invocation.outputJson,
          )}
        </pre>
      </div>
    </article>
  );
}

function App() {
  const [activeView, setActiveView] = useState<AppView>("OVERVIEW");
  const [intakeBatches, setIntakeBatches] = useState<IntakeBatchSummary[]>([]);
  const [isLoadingIntakeBatches, setIsLoadingIntakeBatches] = useState(true);
  const [intakeBatchesError, setIntakeBatchesError] = useState<string | null>(
    null,
  );

  const [globalWorkflowRuns, setGlobalWorkflowRuns] = useState<
    GlobalWorkflowRunSummary[]
  >([]);
  const [isLoadingGlobalWorkflowRuns, setIsLoadingGlobalWorkflowRuns] =
    useState(true);
  const [globalWorkflowRunsError, setGlobalWorkflowRunsError] = useState<
    string | null
  >(null);
  const [workflowRunStatusFilter, setWorkflowRunStatusFilter] =
    useState<WorkflowRunStatusFilter>("ALL");

  const [globalReviewQueueItems, setGlobalReviewQueueItems] = useState<
    GlobalReviewQueueItem[]
  >([]);
  const [isLoadingGlobalReviewQueue, setIsLoadingGlobalReviewQueue] =
    useState(true);
  const [globalReviewQueueError, setGlobalReviewQueueError] = useState<
    string | null
  >(null);

  const [selectedBatchDetail, setSelectedBatchDetail] =
    useState<IntakeBatchDetail | null>(null);
  const [isLoadingBatchDetail, setIsLoadingBatchDetail] = useState(false);
  const [batchDetailError, setBatchDetailError] = useState<string | null>(null);

  const [selectedWorkflowRunDetail, setSelectedWorkflowRunDetail] =
    useState<WorkflowRunDetail | null>(null);
  const [isLoadingWorkflowRunDetail, setIsLoadingWorkflowRunDetail] =
    useState(false);
  const [workflowRunDetailError, setWorkflowRunDetailError] = useState<
    string | null
  >(null);
  const [isExecutingWorkflowRun, setIsExecutingWorkflowRun] = useState(false);
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
  const [executeWorkflowRunError, setExecuteWorkflowRunError] = useState<
    string | null
  >(null);
  const [executeWorkflowRunSuccess, setExecuteWorkflowRunSuccess] = useState<
    string | null
  >(null);
  const [workflowToolCallingPlanResult, setWorkflowToolCallingPlanResult] =
    useState<ExecuteWorkflowToolCallingPlanResponse | null>(null);
  const [isExecutingWorkflowToolCallingPlan, setIsExecutingWorkflowToolCallingPlan] =
    useState(false);
  const [workflowToolCallingPlanError, setWorkflowToolCallingPlanError] =
    useState<string | null>(null);
  const [workflowToolCallingPlanSuccess, setWorkflowToolCallingPlanSuccess] =
    useState<string | null>(null);

  const [isStartingWorkflow, setIsStartingWorkflow] = useState(false);
  const [startWorkflowError, setStartWorkflowError] = useState<string | null>(
    null,
  );
  const [startWorkflowSuccess, setStartWorkflowSuccess] = useState<
    string | null
  >(null);
  const [latestModelCallLog, setLatestModelCallLog] =
    useState<ModelCallLog | null>(null);

  const [modelRoutingTaskType, setModelRoutingTaskType] =
    useState<ModelTaskType>("INTAKE_PARSING");
  const [modelRoutingGoal, setModelRoutingGoal] =
    useState<ModelRoutingGoal>("HIGH_QUALITY");
  const [modelRoutingRequireJson, setModelRoutingRequireJson] = useState(true);
  const [modelRoutingAllowDisabledProviders, setModelRoutingAllowDisabledProviders] =
    useState(true);
  const [modelRoutingPreview, setModelRoutingPreview] =
    useState<PreviewModelRoutingResponse | null>(null);
  const [isPreviewingModelRouting, setIsPreviewingModelRouting] =
    useState(false);
  const [modelRoutingPreviewError, setModelRoutingPreviewError] = useState<
    string | null
  >(null);

  const [selectedReadOnlyMcpToolName, setSelectedReadOnlyMcpToolName] =
    useState<ReadOnlyMcpToolName>("swingops.workflowRuns.list");
  const [selectedReadOnlyMcpWorkflowRunId, setSelectedReadOnlyMcpWorkflowRunId] =
    useState("");
  const [readOnlyMcpInvocationResult, setReadOnlyMcpInvocationResult] =
    useState<ExecuteReadOnlyToolInvocationResponse | null>(null);
  const [isExecutingReadOnlyMcpTool, setIsExecutingReadOnlyMcpTool] =
    useState(false);
  const [readOnlyMcpInvocationError, setReadOnlyMcpInvocationError] = useState<
    string | null
  >(null);
  const [mcpConnectorCatalog, setMcpConnectorCatalog] = useState<
    ConnectorCatalogItem[]
  >([]);
  const [isLoadingMcpConnectorCatalog, setIsLoadingMcpConnectorCatalog] =
    useState(true);
  const [mcpConnectorCatalogError, setMcpConnectorCatalogError] = useState<
    string | null
  >(null);
  const [mcpInvocationHistory, setMcpInvocationHistory] = useState<
    ConnectorInvocationHistoryItem[]
  >([]);
  const [isLoadingMcpInvocationHistory, setIsLoadingMcpInvocationHistory] =
    useState(true);
  const [mcpInvocationHistoryError, setMcpInvocationHistoryError] = useState<
    string | null
  >(null);
  const [mcpAuditStory, setMcpAuditStory] = useState(
    "agent/tool request → policy decision → execution or block → persisted ToolCallLog audit record",
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sourceType, setSourceType] =
    useState<IntakeBatchSourceType>("FREEFORM_NOTES");
  const [rawText, setRawText] = useState("");
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const [createBatchError, setCreateBatchError] = useState<string | null>(null);
  const [createBatchSuccess, setCreateBatchSuccess] = useState<string | null>(
    null,
  );

  const openReviewQueueItemCount = globalReviewQueueItems.filter(
    (item) => item.status === "OPEN" || item.status === "IN_REVIEW",
  ).length;
  const needsReviewWorkflowRunCount = globalWorkflowRuns.filter(
    (run) => run.status === "NEEDS_REVIEW",
  ).length;
  const totalToolCallLogCount = globalWorkflowRuns.reduce(
    (count, run) => count + run.totalToolCallLogCount,
    0,
  );

  const workflowRunStatusCounts = globalWorkflowRuns.reduce<
    Record<WorkflowRunStatus, number>
  >((counts, run) => {
    counts[run.status] = (counts[run.status] ?? 0) + 1;

    return counts;
  }, {} as Record<WorkflowRunStatus, number>);

  const filteredGlobalWorkflowRuns =
    workflowRunStatusFilter === "ALL"
      ? globalWorkflowRuns
      : globalWorkflowRuns.filter(
          (run) => run.status === workflowRunStatusFilter,
        );

  const selectedWorkflowRunId =
    selectedWorkflowRunDetail?.workflowRun.id ?? null;
  const firstAvailableWorkflowRunId = globalWorkflowRuns[0]?.id ?? "";
  const selectedMcpWorkflowRunId =
    selectedReadOnlyMcpWorkflowRunId || firstAvailableWorkflowRunId;
  const readOnlyMcpToolOptions = READ_ONLY_MCP_TOOL_OPTIONS.filter(
    (tool) =>
      tool.name !== "swingops.workflowRuns.get" || Boolean(selectedMcpWorkflowRunId),
  );
  const selectedReadOnlyMcpTool =
    READ_ONLY_MCP_TOOL_OPTIONS.find(
      (tool) => tool.name === selectedReadOnlyMcpToolName,
    ) ?? READ_ONLY_MCP_TOOL_OPTIONS[0];

  async function loadIntakeBatches() {
    try {
      setIsLoadingIntakeBatches(true);
      setIntakeBatchesError(null);

      const batches = await listIntakeBatches();

      setIntakeBatches(batches);
    } catch (error) {
      setIntakeBatchesError(
        error instanceof Error
          ? error.message
          : "Unable to load intake batches.",
      );
    } finally {
      setIsLoadingIntakeBatches(false);
    }
  }

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

  async function loadMcpConnectorCatalog() {
    try {
      setIsLoadingMcpConnectorCatalog(true);
      setMcpConnectorCatalogError(null);

      const response = await listConnectorCatalog();

      setMcpConnectorCatalog(response.connectors);
    } catch (error) {
      setMcpConnectorCatalogError(
        error instanceof Error
          ? error.message
          : "Unable to load connector catalog.",
      );
    } finally {
      setIsLoadingMcpConnectorCatalog(false);
    }
  }

  async function loadMcpInvocationHistory() {
    try {
      setIsLoadingMcpInvocationHistory(true);
      setMcpInvocationHistoryError(null);

      const response = await listConnectorInvocationHistory(25);

      setMcpInvocationHistory(response.invocations);
      setMcpAuditStory(response.historyMetadata.auditStory);
    } catch (error) {
      setMcpInvocationHistoryError(
        error instanceof Error
          ? error.message
          : "Unable to load connector invocation history.",
      );
    } finally {
      setIsLoadingMcpInvocationHistory(false);
    }
  }

  useEffect(() => {
    void loadIntakeBatches();
    void loadGlobalWorkflowRuns();
    void loadGlobalReviewQueueItems();
    void loadMcpConnectorCatalog();
    void loadMcpInvocationHistory();
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

  async function refreshSelectedBatchDetail() {
    if (!selectedBatchDetail) {
      return;
    }

    const refreshedBatchDetail = await getIntakeBatch(
      selectedBatchDetail.intakeBatch.id,
    );

    setSelectedBatchDetail(refreshedBatchDetail);
  }

  async function refreshSelectedWorkflowRunDetail(workflowRunId: string) {
    const refreshedWorkflowRunDetail = await getWorkflowRun(workflowRunId);

    setSelectedWorkflowRunDetail(refreshedWorkflowRunDetail);
  }

  async function handleSelectBatch(intakeBatchId: string) {
    try {
      setIsLoadingBatchDetail(true);
      setBatchDetailError(null);
      setStartWorkflowError(null);
      setStartWorkflowSuccess(null);
      setLatestModelCallLog(null);
      setSelectedWorkflowRunDetail(null);
      setWorkflowRunDetailError(null);

      const detail = await getIntakeBatch(intakeBatchId);

      setSelectedBatchDetail(detail);
    } catch (error) {
      setBatchDetailError(
        error instanceof Error
          ? error.message
          : "Unable to load intake batch details.",
      );
    } finally {
      setIsLoadingBatchDetail(false);
    }
  }

  async function handleSelectWorkflowRun(workflowRunId: string) {
    try {
      setIsLoadingWorkflowRunDetail(true);
      setWorkflowRunDetailError(null);
      setReviewQueueActionError(null);
      setReviewQueueActionSuccess(null);
      setWorkflowToolCallingPlanError(null);
      setWorkflowToolCallingPlanSuccess(null);
      setWorkflowToolCallingPlanResult(null);

      const detail = await getWorkflowRun(workflowRunId);

      setSelectedWorkflowRunDetail(detail);
    } catch (error) {
      setWorkflowRunDetailError(
        error instanceof Error
          ? error.message
          : "Unable to load workflow run detail.",
      );
    } finally {
      setIsLoadingWorkflowRunDetail(false);
    }
  }

  async function handleExecuteWorkflowRun(
    workflowRunId: string,
    scenario: WorkflowExecutionScenario = "HAPPY_PATH",
  ) {
    try {
      setIsExecutingWorkflowRun(true);
      setExecuteWorkflowRunError(null);
      setExecuteWorkflowRunSuccess(null);
      setWorkflowRunDetailError(null);
      setReviewQueueActionError(null);
      setReviewQueueActionSuccess(null);

      const result = await executeWorkflowRun(workflowRunId, { scenario });
      const detail = await getWorkflowRun(workflowRunId);

      setSelectedWorkflowRunDetail(detail);
      setExecuteWorkflowRunSuccess(
        `Executed ${
          scenario === "NEEDS_REVIEW" ? "review-needed" : "happy-path"
        } workflow simulation: ${result.workflowRun.workflowName}`,
      );

      await loadGlobalWorkflowRuns();
      await loadGlobalReviewQueueItems();
      await refreshSelectedBatchDetail();
    } catch (error) {
      setExecuteWorkflowRunError(
        error instanceof Error
          ? error.message
          : "Unable to execute workflow simulation.",
      );
    } finally {
      setIsExecutingWorkflowRun(false);
    }
  }


  async function handleExecuteWorkflowToolCallingPlan(workflowRunId: string) {
    try {
      setIsExecutingWorkflowToolCallingPlan(true);
      setWorkflowToolCallingPlanError(null);
      setWorkflowToolCallingPlanSuccess(null);

      const result = await executeWorkflowToolCallingPlan(workflowRunId);

      setWorkflowToolCallingPlanResult(result);
      setWorkflowToolCallingPlanSuccess(
        `Tool-calling plan ${result.plan.status.toLowerCase().replace(/_/g, " ")} with ${result.results.length} planned calls and ${result.toolCallLogs.length} persisted audit logs.`,
      );

      await refreshSelectedWorkflowRunDetail(workflowRunId);
      await loadGlobalWorkflowRuns();
      await loadMcpInvocationHistory();
    } catch (error) {
      setWorkflowToolCallingPlanError(
        error instanceof Error
          ? error.message
          : "Unable to run tool-calling plan.",
      );
    } finally {
      setIsExecutingWorkflowToolCallingPlan(false);
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
      setWorkflowRunDetailError(null);

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
      await loadMcpConnectorCatalog();
      await loadMcpInvocationHistory();

      if (
        input.workflowRunId &&
        selectedWorkflowRunDetail?.workflowRun.id === input.workflowRunId
      ) {
        await refreshSelectedWorkflowRunDetail(input.workflowRunId);
      }

      if (
        selectedBatchDetail &&
        (!input.intakeBatchId ||
          selectedBatchDetail.intakeBatch.id === input.intakeBatchId)
      ) {
        await refreshSelectedBatchDetail();
      }

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

  async function handleCreateBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = buildCreateIntakeBatchRequest({
      name,
      description,
      sourceType,
      rawText,
    });

    if (!result.ok) {
      setCreateBatchError(result.error);
      setCreateBatchSuccess(null);
      return;
    }

    try {
      setIsCreatingBatch(true);
      setCreateBatchError(null);
      setCreateBatchSuccess(null);

      const createdBatch = await createIntakeBatch(result.request);

      setName("");
      setDescription("");
      setSourceType("FREEFORM_NOTES");
      setRawText("");
      setCreateBatchSuccess(`Created intake batch: ${createdBatch.name}`);

      await loadIntakeBatches();
      await handleSelectBatch(createdBatch.id);
      await loadGlobalWorkflowRuns();
      await loadGlobalReviewQueueItems();
    } catch (error) {
      setCreateBatchError(
        error instanceof Error
          ? error.message
          : "Unable to create intake batch.",
      );
    } finally {
      setIsCreatingBatch(false);
    }
  }

  async function handleStartWorkflow() {
    if (!selectedBatchDetail) {
      return;
    }

    const intakeBatchId = selectedBatchDetail.intakeBatch.id;

    try {
      setIsStartingWorkflow(true);
      setStartWorkflowError(null);
      setStartWorkflowSuccess(null);
      setLatestModelCallLog(null);
      setSelectedWorkflowRunDetail(null);
      setWorkflowRunDetailError(null);
      setExecuteWorkflowRunError(null);
      setExecuteWorkflowRunSuccess(null);

      const response = await startWorkflowForIntakeBatch(intakeBatchId);

      setLatestModelCallLog(response.modelCallLog);
      setStartWorkflowSuccess(
        `Started workflow run: ${response.workflowRun.workflowName}`,
      );

      const refreshedDetail = await getIntakeBatch(intakeBatchId);

      setSelectedBatchDetail(refreshedDetail);
      await loadGlobalWorkflowRuns();
      await loadGlobalReviewQueueItems();
    } catch (error) {
      setStartWorkflowError(
        error instanceof Error ? error.message : "Unable to start workflow.",
      );
    } finally {
      setIsStartingWorkflow(false);
    }
  }

  async function handlePreviewModelRouting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsPreviewingModelRouting(true);
      setModelRoutingPreviewError(null);

      const preview = await previewModelRouting({
        taskType: modelRoutingTaskType,
        preferredGoal: modelRoutingGoal,
        requireJson: modelRoutingRequireJson,
        allowDisabledProvidersForSimulation: modelRoutingAllowDisabledProviders,
      });

      setModelRoutingPreview(preview);
    } catch (error) {
      setModelRoutingPreviewError(
        error instanceof Error
          ? error.message
          : "Unable to preview model routing.",
      );
    } finally {
      setIsPreviewingModelRouting(false);
    }
  }

  async function handleExecuteReadOnlyMcpTool(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      selectedReadOnlyMcpToolName === "swingops.workflowRuns.get" &&
      !selectedMcpWorkflowRunId
    ) {
      setReadOnlyMcpInvocationError(
        "Create or select a workflow run before using the get-by-id connector demo.",
      );
      return;
    }

    try {
      setIsExecutingReadOnlyMcpTool(true);
      setReadOnlyMcpInvocationError(null);

      const result = await executeReadOnlyToolInvocation({
        toolName: selectedReadOnlyMcpToolName,
        inputJson: getReadOnlyMcpToolInput(
          selectedReadOnlyMcpToolName,
          selectedMcpWorkflowRunId,
        ),
        requestedBy: "agent.web-readonly-demo",
        workflowRunId:
          selectedReadOnlyMcpToolName === "swingops.workflowRuns.get"
            ? selectedMcpWorkflowRunId
            : undefined,
        executionMode: selectedReadOnlyMcpTool.blockedDemo
          ? "HUMAN_APPROVED"
          : "AGENT_AUTONOMOUS",
        humanApprovalGranted: selectedReadOnlyMcpTool.blockedDemo,
      });

      setReadOnlyMcpInvocationResult(result);
      await loadGlobalWorkflowRuns();
      await loadGlobalReviewQueueItems();

      if (
        selectedWorkflowRunDetail &&
        result.invocation.workflowRunId === selectedWorkflowRunDetail.workflowRun.id
      ) {
        await refreshSelectedWorkflowRunDetail(
          selectedWorkflowRunDetail.workflowRun.id,
        );
      }
    } catch (error) {
      setReadOnlyMcpInvocationError(
        error instanceof Error
          ? error.message
          : "Unable to execute read-only MCP connector demo.",
      );
    } finally {
      setIsExecutingReadOnlyMcpTool(false);
    }
  }

  function renderReviewQueueActionControls(input: {
    item: ReviewQueueItem;
    workflowRunId?: string | null;
    intakeBatchId?: string | null;
  }) {
    if (input.item.status !== "OPEN") {
      return null;
    }

    return (
      <div className="review-queue-card__review-actions">
        <label>
          Reviewer Notes
          <textarea
            onChange={(event) =>
              handleReviewQueueNotesChange(input.item.id, event.target.value)
            }
            placeholder="Add reviewer notes before resolving or dismissing."
            rows={3}
            value={reviewQueueNotesById[input.item.id] ?? ""}
          />
        </label>

        <div className="workflow-run-card__actions">
          <button
            disabled={activeReviewQueueItemId === input.item.id}
            onClick={() =>
              void handleReviewQueueItemAction({
                reviewQueueItemId: input.item.id,
                action: "resolve",
                workflowRunId: input.workflowRunId ?? input.item.workflowRunId,
                intakeBatchId: input.intakeBatchId ?? null,
              })
            }
            type="button"
          >
            {activeReviewQueueItemId === input.item.id
              ? "Updating…"
              : "Resolve"}
          </button>

          <button
            disabled={activeReviewQueueItemId === input.item.id}
            onClick={() =>
              void handleReviewQueueItemAction({
                reviewQueueItemId: input.item.id,
                action: "dismiss",
                workflowRunId: input.workflowRunId ?? input.item.workflowRunId,
                intakeBatchId: input.intakeBatchId ?? null,
              })
            }
            type="button"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <h1>SwingOps AI</h1>

        <p className="subtitle">Agentic Golf Retail Workflow Platform</p>

        <p className="hero__description">
          SwingOps AI turns messy golf trade-in notes into structured workflow
          runs using model routing, tool execution, human review, and MCP-style
          connector safety.
        </p>
      </section>

      <nav aria-label="SwingOps demo sections" className="app-nav">
        {APP_NAV_ITEMS.map((item) => (
          <button
            className={
              activeView === item.view
                ? "app-nav__button app-nav__button--active"
                : "app-nav__button"
            }
            key={item.view}
            onClick={() => setActiveView(item.view)}
            type="button"
          >
            <span>{item.eyebrow}</span>
            <strong>{item.label}</strong>
          </button>
        ))}
      </nav>

      {activeView === "OVERVIEW" ? (
        <section className="overview-page" aria-labelledby="overview-heading">
          <div className="overview-hero-card">
            <span className="model-route-card__eyebrow">Portfolio Demo</span>
            <h2 id="overview-heading">From messy trade-in notes to governed AI workflow execution</h2>
            <p>
              This demo shows how an agentic operations system can ingest
              inconsistent golf retail notes, start auditable workflow runs,
              route model work across providers, create human review tasks, and
              expose internal tools through a guarded MCP-style connector layer.
            </p>
          </div>

          <div className="overview-metric-grid">
            <article>
              <span>{intakeBatches.length}</span>
              <strong>Intake Batches</strong>
              <p>Messy golf trade-in inputs ready for workflow processing.</p>
            </article>

            <article>
              <span>{globalWorkflowRuns.length}</span>
              <strong>Workflow Runs</strong>
              <p>Queued, completed, failed, and review-needed orchestration runs.</p>
            </article>

            <article>
              <span>{openReviewQueueItemCount}</span>
              <strong>Open Review Items</strong>
              <p>Human-in-the-loop checkpoints for uncertain structured output.</p>
            </article>

            <article>
              <span>{totalToolCallLogCount}</span>
              <strong>Tool Audit Logs</strong>
              <p>Persisted records for planned or executed connector/tool calls.</p>
            </article>
          </div>

          <div className="overview-story-grid">
            <article>
              <span>01</span>
              <h3>Messy Intake</h3>
              <p>Import raw golf trade-in notes, CSV-like rows, email text, or manual entries.</p>
            </article>

            <article>
              <span>02</span>
              <h3>Workflow Orchestration</h3>
              <p>Start workflow runs, simulate execution paths, and inspect step-level outcomes.</p>
            </article>

            <article>
              <span>03</span>
              <h3>Model Routing</h3>
              <p>Route model work based on cost, latency, quality, JSON support, and provider availability.</p>
            </article>

            <article>
              <span>04</span>
              <h3>Human Review</h3>
              <p>Send uncertain outputs to a review queue before operational data is trusted.</p>
            </article>

            <article>
              <span>05</span>
              <h3>MCP-style Tool Safety</h3>
              <p>Expose internal data through read-only tools with policy checks before execution.</p>
            </article>

            <article>
              <span>06</span>
              <h3>Audit Trail</h3>
              <p>Persist model route logs and tool invocation logs for explainability and review.</p>
            </article>
          </div>

          <div className="overview-callout">
            <strong>{getNeedsReviewWorkflowRunSummary(needsReviewWorkflowRunCount)}</strong>
            <p>
              Use the Intake, Workflow Runs, Review Queue, Model Routing, and MCP
              Connectors tabs to walk through the system like a product demo
              instead of a developer test harness.
            </p>
          </div>
        </section>
      ) : null}

      {activeView === "INTAKE" ? (
      <DashboardSection
        title="Create Intake Batch"
        description="Add messy golf trade-in data for later workflow processing."
      >
        <form className="intake-form" onSubmit={handleCreateBatch}>
          <label>
            Batch Name
            <input
              name="name"
              onChange={(event) => setName(event.target.value)}
              placeholder="May trade-in notes"
              type="text"
              value={name}
            />
          </label>

          <label>
            Description
            <input
              name="description"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional context for this batch"
              type="text"
              value={description}
            />
          </label>

          <label>
            Source Type
            <select
              name="sourceType"
              onChange={(event) =>
                setSourceType(event.target.value as IntakeBatchSourceType)
              }
              value={sourceType}
            >
              <option value="FREEFORM_NOTES">Freeform Notes</option>
              <option value="BAD_CSV">Bad CSV</option>
              <option value="EMAIL">Email</option>
              <option value="PDF_TEXT">PDF Text</option>
              <option value="MANUAL_ENTRY">Manual Entry</option>
            </select>
          </label>

          <label>
            Raw Trade-In Text
            <textarea
              name="rawText"
              onChange={(event) => setRawText(event.target.value)}
              placeholder={
                "TM Stealth 2 driver, 10.5, stiff, RH\nPing G425 irons 5-PW, regular flex, LH"
              }
              rows={5}
              value={rawText}
            />
          </label>

          {createBatchError ? (
            <p className="form-message form-message--error">
              {createBatchError}
            </p>
          ) : null}

          {createBatchSuccess ? (
            <p className="form-message form-message--success">
              {createBatchSuccess}
            </p>
          ) : null}

          <button disabled={isCreatingBatch} type="submit">
            {isCreatingBatch ? "Creating…" : "Create Intake Batch"}
          </button>
        </form>
      </DashboardSection>
      ) : null}

      {activeView === "WORKFLOW_RUNS" ? (
      <DashboardSection
        title="Global Workflow Runs"
        description="Operations view for every workflow run across intake batches."
      >
        {!isLoadingGlobalWorkflowRuns && !globalWorkflowRunsError ? (
          <div className="global-workflow-run-toolbar">
            <p className="section-summary">
              {filteredGlobalWorkflowRuns.length} shown /{" "}
              {globalWorkflowRuns.length} total workflow{" "}
              {globalWorkflowRuns.length === 1 ? "run" : "runs"}
            </p>

            <div
              aria-label="Filter workflow runs by status"
              className="workflow-run-status-filter"
            >
              {WORKFLOW_RUN_STATUS_FILTERS.map((statusFilter) => {
                const count =
                  statusFilter === "ALL"
                    ? globalWorkflowRuns.length
                    : workflowRunStatusCounts[statusFilter] ?? 0;

                return (
                  <button
                    className={
                      workflowRunStatusFilter === statusFilter
                        ? "workflow-run-status-filter__button workflow-run-status-filter__button--active"
                        : "workflow-run-status-filter__button"
                    }
                    key={statusFilter}
                    onClick={() => setWorkflowRunStatusFilter(statusFilter)}
                    type="button"
                  >
                    <span>{statusFilter}</span>
                    <strong>{count}</strong>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {isLoadingGlobalWorkflowRuns ? <p>Loading workflow runs…</p> : null}

        {globalWorkflowRunsError ? (
          <EmptyState
            title="Unable to load workflow runs"
            message={globalWorkflowRunsError}
          />
        ) : null}

        {!isLoadingGlobalWorkflowRuns &&
        !globalWorkflowRunsError &&
        globalWorkflowRuns.length === 0 ? (
          <EmptyState
            title="No workflow runs found"
            message="Create an intake batch and start a workflow to populate the operations dashboard."
          />
        ) : null}

        {!isLoadingGlobalWorkflowRuns &&
        !globalWorkflowRunsError &&
        globalWorkflowRuns.length > 0 &&
        filteredGlobalWorkflowRuns.length === 0 ? (
          <EmptyState
            title="No runs match this filter"
            message="Choose a different workflow status to inspect runs across the platform."
          />
        ) : null}

        {!isLoadingGlobalWorkflowRuns &&
        !globalWorkflowRunsError &&
        filteredGlobalWorkflowRuns.length > 0 ? (
          <div className="global-workflow-run-list">
            {filteredGlobalWorkflowRuns.map((run) => (
              <article
                className={
                  selectedWorkflowRunId === run.id
                    ? "global-workflow-run-card global-workflow-run-card--selected"
                    : "global-workflow-run-card"
                }
                key={run.id}
              >
                <div className="global-workflow-run-card__header">
                  <div>
                    <span className="model-route-card__eyebrow">
                      {run.status}
                    </span>
                    <h3>{run.workflowName}</h3>
                    <p title={run.id}>{formatShortId(run.id)}</p>
                  </div>

                  <button
                    disabled={isLoadingWorkflowRunDetail}
                    onClick={() => void handleSelectWorkflowRun(run.id)}
                    type="button"
                  >
                    {selectedWorkflowRunId === run.id ? "Logs Shown Below" : "View Logs"}
                  </button>
                </div>

                <dl className="global-workflow-run-card__context">
                  <div>
                    <dt>Batch</dt>
                    <dd>{run.intakeBatch?.name ?? "—"}</dd>
                  </div>

                  <div>
                    <dt>Item</dt>
                    <dd>{getWorkflowRunSourcePreview(run)}</dd>
                  </div>

                  <div>
                    <dt>Latest Model</dt>
                    <dd>
                      {run.latestModelCallLog
                        ? `${run.latestModelCallLog.provider} / ${run.latestModelCallLog.model}`
                        : "—"}
                    </dd>
                  </div>

                  <div>
                    <dt>Tool Audit Logs</dt>
                    <dd>
                      {run.auditOnlyToolCallLogCount} audit-only /{" "}
                      {run.totalToolCallLogCount} total
                    </dd>
                  </div>

                  <div>
                    <dt>Review Queue</dt>
                    <dd>
                      {run.openReviewQueueItemCount} open /{" "}
                      {run.totalReviewQueueItemCount} total
                    </dd>
                  </div>
                </dl>

                {run.errorMessage ? (
                  <p className="global-workflow-run-card__meta">
                    Error: {run.errorMessage}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}

        {selectedWorkflowRunDetail ? (
          <div className="workflow-run-detail-panel global-workflow-run-detail-panel">
            <div>
              <span className="model-route-card__eyebrow">
                Selected Workflow Run Detail
              </span>
              <h4>{selectedWorkflowRunDetail.workflowRun.workflowName}</h4>
              <p title={selectedWorkflowRunDetail.workflowRun.id}>
                {formatShortId(selectedWorkflowRunDetail.workflowRun.id)}
              </p>
            </div>

            <div className="workflow-execution-summary">
              <h5>Workflow Steps</h5>
              {selectedWorkflowRunDetail.steps.length === 0 ? (
                <p>No workflow steps recorded yet.</p>
              ) : (
                <div className="workflow-step-list">
                  {selectedWorkflowRunDetail.steps.map((step) => (
                    <article className="workflow-step-card" key={step.id}>
                      <div>
                        <strong>
                          {step.orderIndex}. {step.stepName}
                        </strong>
                        <p>{step.stepType}</p>
                      </div>
                      <span>{step.status}</span>
                    </article>
                  ))}
                </div>
              )}



              <WorkflowToolCallingPlanPanel
                workflowRunId={selectedWorkflowRunDetail.workflowRun.id}
                result={
                  workflowToolCallingPlanResult?.plan.workflowRunId ===
                  selectedWorkflowRunDetail.workflowRun.id
                    ? workflowToolCallingPlanResult
                    : null
                }
                isRunning={isExecutingWorkflowToolCallingPlan}
                error={workflowToolCallingPlanError}
                success={workflowToolCallingPlanSuccess}
                onRun={handleExecuteWorkflowToolCallingPlan}
              />

              <h5>Grounding / Connector Calls</h5>
              {selectedWorkflowRunDetail.toolCallLogs.filter(isGroundingToolCallLog).length === 0 ? (
                <p>No grounding connector calls recorded yet.</p>
              ) : (
                <div className="workflow-tool-log-list">
                  {selectedWorkflowRunDetail.toolCallLogs
                    .filter(isGroundingToolCallLog)
                    .map((log) => (
                      <ToolCallLogCard key={log.id} toolCallLog={log} />
                    ))}
                </div>
              )}

              <h5>Review Queue</h5>
              {selectedWorkflowRunDetail.reviewQueueItems.length === 0 ? (
                <p>No review queue items created yet.</p>
              ) : (
                <div className="workflow-tool-log-list">
                  {selectedWorkflowRunDetail.reviewQueueItems.map((item) => (
                    <article className="workflow-tool-log-card" key={item.id}>
                      <div>
                        <strong>{item.reason}</strong>
                        <p><strong>Source:</strong> {getWorkflowReviewQueueDisplayText(item, selectedBatchDetail?.items)}</p>
                        <p><strong>Grounding:</strong> {getGroundingSummaryFromReviewItem(item) ?? "—"}</p>
                        <p><strong>Possible matches:</strong> {getGroundingMatchNamesFromReviewItem(item)}</p>
                        {item.reviewerNotes ? (
                          <p><strong>Reviewer notes:</strong> {item.reviewerNotes}</p>
                        ) : null}
                      </div>
                      <span>{item.status}</span>
                    </article>
                  ))}
                </div>
              )}

              <details className="workflow-audit-log-details">
                <summary>
                  MCP / Tool Invocation Audit Logs
                  <span>{selectedWorkflowRunDetail.toolCallLogs.length} recorded</span>
                </summary>
                {selectedWorkflowRunDetail.toolCallLogs.length === 0 ? (
                  <p>No MCP or workflow simulation tool logs recorded yet.</p>
                ) : (
                  <div className="workflow-tool-log-list">
                    {selectedWorkflowRunDetail.toolCallLogs
                      .filter((log) => !isGroundingToolCallLog(log))
                      .map((log) => (
                        <ToolCallLogCard key={log.id} toolCallLog={log} />
                      ))}
                  </div>
                )}
              </details>
            </div>
          </div>
        ) : null}
      </DashboardSection>
      ) : null}

      {activeView === "REVIEW_QUEUE" ? (
      <DashboardSection
        title="Global Review Queue"
        description="All human-in-the-loop review work across workflow runs."
      >
        {!isLoadingGlobalReviewQueue && !globalReviewQueueError ? (
          <p className="section-summary">
            {openReviewQueueItemCount} open review{" "}
            {openReviewQueueItemCount === 1 ? "item" : "items"} /{" "}
            {globalReviewQueueItems.length} total
          </p>
        ) : null}

        {reviewQueueActionSuccess ? (
          <p className="form-message form-message--success">
            {reviewQueueActionSuccess}
          </p>
        ) : null}

        {reviewQueueActionError ? (
          <p className="form-message form-message--error">
            {reviewQueueActionError}
          </p>
        ) : null}

        {isLoadingGlobalReviewQueue ? <p>Loading review queue…</p> : null}

        {globalReviewQueueError ? (
          <EmptyState
            title="Unable to load review queue"
            message={globalReviewQueueError}
          />
        ) : null}

        {!isLoadingGlobalReviewQueue &&
        !globalReviewQueueError &&
        globalReviewQueueItems.length === 0 ? (
          <EmptyState
            title="No review work queued"
            message="Run a needs-review workflow simulation to create human review items."
          />
        ) : null}

        {!isLoadingGlobalReviewQueue &&
        !globalReviewQueueError &&
        globalReviewQueueItems.length > 0 ? (
          <div className="review-queue-list">
            {globalReviewQueueItems.map((item) => (
              <article className="review-queue-card" key={item.id}>
                <div className="review-queue-card__header">
                  <div>
                    <span className="model-route-card__eyebrow">
                      {item.status}
                    </span>
                    <h3>{item.reason}</h3>
                    <p><strong>Source:</strong> {getGlobalReviewQueueDisplayText(item)}</p>
                  </div>

                  <span className="review-queue-card__status">
                    {item.status}
                  </span>
                </div>

                <dl className="review-queue-card__context">
                  <div>
                    <dt>Reason</dt>
                    <dd>{item.reason}</dd>
                  </div>

                  <div>
                    <dt>Grounding</dt>
                    <dd>{getGroundingSummaryFromReviewItem(item) ?? "—"}</dd>
                  </div>

                  <div>
                    <dt>Possible Matches</dt>
                    <dd>{getGroundingMatchNamesFromReviewItem(item)}</dd>
                  </div>

                  <div>
                    <dt>Batch</dt>
                    <dd>{item.intakeBatch?.name ?? "—"}</dd>
                  </div>

                  <div>
                    <dt>Workflow</dt>
                    <dd>{item.workflowRun?.workflowName ?? "—"}</dd>
                  </div>

                  <div>
                    <dt>Run Status</dt>
                    <dd>{item.workflowRun?.status ?? "—"}</dd>
                  </div>
                </dl>

                <details className="workflow-audit-log-details">
                  <summary>
                    Proposed Golf Club JSON
                    <span>collapsed</span>
                  </summary>
                  <div className="review-queue-card__json">
                    <pre>{formatJson(item.proposedGolfClubJson)}</pre>
                  </div>
                </details>

                {item.reviewerNotes ? (
                  <p className="review-queue-card__meta">
                    Reviewer notes: {item.reviewerNotes}
                  </p>
                ) : null}

                {item.resolvedAt ? (
                  <p className="review-queue-card__meta">
                    Resolved at: {item.resolvedAt}
                  </p>
                ) : null}

                {renderReviewQueueActionControls({
                  item,
                  workflowRunId: item.workflowRunId,
                  intakeBatchId: getReviewQueueItemBatchId(item),
                })}
              </article>
            ))}
          </div>
        ) : null}
      </DashboardSection>
      ) : null}

      {activeView === "MODEL_ROUTING" ? (
      <DashboardSection
        title="Model Routing Preview"
        description="Preview provider selection across mock, OpenAI, Anthropic, Azure OpenAI, and local/open-source style providers based on task needs."
      >
        <div className="section-intro-card">
          <span className="model-route-card__eyebrow">Resume Story</span>
          <h3>Provider routing separated from workflow logic</h3>
          <p>
            The workflow asks for a task outcome. The routing layer decides which
            provider/model should handle it based on task type, JSON requirements,
            provider availability, cost, latency, and quality goals.
          </p>
        </div>

        <form className="model-routing-preview-form" onSubmit={handlePreviewModelRouting}>
          <label>
            Task Type
            <select
              onChange={(event) =>
                setModelRoutingTaskType(event.target.value as ModelTaskType)
              }
              value={modelRoutingTaskType}
            >
              {MODEL_TASK_TYPES.map((taskType) => (
                <option key={taskType} value={taskType}>
                  {formatEnumLabel(taskType)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Preferred Goal
            <select
              onChange={(event) =>
                setModelRoutingGoal(event.target.value as ModelRoutingGoal)
              }
              value={modelRoutingGoal}
            >
              {MODEL_ROUTING_GOALS.map((goal) => (
                <option key={goal} value={goal}>
                  {formatEnumLabel(goal)}
                </option>
              ))}
            </select>
          </label>

          <label className="model-routing-preview-form__checkbox">
            <input
              checked={modelRoutingRequireJson}
              onChange={(event) => setModelRoutingRequireJson(event.target.checked)}
              type="checkbox"
            />
            Require structured JSON output
          </label>

          <label className="model-routing-preview-form__checkbox">
            <input
              checked={modelRoutingAllowDisabledProviders}
              onChange={(event) =>
                setModelRoutingAllowDisabledProviders(event.target.checked)
              }
              type="checkbox"
            />
            Include disabled providers for portfolio simulation
          </label>

          <button disabled={isPreviewingModelRouting} type="submit">
            {isPreviewingModelRouting ? "Previewing…" : "Preview Model Route"}
          </button>
        </form>

        {modelRoutingPreviewError ? (
          <p className="form-message form-message--error">
            {modelRoutingPreviewError}
          </p>
        ) : null}

        {modelRoutingPreview ? (
          <div className="model-routing-preview-result">
            <article className="model-routing-selected-card">
              <div>
                <span className="model-route-card__eyebrow">Selected Route</span>
                <h3>
                  {modelRoutingPreview.routingDecision.provider} /{" "}
                  {modelRoutingPreview.routingDecision.model}
                </h3>
                <p>{modelRoutingPreview.routingDecision.reason}</p>
              </div>

              <dl>
                <div>
                  <dt>Task</dt>
                  <dd>{formatEnumLabel(modelRoutingPreview.routingRequest.taskType)}</dd>
                </div>

                <div>
                  <dt>Goal</dt>
                  <dd>{formatEnumLabel(modelRoutingPreview.routingRequest.preferredGoal)}</dd>
                </div>

                <div>
                  <dt>JSON</dt>
                  <dd>{String(modelRoutingPreview.routingRequest.requireJson)}</dd>
                </div>

                <div>
                  <dt>Cost</dt>
                  <dd>{modelRoutingPreview.routingDecision.estimatedCostTier}</dd>
                </div>

                <div>
                  <dt>Latency</dt>
                  <dd>{modelRoutingPreview.routingDecision.expectedLatencyTier}</dd>
                </div>

                <div>
                  <dt>Quality</dt>
                  <dd>{modelRoutingPreview.routingDecision.qualityTier}</dd>
                </div>
              </dl>

              {modelRoutingPreview.routingDecision.fallbackReason ? (
                <p className="model-routing-selected-card__fallback">
                  Fallback: {modelRoutingPreview.routingDecision.fallbackReason}
                </p>
              ) : null}
            </article>

            <div className="model-routing-preview-grid">
              <div>
                <h4>Candidates Considered</h4>

                <div className="model-routing-candidate-list">
                  {modelRoutingPreview.routingDecision.candidatesConsidered.map(
                    (candidate: ModelRouteCandidateSummary) => (
                      <article
                        className="model-routing-candidate-card"
                        key={`${candidate.provider}-${candidate.model}`}
                      >
                        <div>
                          <strong>
                            {candidate.provider} / {candidate.model}
                          </strong>
                          <p>
                            Supports {candidate.supportedTaskTypes.length} task
                            type{candidate.supportedTaskTypes.length === 1 ? "" : "s"}.
                          </p>
                        </div>

                        <dl>
                          <div>
                            <dt>Cost</dt>
                            <dd>{candidate.costTier}</dd>
                          </div>

                          <div>
                            <dt>Latency</dt>
                            <dd>{candidate.latencyTier}</dd>
                          </div>

                          <div>
                            <dt>Quality</dt>
                            <dd>{candidate.qualityTier}</dd>
                          </div>

                          <div>
                            <dt>Executable</dt>
                            <dd>{String(candidate.enabledForExecution)}</dd>
                          </div>
                        </dl>
                      </article>
                    ),
                  )}
                </div>
              </div>

              <div>
                <h4>Rejected Candidates</h4>

                {modelRoutingPreview.routingDecision.rejectedCandidates.length === 0 ? (
                  <EmptyState
                    title="No rejected candidates"
                    message="Every considered provider/model matched this routing request."
                  />
                ) : (
                  <div className="model-routing-candidate-list">
                    {modelRoutingPreview.routingDecision.rejectedCandidates.map(
                      (candidate: ModelRouteRejectedCandidate) => (
                        <article
                          className="model-routing-candidate-card model-routing-candidate-card--rejected"
                          key={`${candidate.provider}-${candidate.model}`}
                        >
                          <div>
                            <strong>
                              {candidate.provider} / {candidate.model}
                            </strong>
                            <p>{candidate.rejectedReasons.join(", ")}</p>
                          </div>

                          <dl>
                            <div>
                              <dt>Cost</dt>
                              <dd>{candidate.costTier}</dd>
                            </div>

                            <div>
                              <dt>Latency</dt>
                              <dd>{candidate.latencyTier}</dd>
                            </div>

                            <div>
                              <dt>Quality</dt>
                              <dd>{candidate.qualityTier}</dd>
                            </div>

                            <div>
                              <dt>JSON</dt>
                              <dd>{String(candidate.supportsJson)}</dd>
                            </div>
                          </dl>
                        </article>
                      ),
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            title="No model route preview yet"
            message="Choose a task and goal to preview how SwingOps selects a model provider."
          />
        )}
      </DashboardSection>
      ) : null}

      {activeView === "MCP_CONNECTORS" ? (
      <DashboardSection
        title="MCP Connector Catalog and Run History"
        description="Catalog internal connector tools, try policy-governed read-only execution, and review persisted ToolCallLog audit history."
      >
        <div className="section-intro-card">
          <span className="model-route-card__eyebrow">Internal MCP-style Surface</span>
          <h3>Policy-governed tool invocation with audit history</h3>
          <p>
            This is currently an internal MCP-style connector invocation surface,
            not an external MCP server. The page shows which tools are exposed,
            why policy allows or blocks them, whether execution was attempted,
            and the persisted ToolCallLog trail for portfolio review.
          </p>
        </div>

        <div className="mcp-page-grid">
          <section className="mcp-page-section">
            <div className="mcp-page-section__header">
              <div>
                <span className="model-route-card__eyebrow">Connector Catalog</span>
                <h3>Available internal connector tools</h3>
                <p>
                  Each card shows risk, mutation behavior, approval requirements,
                  allowed mode, last invocation, and audit counts.
                </p>
              </div>

              <button
                onClick={() => void loadMcpConnectorCatalog()}
                type="button"
              >
                Refresh Catalog
              </button>
            </div>

            {isLoadingMcpConnectorCatalog ? <p>Loading connector catalog…</p> : null}

            {mcpConnectorCatalogError ? (
              <EmptyState
                title="Unable to load connector catalog"
                message={mcpConnectorCatalogError}
              />
            ) : null}

            {!isLoadingMcpConnectorCatalog &&
            !mcpConnectorCatalogError &&
            mcpConnectorCatalog.length === 0 ? (
              <EmptyState
                title="No connectors registered"
                message="No internal connector tools were returned by the API."
              />
            ) : null}

            {!isLoadingMcpConnectorCatalog &&
            !mcpConnectorCatalogError &&
            mcpConnectorCatalog.length > 0 ? (
              <div className="mcp-connector-catalog-grid">
                {mcpConnectorCatalog.map((connector) => (
                  <ConnectorCatalogCard
                    connector={connector}
                    key={connector.name}
                  />
                ))}
              </div>
            ) : null}
          </section>

          <section className="mcp-page-section">
            <div className="mcp-page-section__header">
              <div>
                <span className="model-route-card__eyebrow">Try a Connector</span>
                <h3>Run a safe read-only connector or blocked mutation demo</h3>
                <p>
                  The request is evaluated by policy first. Allowed read-only
                  calls execute. Disabled or mutating calls are blocked and still
                  persisted as ToolCallLog audit records.
                </p>
              </div>
            </div>

            <form
              className="read-only-mcp-demo-form"
              onSubmit={handleExecuteReadOnlyMcpTool}
            >
              <label>
                Tool
                <select
                  onChange={(event) =>
                    setSelectedReadOnlyMcpToolName(
                      event.target.value as ReadOnlyMcpToolName,
                    )
                  }
                  value={selectedReadOnlyMcpToolName}
                >
                  {readOnlyMcpToolOptions.map((tool) => (
                    <option key={tool.name} value={tool.name}>
                      {tool.label}
                    </option>
                  ))}
                </select>
              </label>

              {selectedReadOnlyMcpToolName === "swingops.workflowRuns.get" ? (
                <label>
                  Workflow Run
                  <select
                    onChange={(event) =>
                      setSelectedReadOnlyMcpWorkflowRunId(event.target.value)
                    }
                    value={selectedMcpWorkflowRunId}
                  >
                    {globalWorkflowRuns.map((run) => (
                      <option key={run.id} value={run.id}>
                        {run.workflowName} / {run.status}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <article className="read-only-mcp-tool-card">
                <div>
                  <span className="model-route-card__eyebrow">
                    {selectedReadOnlyMcpTool.blockedDemo
                      ? "Blocked mutation demo"
                      : "Safe read-only tool"}
                  </span>
                  <h3>{selectedReadOnlyMcpTool.name}</h3>
                  <p>{selectedReadOnlyMcpTool.description}</p>
                </div>

                <dl>
                  <div>
                    <dt>Risk</dt>
                    <dd>{selectedReadOnlyMcpTool.riskLevel}</dd>
                  </div>

                  <div>
                    <dt>Mutates Data</dt>
                    <dd>{String(selectedReadOnlyMcpTool.mutatesData)}</dd>
                  </div>

                  <div>
                    <dt>Requires Approval</dt>
                    <dd>{String(selectedReadOnlyMcpTool.requiresHumanApproval)}</dd>
                  </div>

                  <div>
                    <dt>Enabled</dt>
                    <dd>{formatEnabledLabel(selectedReadOnlyMcpTool.enabled)}</dd>
                  </div>
                </dl>
              </article>

              {readOnlyMcpInvocationError ? (
                <p className="form-message form-message--error">
                  {readOnlyMcpInvocationError}
                </p>
              ) : null}

              <button disabled={isExecutingReadOnlyMcpTool} type="submit">
                {isExecutingReadOnlyMcpTool
                  ? "Executing connector…"
                  : selectedReadOnlyMcpTool.blockedDemo
                    ? "Run Blocked Demo"
                    : "Execute Read-Only Tool"}
              </button>
            </form>

            {readOnlyMcpInvocationResult ? (
              <ReadOnlyMcpConnectorResultCard result={readOnlyMcpInvocationResult} />
            ) : (
              <EmptyState
                title="No connector invocation yet"
                message="Choose a safe read-only connector or the blocked mutation demo to see policy enforcement and persisted audit logs."
              />
            )}
          </section>

          <section className="mcp-page-section">
            <div className="mcp-page-section__header">
              <div>
                <span className="model-route-card__eyebrow">Invocation History</span>
                <h3>Recent ToolCallLog audit records</h3>
                <p>{mcpAuditStory}</p>
              </div>

              <button
                onClick={() => void loadMcpInvocationHistory()}
                type="button"
              >
                Refresh History
              </button>
            </div>

            {isLoadingMcpInvocationHistory ? (
              <p>Loading invocation history…</p>
            ) : null}

            {mcpInvocationHistoryError ? (
              <EmptyState
                title="Unable to load invocation history"
                message={mcpInvocationHistoryError}
              />
            ) : null}

            {!isLoadingMcpInvocationHistory &&
            !mcpInvocationHistoryError &&
            mcpInvocationHistory.length === 0 ? (
              <EmptyState
                title="No connector history yet"
                message="Run the safe read-only connector and the blocked mutation demo to populate the audit history."
              />
            ) : null}

            {!isLoadingMcpInvocationHistory &&
            !mcpInvocationHistoryError &&
            mcpInvocationHistory.length > 0 ? (
              <div className="mcp-invocation-history-list">
                {mcpInvocationHistory.map((invocation) => (
                  <ConnectorInvocationHistoryCard
                    invocation={invocation}
                    key={invocation.id}
                  />
                ))}
              </div>
            ) : null}
          </section>
        </div>
      </DashboardSection>
      ) : null}

      {activeView === "INTAKE" ? (
      <DashboardSection
        title="Selected Intake Batch"
        description="Raw trade-in items that will become workflow input for future AI processing."
      >
        {isLoadingBatchDetail ? <p>Loading batch details…</p> : null}

        {batchDetailError ? (
          <EmptyState
            title="Unable to load selected batch"
            message={batchDetailError}
          />
        ) : null}

        {!isLoadingBatchDetail && !batchDetailError && !selectedBatchDetail ? (
          <EmptyState
            title="No intake batch selected"
            message="Choose View Details on an intake batch to inspect its raw trade-in items."
          />
        ) : null}

        {!isLoadingBatchDetail && !batchDetailError && selectedBatchDetail ? (
          <div className="batch-detail">
            <div className="batch-detail__header batch-detail__header--with-action">
              <div>
                <h3>{selectedBatchDetail.intakeBatch.name}</h3>
                <p>
                  {selectedBatchDetail.intakeBatch.description ??
                    "No description provided."}
                </p>
              </div>

              <button
                disabled={isStartingWorkflow}
                onClick={() => void handleStartWorkflow()}
                type="button"
              >
                {isStartingWorkflow ? "Starting…" : "Start Workflow"}
              </button>
            </div>

            {startWorkflowError ? (
              <p className="form-message form-message--error">
                {startWorkflowError}
              </p>
            ) : null}

            {startWorkflowSuccess ? (
              <p className="form-message form-message--success">
                {startWorkflowSuccess}
              </p>
            ) : null}

            {latestModelCallLog ? (
              <ModelRouteCard modelCallLog={latestModelCallLog} />
            ) : null}

            <div className="raw-item-list">
              {selectedBatchDetail.items.map((item, index) => (
                <article className="raw-item-card" key={item.id}>
                  <span>Item {index + 1}</span>
                  <p>{item.rawText}</p>
                </article>
              ))}
            </div>

            {selectedBatchDetail.workflowRuns.length === 0 ? (
              <EmptyState
                title="No workflow runs yet"
                message="Click Start Workflow to create a queued workflow run with planned steps."
              />
            ) : (
              <div className="workflow-run-list">
                <h4>Workflow Runs</h4>

                {selectedBatchDetail.workflowRuns.map((run) => (
                  <article className="workflow-run-card" key={run.id}>
                    <div>
                      <h5>{run.workflowName}</h5>
                      <p title={run.id}>{formatShortId(run.id)}</p>
                    </div>

                    <div className="workflow-run-card__actions">
                      <strong>{run.status}</strong>

                      <button
                        disabled={isExecutingWorkflowRun}
                        onClick={() =>
                          void handleExecuteWorkflowRun(run.id, "HAPPY_PATH")
                        }
                        type="button"
                      >
                        Run Happy Path
                      </button>

                      <button
                        disabled={isExecutingWorkflowRun}
                        onClick={() =>
                          void handleExecuteWorkflowRun(run.id, "NEEDS_REVIEW")
                        }
                        type="button"
                      >
                        Run Needs Review
                      </button>

                      <button
                        disabled={isLoadingWorkflowRunDetail}
                        onClick={() => void handleSelectWorkflowRun(run.id)}
                        type="button"
                      >
                        View Logs
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {isExecutingWorkflowRun ? <p>Running workflow simulation…</p> : null}

            {executeWorkflowRunSuccess ? (
              <p className="form-message form-message--success">
                {executeWorkflowRunSuccess}
              </p>
            ) : null}

            {executeWorkflowRunError ? (
              <p className="form-message form-message--error">
                {executeWorkflowRunError}
              </p>
            ) : null}

            {isLoadingWorkflowRunDetail ? <p>Loading workflow run logs…</p> : null}

            {workflowRunDetailError ? (
              <p className="form-message form-message--error">
                {workflowRunDetailError}
              </p>
            ) : null}

            {selectedWorkflowRunDetail ? (
              <div className="workflow-run-detail-panel">
                <div>
                  <span className="model-route-card__eyebrow">
                    Workflow Run Detail
                  </span>
                  <h4>{selectedWorkflowRunDetail.workflowRun.workflowName}</h4>
                  <p title={selectedWorkflowRunDetail.workflowRun.id}>
                    {formatShortId(selectedWorkflowRunDetail.workflowRun.id)}
                  </p>
                </div>

                <div className="workflow-execution-summary">
                  <h5>Workflow Steps</h5>

                  {selectedWorkflowRunDetail.steps.length === 0 ? (
                    <p>No workflow steps recorded yet.</p>
                  ) : (
                    <div className="workflow-step-list">
                      {selectedWorkflowRunDetail.steps.map((step) => (
                        <article className="workflow-step-card" key={step.id}>
                          <div>
                            <strong>
                              {step.orderIndex}. {step.stepName}
                            </strong>
                            <p>{step.stepType}</p>
                          </div>
                          <span>{step.status}</span>
                        </article>
                      ))}
                    </div>
                  )}

                  <h5>Grounding / Connector Calls</h5>

                  {selectedWorkflowRunDetail.toolCallLogs.filter(isGroundingToolCallLog).length === 0 ? (
                    <p>No grounding connector calls recorded yet.</p>
                  ) : (
                    <div className="workflow-tool-log-list">
                      {selectedWorkflowRunDetail.toolCallLogs
                        .filter(isGroundingToolCallLog)
                        .map((log) => (
                          <ToolCallLogCard key={log.id} toolCallLog={log} />
                        ))}
                    </div>
                  )}

                  <h5>Review Queue</h5>

                  {selectedWorkflowRunDetail.reviewQueueItems.length === 0 ? (
                    <p>No review queue items created yet.</p>
                  ) : (
                    <div className="workflow-tool-log-list">
                      {selectedWorkflowRunDetail.reviewQueueItems.map((item) => (
                        <article className="workflow-tool-log-card" key={item.id}>
                          <div>
                            <strong>{item.reason}</strong>
                            <p><strong>Source:</strong> {getWorkflowReviewQueueDisplayText(item, selectedBatchDetail?.items)}</p>
                            <p><strong>Grounding:</strong> {getGroundingSummaryFromReviewItem(item) ?? "—"}</p>
                            <p><strong>Possible matches:</strong> {getGroundingMatchNamesFromReviewItem(item)}</p>
                            {item.reviewerNotes ? (
                              <p>Reviewer notes: {item.reviewerNotes}</p>
                            ) : null}
                            {item.resolvedAt ? (
                              <p>Resolved at: {item.resolvedAt}</p>
                            ) : null}

                            {renderReviewQueueActionControls({
                              item,
                              workflowRunId:
                                selectedWorkflowRunDetail.workflowRun.id,
                              intakeBatchId:
                                selectedWorkflowRunDetail.workflowRun
                                  .intakeBatchId,
                            })}
                          </div>

                          <span>{item.status}</span>
                        </article>
                      ))}
                    </div>
                  )}

                  <details className="workflow-audit-log-details">
                    <summary>
                      MCP / Tool Invocation Audit Logs
                      <span>{selectedWorkflowRunDetail.toolCallLogs.length} recorded</span>
                    </summary>

                    {selectedWorkflowRunDetail.toolCallLogs.length === 0 ? (
                      <p>No MCP or workflow simulation tool logs recorded yet.</p>
                    ) : (
                      <div className="workflow-tool-log-list">
                        {selectedWorkflowRunDetail.toolCallLogs
                          .filter((log) => !isGroundingToolCallLog(log))
                          .map((log) => (
                            <ToolCallLogCard key={log.id} toolCallLog={log} />
                          ))}
                      </div>
                    )}
                  </details>
                </div>

                {selectedWorkflowRunDetail.modelCallLogs.length === 0 ? (
                  <EmptyState
                    title="No model call logs"
                    message="This workflow run does not have persisted model call logs yet."
                  />
                ) : (
                  <div className="workflow-model-log-list">
                    {selectedWorkflowRunDetail.modelCallLogs.map((log) => (
                      <ModelRouteCard
                        key={log.id}
                        modelCallLog={log}
                        title="Persisted Model Route"
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </DashboardSection>
      ) : null}

      {activeView === "INTAKE" ? (
      <DashboardSection
        title="Intake Batches"
        description="Messy golf trade-in notes, CSV rows, and email text imported for workflow processing."
      >
        {!isLoadingIntakeBatches && !intakeBatchesError ? (
          <p className="section-summary">
            {intakeBatches.length} intake{" "}
            {intakeBatches.length === 1 ? "batch" : "batches"} loaded
          </p>
        ) : null}

        {isLoadingIntakeBatches ? <p>Loading intake batches…</p> : null}

        {intakeBatchesError ? (
          <EmptyState
            title="Unable to load intake batches"
            message={intakeBatchesError}
          />
        ) : null}

        {!isLoadingIntakeBatches &&
        !intakeBatchesError &&
        intakeBatches.length === 0 ? (
          <EmptyState
            title="No intake batches found"
            message="Create an intake batch through the API to see it here."
          />
        ) : null}

        {!isLoadingIntakeBatches &&
        !intakeBatchesError &&
        intakeBatches.length > 0 ? (
          <div className="intake-batch-list">
            {intakeBatches.map((batch) => (
              <article className="intake-batch-card" key={batch.id}>
                <div>
                  <h3>{batch.name}</h3>
                  <p>{batch.description ?? "No description provided."}</p>
                </div>

                <div className="intake-batch-card__actions">
                  <dl>
                    <div>
                      <dt>Status</dt>
                      <dd>{formatIntakeBatchStatus(batch.status)}</dd>
                    </div>

                    <div>
                      <dt>Source</dt>
                      <dd>{formatIntakeBatchSourceType(batch.sourceType)}</dd>
                    </div>

                    <div>
                      <dt>Items</dt>
                      <dd>{batch.itemCount}</dd>
                    </div>
                  </dl>

                  <button
                    onClick={() => void handleSelectBatch(batch.id)}
                    type="button"
                  >
                    View Details
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </DashboardSection>
      ) : null}
    </main>
  );
}

export default App;
