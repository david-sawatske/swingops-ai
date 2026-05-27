export const golfClubCategories = [
  "Driver",
  "Fairway Wood",
  "Hybrid",
  "Iron Set",
  "Wedge",
  "Putter"
] as const;

export const shaftFlexes = [
  "Ladies",
  "Senior",
  "Regular",
  "Stiff",
  "X-Stiff"
] as const;

export const dexterities = ["Right", "Left"] as const;

export const clubConditions = [
  "New",
  "Excellent",
  "Very Good",
  "Good",
  "Fair"
] as const;

export const intakeBatchStatuses = [
  "Draft",
  "Queued",
  "Processing",
  "Completed",
  "Failed",
  "Needs Review"
] as const;

export const intakeItemStatuses = [
  "Pending",
  "Processing",
  "Structured",
  "Needs Review",
  "Failed"
] as const;

export const intakeSourceTypes = [
  "Freeform Notes",
  "Bad CSV",
  "Email",
  "PDF Text",
  "Manual Entry"
] as const;

export const workflowRunStatuses = [
  "Queued",
  "Running",
  "Completed",
  "Failed",
  "Needs Review",
  "Cancelled"
] as const;

export const workflowStepStatuses = [
  "Pending",
  "Running",
  "Completed",
  "Failed",
  "Skipped",
  "Retrying"
] as const;

export const workflowStepTypes = [
  "Parse Input",
  "Normalize Data",
  "Extract Golf Club Fields",
  "Validate Structured Output",
  "Create Review Item",
  "Persist Golf Club"
] as const;

export const toolCallStatuses = [
  "Started",
  "Succeeded",
  "Failed",
  "Retried"
] as const;

export const modelCallStatuses = [
  "Started",
  "Succeeded",
  "Failed",
  "Retried",
  "Skipped"
] as const;

export const reviewQueueStatuses = [
  "Open",
  "In Review",
  "Resolved",
  "Dismissed"
] as const;

export const reviewReasons = [
  "Missing Required Fields",
  "Low Confidence",
  "Validation Failed",
  "Ambiguous Input",
  "Possible Duplicate",
  "Manual Review Requested"
] as const;

export const modelProviderNames = [
  "Mock",
  "OpenAI",
  "Anthropic",
  "Azure OpenAI",
  "Ollama"
] as const;
