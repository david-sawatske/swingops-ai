import { z } from "zod";

const postgresDatabaseUrlSchema = z
  .string()
  .url()
  .refine(
    (value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol),
    "Database URLs must use the postgres or postgresql protocol.",
  );

export const apiEnvSchema = z.object({
  DATABASE_URL: postgresDatabaseUrlSchema,
  TEST_DATABASE_URL: postgresDatabaseUrlSchema.optional(),

  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(4000),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  LIVE_DEMO_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(14),
  ADMIN_OPS_MAINTENANCE_INTERVAL_HOURS: z.coerce
    .number()
    .int()
    .min(0)
    .max(168)
    .default(0),

  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),

  // Number of reverse-proxy hops to trust for the client IP. Trusting every
  // hop would let a client spoof X-Forwarded-For and bypass rate limits.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),

  // Per-client-IP request limits; 0 disables a limit.
  RATE_LIMIT_MAX_PER_MINUTE: z.coerce.number().int().min(0).default(300),
  WORKFLOW_RATE_LIMIT_MAX_PER_MINUTE: z.coerce
    .number()
    .int()
    .min(0)
    .default(10),

  // The demo knowledge ingest route deletes and rebuilds the corpus.
  KNOWLEDGE_INGEST_ROUTE_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
