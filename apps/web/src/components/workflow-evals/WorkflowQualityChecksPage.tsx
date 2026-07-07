import { useEffect, useMemo, useState } from "react";

import {
  listWorkflowEvalScenarios,
  runWorkflowEvals,
} from "../../api/workflows";
import type {
  RunWorkflowEvalsResponse,
  WorkflowEvalObservedRecord,
  WorkflowEvalPriorReviewSuggestion,
  WorkflowEvalResult,
  WorkflowEvalScenarioSummary,
} from "../../types/workflow";
import {
  formatWorkflowEvalExecutionMode,
  formatWorkflowEvalStatus,
  getWorkflowEvalStatusClassName,
  summarizeWorkflowEvalFailures,
} from "./workflowEvalFormatting";

const QUALITY_GUARDRAILS = [
  {
    title: "No invented defaults",
    body:
      "Unknown shaft, condition, and value fields stay blank until source text or review supports them.",
  },
  {
    title: "Evidence stays attached",
    body:
      "Normalized parser fields keep the raw phrase that produced each value.",
  },
  {
    title: "Review routing remains active",
    body:
      "Incomplete or low-confidence records still create review work.",
  },
  {
    title: "Learning stays suggestive",
    body:
      "Prior corrections can surface as suggestions, but they do not auto-apply.",
  },
];

function WorkflowEvalMetricCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <article className="workflow-eval-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function WorkflowEvalGuardrailGrid() {
  return (
    <section
      className="workflow-eval-guardrail-grid"
      aria-label="Protected workflow behaviors"
    >
      {QUALITY_GUARDRAILS.map((guardrail) => (
        <article className="workflow-eval-guardrail-card" key={guardrail.title}>
          <strong>{guardrail.title}</strong>
          <p>{guardrail.body}</p>
        </article>
      ))}
    </section>
  );
}

function formatNullableField(value: string | number | null) {
  return value === null ? "Blank" : String(value);
}

function formatConfidence(confidence: number) {
  return `${Math.round(confidence * 100)}%`;
}

function formatSuggestionStatus(status: string) {
  if (status === "SUGGESTED") {
    return "Suggestion only";
  }

  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function WorkflowEvalObservedField({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
  return (
    <div className="workflow-eval-observed-field">
      <dt>{label}</dt>
      <dd>{formatNullableField(value)}</dd>
    </div>
  );
}

function WorkflowEvalSuggestionList({
  suggestions = [],
}: {
  suggestions?: WorkflowEvalPriorReviewSuggestion[];
}) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <section
      className="workflow-eval-suggestion-list"
      aria-label="Prior review suggestions"
    >
      <div>
        <span className="model-route-card__eyebrow">Prior review suggestion</span>
        <h5>Reviewer-approved evidence found, but not auto-applied</h5>
      </div>

      {suggestions.map((suggestion) => (
        <article
          className="workflow-eval-suggestion-card"
          key={suggestion.sourceLearningEventId}
        >
          <dl>
            <div>
              <dt>Field</dt>
              <dd>{suggestion.fieldName}</dd>
            </div>
            <div>
              <dt>Raw phrase</dt>
              <dd>{suggestion.rawTextMatch ?? "Blank"}</dd>
            </div>
            <div>
              <dt>Suggested value</dt>
              <dd>{suggestion.suggestedValue ?? "Blank"}</dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd>{formatConfidence(suggestion.confidence)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{formatSuggestionStatus(suggestion.status)}</dd>
            </div>
          </dl>

          <p>{suggestion.confidenceImpact}</p>
        </article>
      ))}
    </section>
  );
}

function WorkflowEvalProofStrip({
  result,
}: {
  result: WorkflowEvalResult;
}) {
  const firstRecord = result.observed.records[0] ?? null;
  const parserEvidenceEntries = Object.entries(firstRecord?.parserEvidence ?? {});
  const proofItems = [
    {
      label: "Shaft",
      value: firstRecord?.shaftFlex ?? "Blank",
    },
    {
      label: "Trade value",
      value:
        firstRecord?.tradeInValue === null || firstRecord?.tradeInValue === undefined
          ? "Blank"
          : `$${firstRecord.tradeInValue}`,
    },
    {
      label: "Review",
      value: firstRecord?.reviewNeeded ? "Yes" : "No",
    },
    {
      label: "Suggestions",
      value: result.observed.priorReviewSuggestionCount,
    },
  ];

  return (
    <div
      className="workflow-eval-proof-strip"
      aria-label={`${result.scenarioName} proof points`}
    >
      {proofItems.map((item) => (
        <article key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </article>
      ))}

      {parserEvidenceEntries.slice(0, 3).map(([fieldName, evidence]) => (
        <article className="workflow-eval-proof-strip__wide" key={fieldName}>
          <span>{fieldName}</span>
          <strong>
            {String(evidence.value)} from “{evidence.sourceText}”
          </strong>
        </article>
      ))}
    </div>
  );
}

function WorkflowEvalRecordSnapshot({
  record,
}: {
  record: WorkflowEvalObservedRecord;
}) {
  const parserEvidenceEntries = Object.entries(record.parserEvidence ?? {});

  return (
    <section className="workflow-eval-record-snapshot">
      <dl>
        <WorkflowEvalObservedField label="Brand" value={record.brand} />
        <WorkflowEvalObservedField
          label="Product line"
          value={record.productLine}
        />
        <WorkflowEvalObservedField label="Category" value={record.category} />
        <WorkflowEvalObservedField label="Shaft flex" value={record.shaftFlex} />
        <WorkflowEvalObservedField
          label="Condition"
          value={record.conditionGrade}
        />
        <WorkflowEvalObservedField
          label="Trade-in value"
          value={record.tradeInValue === null ? null : `$${record.tradeInValue}`}
        />
        <WorkflowEvalObservedField
          label="Missing fields"
          value={
            record.missingFields.length > 0
              ? record.missingFields.join(", ")
              : "None"
          }
        />
        <WorkflowEvalObservedField
          label="Review needed"
          value={record.reviewNeeded ? "Yes" : "No"}
        />
      </dl>

      {parserEvidenceEntries.length > 0 ? (
        <div className="workflow-eval-evidence-list">
          {parserEvidenceEntries.map(([fieldName, evidence]) => (
            <article key={fieldName}>
              <strong>{fieldName}</strong>
              <p>
                {String(evidence.value)} from “{evidence.sourceText}”
              </p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function WorkflowEvalObservedPanel({
  result,
}: {
  result: WorkflowEvalResult;
}) {
  const firstRecord = result.observed.records[0] ?? null;

  return (
    <section
      className="workflow-eval-observed-panel"
      aria-label={`${result.scenarioName} observed result`}
    >
      <div className="workflow-eval-observed-header">
        <div>
          <span className="model-route-card__eyebrow">Observed result</span>
          <h5>Actual workflow behavior</h5>
        </div>
        <p className="workflow-eval-success-note">
          {summarizeWorkflowEvalFailures(result.failures)}
        </p>
      </div>

      <div className="workflow-eval-result-metrics">
        <WorkflowEvalMetricCard
          label="Parsed"
          value={result.observed.parsedRecordCount}
        />
        <WorkflowEvalMetricCard
          label="AI-ready"
          value={result.observed.aiReadyRecordCount}
        />
        <WorkflowEvalMetricCard
          label="Review items"
          value={result.observed.reviewItemCount}
        />
        <WorkflowEvalMetricCard
          label="Suggestions"
          value={result.observed.priorReviewSuggestionCount}
        />
      </div>

      <WorkflowEvalProofStrip result={result} />

      <WorkflowEvalSuggestionList
        suggestions={result.observed.priorReviewSuggestions ?? []}
      />

      {result.failures.length > 0 ? (
        <div className="workflow-eval-failure-list">
          {result.failures.map((failure) => (
            <article key={`${result.scenarioId}-${failure.expectation}`}>
              <strong>{failure.expectation}</strong>
              <p>{failure.message}</p>
            </article>
          ))}
        </div>
      ) : null}

      {firstRecord ? (
        <details className="workflow-eval-result-details">
          <summary>View observed record details</summary>
          <WorkflowEvalRecordSnapshot record={firstRecord} />
        </details>
      ) : null}
    </section>
  );
}

function WorkflowEvalScenarioCard({
  result,
  scenario,
}: {
  result: WorkflowEvalResult | null;
  scenario: WorkflowEvalScenarioSummary;
}) {
  return (
    <article className="workflow-eval-scenario-card">
      <header className="workflow-eval-scenario-card__header">
        <div>
          <span className="model-route-card__eyebrow">
            {scenario.workflowStage} · {scenario.sourceType} ·{" "}
            {formatWorkflowEvalExecutionMode(scenario.executionMode)}
          </span>
          <h4>{scenario.name}</h4>
          <p>{scenario.description}</p>
        </div>

        {result ? (
          <span className={getWorkflowEvalStatusClassName(result.status)}>
            {formatWorkflowEvalStatus(result.status)}
          </span>
        ) : (
          <span className="workflow-eval-status workflow-eval-status--ready">
            Ready
          </span>
        )}
      </header>

      <section className="workflow-eval-scenario-grid">
        <div className="workflow-eval-scenario-panel">
          <span className="model-route-card__eyebrow">Protected behavior</span>
          <p>{scenario.protectedBehavior}</p>
        </div>

        <div className="workflow-eval-scenario-panel">
          <span className="model-route-card__eyebrow">Why this matters</span>
          <p>{scenario.failureImpact}</p>
        </div>
      </section>

      <section className="workflow-eval-input-panel">
        <span className="model-route-card__eyebrow">Sample input</span>
        <pre>{scenario.sampleInput}</pre>
      </section>

      {result ? <WorkflowEvalObservedPanel result={result} /> : null}

      <details className="workflow-eval-result-details">
        <summary>Expected behavior</summary>
        <ul className="workflow-eval-expected-list">
          {scenario.expectedBehavior.map((expectation) => (
            <li key={expectation}>{expectation}</li>
          ))}
        </ul>
      </details>
    </article>
  );
}

export function WorkflowQualityChecksPage() {
  const [scenarios, setScenarios] = useState<WorkflowEvalScenarioSummary[]>([]);
  const [result, setResult] = useState<RunWorkflowEvalsResponse | null>(null);
  const [isLoadingScenarios, setIsLoadingScenarios] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resultByScenarioId = useMemo(
    () =>
      new Map(
        result?.results.map((scenarioResult) => [
          scenarioResult.scenarioId,
          scenarioResult,
        ]) ?? [],
      ),
    [result],
  );

  async function loadScenarios() {
    try {
      setIsLoadingScenarios(true);
      setError(null);

      const response = await listWorkflowEvalScenarios();

      setScenarios(response.scenarios);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load quality check scenarios.",
      );
    } finally {
      setIsLoadingScenarios(false);
    }
  }

  async function handleRunQualityChecks() {
    try {
      setIsRunning(true);
      setError(null);

      const response = await runWorkflowEvals();

      setResult(response);
    } catch (runError) {
      setError(
        runError instanceof Error
          ? runError.message
          : "Unable to run quality checks.",
      );
    } finally {
      setIsRunning(false);
    }
  }

  useEffect(() => {
    void loadScenarios();
  }, []);

  return (
    <section className="workflow-eval-page">
      <article className="guided-workflow-card workflow-eval-hero-card">
        <div className="workflow-eval-hero-card__content">
          <span className="model-route-card__eyebrow">Quality Checks</span>
          <h3>Reliability guardrails for the trade-in workflow</h3>
          <p>
            Run known scenarios against the same workflow code used by the main
            trade-in path. A passing check means the workflow matched the expected
            guardrail behavior, including cases that should route to review.
          </p>
        </div>

        <button
          className="guided-step-primary-action"
          disabled={isRunning}
          onClick={() => void handleRunQualityChecks()}
          type="button"
        >
          {isRunning ? "Running Quality Checks..." : "Run Quality Checks"}
        </button>
      </article>

      <WorkflowEvalGuardrailGrid />

      <p className="workflow-eval-interpretation-note">
        Expected outcomes can include review routing. For example, an unknown shaft
        value passes when it stays blank and creates a review item.
      </p>

      {error ? <p className="workflow-eval-error">{error}</p> : null}

      {result ? (
        <section
          className="workflow-eval-summary-grid"
          aria-label="Quality check summary"
        >
          <WorkflowEvalMetricCard label="Checks run" value={result.summary.total} />
          <WorkflowEvalMetricCard
            label="Expected outcomes met"
            value={result.summary.passed}
          />
          <WorkflowEvalMetricCard
            label="Unexpected outcomes"
            value={result.summary.failed}
          />
        </section>
      ) : null}

      <section
        className="workflow-eval-scenario-list"
        aria-label="Quality check scenarios"
      >
        {isLoadingScenarios ? (
          <p>Loading quality check scenarios...</p>
        ) : (
          scenarios.map((scenario) => (
            <WorkflowEvalScenarioCard
              key={scenario.id}
              result={resultByScenarioId.get(scenario.id) ?? null}
              scenario={scenario}
            />
          ))
        )}
      </section>
    </section>
  );
}
