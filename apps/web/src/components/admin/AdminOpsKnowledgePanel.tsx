import { useEffect, useState } from "react";

import { getAdminOpsSummary } from "../../api/workflows";
import type { GetAdminOpsSummaryResponse } from "../../types/workflow";
import {
  AdminOpsInspectionGuide,
  AdminOpsMetricCard,
  formatAdminOpsPercent,
} from "./adminOpsPresentation";

export function AdminOpsKnowledgePanel() {
  const [summary, setSummary] = useState<GetAdminOpsSummaryResponse | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadKnowledgeSummary() {
    try {
      setIsLoading(true);
      setError(null);

      const response = await getAdminOpsSummary();

      setSummary(response);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load grounding readiness.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadKnowledgeSummary();
  }, []);

  const aiReadyRecords = summary?.aiReadyRecords ?? null;
  const activeSourceCount =
    aiReadyRecords?.sourceQuality.filter((entry) => entry.active > 0).length ??
    0;

  const sourceWithMostReview = aiReadyRecords
    ? ([...aiReadyRecords.sourceQuality]
        .filter((entry) => entry.active > 0)
        .sort((left, right) => {
          const leftRate =
            left.active > 0 ? left.reviewNeeded / left.active : 0;
          const rightRate =
            right.active > 0 ? right.reviewNeeded / right.active : 0;

          return rightRate - leftRate || right.reviewNeeded - left.reviewNeeded;
        })[0] ?? null)
    : null;

  const attentionText = aiReadyRecords
    ? aiReadyRecords.reviewNeeded === 0
      ? "No active AI-ready records are currently marked as requiring review."
      : sourceWithMostReview
        ? `${aiReadyRecords.reviewNeeded} active records need review. ${sourceWithMostReview.sourceType} has the highest current source-level review pressure.`
        : `${aiReadyRecords.reviewNeeded} active records still need review before dependable downstream grounding use.`
    : "Grounding attention signals will appear after the Admin Ops summary loads.";

  return (
    <section
      className="admin-ops-panel"
      aria-labelledby="admin-ops-knowledge-title"
    >
      <div className="admin-ops-panel-heading">
        <span className="model-route-card__eyebrow">Knowledge grounding</span>
        <h3 id="admin-ops-knowledge-title">Grounding readiness visibility</h3>
        <p>
          Uses persisted AI-ready record signals to show what can participate in
          grounding workflows without claiming seed coverage that is not exposed
          by the current API.
        </p>
      </div>

      <div className="admin-ops-mini-metric-grid">
        <AdminOpsMetricCard
          metric={{
            detail: "Active records marked ready for grounding workflows.",
            label: "Grounding-ready",
            value: aiReadyRecords?.ragReady ?? "—",
          }}
        />
        <AdminOpsMetricCard
          metric={{
            detail: "Share of active records currently marked grounding-ready.",
            label: "Readiness rate",
            value: aiReadyRecords
              ? formatAdminOpsPercent(
                  aiReadyRecords.ragReady,
                  aiReadyRecords.active,
                )
              : "—",
          }}
        />
        <AdminOpsMetricCard
          metric={{
            detail: "Source types represented by at least one active record.",
            label: "Active source types",
            value: summary ? activeSourceCount : "—",
          }}
        />
      </div>

      <AdminOpsInspectionGuide
        attention={attentionText}
        inspectNext="Inspect Source quality and Missing fields in AI-ready records, then review the workflow evidence attached to records that are not grounding-ready."
        showing="Summary-backed grounding readiness across active AI-ready records and represented source types."
      />

      {isLoading ? (
        <p className="admin-ops-muted">Loading grounding readiness...</p>
      ) : null}

      {error ? <p className="admin-ops-error">{error}</p> : null}
    </section>
  );
}
