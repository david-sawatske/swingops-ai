import { useMemo, useState } from "react";

import { prepareGoldenDemonstration } from "../../../api/workflows";
import type {
  MultiSourceIntakeSourceInput,
  MultiSourceIntakeSourceType,
} from "../../../types/workflow";
import { EmptyState } from "../../EmptyState";
import { SourceBuilderActions } from "./SourceBuilderActions";
import { SourceCard } from "./SourceCard";
import { SourceIntakeStatusStrip } from "./SourceIntakeStatusStrip";
import { createGoldenDemonstrationSources } from "./goldenDemonstrationSources";
import { SAMPLE_SOURCE_BY_TYPE } from "./sourceIntakeSamples";
import type {
  GuidedSourceIntakeBuilderProps,
  SourceInputMode,
} from "./sourceIntakeTypes";
import {
  createBlankSource,
  toRunnableSources,
} from "./sourceIntakeUtils";

export function GuidedSourceIntakeBuilder({
  result,
  isRunning,
  error,
  success,
  onRunSources,
}: GuidedSourceIntakeBuilderProps) {
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
  const [
    isPreparingGoldenDemonstration,
    setIsPreparingGoldenDemonstration,
  ] = useState(false);
  const [
    hasLoadedGoldenDemonstration,
    setHasLoadedGoldenDemonstration,
  ] = useState(false);
  const [
    goldenDemonstrationMessage,
    setGoldenDemonstrationMessage,
  ] = useState<string | null>(null);
  const [
    goldenDemonstrationError,
    setGoldenDemonstrationError,
  ] = useState<string | null>(null);

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

  async function handleLoadGoldenDemonstration() {
    if (
      result ||
      isRunning ||
      isPreparingGoldenDemonstration ||
      hasLoadedGoldenDemonstration
    ) {
      return;
    }

    try {
      setIsPreparingGoldenDemonstration(true);
      setGoldenDemonstrationMessage(null);
      setGoldenDemonstrationError(null);

      const preparation = await prepareGoldenDemonstration();
      const goldenSources = createGoldenDemonstrationSources();

      setSources(goldenSources);
      setSourceInputModes(
        goldenSources.map(() => "PASTE" as const),
      );
      setUploadedFileNames(
        goldenSources.map(() => null),
      );
      setSelectedSourceTypes(
        goldenSources.map((source) => source.sourceType),
      );
      setHasLoadedGoldenDemonstration(true);

      setGoldenDemonstrationMessage(
        preparation.historicalEvidence.created
          ? "Golden demonstration loaded. One historical reviewer-approved shaft-flex correction was prepared. Four editable source types are staged below. No normalization or model execution has run yet."
          : "Golden demonstration loaded. The existing historical reviewer-approved shaft-flex correction was reused. Four editable source types are staged below. No normalization or model execution has run yet.",
      );
    } catch (preparationError) {
      setGoldenDemonstrationError(
        preparationError instanceof Error
          ? preparationError.message
          : "Unable to prepare the golden demonstration.",
      );
    } finally {
      setIsPreparingGoldenDemonstration(false);
    }
  }

  function handleRun() {
    onRunSources({ sources: runnableSources });
  }

  const hasVisibleContentStep = sources.some((source, index) =>
    canEnterSourceContent(source, index),
  );

  return (
    <div className="guided-source-builder">
      <section
        aria-labelledby="golden-demonstration-loader-title"
        className="guided-source-builder__golden-setup"
      >
        <div>
          <span className="model-route-card__eyebrow">
            Canonical walkthrough
          </span>
          <strong id="golden-demonstration-loader-title">
            Stage the complete five-record demonstration.
          </strong>
          <p>
            This prepares one earlier reviewer-approved correction and
            loads four editable source types. It does not normalize the
            records or run the model.
          </p>
        </div>

        <button
          disabled={
            isRunning ||
            isPreparingGoldenDemonstration ||
            hasLoadedGoldenDemonstration ||
            Boolean(result)
          }
          onClick={() => void handleLoadGoldenDemonstration()}
          type="button"
        >
          {isPreparingGoldenDemonstration
            ? "Preparing demonstration…"
            : hasLoadedGoldenDemonstration
              ? "Golden demonstration loaded"
              : result
                ? "Start over to reload"
                : "Load golden demonstration"}
        </button>
      </section>

      {goldenDemonstrationMessage ? (
        <p
          aria-live="polite"
          className="form-message form-message--success"
        >
          {goldenDemonstrationMessage}
        </p>
      ) : null}

      {goldenDemonstrationError ? (
        <p
          aria-live="assertive"
          className="form-message form-message--error"
        >
          {goldenDemonstrationError}
        </p>
      ) : null}

      <SourceIntakeStatusStrip
        isNormalizationComplete={Boolean(result)}
        readySourceCount={readySourceCount}
        selectedTypeCount={selectedTypeCount}
        sourceCount={sources.length}
      />

      {error ? (
        <EmptyState title="Unable to normalize sources" message={error} />
      ) : null}

      {success ? <p className="success-message">{success}</p> : null}

      <div className="multi-source-intake-editor-list guided-source-builder__list">
        {sources.map((source, index) => (
          <SourceCard
            canChooseSourceType={canChooseSourceType}
            canEnterSourceContent={canEnterSourceContent}
            index={index}
            isRunning={isRunning}
            isSourceNamed={isSourceNamed}
            key={`${source.sourceType}-${index}`}
            onPopulateSampleSource={populateSampleSource}
            onRemoveSource={removeSource}
            onSelectedSourceTypeChange={updateSelectedSourceType}
            onSourceChange={updateSource}
            onSourceInputModeChange={updateSourceInputMode}
            onSourceNameChange={updateSourceName}
            onUploadSource={handleUploadSource}
            selectedSourceType={selectedSourceTypes[index] ?? null}
            source={source}
            sourceCount={sources.length}
            sourceInputMode={sourceInputModes[index] ?? null}
            uploadedFileName={uploadedFileNames[index] ?? null}
          />
        ))}
      </div>

      {hasVisibleContentStep ? (
        <SourceBuilderActions
          isRunning={isRunning}
          onAddSource={addSource}
          onRun={handleRun}
          runnableSourceCount={runnableSources.length}
        />
      ) : null}
    </div>
  );
}
