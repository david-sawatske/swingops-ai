import { useEffect, useState } from "react";
import { listIntakeBatches } from "./api/intakeBatches";
import { DashboardSection } from "./components/DashboardSection";
import { EmptyState } from "./components/EmptyState";
import type { IntakeBatchSummary } from "./types/intake";
import {
  formatIntakeBatchSourceType,
  formatIntakeBatchStatus,
} from "./utils/intakeLabels";

function App() {
  const [intakeBatches, setIntakeBatches] = useState<IntakeBatchSummary[]>([]);
  const [isLoadingIntakeBatches, setIsLoadingIntakeBatches] = useState(true);
  const [intakeBatchesError, setIntakeBatchesError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let isMounted = true;

    async function loadIntakeBatches() {
      try {
        setIsLoadingIntakeBatches(true);
        setIntakeBatchesError(null);

        const batches = await listIntakeBatches();

        if (isMounted) {
          setIntakeBatches(batches);
        }
      } catch (error) {
        if (isMounted) {
          setIntakeBatchesError(
            error instanceof Error
              ? error.message
              : "Unable to load intake batches.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingIntakeBatches(false);
        }
      }
    }

    void loadIntakeBatches();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="app-shell">
      <section className="hero">
        <h1>SwingOps AI</h1>

        <p className="subtitle">Agentic Golf Retail Workflow Platform</p>
      </section>

      <DashboardSection
        title="Intake Batches"
        description="Messy golf trade-in notes, CSV rows, and email text imported for workflow processing."
      >
        {isLoadingIntakeBatches ? <p>Loading intake batches…</p> : null}

        {intakeBatchesError ? (
          <EmptyState
            title="Unable to load intake batches"
            message={intakeBatchesError}
          />
        ) : null}

        {!isLoadingIntakeBatches &&
        !intakeBatchesError &&
        intakeBatches.length === 0 ? (
          <EmptyState
            title="No intake batches found"
            message="Create an intake batch through the API to see it here."
          />
        ) : null}

        {!isLoadingIntakeBatches &&
        !intakeBatchesError &&
        intakeBatches.length > 0 ? (
          <div className="intake-batch-list">
            {intakeBatches.map((batch) => (
              <article className="intake-batch-card" key={batch.id}>
                <div>
                  <h3>{batch.name}</h3>
                  <p>{batch.description ?? "No description provided."}</p>
                </div>

                <dl>
                  <div>
                    <dt>Status</dt>
                    <dd>{formatIntakeBatchStatus(batch.status)}</dd>
                  </div>

                  <div>
                    <dt>Source</dt>
                    <dd>{formatIntakeBatchSourceType(batch.sourceType)}</dd>
                  </div>

                  <div>
                    <dt>Items</dt>
                    <dd>{batch.itemCount}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        ) : null}
      </DashboardSection>
    </main>
  );
}

export default App;
