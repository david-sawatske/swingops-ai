export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getStringField(
  record: Record<string, unknown> | null,
  fieldName: string,
): string {
  if (!record) {
    return "—";
  }

  const value = record[fieldName];

  return typeof value === "string" ? value : "—";
}

export function getBooleanField(
  record: Record<string, unknown> | null,
  fieldName: string,
): string {
  if (!record) {
    return "—";
  }

  const value = record[fieldName];

  return typeof value === "boolean" ? String(value) : "—";
}

export function getStringListField(
  record: Record<string, unknown> | null,
  fieldName: string,
): string {
  if (!record) {
    return "—";
  }

  const value = record[fieldName];

  if (!Array.isArray(value)) {
    return "—";
  }

  const strings = value.filter((item): item is string => typeof item === "string");

  return strings.length > 0 ? strings.join(", ") : "—";
}
