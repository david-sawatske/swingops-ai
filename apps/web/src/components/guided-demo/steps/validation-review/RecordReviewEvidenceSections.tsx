import { getUnresolvedMissingFields } from "./recordReviewCorrectionUtils";
import type { RecordReviewCard } from "./validationReviewTypes";
import {
  formatDisplayValue,
  formatFieldLabel,
  getFirstValue,
  getInventorySummary,
  getParserEvidenceForField,
  getProposedRecord,
  getStatusClassName,
  getValuationSummary,
} from "./validationReviewUtils";

function RecordFieldGrid({ card }: { card: RecordReviewCard }) {
  const proposedRecord = getProposedRecord(card.reviewItem);
  const fields = [
    {
      label: "Brand",
      value:
        getFirstValue(card.parsedRecord, ["brand"]) ??
        getFirstValue(proposedRecord, ["brand"]),
      evidenceKeys: ["brand"],
    },
    {
      label: "Product line",
      value:
        getFirstValue(card.parsedRecord, ["productLine", "model", "title"]) ??
        getFirstValue(proposedRecord, ["productLine", "model", "title"]),
      evidenceKeys: ["productLine"],
    },
    {
      label: "Category",
      value:
        getFirstValue(card.parsedRecord, ["category"]) ??
        getFirstValue(proposedRecord, ["category"]),
      evidenceKeys: ["category"],
    },
    {
      label: "Shaft flex",
      value:
        getFirstValue(card.parsedRecord, ["shaftFlex", "flex"]) ??
        getFirstValue(proposedRecord, ["shaftFlex", "flex"]),
      evidenceKeys: ["shaftFlex"],
    },
    {
      label: "Condition",
      value:
        getFirstValue(card.parsedRecord, ["conditionGrade"]) ??
        getFirstValue(proposedRecord, ["conditionGrade"]),
      evidenceKeys: ["conditionGrade"],
    },
    {
      label: "Trade-in value",
      value:
        getFirstValue(card.parsedRecord, [
          "tradeInValue",
          "demoValue",
          "value",
        ]) ??
        getFirstValue(proposedRecord, ["tradeInValue", "demoValue", "value"]),
      currency: true,
      evidenceKeys: ["tradeInValue", "demoValue", "value"],
    },
    {
      label: "Store",
      value:
        getFirstValue(card.parsedRecord, ["storeId", "store"]) ??
        getFirstValue(proposedRecord, ["storeId", "store"]),
      evidenceKeys: [],
    },
  ];

  return (
    <dl className="guided-record-field-grid">
      {fields.map((field) => {
        const parserEvidence =
          field.evidenceKeys.length > 0
            ? getParserEvidenceForField(card.parsedRecord, field.evidenceKeys)
            : null;

        return (
          <div key={field.label}>
            <dt>{field.label}</dt>
            <dd>
              <span>
                {formatDisplayValue(field.value, { currency: field.currency })}
              </span>
              {parserEvidence ? (
                <small className="guided-parser-field-evidence">
                  Parsed from “{parserEvidence.sourceText}”
                </small>
              ) : null}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function RecordAttentionList({ card }: { card: RecordReviewCard }) {
  const warningChecks = card.validationChecks.filter(
    (check) => check.status === "WARNING" || check.status === "FAIL",
  );
  const unresolvedRetries = card.retryEvents.filter(
    (event) => event.status === "UNRESOLVED",
  );
  const attentionItems = [
    ...getUnresolvedMissingFields(card).map((field) => ({
      id: `missing-${field}`,
      label: `Confirm ${formatFieldLabel(field)}`,
      detail: "This value is missing or unclear in the normalized record.",
    })),
    ...card.reviewReasons.map((reason) => ({
      id: `reason-${reason}`,
      label: "Review reason",
      detail: reason,
    })),
    ...warningChecks.map((check) => ({
      id: `check-${check.id}`,
      label: check.label,
      detail: check.message,
    })),
    ...unresolvedRetries.map((event) => ({
      id: `retry-${event.id}`,
      label: event.reason,
      detail: event.message,
    })),
  ];
  const dedupedItems = attentionItems.filter(
    (item, index, items) =>
      items.findIndex(
        (candidate) =>
          candidate.label === item.label && candidate.detail === item.detail,
      ) === index,
  );

  if (dedupedItems.length === 0) {
    return (
      <p className="guided-validation-empty-note">
        No record-level issues were found for this item.
      </p>
    );
  }

  return (
    <ul className="guided-record-attention-list">
      {dedupedItems.map((item) => (
        <li key={item.id}>
          <strong>{item.label}</strong>
          <span>{item.detail}</span>
        </li>
      ))}
    </ul>
  );
}

export function RecordEvidenceDetails({ card }: { card: RecordReviewCard }) {
  return (
    <details className="guided-record-supporting-details">
      <summary>Source and system evidence</summary>

      <div className="guided-record-evidence-grid">
        <article className="guided-record-evidence-grid__source">
          <strong>Source evidence</strong>
          <p>{card.sourceEvidence}</p>
        </article>
        <article>
          <strong>Inventory evidence</strong>
          <p>{getInventorySummary(card.inventoryEvidence)}</p>
        </article>
        <article>
          <strong>Valuation evidence</strong>
          <p>{getValuationSummary(card.valuationEvidence)}</p>
        </article>
      </div>
    </details>
  );
}

export function RecordReviewSignalDetails({
  card,
}: {
  card: RecordReviewCard;
}) {
  return (
    <details className="guided-record-supporting-details">
      <summary>Review signals and suggested action</summary>

      <div className="guided-record-review-card__body-grid">
        <section>
          <h5>What needs attention</h5>
          <RecordAttentionList card={card} />
        </section>
        <section>
          <h5>Suggested next action</h5>
          <p>{card.suggestedAction}</p>
        </section>
      </div>
    </details>
  );
}

export function RecordValidationDetails({ card }: { card: RecordReviewCard }) {
  return (
    <details className="guided-record-review-details">
      <summary>Detailed validation and retry evidence</summary>

      {card.validationChecks.length > 0 ? (
        <ol className="guided-validation-evidence-list">
          {card.validationChecks.map((check) => (
            <li key={check.id}>
              <span className={getStatusClassName(check.status)}>
                {check.status}
              </span>
              <div>
                <strong>{check.label}</strong>
                <p>{check.message}</p>
                <small>
                  Severity {check.severity.toLowerCase()}
                  {check.field ? ` · field ${check.field}` : ""}
                  {check.reviewRequired ? " · review required" : ""}
                </small>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="guided-validation-empty-note">
          No detailed validation checks were matched directly to this record.
        </p>
      )}

      {card.retryEvents.length > 0 ? (
        <ol className="guided-validation-evidence-list">
          {card.retryEvents.map((event) => (
            <li key={event.id}>
              <span className={getStatusClassName(event.status)}>
                {event.status}
              </span>
              <div>
                <strong>{event.reason}</strong>
                <p>{event.message}</p>
                <small>
                  {event.targetField
                    ? `Target field ${event.targetField}`
                    : "Workflow-level retry"}
                  {" · "}
                  {`Attempts ${event.attemptCount}/${event.maxAttempts}`}
                  {" · "}
                  {event.policy}
                </small>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </details>
  );
}

function hasUsableSourceEvidence(value: string) {
  const trimmedValue = value.trim();

  return (
    trimmedValue.length > 0 &&
    trimmedValue !== "No source evidence captured for this record."
  );
}

export function PassedRecordReviewSummary({
  card,
}: {
  card: RecordReviewCard;
}) {
  const inventorySummary = getInventorySummary(card.inventoryEvidence);
  const valuationSummary = getValuationSummary(card.valuationEvidence);
  const hasSourceEvidence = hasUsableSourceEvidence(card.sourceEvidence);

  return (
    <div className="guided-passed-record-summary">
      <div className="guided-passed-record-summary__status">
        <strong>Record passed review gates.</strong>
        <p>
          This record has no active review item. The available system evidence
          is summarized below.
        </p>
      </div>

      <div className="guided-passed-record-normalized-fields">
        <strong>Normalized fields and parser evidence</strong>
        <RecordFieldGrid card={card} />
      </div>

      <div className="guided-passed-record-evidence-grid">
        {hasSourceEvidence ? (
          <article className="guided-passed-record-evidence-grid__source">
            <strong>Source evidence</strong>
            <p>{card.sourceEvidence}</p>
          </article>
        ) : null}
        <article>
          <strong>Inventory evidence</strong>
          <p>{inventorySummary}</p>
        </article>
        <article>
          <strong>Valuation evidence</strong>
          <p>{valuationSummary}</p>
        </article>
      </div>
    </div>
  );
}
