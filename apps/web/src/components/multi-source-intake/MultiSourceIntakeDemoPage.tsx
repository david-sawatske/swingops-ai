import { useMemo, useState } from "react";
import type {
  ExecuteMultiSourceIntakeDemoRequest,
  ExecuteMultiSourceIntakeDemoResponse,
  MultiSourceIntakeSourceInput,
  MultiSourceIntakeSourceType,
} from "../../types/workflow";
import { DashboardSection } from "../DashboardSection";
import { EmptyState } from "../EmptyState";

const SOURCE_TYPE_OPTIONS: {
  value: MultiSourceIntakeSourceType;
  label: string;
}[] = [
  { value: "FREE_TEXT", label: "Free text" },
  { value: "POORLY_FORMED_CSV", label: "Poorly formed CSV" },
  { value: "EMAIL", label: "Email" },
  { value: "LOG", label: "Log" },
];

const SAMPLE_SOURCE_BY_TYPE: Record<MultiSourceIntakeSourceType, MultiSourceIntakeSourceInput> = {
  FREE_TEXT: {
    sourceType: "FREE_TEXT",
    sourceName: "Counter notebook notes",
    rawContent: [
      "Sat counter notes - trade pile",
      "1) TM stealth2 drv 10.5 ventus stiff. no hc. crown sky mark. cust: Mark R.",
      "2) Ping g425 irons 5-pw reg flex, grips slick, missing serial maybe. needs manager look.",
      "Store 104 / associate jules",
    ].join("\n"),
  },
  POORLY_FORMED_CSV: {
    sourceType: "POORLY_FORMED_CSV",
    sourceName: "Store export with broken rows",
    rawContent: [
      "brand|model,cat,shaft,cond,value,store",
      "Titleist; TSR2; 3w ; Tensei S ; face wear ; $145 ; 104",
      "Cally,Rogue ST Max driver,HZRDUS X,paint chip no wrench,190,STORE-207",
      "PING|G425 irons|reg|worn grips||104",
    ].join("\n"),
  },
  EMAIL: {
    sourceType: "EMAIL",
    sourceName: "Customer trade-in email",
    rawContent: [
      "From: Hannah Lee <hannah.lee@example.com>",
      "To: tradeins@swingops.example",
      "Subject: Trade values for two clubs - receipt attached",
      "",
      "Hi team, I am bringing in a Callaway Rogue ST Max 9 degree driver with HZRDUS x-stiff.",
      "There is paint wear on the sole and I do not have the wrench.",
      "Also a TaylorMade Stealth 2 10.5 driver with Ventus stiff and a sky mark.",
      "Attached: trade_sheet_8821.pdf, driver_photos.zip",
      "Preferred store: 207",
    ].join("\n"),
  },
  LOG: {
    sourceType: "LOG",
    sourceName: "Import worker event log",
    rawContent: [
      "2026-05-18T14:33:02Z INFO import start store=104 batch=nightly_tradeins",
      "2026-05-18T14:33:04Z WARN malformed payload brand=Titleist model=TSR cat=3w shaft='Tensei S' value=145",
      "2026-05-18T14:33:07Z ERROR row=18 missing category payload={brand:'PING', model:'G425', notes:'irons 5-PW reg worn grips'}",
      "2026-05-18T14:33:11Z INFO normalized sku match Callaway Rogue ST Max driver store=207",
    ].join("\n"),
  },
};

function createBlankSource(): MultiSourceIntakeSourceInput {
  return {
    sourceType: "FREE_TEXT",
    sourceName: "",
    rawContent: "",
  };
}

function formatList(values: string[]) {
  return values.length > 0 ? values.join(", ") : "—";
}

function formatNullable(value: string | number | null | undefined) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function formatScore(score: number) {
  return score.toFixed(2);
}

function getSourceLabel(sourceType: string) {
  return sourceType
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getAuditStatusClassName(status: string) {
  return `agentic-demo-audit-event__status agentic-demo-audit-event__status--${status.toLowerCase().replace(/_/g, "-")}`;
}

function getQualitySignalClassName(severity: string) {
  return `multi-source-intake-signal multi-source-intake-signal--${severity.toLowerCase()}`;
}

function toRunnableSources(sources: MultiSourceIntakeSourceInput[]) {
  return sources
    .map((source) => ({
      sourceType: source.sourceType,
      sourceName: source.sourceName?.trim() || undefined,
      rawContent: source.rawContent.trim(),
    }))
    .filter((source) => source.rawContent.length > 0);
}

function getSourceStatus(source: MultiSourceIntakeSourceInput, uploadedFileName?: string) {
  if (uploadedFileName) {
    return "Uploaded";
  }

  if (!source.rawContent.trim()) {
    return "Needs content";
  }

  const matchingSample = Object.values(SAMPLE_SOURCE_BY_TYPE).some(
    (sampleSource) =>
      sampleSource.sourceType === source.sourceType &&
      sampleSource.rawContent === source.rawContent,
  );

  return matchingSample ? "Sample loaded" : "Ready";
}

function getSourceStatusClassName(status: string) {
  return status === "Needs content"
    ? "multi-source-intake-status multi-source-intake-status--warning"
    : "multi-source-intake-status multi-source-intake-status--ready";
}


type SourceInputMode = "PASTE" | "UPLOAD";

export function MultiSourceIntakeDemoPage({
  result,
  isRunning,
  error,
  success,
  onRunDemo,
}: {
  result: ExecuteMultiSourceIntakeDemoResponse | null;
  isRunning: boolean;
  error: string | null;
  success: string | null;
  onRunDemo: (request?: ExecuteMultiSourceIntakeDemoRequest) => void;
}) {
  const [sources, setSources] = useState<MultiSourceIntakeSourceInput[]>([
    createBlankSource(),
  ]);
  const [sourceInputModes, setSourceInputModes] = useState<(SourceInputMode | null)[]>([
    null,
  ]);
  const [uploadedFileNames, setUploadedFileNames] = useState<(string | null)[]>([
    null,
  ]);
  const [selectedSourceTypes, setSelectedSourceTypes] = useState<
    (MultiSourceIntakeSourceType | null)[]
  >([null]);

  const runnableSources = useMemo(() => toRunnableSources(sources), [sources]);
  const selectedSource = result?.sourceResults[0] ?? null;

  function updateSource(
    index: number,
    updates: Partial<MultiSourceIntakeSourceInput>,
  ) {
    setSources((currentSources) =>
      currentSources.map((source, sourceIndex) =>
        sourceIndex === index ? { ...source, ...updates } : source,
      ),
    );
  }

  function updateSourceName(index: number, sourceName: string) {
    updateSource(index, { sourceName });

    if (!sourceName.trim()) {
      updateSource(index, { rawContent: "" });
      setSourceInputModes((currentModes) =>
        currentModes.map((currentMode, sourceIndex) =>
          sourceIndex === index ? null : currentMode,
        ),
      );
      setSelectedSourceTypes((currentSourceTypes) =>
        currentSourceTypes.map((currentSourceType, sourceIndex) =>
          sourceIndex === index ? null : currentSourceType,
        ),
      );
      setUploadedFileNames((currentFileNames) =>
        currentFileNames.map((currentFileName, sourceIndex) =>
          sourceIndex === index ? null : currentFileName,
        ),
      );
    }
  }

  function addSource() {
    setSources((currentSources) => [createBlankSource(), ...currentSources]);
    setSourceInputModes((currentModes) => [null, ...currentModes]);
    setUploadedFileNames((currentFileNames) => [null, ...currentFileNames]);
    setSelectedSourceTypes((currentSourceTypes) => [null, ...currentSourceTypes]);
  }

  function clearSources() {
    setSources([createBlankSource()]);
    setSourceInputModes([null]);
    setUploadedFileNames([null]);
    setSelectedSourceTypes([null]);
  }

  function removeSource(index: number) {
    setSources((currentSources) =>
      currentSources.filter((_, sourceIndex) => sourceIndex !== index),
    );
    setSourceInputModes((currentModes) =>
      currentModes.filter((_, sourceIndex) => sourceIndex !== index),
    );
    setUploadedFileNames((currentFileNames) =>
      currentFileNames.filter((_, sourceIndex) => sourceIndex !== index),
    );
    setSelectedSourceTypes((currentSourceTypes) =>
      currentSourceTypes.filter((_, sourceIndex) => sourceIndex !== index),
    );
  }

  function updateSourceInputMode(index: number, mode: SourceInputMode) {
    setSourceInputModes((currentModes) =>
      currentModes.map((currentMode, sourceIndex) =>
        sourceIndex === index ? mode : currentMode,
      ),
    );
    setSelectedSourceTypes((currentSourceTypes) =>
      currentSourceTypes.map((currentSourceType, sourceIndex) =>
        sourceIndex === index ? null : currentSourceType,
      ),
    );
    updateSource(index, { rawContent: "" });
    setUploadedFileNames((currentFileNames) =>
      currentFileNames.map((currentFileName, sourceIndex) =>
        sourceIndex === index ? null : currentFileName,
      ),
    );
  }

  function updateSelectedSourceType(
    index: number,
    sourceType: MultiSourceIntakeSourceType,
  ) {
    setSelectedSourceTypes((currentSourceTypes) =>
      currentSourceTypes.map((currentSourceType, sourceIndex) =>
        sourceIndex === index ? sourceType : currentSourceType,
      ),
    );
    updateSource(index, { sourceType, rawContent: "" });
    setUploadedFileNames((currentFileNames) =>
      currentFileNames.map((currentFileName, sourceIndex) =>
        sourceIndex === index ? null : currentFileName,
      ),
    );
  }

  function isSourceNamed(source: MultiSourceIntakeSourceInput) {
    return Boolean(source.sourceName?.trim());
  }

  function canChooseSourceType(index: number) {
    return Boolean(sourceInputModes[index]);
  }

  function canEnterSourceContent(source: MultiSourceIntakeSourceInput, index: number) {
    return (
      isSourceNamed(source) &&
      canChooseSourceType(index) &&
      Boolean(selectedSourceTypes[index])
    );
  }

  async function handleUploadSource(index: number, file: File | null) {
    if (!file) {
      return;
    }

    const text = await file.text();
    updateSource(index, {
      sourceName: sources[index]?.sourceName?.trim() || file.name,
      rawContent: text,
    });
    setUploadedFileNames((currentFileNames) =>
      currentFileNames.map((currentFileName, sourceIndex) =>
        sourceIndex === index ? file.name : currentFileName,
      ),
    );
  }

  function populateSampleSource(index: number) {
    const currentSource = sources[index];

    if (!currentSource) {
      return;
    }

    const sampleSource = SAMPLE_SOURCE_BY_TYPE[currentSource.sourceType];

    updateSource(index, {
      sourceName: sampleSource.sourceName,
      rawContent: sampleSource.rawContent,
    });
    setUploadedFileNames((currentFileNames) =>
      currentFileNames.map((currentFileName, sourceIndex) =>
        sourceIndex === index ? null : currentFileName,
      ),
    );
  }

  function handleRun() {
    onRunDemo({ sources: runnableSources });
  }

  return (
    <DashboardSection
      title="Multi-Source Intake Demo"
      description="Convert messy operational sources into AI-ready workflow assets: cleaned datasets, structured schemas, metadata, review signals, embeddings, and RAG index summaries."
    >
      <div className="multi-source-intake-layout">
        <article className="agentic-demo-story-card">
          <span className="model-route-card__eyebrow">Product story</span>
          <h3>Convert messy sources into AI-ready assets</h3>
          <p>
            Add a source, name it, choose paste or upload, select the source type,
            then provide content or populate sample data.
          </p>
          <p>
            Add more sources as needed, then normalize everything into records,
            schema fields, metadata, quality signals, and RAG readiness.
          </p>
        </article>

        <article className="agentic-demo-story-card">
          <span className="model-route-card__eyebrow">Pipeline</span>
          <h3>Raw input → AI-ready assets</h3>
          <ol className="multi-source-intake-pipeline-list">
            <li>Name the source</li>
            <li>Choose paste or upload</li>
            <li>Select source type</li>
            <li>Paste, upload, or populate sample data</li>
            <li>Cleaned text</li>
            <li>Normalized records</li>
            <li>Inferred schema</li>
            <li>Metadata extraction</li>
            <li>Quality and review signals</li>
            <li>Embedding and RAG readiness</li>
          </ol>
        </article>
      </div>

      <section className="agentic-demo-section">
        <div className="agentic-demo-section__header">
          <div>
            <span className="model-route-card__eyebrow">Input builder</span>
            <h3>Sources to normalize</h3>
            <p>
              Add one or more messy sources. For each source, select the type, then
              paste content, upload a text-like file, or populate sample data.
            </p>
          </div>
          <div className="agentic-demo-form__actions">
            <button
              disabled={isRunning}
              onClick={addSource}
              type="button"
            >
              Add Source
            </button>
            <button
              disabled={isRunning}
              onClick={clearSources}
              type="button"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="multi-source-intake-editor-list">
          {sources.map((source, index) => (
            <article className="agentic-demo-card multi-source-intake-editor-card" key={`${source.sourceType}-${index}`}>
              {(() => {
                const sourceStatus = getSourceStatus(source, uploadedFileNames[index] ?? undefined);

                return (
                  <>
                    <div className="multi-source-intake-editor-card__header">
                      <div className="multi-source-intake-editor-card__title">
                        <div className="multi-source-intake-editor-card__meta">
                          <span className="model-route-card__eyebrow">
                            Source {index + 1}
                          </span>
                          <span className={getSourceStatusClassName(sourceStatus)}>
                            {sourceStatus}
                          </span>
                        </div>
                        {!isSourceNamed(source) ? (
                          <span className="multi-source-intake-start-here">
                            Start here
                          </span>
                        ) : null}
                        <input
                          aria-label={`Source ${index + 1} name`}
                          className="multi-source-intake-title-input"
                          disabled={isRunning}
                          onChange={(event) =>
                            updateSourceName(index, event.target.value)
                          }
                          placeholder="Create a source name to choose how you want to provide content."
                          value={source.sourceName ?? ""}
                        />
                      </div>

                      <div className="multi-source-intake-editor-card__actions">
                        {sources.length > 1 ? (
                          <button
                            className="multi-source-intake-remove-button"
                            disabled={isRunning}
                            onClick={() => removeSource(index)}
                            type="button"
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {isSourceNamed(source) ? (
                      <div className="multi-source-intake-progressive-section multi-source-intake-progressive-section--tabs">
                        <div className="multi-source-intake-step-label">
                          <span>Step 2</span>
                          <strong>Choose input method</strong>
                        </div>
                        <div className="multi-source-intake-folder-tabs" role="tablist" aria-label={`Source ${index + 1} input method`}>
                          <button
                            aria-selected={sourceInputModes[index] === "PASTE"}
                            className={
                              sourceInputModes[index] === "PASTE"
                                ? "multi-source-intake-folder-tab multi-source-intake-folder-tab--active"
                                : "multi-source-intake-folder-tab"
                            }
                            disabled={isRunning}
                            onClick={() => updateSourceInputMode(index, "PASTE")}
                            role="tab"
                            type="button"
                          >
                            <span>Paste raw content</span>
                            <small>Best for notes, emails, logs, or copied exports</small>
                          </button>
                          <button
                            aria-selected={sourceInputModes[index] === "UPLOAD"}
                            className={
                              sourceInputModes[index] === "UPLOAD"
                                ? "multi-source-intake-folder-tab multi-source-intake-folder-tab--active"
                                : "multi-source-intake-folder-tab"
                            }
                            disabled={isRunning}
                            onClick={() => updateSourceInputMode(index, "UPLOAD")}
                            role="tab"
                            type="button"
                          >
                            <span>Upload file</span>
                            <small>Best for .txt, .csv, .log, .eml, or .json</small>
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {canChooseSourceType(index) ? (
                      <div className="multi-source-intake-progressive-section">
                        <div className="multi-source-intake-step-label">
                          <span>Step 3</span>
                          <strong>Select source type</strong>
                        </div>
                        <div className="multi-source-intake-control-panel multi-source-intake-control-panel--inline">
                          <label className="multi-source-intake-field multi-source-intake-field--inline">
                            <span>Source type</span>
                            <select
                              disabled={isRunning}
                              onChange={(event) =>
                                updateSelectedSourceType(
                                  index,
                                  event.target.value as MultiSourceIntakeSourceType,
                                )
                              }
                              value={selectedSourceTypes[index] ?? ""}
                            >
                              <option disabled value="">
                                Select a source type...
                              </option>
                              {SOURCE_TYPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    ) : null}

                    {canEnterSourceContent(source, index) ? (
                      <div className="multi-source-intake-progressive-section">
                        <div className="multi-source-intake-step-label">
                          <span>Step 4</span>
                          <strong>
                            {sourceInputModes[index] === "UPLOAD"
                              ? "Upload source file"
                              : "Paste source content"}
                          </strong>
                        </div>

                        {sourceInputModes[index] === "UPLOAD" ? (
                          <div className="multi-source-intake-upload-panel">
                            <span className="multi-source-intake-upload-label">
                              Upload text-like document
                            </span>
                            <label className="multi-source-intake-upload-control">
                              <input
                                accept=".txt,.csv,.log,.eml,.json,text/*"
                                disabled={isRunning}
                                onChange={(event) => {
                                  void handleUploadSource(index, event.target.files?.[0] ?? null);
                                  event.target.value = "";
                                }}
                                type="file"
                              />
                              <span className="multi-source-intake-upload-button">
                                Choose file
                              </span>
                              <span className="multi-source-intake-upload-file-name">
                                {uploadedFileNames[index] ?? "No file loaded"}
                              </span>
                            </label>
                            <p>
                              Choose a .txt, .csv, .log, .eml, or .json file.
                            </p>
                          </div>
                        ) : (
                          <>
                            <button
                              className="multi-source-intake-sample-card"
                              disabled={isRunning}
                              onClick={() => populateSampleSource(index)}
                              type="button"
                            >
                              <span>
                                <strong>Use sample for {getSourceLabel(source.sourceType)}</strong>
                                <small>Click to fill this source with realistic demo content.</small>
                              </span>
                              <span aria-hidden="true" className="multi-source-intake-sample-card__arrow">
                                Add sample
                              </span>
                            </button>
                            <label className="multi-source-intake-field">
                              <span>Raw source content</span>
                              <textarea
                                disabled={isRunning}
                                onChange={(event) =>
                                  updateSource(index, { rawContent: event.target.value })
                                }
                                placeholder="Paste messy text, broken CSV rows, email content, or logs here."
                                rows={6}
                                value={source.rawContent}
                              />
                            </label>
                          </>
                        )}
                      </div>
                    ) : null}
                  </>
                );
              })()}
            </article>
          ))}
        </div>

        <div className="agentic-demo-form__actions">
          <button
            disabled={isRunning || runnableSources.length === 0}
            onClick={handleRun}
            type="button"
          >
            {isRunning ? "Normalizing Sources…" : "Normalize Sources"}
          </button>
        </div>
      </section>

      {error ? (
        <EmptyState title="Unable to run multi-source intake demo" message={error} />
      ) : null}

      {success ? <p className="success-message">{success}</p> : null}

      {!result ? (
        <EmptyState
          title="No multi-source demo run yet"
          message="Add a source, name it, choose paste or upload, select the source type, then provide content before normalizing into AI-ready asset summaries."
        />
      ) : null}

      {result ? (
        <div className="multi-source-intake-result">
          <section className="agentic-demo-summary-grid">
            <article>
              <span className="model-route-card__eyebrow">Sources</span>
              <strong>{result.sourcesProcessed}</strong>
              <p>sources processed</p>
            </article>
            <article>
              <span className="model-route-card__eyebrow">Records</span>
              <strong>{result.recordsExtracted}</strong>
              <p>normalized rows</p>
            </article>
            <article>
              <span className="model-route-card__eyebrow">Assets</span>
              <strong>{result.assetsCreated}</strong>
              <p>summaries created</p>
            </article>
            <article>
              <span className="model-route-card__eyebrow">Review</span>
              <strong>{result.reviewNeeded}</strong>
              <p>records flagged</p>
            </article>
          </section>

          <section className="agentic-demo-section">
            <h3>1. Source cards</h3>
            <div className="multi-source-intake-source-grid">
              {result.sourceResults.map((source) => (
                <article className="agentic-demo-card" key={source.id}>
                  <div className="agentic-demo-card__header">
                    <div>
                      <span className="model-route-card__eyebrow">
                        {getSourceLabel(source.sourceType)}
                      </span>
                      <h4>{source.sourceName}</h4>
                    </div>
                    <span
                      className={
                        source.missingFields.length > 0
                          ? "agentic-demo-pill agentic-demo-pill--warning"
                          : "agentic-demo-pill agentic-demo-pill--success"
                      }
                    >
                      Confidence {formatScore(source.confidence)}
                    </span>
                  </div>

                  <dl className="agentic-demo-metadata">
                    <div>
                      <dt>Records</dt>
                      <dd>{source.extractedRecords.length}</dd>
                    </div>
                    <div>
                      <dt>Brands</dt>
                      <dd>{formatList(source.metadata.detectedBrands)}</dd>
                    </div>
                    <div>
                      <dt>Store</dt>
                      <dd>{formatList(source.metadata.detectedStoreIds)}</dd>
                    </div>
                    <div>
                      <dt>Tags</dt>
                      <dd>{formatList(source.metadata.operationalTags)}</dd>
                    </div>
                  </dl>

                  <details className="multi-source-intake-details">
                    <summary>Raw input preview</summary>
                    <pre>{source.rawContent}</pre>
                  </details>

                  <details className="multi-source-intake-details">
                    <summary>Cleaned text preview</summary>
                    <pre>{source.cleanedText}</pre>
                  </details>
                </article>
              ))}
            </div>
          </section>

          <section className="agentic-demo-section">
            <h3>2. Cleaned dataset preview</h3>
            <div className="multi-source-intake-table-wrap">
              <table className="multi-source-intake-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Brand</th>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Flex</th>
                    <th>Condition</th>
                    <th>Value</th>
                    <th>Store</th>
                    <th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {result.cleanedDatasetPreview.map((record) => (
                    <tr key={record.id}>
                      <td>{getSourceLabel(record.sourceType)}</td>
                      <td>{formatNullable(record.brand)}</td>
                      <td>{formatNullable(record.productLine)}</td>
                      <td>{formatNullable(record.category)}</td>
                      <td>{formatNullable(record.shaftFlex)}</td>
                      <td>{formatNullable(record.condition)}</td>
                      <td>{record.tradeInValue === null ? "—" : `$${record.tradeInValue}`}</td>
                      <td>{formatNullable(record.storeId)}</td>
                      <td>
                        {record.reviewNeeded ? (
                          <span className="agentic-demo-pill agentic-demo-pill--warning">
                            Review
                          </span>
                        ) : (
                          <span className="agentic-demo-pill agentic-demo-pill--success">
                            Ready
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="agentic-demo-section">
            <h3>3. Extracted structured records</h3>
            <div className="agentic-demo-card-list">
              {result.cleanedDatasetPreview.map((record) => (
                <article className="agentic-demo-card" key={record.id}>
                  <div className="agentic-demo-card__header">
                    <div>
                      <span className="model-route-card__eyebrow">
                        {getSourceLabel(record.sourceType)} · confidence{" "}
                        {formatScore(record.confidence)}
                      </span>
                      <h4>
                        {record.brand ?? "Unknown brand"}{" "}
                        {record.productLine ?? "Unknown product"}
                      </h4>
                    </div>
                    {record.reviewNeeded ? (
                      <span className="agentic-demo-pill agentic-demo-pill--warning">
                        Needs review
                      </span>
                    ) : (
                      <span className="agentic-demo-pill agentic-demo-pill--success">
                        Structured
                      </span>
                    )}
                  </div>

                  <dl className="agentic-demo-metadata">
                    <div>
                      <dt>Customer</dt>
                      <dd>
                        {[record.customerName, record.customerEmail]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Missing fields</dt>
                      <dd>{formatList(record.missingFields)}</dd>
                    </div>
                    <div>
                      <dt>Attachments</dt>
                      <dd>{formatList(record.attachmentsMentioned)}</dd>
                    </div>
                    <div>
                      <dt>Event timestamp</dt>
                      <dd>{formatNullable(record.eventTimestamp)}</dd>
                    </div>
                  </dl>

                  <details className="multi-source-intake-details">
                    <summary>Normalized text for embedding</summary>
                    <pre>{record.normalizedText}</pre>
                  </details>
                </article>
              ))}
            </div>
          </section>

          <section className="agentic-demo-section">
            <h3>4. Inferred schema</h3>
            <div className="multi-source-intake-schema-grid">
              {result.inferredDatasetSchema.map((field) => (
                <article className="agentic-demo-card" key={field.fieldName}>
                  <span className="model-route-card__eyebrow">
                    {field.type}
                    {field.nullable ? " · nullable" : ""}
                  </span>
                  <h4>{field.fieldName}</h4>
                  <p>{field.description}</p>
                  <small>Examples: {formatList(field.examples)}</small>
                </article>
              ))}
            </div>
          </section>

          <section className="agentic-demo-section">
            <h3>5. Metadata summary</h3>
            <dl className="agentic-demo-metadata">
              <div>
                <dt>Source types</dt>
                <dd>{result.metadataSummary.sourceTypes.map(getSourceLabel).join(", ")}</dd>
              </div>
              <div>
                <dt>Brands</dt>
                <dd>{formatList(result.metadataSummary.detectedBrands)}</dd>
              </div>
              <div>
                <dt>Categories</dt>
                <dd>{formatList(result.metadataSummary.detectedCategories)}</dd>
              </div>
              <div>
                <dt>Stores</dt>
                <dd>{formatList(result.metadataSummary.detectedStoreIds)}</dd>
              </div>
              <div>
                <dt>Customer emails</dt>
                <dd>{formatList(result.metadataSummary.customerEmails)}</dd>
              </div>
              <div>
                <dt>Attachments</dt>
                <dd>{formatList(result.metadataSummary.attachmentNames)}</dd>
              </div>
              <div>
                <dt>Event timestamps</dt>
                <dd>{formatList(result.metadataSummary.eventTimestamps)}</dd>
              </div>
              <div>
                <dt>Operational tags</dt>
                <dd>{formatList(result.metadataSummary.operationalTags)}</dd>
              </div>
            </dl>
          </section>

          <section className="agentic-demo-section">
            <h3>6. Quality and review signals</h3>
            <div className="multi-source-intake-signal-list">
              {result.sourceResults.flatMap((source) =>
                source.qualitySignals.map((signal) => (
                  <article
                    className={getQualitySignalClassName(signal.severity)}
                    key={`${source.id}-${signal.signal}-${signal.message}`}
                  >
                    <span>{signal.severity}</span>
                    <strong>{signal.signal}</strong>
                    <p>{signal.message}</p>
                    <small>{source.sourceName}</small>
                  </article>
                )),
              )}
            </div>
          </section>

          <section className="agentic-demo-section">
            <h3>7. Embedding and RAG readiness</h3>
            <article className="agentic-demo-card">
              <div className="agentic-demo-card__header">
                <div>
                  <span className="model-route-card__eyebrow">
                    trade_in_intake_assets
                  </span>
                  <h4>{result.ragReadinessSummary.summary}</h4>
                </div>
                <span
                  className={
                    result.ragReadinessSummary.ragIndexReady
                      ? "agentic-demo-pill agentic-demo-pill--success"
                      : "agentic-demo-pill agentic-demo-pill--warning"
                  }
                >
                  {result.ragReadinessSummary.ragIndexReady
                    ? "RAG-ready"
                    : "Needs review"}
                </span>
              </div>

              <dl className="agentic-demo-metadata">
                <div>
                  <dt>Ready sources</dt>
                  <dd>
                    {result.ragReadinessSummary.readySourceCount}/
                    {result.ragReadinessSummary.totalSourceCount}
                  </dd>
                </div>
                <div>
                  <dt>Ready records</dt>
                  <dd>
                    {result.ragReadinessSummary.readyRecordCount}/
                    {result.ragReadinessSummary.totalRecordCount}
                  </dd>
                </div>
                <div>
                  <dt>Embedding ready</dt>
                  <dd>{result.ragReadinessSummary.embeddingReady ? "Yes" : "No"}</dd>
                </div>
                <div>
                  <dt>Index ready</dt>
                  <dd>{result.ragReadinessSummary.ragIndexReady ? "Yes" : "No"}</dd>
                </div>
              </dl>
            </article>

            <div className="multi-source-intake-source-grid">
              {result.sourceResults.map((source) => (
                <article className="agentic-demo-card" key={`${source.id}-rag`}>
                  <span className="model-route-card__eyebrow">
                    {source.ragIndexReadiness.indexName}
                  </span>
                  <h4>{source.sourceName}</h4>
                  <p>{source.embeddingReadiness.reason}</p>
                  <p>{source.ragIndexReadiness.reason}</p>
                  <small>
                    Chunk strategy: {source.embeddingReadiness.suggestedChunkStrategy}
                  </small>
                </article>
              ))}
            </div>
          </section>

          <section className="agentic-demo-section">
            <h3>8. Audit trail</h3>
            <div className="agentic-demo-audit-list">
              {result.auditTrail.map((event) => (
                <article className="agentic-demo-audit-event" key={event.orderIndex}>
                  <div>
                    <span className="model-route-card__eyebrow">
                      Step {event.orderIndex}
                    </span>
                    <h4>{event.label}</h4>
                    <p>{event.summary}</p>
                  </div>
                  <span className={getAuditStatusClassName(event.status)}>
                    {event.status}
                  </span>
                </article>
              ))}
            </div>
          </section>

          {selectedSource ? (
            <section className="agentic-demo-section">
              <h3>Persisted demo IDs</h3>
              <dl className="agentic-demo-metadata">
                <div>
                  <dt>Intake batch</dt>
                  <dd>{result.persistedIds.intakeBatchId}</dd>
                </div>
                <div>
                  <dt>Workflow run</dt>
                  <dd>{result.persistedIds.workflowRunId}</dd>
                </div>
                <div>
                  <dt>Intake items</dt>
                  <dd>{result.persistedIds.intakeItemIds.length}</dd>
                </div>
                <div>
                  <dt>Review queue items</dt>
                  <dd>{result.persistedIds.reviewQueueItemIds.length}</dd>
                </div>
                <div>
                  <dt>Tool call logs</dt>
                  <dd>{result.persistedIds.toolCallLogIds.length}</dd>
                </div>
              </dl>
            </section>
          ) : null}
        </div>
      ) : null}
    </DashboardSection>
  );
}
