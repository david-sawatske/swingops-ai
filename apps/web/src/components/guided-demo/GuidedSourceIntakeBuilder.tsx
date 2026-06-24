import { useMemo, useState } from "react";

import type {
  ExecuteMultiSourceIntakeDemoRequest,
  ExecuteMultiSourceIntakeDemoResponse,
  MultiSourceIntakeSourceInput,
  MultiSourceIntakeSourceType,
} from "../../types/workflow";
import { EmptyState } from "../EmptyState";

const SOURCE_TYPE_OPTIONS: {
  value: MultiSourceIntakeSourceType;
  label: string;
}[] = [
  { value: "FREE_TEXT", label: "Store note / free text" },
  { value: "POORLY_FORMED_CSV", label: "Malformed CSV" },
  { value: "EMAIL", label: "Customer email" },
  { value: "LOG", label: "Operations log" },
];

const SAMPLE_SOURCE_BY_TYPE: Record<
  MultiSourceIntakeSourceType,
  MultiSourceIntakeSourceInput
> = {
  FREE_TEXT: {
    sourceType: "FREE_TEXT",
    sourceName: "Counter notebook notes",
    rawContent: [
      "Sat counter notes - trade pile",
      "1) TM stealth2 drv 10.5 ventus stiff condition 8.0 Average cust: Mark R.",
      "2) Ping g425 irons 5-pw reg flex condition 7.0 Below Average needs manager look.",
      "3) Cleveland RTX 6 ZipCore wedge senior flex condition 9.0 Above Average value $72 serial CLV-001.",
      "4) Odyssey White Hot OG putter ladies flex condition 8.0 Average value $95 serial ODS-002.",
      "Store 104 / associate jules",
    ].join("\n"),
  },
  POORLY_FORMED_CSV: {
    sourceType: "POORLY_FORMED_CSV",
    sourceName: "Store export with broken rows",
    rawContent: [
      "brand|model,cat,shaft,condition_grade,value,store",
      "Titleist; TSR2; 3w ; Tensei S ; 8.0 Average ; $145 ; 104",
      "Cally,Rogue ST Max driver,HZRDUS X,7.0 Below Average,190,STORE-207",
      "PING|G425 irons|reg|6.0 Poor||104",
      "Cleveland|RTX 6 ZipCore wedge|Senior|9.0 Above Average|$72|104",
      "Odyssey|White Hot OG putter|Ladies|8.0 Average|$95|104",
      "Mizuno|JPX 923 Hot Metal irons|Tour X-Stiff|9.0 Above Average|$390|STORE-104",
      "PING|G430 Max driver|Tour X-Stiff|9.5 Mint|$240|STORE-207",
    ].join("\n"),
  },
  EMAIL: {
    sourceType: "EMAIL",
    sourceName: "Customer trade-in email",
    rawContent: [
      "From: Hannah Lee <hannah.lee@example.com>",
      "To: tradeins@swingops.example",
      "Subject: Trade values for two clubs",
      "",
      "Hi team, I am bringing in a Callaway Rogue ST Max 9 degree driver with HZRDUS x-stiff.",
      "Condition grade is 7.0 Below Average.",
      "Also a TaylorMade Stealth 2 10.5 driver with Ventus stiff and condition 8.0 Average.",
      "One more: Cleveland RTX 6 ZipCore wedge with Senior flex, condition 9.0 Above Average, estimated value 72.",
      "Also Odyssey White Hot OG putter with Ladies flex, condition 8.0 Average, value 95.",
      "Preferred store: 207",
    ].join("\n"),
  },
  LOG: {
    sourceType: "LOG",
    sourceName: "Import worker event log",
    rawContent: [
      "2026-05-18T14:33:02Z INFO import start store=104 batch=nightly_tradeins",
      "2026-05-18T14:33:04Z WARN malformed payload brand=Titleist model=TSR cat=3w shaft='Tensei S' condition='8.0 Average' value=145",
      "2026-05-18T14:33:07Z ERROR row=18 missing category payload={brand:'PING', model:'G425', condition:'6.0 Poor', notes:'irons 5-PW reg'}",
      "2026-05-18T14:33:11Z INFO normalized sku match Callaway Rogue ST Max driver store=207",
      "2026-05-18T14:33:14Z INFO normalized payload brand=Cleveland model=RTX 6 ZipCore cat=wedge shaft='Senior' condition='9.0 Above Average' value=72",
      "2026-05-18T14:33:18Z INFO normalized payload brand=Mizuno model=JPX 923 Hot Metal cat=irons shaft='Tour X-Stiff' condition='9.0 Above Average' value=390",
    ].join("\n"),
  },
};

type SourceInputMode = "PASTE" | "UPLOAD";

function createBlankSource(): MultiSourceIntakeSourceInput {
  return {
    sourceType: "FREE_TEXT",
    sourceName: "",
    rawContent: "",
  };
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

function getSourceLabel(sourceType: string) {
  return sourceType
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getSourceStatus(
  source: MultiSourceIntakeSourceInput,
  uploadedFileName?: string,
) {
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

export function GuidedSourceIntakeBuilder({
  result,
  isRunning,
  error,
  success,
  onRunSources,
}: {
  result: ExecuteMultiSourceIntakeDemoResponse | null;
  isRunning: boolean;
  error: string | null;
  success: string | null;
  onRunSources: (request?: ExecuteMultiSourceIntakeDemoRequest) => void;
}) {
  const [sources, setSources] = useState<MultiSourceIntakeSourceInput[]>([
    createBlankSource(),
  ]);
  const [sourceInputModes, setSourceInputModes] = useState<
    (SourceInputMode | null)[]
  >([null]);
  const [uploadedFileNames, setUploadedFileNames] = useState<(string | null)[]>([
    null,
  ]);
  const [selectedSourceTypes, setSelectedSourceTypes] = useState<
    (MultiSourceIntakeSourceType | null)[]
  >([null]);

  const runnableSources = useMemo(() => toRunnableSources(sources), [sources]);
  const readySourceCount = runnableSources.length;
  const selectedTypeCount = new Set(
    sources
      .map((source) => source.sourceType)
      .filter((sourceType) => Boolean(sourceType)),
  ).size;

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
    setSources((currentSources) => [...currentSources, createBlankSource()]);
    setSourceInputModes((currentModes) => [...currentModes, null]);
    setUploadedFileNames((currentFileNames) => [...currentFileNames, null]);
    setSelectedSourceTypes((currentSourceTypes) => [
      ...currentSourceTypes,
      null,
    ]);
  }

  function clearSources() {
    setSources([createBlankSource()]);
    setSourceInputModes([null]);
    setUploadedFileNames([null]);
    setSelectedSourceTypes([null]);
  }

  function removeSource(index: number) {
    if (sources.length === 1) {
      return;
    }

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

  function canEnterSourceContent(
    source: MultiSourceIntakeSourceInput,
    index: number,
  ) {
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
    onRunSources({ sources: runnableSources });
  }

  const hasVisibleContentStep = sources.some((source, index) =>
    canEnterSourceContent(source, index),
  );

  return (
    <div className="guided-source-builder">
      <div className="guided-workflow-intake-toolbar">
        <div className="guided-workflow-metrics guided-workflow-metrics--compact">
          <article>
            <strong>{sources.length}</strong>
            <span>Sources staged</span>
          </article>
          <article>
            <strong>{selectedTypeCount}</strong>
            <span>Source types</span>
          </article>
          <article>
            <strong>{readySourceCount}</strong>
            <span>Ready sources</span>
          </article>
          <article>
            <strong>{result ? "Complete" : "Not run"}</strong>
            <span>Normalization</span>
          </article>
        </div>

      </div>

      {error ? (
        <EmptyState title="Unable to normalize sources" message={error} />
      ) : null}

      {success ? <p className="success-message">{success}</p> : null}

      <div className="multi-source-intake-editor-list guided-source-builder__list">
        {sources.map((source, index) => (
          <article
            className="agentic-demo-card multi-source-intake-editor-card"
            key={`${source.sourceType}-${index}`}
          >
            {(() => {
              const sourceStatus = getSourceStatus(
                source,
                uploadedFileNames[index] ?? undefined,
              );

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
                      <label className="guided-source-builder__name-field">
                        <span>
                          {isSourceNamed(source) ? "Source name" : "Start here"}
                        </span>
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
                      </label>
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

                  <div
                    className={
                      isSourceNamed(source)
                        ? "multi-source-intake-progressive-section multi-source-intake-progressive-section--tabs"
                        : "multi-source-intake-progressive-section multi-source-intake-progressive-section--tabs multi-source-intake-progressive-section--disabled"
                    }
                  >
                      <div className="multi-source-intake-step-label">
                        <span>Step 2</span>
                        <strong>Choose input method</strong>
                      </div>
                      <div
                        aria-label={`Source ${index + 1} input method`}
                        className="multi-source-intake-folder-tabs"
                        role="tablist"
                      >
                        <button
                          aria-selected={sourceInputModes[index] === "PASTE"}
                          className={
                            sourceInputModes[index] === "PASTE"
                              ? "multi-source-intake-folder-tab multi-source-intake-folder-tab--active"
                              : "multi-source-intake-folder-tab"
                          }
                          disabled={isRunning || !isSourceNamed(source)}
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
                          disabled={isRunning || !isSourceNamed(source)}
                          onClick={() => updateSourceInputMode(index, "UPLOAD")}
                          role="tab"
                          type="button"
                        >
                          <span>Upload file</span>
                          <small>Best for .txt, .csv, .log, or .eml</small>
                        </button>
                      </div>
                    </div>

                  <div
                    className={
                      canChooseSourceType(index)
                        ? "multi-source-intake-progressive-section"
                        : "multi-source-intake-progressive-section multi-source-intake-progressive-section--disabled"
                    }
                  >
                      <div className="multi-source-intake-step-label">
                        <span>Step 3</span>
                        <strong>Select source type</strong>
                      </div>
                      <div className="multi-source-intake-control-panel multi-source-intake-control-panel--inline">
                        <label className="multi-source-intake-field multi-source-intake-field--inline">
                          <span>Source type</span>
                          <select
                            disabled={isRunning || !canChooseSourceType(index)}
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
                              accept=".txt,.csv,.log,.eml,text/*"
                              disabled={isRunning}
                              onChange={(event) => {
                                void handleUploadSource(
                                  index,
                                  event.target.files?.[0] ?? null,
                                );
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
                          <p>Choose a .txt, .csv, .log, or .eml file.</p>
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
                              <strong>
                                Use sample for {getSourceLabel(source.sourceType)}
                              </strong>
                              <small>
                                Click to fill this source with realistic operational content.
                              </small>
                            </span>
                            <span
                              aria-hidden="true"
                              className="multi-source-intake-sample-card__arrow"
                            >
                              Add sample
                            </span>
                          </button>
                          <label className="multi-source-intake-field">
                            <span>Raw source content</span>
                            <textarea
                              disabled={isRunning}
                              onChange={(event) =>
                                updateSource(index, {
                                  rawContent: event.target.value,
                                })
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

      {hasVisibleContentStep ? (
        <>
          <div className="guided-source-builder__list-actions">
            <button disabled={isRunning} onClick={addSource} type="button">
              Add Source
            </button>
            <button disabled={isRunning} onClick={clearSources} type="button">
              Clear
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
            disabled={isRunning || runnableSources.length === 0}
            onClick={handleRun}
            type="button"
          >
            {isRunning ? "Normalizing Sources…" : "Normalize Sources"}
          </button>
        </div>
        </>
      ) : null}
    </div>
  );
}
