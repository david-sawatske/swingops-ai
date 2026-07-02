import type {
  ExecuteMultiSourceIntakeDemoRequest,
  ExecuteMultiSourceIntakeDemoResponse,
} from "../../../types/workflow";
import { GuidedSourceIntakeBuilder } from "../GuidedSourceIntakeBuilder";

type GuidedMessySourceIntakeStepProps = {
  error: string | null;
  isRunning: boolean;
  onRunSources: (request?: ExecuteMultiSourceIntakeDemoRequest) => void;
  result: ExecuteMultiSourceIntakeDemoResponse | null;
  success: string | null;
};

export function GuidedMessySourceIntakeStep({
  error,
  isRunning,
  onRunSources,
  result,
  success,
}: GuidedMessySourceIntakeStepProps) {
  return (
    <article className="guided-workflow-card">
      <section className="guided-step-orientation">
        <span className="model-route-card__eyebrow">Step 1 · Messy Source Intake</span>
        <h3>What messy information is entering the workflow?</h3>
        <p>
          This step starts with the kind of operational text a store team might actually
          receive. The input does not need to be perfect. The workflow should preserve
          the source meaning, extract usable fields, and keep uncertainty visible.
        </p>

        <div className="guided-step-mini-list" aria-label="Source intake explanation">
          <article>
            <strong>Input</strong>
            <p>Customer messages, counter notes, malformed CSV rows, or system logs.</p>
          </article>

          <article>
            <strong>Action</strong>
            <p>Normalize Sources parses the text and identifies candidate trade-in fields.</p>
          </article>

          <article>
            <strong>Output</strong>
            <p>Structured records for Step 2, plus missing-field and review signals.</p>
          </article>
        </div>

        <details className="guided-workflow-details guided-workflow-details--compact">
          <summary>What to watch for in this step</summary>
          <p className="guided-workflow-details__intro">
            Missing or uncertain fields should stay visible. A useful intake workflow does
            not hide ambiguity before validation and review.
          </p>
        </details>
      </section>

      <section className="guided-step-workspace">
        <div className="guided-step-workspace__header">
          <div>
            <span className="model-route-card__eyebrow">Do the work</span>
            <h4>Stage source text and run normalization</h4>
            <p>
              Add source content below, then run normalization. When the workflow
              finishes, the guided demo moves to Step 2 so you can inspect the AI-ready
              records it created.
            </p>
          </div>
        </div>

        <GuidedSourceIntakeBuilder
          error={error}
          isRunning={isRunning}
          onRunSources={onRunSources}
          result={result}
          success={success}
        />
      </section>
    </article>
  );
}
