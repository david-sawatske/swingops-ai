import "dotenv/config";

import { apiEnvSchema } from "./env-schema.js";

const parsedEnv = apiEnvSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid API environment configuration:");
  console.error(parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsedEnv.data;
