import "dotenv/config";

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";

import {
  getDatabaseDisplayName,
  getDatabaseNameFromUrl,
  resolveTestDatabaseUrl,
} from "../config/database-urls.js";
import { apiEnvSchema } from "../config/env-schema.js";

const parsedEnv = apiEnvSchema.parse(process.env);
const testDatabaseUrl = resolveTestDatabaseUrl(parsedEnv);
const testDatabaseName = getDatabaseNameFromUrl(testDatabaseUrl);
const apiRoot = fileURLToPath(new URL("../../", import.meta.url));

if (!/^[a-zA-Z0-9_]+$/.test(testDatabaseName)) {
  throw new Error(
    "Test database names may contain only letters, numbers, and underscores.",
  );
}

const maintenanceDatabaseUrl = new URL(testDatabaseUrl);
maintenanceDatabaseUrl.pathname = "/postgres";

const maintenanceClient = new PrismaClient({
  datasourceUrl: maintenanceDatabaseUrl.toString(),
});

try {
  const rows = await maintenanceClient.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS(
      SELECT 1 FROM pg_database WHERE datname = ${testDatabaseName}
    ) AS "exists"
  `;

  if (!rows[0]?.exists) {
    await maintenanceClient.$executeRawUnsafe(
      `CREATE DATABASE "${testDatabaseName}"`,
    );
    console.log(
      `Created test database ${getDatabaseDisplayName(testDatabaseUrl)}.`,
    );
  }
} finally {
  await maintenanceClient.$disconnect();
}

console.log(
  `Resetting test database ${getDatabaseDisplayName(testDatabaseUrl)}.`,
);

const migrationResult = spawnSync(
  "pnpm",
  ["exec", "prisma", "migrate", "reset", "--force", "--skip-seed"],
  {
    cwd: apiRoot,
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl,
      NODE_ENV: "test",
    },
    stdio: "inherit",
  },
);

if (migrationResult.error) {
  throw migrationResult.error;
}

if (migrationResult.status !== 0) {
  throw new Error(
    `Test database migration reset failed with exit code ${migrationResult.status ?? "unknown"}.`,
  );
}

console.log("Test database is migrated and ready.");
