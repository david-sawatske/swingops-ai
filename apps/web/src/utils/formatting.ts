export function formatEnumLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export function formatEnabledLabel(value: boolean): string {
  return value ? "Enabled" : "Disabled";
}

export function formatShortId(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  return value.length <= 14 ? value : `${value.slice(0, 8)}...${value.slice(-4)}`;
}

export function formatJson(value: unknown): string {
  if (value === null || value === undefined) {
    return "No proposed golf club data captured.";
  }

  return JSON.stringify(value, null, 2);
}

export function formatConnectorJson(value: unknown): string {
  if (value === null || value === undefined) {
    return "No connector result returned.";
  }

  return JSON.stringify(value, null, 2);
}

export function formatToolCallTimestamp(value: string | null): string {
  return value ?? "—";
}
