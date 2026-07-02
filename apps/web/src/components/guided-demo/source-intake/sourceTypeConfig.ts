import type { MultiSourceIntakeSourceType } from "../../../types/workflow";

export const SOURCE_TYPE_OPTIONS: {
  value: MultiSourceIntakeSourceType;
  label: string;
}[] = [
  { value: "FREE_TEXT", label: "Store note / free text" },
  { value: "POORLY_FORMED_CSV", label: "Malformed CSV" },
  { value: "EMAIL", label: "Customer email" },
  { value: "LOG", label: "Operations log" },
];

export function getRawSourceContentPlaceholder(sourceType: string | null | undefined) {
  switch (sourceType) {
    case "FREE_TEXT":
      return "Paste store notes, counter notes, or customer trade-in details here.";
    case "POORLY_FORMED_CSV":
      return "Paste malformed CSV rows, copied spreadsheet exports, or comma-separated trade-in data here.";
    case "EMAIL":
      return "Paste the customer email body or forwarded trade-in message here.";
    case "LOG":
      return "Paste operations log lines, system notes, or handoff activity here.";
    default:
      return "Select a source type first, then paste the matching source content here.";
  }
}

export function getUploadSourceFileHelp(sourceType: string | null | undefined) {
  switch (sourceType) {
    case "FREE_TEXT":
      return "Upload a .txt file with store notes, counter notes, or customer trade-in details.";
    case "POORLY_FORMED_CSV":
      return "Upload a .csv or .txt file with copied spreadsheet rows or malformed trade-in data.";
    case "EMAIL":
      return "Upload a .eml or .txt file with the customer email body or forwarded trade-in message.";
    case "LOG":
      return "Upload a .log or .txt file with operations logs, system notes, or handoff activity.";
    default:
      return "{getUploadSourceFileHelp(selectedSourceTypes[index])}";
  }
}
