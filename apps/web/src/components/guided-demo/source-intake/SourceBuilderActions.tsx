type SourceBuilderActionsProps = {
  isRunning: boolean;
  onAddSource: () => void;
  onRun: () => void;
  runnableSourceCount: number;
};

export function SourceBuilderActions({
  isRunning,
  onAddSource,
  onRun,
  runnableSourceCount,
}: SourceBuilderActionsProps) {
  return (
    <>
      <div className="guided-source-builder__list-actions">
        <button
          aria-label="Add another source"
          className="guided-add-source-icon-button"
          disabled={isRunning}
          onClick={onAddSource}
          title="Add another source to this intake run"
          type="button"
        >
          +
        </button>
      </div>

      <div className="guided-source-builder__final-action">
        <div>
          <span className="model-route-card__eyebrow">Final action for this step</span>
          <strong>Normalize the staged sources into AI-ready assets.</strong>
          <p>
            This creates cleaned records, inferred schema, metadata, quality signals,
            and RAG readiness for the next workflow step.
          </p>
        </div>
        <button
          disabled={isRunning || runnableSourceCount === 0}
          onClick={onRun}
          type="button"
        >
          {isRunning ? "Normalizing Sources…" : "Normalize Sources"}
        </button>
      </div>
    </>
  );
}
