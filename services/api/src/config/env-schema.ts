import { z } from "zod";

export const apiEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .refine(
      (value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol),
      "DATABASE_URL must use the postgres or postgresql protocol."
    ),

  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(4000),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  WEB_ORIGIN: z.string().url().default("http://localhost:5173")
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
