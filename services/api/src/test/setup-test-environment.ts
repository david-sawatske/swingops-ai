import "dotenv/config";

import { resolveTestDatabaseUrl } from "../config/database-urls.js";
import { apiEnvSchema } from "../config/env-schema.js";

const parsedEnv = apiEnvSchema.parse(process.env);

process.env.DATABASE_URL = resolveTestDatabaseUrl(parsedEnv);
process.env.NODE_ENV = "test";
