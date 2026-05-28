import { FormEvent, useEffect, useState } from "react";
import {
  createIntakeBatch,
  listIntakeBatches,
} from "./api/intakeBatches";
import { DashboardSection } from "./components/DashboardSection";
import { EmptyState } from "./components/EmptyState";
import type {
  IntakeBatchSourceType,
  IntakeBatchSummary,
} from "./types/intake";
import { buildCreateIntakeBatchRequest } from "./utils/intakeForm";
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

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sourceType, setSourceType] =
    useState<IntakeBatchSourceType>("FREEFORM_NOTES");
  const [rawText, setRawText] = useState("");
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const [createBatchError, setCreateBatchError] = useState<string | null>(null);
  const [createBatchSuccess, setCreateBatchSuccess] = useState<string | null>(
    null,
  );

  async function loadIntakeBatches() {
    try {
      setIsLoadingIntakeBatches(true);
      setIntakeBatchesError(null);

      const batches = await listIntakeBatches();

      setIntakeBatches(batches);
    } catch (error) {
      setIntakeBatchesError(
        error instanceof Error
          ? error.message
          : "Unable to load intake batches.",
      );
    } finally {
      setIsLoadingIntakeBatches(false);
    }
  }

  useEffect(() => {
    void loadIntakeBatches();
  }, []);

  async function handleCreateBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = buildCreateIntakeBatchRequest({
      name,
      description,
      sourceType,
      rawText,
    });

    if (!result.ok) {
      setCreateBatchError(result.error);
      setCreateBatchSuccess(null);
      return;
    }

    try {
      setIsCreatingBatch(true);
      setCreateBatchError(null);
      setCreateBatchSuccess(null);

      const createdBatch = await createIntakeBatch(result.request);

      setName("");
      setDescription("");
      setSourceType("FREEFORM_NOTES");
      setRawText("");
      setCreateBatchSuccess(`Created intake batch: ${createdBatch.name}`);

      await loadIntakeBatches();
    } catch (error) {
      setCreateBatchError(
        error instanceof Error
          ? error.message
          : "Unable to create intake batch.",
      );
    } finally {
      setIsCreatingBatch(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <h1>SwingOps AI</h1>

        <p className="subtitle">Agentic Golf Retail Workflow Platform</p>
      </section>

      <DashboardSection
        title="Create Intake Batch"
        description="Add messy golf trade-in data for later workflow processing."
      >
        <form className="intake-form" onSubmit={handleCreateBatch}>
          <label>
            Batch Name
            <input
              name="name"
              onChange={(event) => setName(event.target.value)}
              placeholder="May trade-in notes"
              type="text"
              value={name}
            />
          </label>

          <label>
            Description
            <input
              name="description"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional context for this batch"
              type="text"
              value={description}
            />
          </label>

          <label>
            Source Type
            <select
              name="sourceType"
              onChange={(event) =>
                setSourceType(event.target.value as IntakeBatchSourceType)
              }
              value={sourceType}
            >
              <option value="FREEFORM_NOTES">Freeform Notes</option>
              <option value="CSV_UPLOAD">CSV Upload</option>
              <option value="EMAIL">Email</option>
            </select>
          </label>

          <label>
            Raw Trade-In Text
            <textarea
              name="rawText"
              onChange={(event) => setRawText(event.target.value)}
              placeholder={"TM Stealth 2 driver, 10.5, stiff, RH\nPing G425 irons 5-PW, regular flex, LH"}
              rows={5}
              value={rawText}
            />
          </label>

          {createBatchError ? (
            <p className="form-message form-message--error">
              {createBatchError}
            </p>
          ) : null}

          {createBatchSuccess ? (
            <p className="form-message form-message--success">
              {createBatchSuccess}
            </p>
          ) : null}

          <button disabled={isCreatingBatch} type="submit">
            {isCreatingBatch ? "Creating…" : "Create Intake Batch"}
          </button>
        </form>
      </DashboardSection>

      <DashboardSection
        title="Intake Batches"
        description="Messy golf trade-in notes, CSV rows, and email text imported for workflow processing."
      >
        {!isLoadingIntakeBatches && !intakeBatchesError ? (
          <p className="section-summary">
            {intakeBatches.length} intake{" "}
            {intakeBatches.length === 1 ? "batch" : "batches"} loaded
          </p>
        ) : null}

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
