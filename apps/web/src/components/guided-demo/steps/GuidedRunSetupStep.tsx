type GuidedRunSetupStepProps = {
  onContinue: () => void;
};

export function GuidedRunSetupStep({ onContinue }: GuidedRunSetupStepProps) {
  return (
    <article className="guided-workflow-card guided-workflow-card--hero">
      <section className="guided-step-orientation">
        <span className="model-route-card__eyebrow">Step 1 · Run Setup</span>
        <h3>What operational job is this run supposed to complete?</h3>
        <p>
          A golf retail team receives trade-in details through messy customer messages,
          counter notes, malformed CSV rows, and system logs. The goal of this run is to
          turn those signals into reviewed AI-ready records and a clear explanation of
          what happened.
        </p>

        <section className="guided-flow-overview">
          <div className="guided-flow-overview__header">
            <h4>Run overview</h4>
            <p>
              This is the path the guided demo will follow. Each phase adds one layer of
              operational context before showing the technical evidence.
            </p>
          </div>

          <div className="guided-workflow-flowline" aria-label="Guided workflow phases">
            <span>Messy inputs</span>
            <span>Structured records</span>
            <span>Guarded workflow</span>
            <span>System evidence</span>
            <span>Review gate</span>
            <span>Run report</span>
          </div>
        </section>

        <section className="guided-explainer-list" aria-label="Run setup explanation">
          <article>
            <strong>Business trigger</strong>
            <p>
              Trade-in data is incomplete, inconsistent, and spread across several
              operational sources.
            </p>
          </article>

          <article>
            <strong>Workflow objective</strong>
            <p>
              Normalize the source data, prepare durable records, run controlled AI steps,
              and preserve evidence for review.
            </p>
          </article>

          <article>
            <strong>Why it matters</strong>
            <p>
              The system should not silently guess. It should show what was extracted, what
              systems were used, and what still needs review.
            </p>
          </article>
        </section>

        <details className="guided-workflow-details guided-workflow-details--compact">
          <summary>View the technical layers this run will demonstrate</summary>
          <p className="guided-workflow-details__intro">
            These are the layers you will see as the guided demo progresses. They explain how
            the workflow moves from messy source data to controlled, reviewable output.
          </p>

          <div className="guided-explainer-list">
            <article>
              <strong>Source layer</strong>
              <p>
                Messy trade-in text is normalized into structured records with required
                fields, missing-field signals, and review flags.
              </p>
            </article>

            <article>
              <strong>System layer</strong>
              <p>
                The workflow can use knowledge retrieval, inventory matching, valuation
                estimates, model routing, read-only tools, and audit logs.
              </p>
            </article>

            <article>
              <strong>Control layer</strong>
              <p>
                The workflow should not silently guess or write unsafe changes.
                Low-confidence output is routed to review, and unsafe mutation requests are
                blocked.
              </p>
            </article>
          </div>
        </details>
      </section>

      <section className="guided-step-workspace">
        <div className="guided-step-workspace__header">
          <div>
            <span className="model-route-card__eyebrow">Do the work</span>
            <h4>Start the guided run</h4>
            <p>
              Move to source intake when you are ready to see the first live workflow
              action.
            </p>
          </div>
        </div>

        <section className="guided-next-step-note">
          <h4>What to look for as you continue</h4>
          <p>
            Each following step should answer one question: what changed, which system was
            involved, and why that output can or cannot be trusted yet.
          </p>
        </section>

        <button onClick={onContinue} type="button">
          Continue to Step 2
        </button>
      </section>
    </article>
  );
}
