type DatabaseUrlEnvironment = {
  DATABASE_URL: string;
  TEST_DATABASE_URL?: string | undefined;
};

function getDatabaseName(databaseUrl: URL): string {
  return decodeURIComponent(databaseUrl.pathname.replace(/^\//, ""));
}

function getDatabaseTarget(databaseUrl: URL): string {
  return [
    databaseUrl.protocol,
    databaseUrl.hostname,
    databaseUrl.port || "5432",
    getDatabaseName(databaseUrl)
  ].join("|");
}

export function deriveTestDatabaseUrl(developmentDatabaseUrl: string): string {
  const testDatabaseUrl = new URL(developmentDatabaseUrl);
  const developmentDatabaseName = getDatabaseName(testDatabaseUrl);

  if (!developmentDatabaseName) {
    throw new Error("DATABASE_URL must include a database name.");
  }

  testDatabaseUrl.pathname = `/${developmentDatabaseName}_test`;

  return testDatabaseUrl.toString();
}

export function resolveTestDatabaseUrl(env: DatabaseUrlEnvironment): string {
  const developmentDatabaseUrl = new URL(env.DATABASE_URL);
  const testDatabaseUrl = new URL(
    env.TEST_DATABASE_URL ?? deriveTestDatabaseUrl(env.DATABASE_URL)
  );
  const testDatabaseName = getDatabaseName(testDatabaseUrl);

  if (!testDatabaseName.endsWith("_test")) {
    throw new Error(
      "Refusing to reset a test database whose name does not end with _test."
    );
  }

  if (getDatabaseTarget(testDatabaseUrl) === getDatabaseTarget(developmentDatabaseUrl)) {
    throw new Error("TEST_DATABASE_URL must not target the development database.");
  }

  return testDatabaseUrl.toString();
}

export function getDatabaseDisplayName(databaseUrl: string): string {
  const parsedUrl = new URL(databaseUrl);

  return `${parsedUrl.hostname}:${parsedUrl.port || "5432"}${parsedUrl.pathname}`;
}

export function getDatabaseNameFromUrl(databaseUrl: string): string {
  return getDatabaseName(new URL(databaseUrl));
}
