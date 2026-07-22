import { describe, expect, it } from "vitest";

import {
  deriveTestDatabaseUrl,
  resolveTestDatabaseUrl,
} from "./database-urls.js";

const developmentDatabaseUrl =
  "postgresql://user:password@localhost:5433/swingops_ai?schema=public";

describe("test database URL safety", () => {
  it("derives a separate _test database when no override is configured", () => {
    const result = deriveTestDatabaseUrl(developmentDatabaseUrl);

    expect(new URL(result).pathname).toBe("/swingops_ai_test");
    expect(new URL(result).searchParams.get("schema")).toBe("public");
  });

  it("accepts an explicit, separately named test database", () => {
    const result = resolveTestDatabaseUrl({
      DATABASE_URL: developmentDatabaseUrl,
      TEST_DATABASE_URL:
        "postgresql://user:password@localhost:5433/custom_swingops_test?schema=public",
    });

    expect(new URL(result).pathname).toBe("/custom_swingops_test");
  });

  it("refuses to reset the development database even when its name looks test-safe", () => {
    const developmentDatabaseNamedLikeTest =
      "postgresql://user:password@localhost:5433/production_snapshot_test?schema=public";

    expect(() =>
      resolveTestDatabaseUrl({
        DATABASE_URL: developmentDatabaseNamedLikeTest,
        TEST_DATABASE_URL: developmentDatabaseNamedLikeTest,
      }),
    ).toThrow("must not target the development database");
  });

  it("refuses an unsafe test database name", () => {
    expect(() =>
      resolveTestDatabaseUrl({
        DATABASE_URL: developmentDatabaseUrl,
        TEST_DATABASE_URL:
          "postgresql://user:password@localhost:5433/swingops_ai_testing?schema=public",
      }),
    ).toThrow("does not end with _test");
  });
});
