import type {
  CreateIntakeBatchRequest,
  IntakeBatchSourceType,
} from "../types/intake";

type BuildCreateIntakeBatchInput = {
  name: string;
  description: string;
  sourceType: IntakeBatchSourceType;
  rawText: string;
};

type BuildCreateIntakeBatchResult =
  | {
      ok: true;
      request: CreateIntakeBatchRequest;
    }
  | {
      ok: false;
      error: string;
    };

export function buildCreateIntakeBatchRequest({
  name,
  description,
  sourceType,
  rawText,
}: BuildCreateIntakeBatchInput): BuildCreateIntakeBatchResult {
  const trimmedName = name.trim();
  const trimmedDescription = description.trim();

  const rawItems = rawText
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!trimmedName) {
    return {
      ok: false,
      error: "Batch name is required.",
    };
  }

  if (rawItems.length === 0) {
    return {
      ok: false,
      error: "At least one raw trade-in text line is required.",
    };
  }

  return {
    ok: true,
    request: {
      name: trimmedName,
      description: trimmedDescription || undefined,
      sourceType,
      items: rawItems.map((item) => ({ rawText: item })),
    },
  };
}
