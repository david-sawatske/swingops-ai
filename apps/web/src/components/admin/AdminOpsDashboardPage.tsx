import { useEffect, useState } from "react";

import { getAdminOpsSummary } from "../../api/workflows";
import type {
  GetAdminOpsSummaryResponse,
  GlobalWorkflowRunSummary,
  OperationalDataOriginFilter,
} from "../../types/workflow";
import { WorkflowQualityChecksPage } from "../workflow-evals/WorkflowQualityChecksPage";
import { AdminOpsAiReadyRecordsPanel } from "./AdminOpsAiReadyRecordsPanel";
import { AdminOpsKnowledgePanel } from "./AdminOpsKnowledgePanel";
import { AdminOpsModelTelemetryPanel } from "./AdminOpsModelTelemetryPanel";
import { AdminOpsNormalizationMatrixPanel } from "./AdminOpsNormalizationMatrixPanel";
import { AdminOpsOperationalBriefing } from "./AdminOpsOperationalBriefing";
import { AdminOpsQualitySafeguards } from "./AdminOpsQualitySafeguards";

type AdminOpsDashboardPageProps = {
  workflowRuns: GlobalWorkflowRunSummary[];
  workflowRunCount: number;
  openReviewQueueItemCount: number;
  toolCallLogCount: number;
  onOpenReviewQueueForRecord: (intakeItemId: string | null) => void;
};

type AdminOpsSection =
  | "AI_READY_RECORDS"
  | "QUALITY_CHECKS"
  | "MODEL_TELEMETRY"
  | "NORMALIZATION_MATRIX"
  | "KNOWLEDGE_GROUNDING";

const ADMIN_OPS_SECTIONS: Array<{
  body: string;
  panelId: string;
  tabId: string;
  title: string;
  value: AdminOpsSection;
}> = [
  {
    body: "Structured output, missing fields, and review state.",
    panelId: "admin-ops-records-panel",
    tabId: "admin-ops-records-tab",
    title: "AI-ready records",
    value: "AI_READY_RECORDS",
  },
  {
    body: "Scenario matrix and protected workflow behavior.",
    panelId: "admin-ops-quality-checks-panel",
    tabId: "admin-ops-quality-checks-tab",
    title: "Quality checks",
    value: "QUALITY_CHECKS",
  },
  {
    body: "Cost, latency, fallback, and validation status.",
    panelId: "admin-ops-model-panel",
    tabId: "admin-ops-model-tab",
    title: "Model telemetry",
    value: "MODEL_TELEMETRY",
  },
  {
    body: "Aliases, negative evidence, and blocked repairs.",
    panelId: "admin-ops-normalization-panel",
    tabId: "admin-ops-normalization-tab",
    title: "Normalization matrix",
    value: "NORMALIZATION_MATRIX",
  },
  {
    body: "Record readiness and source-level grounding signals.",
    panelId: "admin-ops-knowledge-panel",
    tabId: "admin-ops-knowledge-tab",
    title: "Knowledge grounding",
    value: "KNOWLEDGE_GROUNDING",
  },
];

export function AdminOpsDashboardPage({
  onOpenReviewQueueForRecord,
  workflowRuns,
}: AdminOpsDashboardPageProps) {
  const [activeSection, setActiveSection] =
    useState<AdminOpsSection>("AI_READY_RECORDS");
  const [reportScope, setReportScope] =
    useState<OperationalDataOriginFilter>("SEEDED_BASELINE");
  const [summary, setSummary] = useState<GetAdminOpsSummaryResponse | null>(
    null,
  );
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    async function loadOperationalBriefing() {
      try {
        setIsSummaryLoading(true);
        setSummaryError(null);

        const response = await getAdminOpsSummary({
          dataOrigin: reportScope === "ALL" ? undefined : reportScope,
        });

        if (isCurrent) {
          setSummary(response);
        }
      } catch (loadError) {
        if (isCurrent) {
          setSummary(null);
          setSummaryError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load the operational briefing.",
          );
        }
      } finally {
        if (isCurrent) {
          setIsSummaryLoading(false);
        }
      }
    }

    void loadOperationalBriefing();

    return () => {
      isCurrent = false;
    };
  }, [reportScope]);

  return (
    <section className="admin-ops-page" aria-labelledby="admin-ops-title">
      <div className="admin-ops-hero">
        <span className="model-route-card__eyebrow">Admin Ops</span>
        <h2 id="admin-ops-title">Controlled workflow operations</h2>
        <p>
          Inspect records, quality checks, model execution, normalization rules,
          grounding readiness, review routing, and auditability from one
          read-only control surface.
        </p>
      </div>

      <AdminOpsOperationalBriefing
        error={summaryError}
        isLoading={isSummaryLoading}
        onScopeChange={setReportScope}
        scope={reportScope}
        summary={summary}
      />

      <nav
        aria-label="Admin Ops dashboard sections"
        className="admin-ops-section-grid"
        role="tablist"
      >
        {ADMIN_OPS_SECTIONS.map((section) => {
          const isActive = activeSection === section.value;

          return (
            <button
              aria-controls={section.panelId}
              aria-selected={isActive}
              className={
                isActive
                  ? "admin-ops-section-card admin-ops-section-card--active"
                  : "admin-ops-section-card"
              }
              id={section.tabId}
              key={section.value}
              onClick={() => setActiveSection(section.value)}
              role="tab"
              type="button"
            >
              <h3>{section.title}</h3>
              <p>{section.body}</p>
            </button>
          );
        })}
      </nav>

      {activeSection === "AI_READY_RECORDS" ? (
        <div
          aria-labelledby="admin-ops-records-tab"
          className="admin-ops-tab-panel"
          id="admin-ops-records-panel"
          role="tabpanel"
        >
          <AdminOpsAiReadyRecordsPanel
            dataOrigin={reportScope}
            onOpenReviewQueue={onOpenReviewQueueForRecord}
          />
        </div>
      ) : null}

      {activeSection === "QUALITY_CHECKS" ? (
        <section
          aria-labelledby="admin-ops-quality-checks-tab"
          className="admin-ops-embedded-panel admin-ops-tab-panel"
          id="admin-ops-quality-checks-panel"
          role="tabpanel"
        >
          <div className="admin-ops-panel-heading">
            <span className="model-route-card__eyebrow">
              Validation &amp; Quality Checks
            </span>
            <h3 id="admin-ops-quality-checks-title">
              Protected workflow behavior
            </h3>
            <p>
              Run known scenarios against the active workflow safeguards so
              parser behavior, review routing, correction suggestions, and
              protected execution remain verifiable.
            </p>
            <p className="admin-ops-scope-note">
              Live executable checks — these scenarios verify current code and
              are not filtered by the reporting data selection above.
            </p>
          </div>

          <AdminOpsQualitySafeguards />

          <WorkflowQualityChecksPage />
        </section>
      ) : null}

      {activeSection === "MODEL_TELEMETRY" ? (
        <div
          aria-labelledby="admin-ops-model-tab"
          className="admin-ops-tab-panel"
          id="admin-ops-model-panel"
          role="tabpanel"
        >
          <AdminOpsModelTelemetryPanel
            dataOrigin={reportScope}
            workflowRuns={workflowRuns}
          />
        </div>
      ) : null}

      {activeSection === "NORMALIZATION_MATRIX" ? (
        <div
          aria-labelledby="admin-ops-normalization-tab"
          className="admin-ops-tab-panel"
          id="admin-ops-normalization-panel"
          role="tabpanel"
        >
          <p className="admin-ops-scope-note">
            Current application configuration — normalization rules are not
            filtered by reporting data.
          </p>
          <AdminOpsNormalizationMatrixPanel />
        </div>
      ) : null}

      {activeSection === "KNOWLEDGE_GROUNDING" ? (
        <div
          aria-labelledby="admin-ops-knowledge-tab"
          className="admin-ops-tab-panel"
          id="admin-ops-knowledge-panel"
          role="tabpanel"
        >
          <AdminOpsKnowledgePanel dataOrigin={reportScope} />
        </div>
      ) : null}
    </section>
  );
}
