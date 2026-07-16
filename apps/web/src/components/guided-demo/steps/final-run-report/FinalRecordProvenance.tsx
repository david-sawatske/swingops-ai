import type { MergedRecordSummary } from "./finalRunReportTypes";

export function FinalRecordProvenance({
  records,
}: {
  records: MergedRecordSummary[];
}) {
  if (records.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="guided-final-provenance-title"
      className="guided-final-provenance"
    >
      <div className="guided-final-provenance__header">
        <span className="model-route-card__eyebrow">Record provenance</span>
        <h4 id="guided-final-provenance-title">
          Where each current result came from
        </h4>
        <p>
          Expand a record to see only the workflow systems that returned
          applicable evidence or saved an authoritative change.
        </p>
      </div>

      <div className="guided-final-provenance__records">
        {records.map((record) => (
          <details className="guided-final-provenance-record" key={record.id}>
            <summary className="guided-final-provenance-record__summary">
              <span className="guided-final-provenance-record__identity">
                <strong>{record.label || "Unnamed record"}</strong>
                <span>
                  {record.sourceName} · {record.provenanceEntries.length} contributing
                  source{record.provenanceEntries.length === 1 ? "" : "s"}
                </span>
              </span>

              <span className="guided-final-provenance-record__status">
                {record.persistenceLabel}
              </span>
            </summary>

            <dl className="guided-final-provenance-list">
              {record.provenanceEntries.map((entry) => (
                <div key={entry.key}>
                  <dt>{entry.label}</dt>
                  <dd>{entry.detail}</dd>
                </div>
              ))}
            </dl>
          </details>
        ))}
      </div>
    </section>
  );
}
