import type { MultiSourceIntakeSourceInput } from "../../../types/workflow";

import { SAMPLE_SOURCE_BY_TYPE } from "./sourceIntakeSamples";

export function createBlankSource(): MultiSourceIntakeSourceInput {
  return {
    sourceType: "FREE_TEXT",
    sourceName: "",
    rawContent: "",
  };
}

export function toRunnableSources(sources: MultiSourceIntakeSourceInput[]) {
  return sources
    .map((source) => ({
      sourceType: source.sourceType,
      sourceName: source.sourceName?.trim() || undefined,
      rawContent: source.rawContent.trim(),
    }))
    .filter((source) => source.rawContent.length > 0);
}

export function getSourceLabel(sourceType: string) {
  return sourceType
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getSourceStatus(
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

export function getSourceStatusClassName(status: string) {
  return status === "Needs content"
    ? "multi-source-intake-status multi-source-intake-status--warning"
    : "multi-source-intake-status multi-source-intake-status--ready";
}
