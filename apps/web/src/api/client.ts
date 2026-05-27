const DEFAULT_API_BASE_URL = "http://localhost:4000";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL;

type ApiClientOptions = {
  signal?: AbortSignal;
};

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function apiGet<T>(
  path: string,
  options: ApiClientOptions = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    signal: options.signal,
  });

  return parseJsonResponse<T>(response);
}

export async function apiPost<TResponse, TBody>(
  path: string,
  body: TBody,
  options: ApiClientOptions = {},
): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  return parseJsonResponse<TResponse>(response);
}
