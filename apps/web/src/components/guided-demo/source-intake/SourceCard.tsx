import type {
  MultiSourceIntakeSourceInput,
  MultiSourceIntakeSourceType,
} from "../../../types/workflow";

import type { SourceInputMode } from "./sourceIntakeTypes";
import {
  getSourceLabel,
  getSourceStatus,
  getSourceStatusClassName,
} from "./sourceIntakeUtils";
import {
  SOURCE_TYPE_OPTIONS,
  getRawSourceContentPlaceholder,
  getUploadSourceFileHelp,
} from "./sourceTypeConfig";

type SourceCardProps = {
  canChooseSourceType: (index: number) => boolean;
  canEnterSourceContent: (
    source: MultiSourceIntakeSourceInput,
    index: number,
  ) => boolean;
  index: number;
  isRunning: boolean;
  isSourceNamed: (source: MultiSourceIntakeSourceInput) => boolean;
  onPopulateSampleSource: (index: number) => void;
  onRemoveSource: (index: number) => void;
  onSelectedSourceTypeChange: (
    index: number,
    sourceType: MultiSourceIntakeSourceType,
  ) => void;
  onSourceChange: (
    index: number,
    updates: Partial<MultiSourceIntakeSourceInput>,
  ) => void;
  onSourceInputModeChange: (index: number, mode: SourceInputMode) => void;
  onSourceNameChange: (index: number, sourceName: string) => void;
  onUploadSource: (index: number, file: File | null) => Promise<void> | void;
  selectedSourceType: MultiSourceIntakeSourceType | null;
  source: MultiSourceIntakeSourceInput;
  sourceCount: number;
  sourceInputMode: SourceInputMode | null;
  uploadedFileName: string | null;
};

export function SourceCard({
  canChooseSourceType,
  canEnterSourceContent,
  index,
  isRunning,
  isSourceNamed,
  onPopulateSampleSource,
  onRemoveSource,
  onSelectedSourceTypeChange,
  onSourceChange,
  onSourceInputModeChange,
  onSourceNameChange,
  onUploadSource,
  selectedSourceType,
  source,
  sourceCount,
  sourceInputMode,
  uploadedFileName,
}: SourceCardProps) {
  const sourceStatus = getSourceStatus(source, uploadedFileName ?? undefined);

  return (
    <article
      className="agentic-demo-card multi-source-intake-editor-card"
      key={`${source.sourceType}-${index}`}
    >
      <div className="multi-source-intake-editor-card__header guided-source-card-header">
        <div className="guided-source-card-title-row">
          <div className="guided-source-card-title-group">
            <span className="model-route-card__eyebrow">Source {index + 1}</span>
            {sourceCount > 1 ? (
              <button
                aria-label={`Remove source ${index + 1}`}
                className="guided-remove-source-icon-button"
                disabled={isRunning}
                onClick={() => onRemoveSource(index)}
                title={`Remove source ${index + 1}`}
                type="button"
              >
                <svg
                  aria-hidden="true"
                  focusable="false"
                  viewBox="0 0 24 24"
                >
                  <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 7h2v8h-2v-8Zm4 0h2v8h-2v-8ZM6 8h12l-1 13H7L6 8Z" />
                </svg>
              </button>
            ) : null}
          </div>

          <span className={getSourceStatusClassName(sourceStatus)}>
            {sourceStatus}
          </span>
        </div>

        <label className="multi-source-intake-field guided-source-name-field">
          <span>Source name</span>
          <input
            aria-label={`Source ${index + 1} name`}
            className="multi-source-intake-title-input"
            disabled={isRunning}
            onChange={(event) =>
              onSourceNameChange(index, event.target.value)
            }
            placeholder="Example: Counter notes"
            value={source.sourceName ?? ""}
          />
        </label>
      </div>

      <div
        className={
          isSourceNamed(source)
            ? "multi-source-intake-progressive-section multi-source-intake-progressive-section--tabs"
            : "multi-source-intake-progressive-section multi-source-intake-progressive-section--tabs multi-source-intake-progressive-section--disabled"
        }
      >
        <div className="multi-source-intake-step-label">
          <strong>Input method</strong>
        </div>
        <div
          aria-label={`Source ${index + 1} input method`}
          className="multi-source-intake-folder-tabs"
          role="tablist"
        >
          <button
            aria-selected={sourceInputMode === "PASTE"}
            className={
              sourceInputMode === "PASTE"
                ? "multi-source-intake-folder-tab multi-source-intake-folder-tab--active"
                : "multi-source-intake-folder-tab"
            }
            disabled={isRunning || !isSourceNamed(source)}
            onClick={() => onSourceInputModeChange(index, "PASTE")}
            role="tab"
            type="button"
          >
            <span>Paste raw content</span>
            <small>Best for notes, emails, logs, or copied exports</small>
          </button>
          <button
            aria-selected={sourceInputMode === "UPLOAD"}
            className={
              sourceInputMode === "UPLOAD"
                ? "multi-source-intake-folder-tab multi-source-intake-folder-tab--active"
                : "multi-source-intake-folder-tab"
            }
            disabled={isRunning || !isSourceNamed(source)}
            onClick={() => onSourceInputModeChange(index, "UPLOAD")}
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
          <strong>Source type</strong>
        </div>
        <div className="guided-source-type-select-row">
          <select
            aria-label={`Source ${index + 1} type`}
            disabled={isRunning || !canChooseSourceType(index)}
            onChange={(event) =>
              onSelectedSourceTypeChange(
                index,
                event.target.value as MultiSourceIntakeSourceType,
              )
            }
            value={selectedSourceType ?? ""}
          >
            <option disabled value="">
              Select source type...
            </option>
            {SOURCE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {canEnterSourceContent(source, index) ? (
        <div className="multi-source-intake-progressive-section">
          <div className="multi-source-intake-step-label">
            <strong>
              {sourceInputMode === "UPLOAD"
                ? "Upload source file"
                : "Paste source content"}
            </strong>
          </div>

          {sourceInputMode === "UPLOAD" ? (
            <div className="multi-source-intake-upload-panel">
              <label className="multi-source-intake-upload-control guided-upload-file-control">
                <span className="guided-upload-file-control__button" aria-hidden="true">
                  <svg
                    focusable="false"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 3 7 8h3v6h4V8h3l-5-5ZM5 17h14v2H5v-2Z" />
                  </svg>
                  Choose file
                </span>
                <input
                  className="guided-upload-file-input"
                  accept=".txt,.csv,.log,.eml,text/*"
                  disabled={isRunning}
                  onChange={(event) => {
                    void onUploadSource(
                      index,
                      event.target.files?.[0] ?? null,
                    );
                    event.target.value = "";
                  }}
                  type="file"
                />
                <span className="guided-upload-file-status">
                  {uploadedFileName ?? "No file loaded"}
                </span>
              </label>
              <p>{getUploadSourceFileHelp(selectedSourceType)}</p>
            </div>
          ) : (
            <>
              <button
                className="multi-source-intake-sample-card"
                disabled={isRunning}
                onClick={() => onPopulateSampleSource(index)}
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
                    onSourceChange(index, {
                      rawContent: event.target.value,
                    })
                  }
                  placeholder={getRawSourceContentPlaceholder(selectedSourceType)}
                  rows={6}
                  value={source.rawContent}
                />
              </label>
            </>
          )}
        </div>
      ) : null}
    </article>
  );
}
