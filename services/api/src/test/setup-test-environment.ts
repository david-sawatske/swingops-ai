import "dotenv/config";

import { resolveTestDatabaseUrl } from "../config/database-urls.js";
import { apiEnvSchema } from "../config/env-schema.js";

const parsedEnv = apiEnvSchema.parse(process.env);

process.env.DATABASE_URL = resolveTestDatabaseUrl(parsedEnv);
process.env.NODE_ENV = "test";
// Route tests issue many requests from one address; rate-limit tests opt in
// through buildApp options instead.
process.env.RATE_LIMIT_MAX_PER_MINUTE ??= "0";
process.env.WORKFLOW_RATE_LIMIT_MAX_PER_MINUTE ??= "0";
