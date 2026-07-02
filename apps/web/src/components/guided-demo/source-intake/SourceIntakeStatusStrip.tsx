type SourceIntakeStatusStripProps = {
  isNormalizationComplete: boolean;
  readySourceCount: number;
  selectedTypeCount: number;
  sourceCount: number;
};

export function SourceIntakeStatusStrip({
  isNormalizationComplete,
  readySourceCount,
  selectedTypeCount,
  sourceCount,
}: SourceIntakeStatusStripProps) {
  return (
    <div className="guided-workflow-intake-toolbar">
      <section className="multi-source-intake-status-strip" aria-label="Source intake status">
        <div className="multi-source-intake-status-strip__header">
          <span className="model-route-card__eyebrow">Intake status</span>
        </div>

        <div className="multi-source-intake-status-line">
          <span>
            <strong>{sourceCount}</strong> source{sourceCount === 1 ? "" : "s"} staged
          </span>
          <span>
            <strong>{selectedTypeCount}</strong> source type{selectedTypeCount === 1 ? "" : "s"}
          </span>
          <span>
            <strong>{readySourceCount}</strong> ready source{readySourceCount === 1 ? "" : "s"}
          </span>
          <span>
            Normalization: <strong>{isNormalizationComplete ? "complete" : "not run"}</strong>
          </span>
        </div>
      </section>
    </div>
  );
}
