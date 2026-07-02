import type { RetryEvent, ValidationCheck } from "./validationReviewTypes";
import {
  formatFieldLabel,
  getStatusClassName,
} from "./validationReviewUtils";

type RunLevelAuditSectionProps = {
  unassignedRunLevelSignalCount: number;
  unmappedActionableRetryEvents: RetryEvent[];
  unmappedActionableValidationChecks: ValidationCheck[];
};

export function RunLevelAuditSection({
  unassignedRunLevelSignalCount,
  unmappedActionableRetryEvents,
  unmappedActionableValidationChecks,
}: RunLevelAuditSectionProps) {
  return (
    <section className="guided-run-audit-section">
              <div className="guided-run-audit-section__header">
                <span>Run-level audit</span>
              </div>

              <details className="guided-run-audit-dropdown">
                <summary>
                  <div>
                    <strong>
                      {unassignedRunLevelSignalCount === 0
                        ? "All actionable signals grouped into review cards"
                        : `${unassignedRunLevelSignalCount} unmapped actionable signal${unassignedRunLevelSignalCount === 1 ? "" : "s"}`}
                    </strong>
                    <p>
                      Checks and retries are shown on record cards when they can be tied
                      to one club. This audit row only reports actionable workflow-level
                      signals that could not be mapped to a single record.
                    </p>
                  </div>
                </summary>

                <div className="guided-run-validation-detail__body guided-run-validation-detail__body--audit">
                  <div className="guided-run-audit-summary">
                    <article>
                      <strong>{unmappedActionableValidationChecks.length}</strong>
                      <span>unmapped warnings or failures</span>
                    </article>
                    <article>
                      <strong>{unmappedActionableRetryEvents.length}</strong>
                      <span>unmapped unresolved retries</span>
                    </article>
                  </div>

                  <p className="guided-validation-empty-note">
                    {unassignedRunLevelSignalCount === 0
                      ? "All actionable validation and retry signals were grouped into the record cards above."
                      : "Review the unmapped warnings or failures below. Passing checks and review-item summaries are already represented by the record cards above."}
                  </p>

                  {unmappedActionableValidationChecks.length > 0 ? (
                    <div className="guided-run-audit-signal-list">
                      <h5>Unmapped warnings or failures</h5>
                      <ol className="guided-validation-evidence-list guided-run-audit-signal-list__items">
                        {unmappedActionableValidationChecks.map((check) => (
                          <li key={check.id}>
                            <span className={getStatusClassName(check.status)}>{check.status}</span>
                            <div>
                              <strong>{check.label}</strong>
                              <p>{check.message}</p>
                              <small>
                                Severity {check.severity.toLowerCase()}
                                {check.field ? ` · field ${formatFieldLabel(check.field)}` : ""}
                                {check.reviewRequired ? " · review required" : ""}
                              </small>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}

                  {unmappedActionableRetryEvents.length > 0 ? (
                    <div className="guided-run-audit-signal-list">
                      <h5>Unmapped unresolved retries</h5>
                      <ol className="guided-validation-evidence-list guided-run-audit-signal-list__items">
                        {unmappedActionableRetryEvents.map((event) => (
                          <li key={event.id}>
                            <span className={getStatusClassName(event.status)}>{event.status}</span>
                            <div>
                              <strong>{event.reason}</strong>
                              <p>{event.message}</p>
                              <small>
                                {event.targetField
                                  ? `Target field ${formatFieldLabel(event.targetField)}`
                                  : "Workflow-level retry"}
                                {" · "}
                                {event.policy}
                              </small>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </div>
              </details>
            </section>
  );
}
