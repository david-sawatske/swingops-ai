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
          This step starts with user-provided operational text or an optional loaded
          sample. The input does not need to be perfect. The deterministic parser
          preserves the source meaning, extracts supported fields, and keeps missing or
          uncertain information visible.
        </p>

        <div className="guided-step-mini-list" aria-label="Source intake explanation">
          <article>
            <strong>Input</strong>
            <p>User-provided messages, counter notes, malformed CSV rows, system logs, or loaded samples.</p>
          </article>

          <article>
            <strong>Action</strong>
            <p>Normalize Sources runs deterministic parsing and identifies supported candidate trade-in fields.</p>
          </article>

          <article>
            <strong>Output</strong>
            <p>Persisted candidate records for Step 2, with missing-field and review signals preserved.</p>
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
              Add source content below, then run normalization. When deterministic
              parsing finishes, the guided workflow moves to Step 2 so you can inspect
              the persisted candidate records it created.
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
