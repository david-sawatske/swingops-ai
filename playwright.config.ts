import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

const apiEnvironmentPath = fileURLToPath(
  new URL("./services/api/.env", import.meta.url),
);

if (existsSync(apiEnvironmentPath)) {
  loadEnvFile(apiEnvironmentPath);
}

function getDatabaseName(databaseUrl: URL) {
  return decodeURIComponent(databaseUrl.pathname.replace(/^\//, ""));
}

function getDatabaseTarget(databaseUrl: URL) {
  return [
    databaseUrl.protocol,
    databaseUrl.hostname,
    databaseUrl.port || "5432",
    getDatabaseName(databaseUrl),
  ].join("|");
}

function resolveBrowserTestDatabaseUrl() {
  const developmentDatabaseUrlValue = process.env.DATABASE_URL;

  if (!developmentDatabaseUrlValue) {
    throw new Error(
      "DATABASE_URL is required. Copy services/api/.env.example to services/api/.env before running browser tests.",
    );
  }

  const developmentDatabaseUrl = new URL(developmentDatabaseUrlValue);
  const configuredTestDatabaseUrl = process.env.TEST_DATABASE_URL;
  const testDatabaseUrl = configuredTestDatabaseUrl
    ? new URL(configuredTestDatabaseUrl)
    : new URL(developmentDatabaseUrl);

  if (!configuredTestDatabaseUrl) {
    const developmentDatabaseName = getDatabaseName(developmentDatabaseUrl);

    if (!developmentDatabaseName) {
      throw new Error("DATABASE_URL must include a database name.");
    }

    testDatabaseUrl.pathname = `/${developmentDatabaseName}_test`;
  }

  if (!getDatabaseName(testDatabaseUrl).endsWith("_test")) {
    throw new Error(
      "Refusing to run browser tests against a database whose name does not end with _test.",
    );
  }

  if (
    getDatabaseTarget(testDatabaseUrl) ===
    getDatabaseTarget(developmentDatabaseUrl)
  ) {
    throw new Error("Browser tests must not target the development database.");
  }

  return testDatabaseUrl.toString();
}

const testDatabaseUrl = resolveBrowserTestDatabaseUrl();
const apiPort = Number(process.env.E2E_API_PORT ?? "4010");
const webPort = Number(process.env.E2E_WEB_PORT ?? "4174");
const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
const webBaseUrl = `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "test-results/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: webBaseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @swingops/api exec tsx src/server.ts",
      env: {
        ...process.env,
        ALLOW_REAL_MODEL_CALLS_IN_TESTS: "false",
        API_HOST: "127.0.0.1",
        API_PORT: String(apiPort),
        DATABASE_URL: testDatabaseUrl,
        ENABLE_REAL_MODEL_CALLS: "false",
        LOG_LEVEL: "warn",
        NODE_ENV: "test",
        TEST_DATABASE_URL: testDatabaseUrl,
        WEB_ORIGIN: webBaseUrl,
      },
      reuseExistingServer: false,
      timeout: 120_000,
      url: `${apiBaseUrl}/health`,
    },
    {
      command: `pnpm --filter @swingops/web exec vite --host 127.0.0.1 --port ${webPort} --strictPort`,
      env: {
        ...process.env,
        VITE_API_BASE_URL: apiBaseUrl,
      },
      reuseExistingServer: false,
      timeout: 120_000,
      url: webBaseUrl,
    },
  ],
});
