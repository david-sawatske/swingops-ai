import { readFile } from "node:fs/promises";

import { parse } from "dotenv";
import { describe, expect, it } from "vitest";

import { apiEnvSchema } from "./env-schema.js";

describe("API environment configuration", () => {
  it("keeps the checked-in example aligned with the local Docker and web ports", async () => {
    const examplePath = new URL("../../.env.example", import.meta.url);
    const exampleEnv = parse(await readFile(examplePath));
    const parsed = apiEnvSchema.parse(exampleEnv);
    const databaseUrl = new URL(parsed.DATABASE_URL);

    expect(databaseUrl.protocol).toBe("postgresql:");
    expect(databaseUrl.hostname).toBe("localhost");
    expect(databaseUrl.port).toBe("5433");
    expect(new URL(parsed.TEST_DATABASE_URL!).pathname).toBe(
      "/swingops_ai_test",
    );
    expect(parsed.API_PORT).toBe(4000);
    expect(parsed.WEB_ORIGIN).toBe("http://localhost:5173");
  });

  it("applies safe local defaults for optional API settings", () => {
    const parsed = apiEnvSchema.parse({
      DATABASE_URL: "postgresql://user:password@localhost:5433/database",
    });

    expect(parsed).toMatchObject({
      API_HOST: "0.0.0.0",
      API_PORT: 4000,
      LOG_LEVEL: "info",
      WEB_ORIGIN: "http://localhost:5173",
    });
  });

  it("rejects a database URL with a non-PostgreSQL protocol", () => {
    const result = apiEnvSchema.safeParse({
      DATABASE_URL: "https://localhost:5433/database",
    });

    expect(result.success).toBe(false);
  });
});
