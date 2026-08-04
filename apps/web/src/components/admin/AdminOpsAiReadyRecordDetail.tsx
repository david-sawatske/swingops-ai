import type { AiReadyIntakeRecord } from "../../types/workflow";
import { formatEnumLabel } from "../../utils/formatting";
import {
  formatAiReadyFieldLabel,
  formatAiReadyRecordDisplayName,
  formatAiReadySourceTypeLabel,
  formatAiReadyStatusLabel,
  getAiReadyRecordMissingFields,
} from "./adminOpsAiReadyUtils";
import {
  AdminOpsStatusBadge,
  formatAdminOpsDate,
  formatCurrency,
  formatShortId,
} from "./adminOpsPresentation";

function formatConfidence(confidence: number) {
  return `${Math.round(confidence * 100)}%`;
}

export function AdminOpsAiReadyRecordDetail({
  onBack,
  onOpenReviewQueue,
  record,
}: {
  onBack: () => void;
  onOpenReviewQueue: (intakeItemId: string | null) => void;
  record: AiReadyIntakeRecord;
}) {
  const normalized = record.normalizedJson;
  const isSuperseded = record.status === "SUPERSEDED";
  const missingFields = getAiReadyRecordMissingFields(record);
  const attentionSignals = (record.qualitySignalsJson ?? []).filter(
    (signal) => signal.severity !== "INFO",
  );
  const normalizedFields = [
    { label: "Brand", value: normalized.brand },
    { label: "Product line", value: normalized.productLine },
    {
      label: "Category",
      value: normalized.category ? formatEnumLabel(normalized.category) : null,
    },
    {
      label: "Shaft flex",
      value: normalized.shaftFlex
        ? formatEnumLabel(normalized.shaftFlex)
        : null,
    },
    { label: "Condition grade", value: normalized.conditionGrade },
    {
      label: "Trade-in value",
      value:
        normalized.tradeInValue === null
          ? null
          : formatCurrency(normalized.tradeInValue),
    },
    { label: "Store", value: normalized.storeId },
    { label: "Confidence", value: formatConfidence(normalized.confidence) },
  ];

  return (
    <div className="admin-ops-record-detail">
      <div className="admin-ops-record-detail__toolbar">
        <button
          className="admin-ops-record-detail__back"
          onClick={onBack}
          type="button"
        >
          ← Back to {isSuperseded ? "history" : "records"}
        </button>

        <AdminOpsStatusBadge
          tone={
            isSuperseded
              ? "neutral"
              : record.reviewNeeded
                ? "warning"
                : "success"
          }
        >
          {formatAiReadyStatusLabel(record.status)}
        </AdminOpsStatusBadge>
      </div>

      <section
        aria-label="Record readiness summary"
        className="admin-ops-record-detail__summary"
      >
        <div>
          <span>{isSuperseded ? "Lifecycle" : "Review state"}</span>
          <strong>
            {isSuperseded
              ? "Historical record"
              : record.reviewNeeded
                ? "Human review required"
                : "No review hold"}
          </strong>
        </div>
        <div>
          <span>{isSuperseded ? "Replacement" : "Grounding"}</span>
          <strong>
            {isSuperseded
              ? record.supersededByAiReadyIntakeRecordId
                ? "Linked"
                : "Later workflow output"
              : record.ragReady
                ? "Ready"
                : "Not ready"}
          </strong>
        </div>
        <div>
          <span>{isSuperseded ? "Replaced" : "Embedding"}</span>
          <strong>
            {isSuperseded
              ? formatAdminOpsDate(record.supersededAt)
              : record.embeddingReady
                ? "Ready"
                : "Not ready"}
          </strong>
        </div>
        <div>
          <span>Source type</span>
          <strong>{formatAiReadySourceTypeLabel(record.sourceType)}</strong>
        </div>
      </section>

      <section
        className={
          isSuperseded
            ? "admin-ops-record-detail__attention admin-ops-record-detail__attention--history"
            : record.reviewNeeded
              ? "admin-ops-record-detail__attention admin-ops-record-detail__attention--warning"
              : "admin-ops-record-detail__attention admin-ops-record-detail__attention--ready"
        }
      >
        <div>
          <span className="model-route-card__eyebrow">
            {isSuperseded
              ? "Replacement context"
              : record.reviewNeeded
                ? "Needs attention"
                : "Ready to continue"}
          </span>
          <h5>
            {isSuperseded
              ? "Why this record was replaced"
              : "Why this record is in its current state"}
          </h5>
          <p>
            {isSuperseded
              ? (record.supersededReason ??
                "A later workflow result replaced this intake candidate.")
              : record.reviewNeeded
                ? "Review the unresolved fields and quality signals before this record moves downstream."
                : "This record has no active human-review hold and is ready for its next grounded workflow step."}
          </p>
        </div>

        {missingFields.length > 0 ? (
          <div className="admin-ops-record-detail__missing-fields">
            <strong>Missing fields</strong>
            <ul>
              {missingFields.map((fieldName) => (
                <li key={fieldName}>{formatAiReadyFieldLabel(fieldName)}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {attentionSignals.length > 0 ? (
          <div className="admin-ops-record-detail__signals">
            <strong>Quality signals</strong>
            <ul>
              {attentionSignals.map((signal, index) => (
                <li key={`${signal.signal}-${index}`}>
                  <span>{formatEnumLabel(signal.signal)}</span>
                  <p>{signal.message}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!isSuperseded && record.reviewNeeded ? (
          <button
            className="admin-ops-record-detail__primary-action"
            onClick={() => onOpenReviewQueue(record.intakeItemId)}
            type="button"
          >
            {record.intakeItemId ? "Open related review" : "Open review queue"}
          </button>
        ) : null}
      </section>

      <section className="admin-ops-record-detail__section">
        <div className="admin-ops-record-detail__section-heading">
          <span className="model-route-card__eyebrow">Structured output</span>
          <h5>
            {isSuperseded ? "Previous normalized record" : "Normalized record"}
          </h5>
        </div>
        <dl className="admin-ops-record-detail__field-grid">
          {normalizedFields.map((field) => (
            <div key={field.label}>
              <dt>{field.label}</dt>
              <dd>{field.value || "Missing"}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="admin-ops-record-detail__section">
        <div className="admin-ops-record-detail__section-heading">
          <span className="model-route-card__eyebrow">Provenance</span>
          <h5>Source and workflow context</h5>
        </div>
        <dl className="admin-ops-record-detail__context-grid">
          <div>
            <dt>Source</dt>
            <dd>{record.sourceName}</dd>
          </div>
          <div>
            <dt>Source type</dt>
            <dd>{formatAiReadySourceTypeLabel(record.sourceType)}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{formatAdminOpsDate(record.createdAt)}</dd>
          </div>
          <div>
            <dt>{isSuperseded ? "Replaced" : "Updated"}</dt>
            <dd>
              {formatAdminOpsDate(
                isSuperseded ? record.supersededAt : record.updatedAt,
              )}
            </dd>
          </div>
        </dl>

        <details className="admin-ops-record-detail__source-text">
          <summary>View source text</summary>
          <p>{record.rawText}</p>
        </details>

        <details className="admin-ops-history-technical">
          <summary>Technical audit detail</summary>
          <div className="admin-ops-reference-list">
            <small>record: {formatShortId(record.id)}</small>
            <small>run: {formatShortId(record.workflowRunId)}</small>
            <small>batch: {formatShortId(record.intakeBatchId)}</small>
            <small>item: {formatShortId(record.intakeItemId)}</small>
            <small>source record: {formatShortId(record.sourceRecordId)}</small>
          </div>
        </details>
      </section>

      <p className="admin-ops-record-detail__identity">
        Viewing {formatAiReadyRecordDisplayName(record)}
      </p>
    </div>
  );
}
