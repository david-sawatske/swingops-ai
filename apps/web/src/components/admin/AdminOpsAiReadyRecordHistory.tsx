import type { AiReadyIntakeRecord } from "../../types/workflow";
import {
  formatAiReadyRecordDisplayName,
  formatAiReadySourceTypeLabel,
} from "./adminOpsAiReadyUtils";
import {
  AdminOpsStatusBadge,
  formatAdminOpsDate,
  formatShortId,
} from "./adminOpsPresentation";

export function AdminOpsAiReadyRecordHistory({
  onInspectRecord,
  records,
  totalCount,
}: {
  onInspectRecord: (record: AiReadyIntakeRecord) => void;
  records: AiReadyIntakeRecord[];
  totalCount: number;
}) {
  return (
    <section
      aria-label="Replaced record history results"
      className="admin-ops-history-view"
    >
      <div className="admin-ops-history-summary">
        <div>
          <span className="model-route-card__eyebrow">History snapshot</span>
          <strong>
            {totalCount.toLocaleString()} replaced{" "}
            {totalCount === 1 ? "record" : "records"}
          </strong>
        </div>
        <p>
          Earlier intake candidates remain read-only so reviewers can trace what
          changed and why a later workflow result became authoritative.
        </p>
      </div>

      <div className="admin-ops-history-list">
        {records.map((record) => {
          const replacementLabel = record.supersededByAiReadyIntakeRecordId
            ? "Final reviewed record"
            : "Later workflow output";

          return (
            <article className="admin-ops-history-card" key={record.id}>
              <div className="admin-ops-history-card__header">
                <div>
                  <span className="model-route-card__eyebrow">
                    Previous candidate
                  </span>
                  <h5>{formatAiReadyRecordDisplayName(record)}</h5>
                  <p>
                    {formatAiReadySourceTypeLabel(record.sourceType)} ·{" "}
                    {record.sourceName}
                  </p>
                </div>

                <div className="admin-ops-history-card__status">
                  <AdminOpsStatusBadge tone="neutral">
                    Replaced
                  </AdminOpsStatusBadge>
                  <small>{formatAdminOpsDate(record.supersededAt)}</small>
                </div>
              </div>

              <div
                aria-label={`${formatAiReadyRecordDisplayName(record)} replacement relationship`}
                className="admin-ops-history-relationship"
              >
                <div>
                  <span>Previous record</span>
                  <strong>{formatAiReadyRecordDisplayName(record)}</strong>
                  <small>Created {formatAdminOpsDate(record.createdAt)}</small>
                </div>

                <span
                  aria-hidden="true"
                  className="admin-ops-history-relationship__arrow"
                >
                  →
                </span>

                <div>
                  <span>Replacement</span>
                  <strong>{replacementLabel}</strong>
                  <small>
                    {record.supersededByAiReadyIntakeRecordId
                      ? "Linked to the authoritative record"
                      : "Written by a later workflow run"}
                  </small>
                </div>
              </div>

              <div className="admin-ops-history-card__reason">
                <span>Replacement reason</span>
                <p>
                  {record.supersededReason ??
                    "A later workflow result replaced this intake candidate."}
                </p>
              </div>

              <div className="admin-ops-history-card__actions">
                <button
                  aria-label={`Inspect previous record for ${formatAiReadyRecordDisplayName(record)}`}
                  onClick={() => onInspectRecord(record)}
                  type="button"
                >
                  Inspect previous record
                </button>

                <details className="admin-ops-history-technical">
                  <summary>Technical audit detail</summary>
                  <div className="admin-ops-reference-list">
                    <small>record: {formatShortId(record.id)}</small>
                    <small>
                      replacement:{" "}
                      {formatShortId(record.supersededByAiReadyIntakeRecordId)}
                    </small>
                    <small>run: {formatShortId(record.workflowRunId)}</small>
                    <small>batch: {formatShortId(record.intakeBatchId)}</small>
                    <small>item: {formatShortId(record.intakeItemId)}</small>
                  </div>
                </details>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
