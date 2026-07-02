export function formatEnumLabel(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "—";
  }

  const normalized = trimmedValue.toUpperCase().replace(/[\s-]+/g, "_");

  const knownLabels: Record<string, string> = {
    DRIVER: "Driver",
    FAIRWAY_WOOD: "Fairway Wood",
    HYBRID: "Hybrid",
    IRON_SET: "Iron Set",
    WEDGE: "Wedge",
    PUTTER: "Putter",
    LADIES: "Ladies",
    SENIOR: "Senior",
    REGULAR: "Regular",
    STIFF: "Stiff",
    X_STIFF: "X-Stiff",
    TOUR_X_STIFF: "Tour X-Stiff",
    READY_FOR_REVIEW: "Ready for review",
    READY_FOR_RAG: "Ready for RAG",
    NEEDS_REVIEW: "Needs review",
  };

  if (knownLabels[normalized]) {
    return knownLabels[normalized];
  }

  if (!trimmedValue.includes("_")) {
    return trimmedValue;
  }

  return trimmedValue
    .split("_")
    .filter(Boolean)
    .map((part) => {
      const upperPart = part.toUpperCase();

      if (["AI", "API", "CSV", "PDF", "RAG", "UI"].includes(upperPart)) {
        return upperPart;
      }

      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
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
