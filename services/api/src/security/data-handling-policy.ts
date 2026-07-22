export const DATA_HANDLING_POLICY_VERSION = "2026-07-21" as const;

export type DataHandlingContext =
  | "MODEL_AUDIT_LOG"
  | "TOOL_AUDIT_LOG"
  | "EXTERNAL_TOOL_OUTPUT";

export type DataRedactionType =
  | "AUTHENTICATION_SECRET"
  | "EMAIL_ADDRESS"
  | "PHONE_NUMBER"
  | "GOVERNMENT_IDENTIFIER"
  | "PAYMENT_DATA"
  | "PERSON_NAME"
  | "POSTAL_ADDRESS";

export type PromptInjectionIndicator =
  | "INSTRUCTION_OVERRIDE"
  | "PROMPT_EXTRACTION"
  | "SECRET_EXTRACTION"
  | "ROLE_MANIPULATION";

export type DataHandlingMode = "REDACT" | "OMIT_SENSITIVE_FIELDS";

export type DataHandlingDiagnostics = {
  policyVersion: typeof DATA_HANDLING_POLICY_VERSION;
  context: DataHandlingContext;
  mode: DataHandlingMode;
  retentionClass: "LOCAL_AUDIT_LOG" | "TRANSIENT_RESPONSE";
  automatedRetentionEnforced: false;
  redacted: boolean;
  redactionCount: number;
  redactionTypes: DataRedactionType[];
  promptInjectionIndicators: PromptInjectionIndicator[];
  promptInjectionAction: "ADVISORY_ONLY";
};

export type DataHandlingResult = {
  value: unknown;
  diagnostics: DataHandlingDiagnostics;
};

type MutableDiagnostics = {
  redactionCount: number;
  redactionTypes: Set<DataRedactionType>;
  promptInjectionIndicators: Set<PromptInjectionIndicator>;
};

const redactionTypeOrder: DataRedactionType[] = [
  "AUTHENTICATION_SECRET",
  "EMAIL_ADDRESS",
  "PHONE_NUMBER",
  "GOVERNMENT_IDENTIFIER",
  "PAYMENT_DATA",
  "PERSON_NAME",
  "POSTAL_ADDRESS"
];

const promptInjectionIndicatorOrder: PromptInjectionIndicator[] = [
  "INSTRUCTION_OVERRIDE",
  "PROMPT_EXTRACTION",
  "SECRET_EXTRACTION",
  "ROLE_MANIPULATION"
];

const promptInjectionPatterns: Array<{
  indicator: PromptInjectionIndicator;
  pattern: RegExp;
}> = [
  {
    indicator: "INSTRUCTION_OVERRIDE",
    pattern:
      /\b(?:ignore|disregard|forget|override)\b.{0,50}\b(?:previous|prior|system|developer|original)\b.{0,30}\b(?:instruction|instructions|message|prompt|rules?)\b/i
  },
  {
    indicator: "PROMPT_EXTRACTION",
    pattern:
      /\b(?:reveal|show|expose|print|repeat|return)\b.{0,50}\b(?:system|developer|hidden|original)\b.{0,20}\b(?:prompt|message|instructions?|rules?)\b/i
  },
  {
    indicator: "SECRET_EXTRACTION",
    pattern:
      /\b(?:reveal|show|expose|print|return|list)\b.{0,50}\b(?:secret|secrets|password|passwords|api[ _-]?keys?|access[ _-]?tokens?|credentials?)\b/i
  },
  {
    indicator: "ROLE_MANIPULATION",
    pattern: /\b(?:you are now|act as|pretend (?:that )?you are)\b/i
  }
];

const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const governmentIdentifierPattern = /\b\d{3}-\d{2}-\d{4}\b/g;
const phonePatterns = [
  /\+1[ .-]?\(?\d{3}\)?[ .-]?\d{3}[ .-]\d{4}\b/g,
  /\(\d{3}\)[ .-]?\d{3}[ .-]\d{4}\b/g,
  /\b\d{3}[ .-]\d{3}[ .-]\d{4}\b/g
];
const bearerCredentialPattern = /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi;
const providerCredentialPattern = /\bsk-[A-Za-z0-9_-]{16,}\b/g;
const assignedSecretPattern =
  /\b(api[ _-]?key|password|secret|access[ _-]?token|refresh[ _-]?token)\s*([:=])\s*([^\s,;]+)/gi;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function classifySensitiveKey(key: string): DataRedactionType | null {
  const normalized = normalizedKey(key);

  if (
    normalized === "password" ||
    normalized === "passwd" ||
    normalized === "pwd" ||
    normalized === "secret" ||
    normalized.endsWith("secret") ||
    normalized === "token" ||
    normalized.endsWith("accesstoken") ||
    normalized.endsWith("refreshtoken") ||
    normalized.endsWith("authtoken") ||
    normalized.endsWith("bearertoken") ||
    normalized.endsWith("sessiontoken") ||
    normalized.endsWith("idtoken") ||
    normalized === "apikey" ||
    normalized.endsWith("apikey") ||
    normalized === "authorization" ||
    normalized.endsWith("authorization") ||
    normalized === "cookie" ||
    normalized === "setcookie" ||
    normalized === "privatekey" ||
    normalized.endsWith("privatekey") ||
    normalized === "credential" ||
    normalized === "credentials"
  ) {
    return "AUTHENTICATION_SECRET";
  }

  if (
    normalized === "email" ||
    normalized.endsWith("email") ||
    normalized.endsWith("emailaddress")
  ) {
    return "EMAIL_ADDRESS";
  }

  if (
    normalized === "phone" ||
    normalized.endsWith("phone") ||
    normalized.endsWith("phonenumber") ||
    normalized === "mobile" ||
    normalized.endsWith("mobile") ||
    normalized === "telephone"
  ) {
    return "PHONE_NUMBER";
  }

  if (
    normalized === "ssn" ||
    normalized.endsWith("ssn") ||
    normalized.includes("socialsecurity") ||
    normalized === "taxpayerid"
  ) {
    return "GOVERNMENT_IDENTIFIER";
  }

  if (
    normalized === "cardnumber" ||
    normalized.endsWith("cardnumber") ||
    normalized === "creditcard" ||
    normalized.endsWith("creditcard") ||
    normalized === "cvv" ||
    normalized === "cvc" ||
    normalized === "bankaccount" ||
    normalized.endsWith("bankaccount") ||
    normalized === "routingnumber"
  ) {
    return "PAYMENT_DATA";
  }

  if (
    normalized === "firstname" ||
    normalized === "lastname" ||
    normalized === "fullname" ||
    normalized === "customername" ||
    normalized === "reviewername"
  ) {
    return "PERSON_NAME";
  }

  if (
    normalized === "streetaddress" ||
    normalized === "addressline1" ||
    normalized === "addressline2" ||
    normalized === "mailingaddress" ||
    normalized === "postaladdress"
  ) {
    return "POSTAL_ADDRESS";
  }

  return null;
}

function redactionMarker(type: DataRedactionType): string {
  return `[REDACTED:${type}]`;
}

function recordRedaction(
  diagnostics: MutableDiagnostics,
  type: DataRedactionType,
  count = 1
): void {
  diagnostics.redactionTypes.add(type);
  diagnostics.redactionCount += count;
}

function inspectPromptInjection(
  value: string,
  diagnostics: MutableDiagnostics
): void {
  for (const { indicator, pattern } of promptInjectionPatterns) {
    if (pattern.test(value)) {
      diagnostics.promptInjectionIndicators.add(indicator);
    }
  }
}

function replaceMatches(
  value: string,
  pattern: RegExp,
  type: DataRedactionType,
  diagnostics: MutableDiagnostics,
  replacement: string | ((...match: string[]) => string)
): string {
  return value.replace(pattern, (...args: unknown[]) => {
    recordRedaction(diagnostics, type);

    if (typeof replacement === "string") {
      return replacement;
    }

    const matches = args.slice(0, -2).map(String);
    return replacement(...matches);
  });
}

function redactString(
  value: string,
  diagnostics: MutableDiagnostics
): string {
  inspectPromptInjection(value, diagnostics);

  let sanitized = replaceMatches(
    value,
    bearerCredentialPattern,
    "AUTHENTICATION_SECRET",
    diagnostics,
    redactionMarker("AUTHENTICATION_SECRET")
  );
  sanitized = replaceMatches(
    sanitized,
    providerCredentialPattern,
    "AUTHENTICATION_SECRET",
    diagnostics,
    redactionMarker("AUTHENTICATION_SECRET")
  );
  sanitized = replaceMatches(
    sanitized,
    assignedSecretPattern,
    "AUTHENTICATION_SECRET",
    diagnostics,
    (_match, label, separator) =>
      `${label}${separator}${redactionMarker("AUTHENTICATION_SECRET")}`
  );
  sanitized = replaceMatches(
    sanitized,
    emailPattern,
    "EMAIL_ADDRESS",
    diagnostics,
    redactionMarker("EMAIL_ADDRESS")
  );
  sanitized = replaceMatches(
    sanitized,
    governmentIdentifierPattern,
    "GOVERNMENT_IDENTIFIER",
    diagnostics,
    redactionMarker("GOVERNMENT_IDENTIFIER")
  );

  for (const phonePattern of phonePatterns) {
    sanitized = replaceMatches(
      sanitized,
      phonePattern,
      "PHONE_NUMBER",
      diagnostics,
      redactionMarker("PHONE_NUMBER")
    );
  }

  return sanitized;
}

function sanitizeValue(
  value: unknown,
  mode: DataHandlingMode,
  diagnostics: MutableDiagnostics,
  seen: WeakSet<object>
): unknown {
  if (typeof value === "string") {
    return redactString(value, diagnostics);
  }

  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return null;
    }

    seen.add(value);
    const sanitizedEntries = value.map((entry) =>
      sanitizeValue(entry, mode, diagnostics, seen)
    );
    seen.delete(value);
    return sanitizedEntries;
  }

  if (!isRecord(value)) {
    return null;
  }

  if (seen.has(value)) {
    return null;
  }

  seen.add(value);
  const sanitizedEntries: Array<[string, unknown]> = [];

  for (const [key, nestedValue] of Object.entries(value)) {
    const sensitiveKeyType = classifySensitiveKey(key);

    if (sensitiveKeyType !== null) {
      recordRedaction(diagnostics, sensitiveKeyType);

      if (mode === "REDACT") {
        sanitizedEntries.push([key, redactionMarker(sensitiveKeyType)]);
      }

      continue;
    }

    sanitizedEntries.push([
      key,
      sanitizeValue(nestedValue, mode, diagnostics, seen)
    ]);
  }

  seen.delete(value);
  return Object.fromEntries(sanitizedEntries);
}

export function applyDataHandlingPolicy(input: {
  value: unknown;
  context: DataHandlingContext;
  mode?: DataHandlingMode;
}): DataHandlingResult {
  const mode = input.mode ?? "REDACT";
  const mutableDiagnostics: MutableDiagnostics = {
    redactionCount: 0,
    redactionTypes: new Set<DataRedactionType>(),
    promptInjectionIndicators: new Set<PromptInjectionIndicator>()
  };
  const value = sanitizeValue(
    input.value,
    mode,
    mutableDiagnostics,
    new WeakSet<object>()
  );
  const redactionTypes = redactionTypeOrder.filter((type) =>
    mutableDiagnostics.redactionTypes.has(type)
  );
  const promptInjectionIndicators = promptInjectionIndicatorOrder.filter(
    (indicator) =>
      mutableDiagnostics.promptInjectionIndicators.has(indicator)
  );

  return {
    value,
    diagnostics: {
      policyVersion: DATA_HANDLING_POLICY_VERSION,
      context: input.context,
      mode,
      retentionClass:
        input.context === "EXTERNAL_TOOL_OUTPUT"
          ? "TRANSIENT_RESPONSE"
          : "LOCAL_AUDIT_LOG",
      automatedRetentionEnforced: false,
      redacted: mutableDiagnostics.redactionCount > 0,
      redactionCount: mutableDiagnostics.redactionCount,
      redactionTypes,
      promptInjectionIndicators,
      promptInjectionAction: "ADVISORY_ONLY"
    }
  };
}

export function attachDataHandlingDiagnostics(
  result: DataHandlingResult
): Record<string, unknown> {
  if (isRecord(result.value)) {
    return {
      ...result.value,
      dataHandlingPolicy: result.diagnostics
    };
  }

  return {
    auditValue: result.value,
    dataHandlingPolicy: result.diagnostics
  };
}

export function sanitizeAuditText(
  value: string,
  context: Extract<DataHandlingContext, "MODEL_AUDIT_LOG" | "TOOL_AUDIT_LOG">
): string {
  const result = applyDataHandlingPolicy({
    value,
    context
  });

  return typeof result.value === "string"
    ? result.value
    : "Sensitive error details were redacted."
}
