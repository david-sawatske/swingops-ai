import type { ModelProviderName } from "./model-provider.types.js";

export type ModelProviderAdapterErrorCode =
  | "MODEL_PROVIDER_NOT_CONFIGURED"
  | "MODEL_PROVIDER_REQUEST_FAILED"
  | "MODEL_PROVIDER_INVALID_RESPONSE";

export class ModelProviderAdapterError extends Error {
  readonly code: ModelProviderAdapterErrorCode;
  readonly provider: ModelProviderName;
  readonly statusCode?: number;

  constructor(input: {
    code: ModelProviderAdapterErrorCode;
    provider: ModelProviderName;
    message: string;
    statusCode?: number;
  }) {
    super(input.message);
    this.name = "ModelProviderAdapterError";
    this.code = input.code;
    this.provider = input.provider;

    if (input.statusCode !== undefined) {
      this.statusCode = input.statusCode;
    }
  }
}

export function isModelProviderAdapterError(
  error: unknown
): error is ModelProviderAdapterError {
  return error instanceof ModelProviderAdapterError;
}
