import "dotenv/config";

import { env } from "../config/env.js";
import { disconnectPrisma } from "../lib/prisma.js";
import { runAdminOpsMaintenance } from "../operational-data/admin-ops-maintenance.js";

const DEFAULT_RETENTION_DAYS = 14;

function getArgumentValue(name: string): string | null {
  const prefix = `--${name}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));

  return argument ? argument.slice(prefix.length) : null;
}

function parseAnchorArgument(): Date {
  const value = getArgumentValue("anchor");
  const anchor = value ? new Date(value) : new Date();

  if (Number.isNaN(anchor.getTime())) {
    throw new Error("--anchor must be a valid ISO-8601 date and time.");
  }

  return anchor;
}

function parseRetentionDays(): number {
  const value =
    getArgumentValue("retention-days") ??
    String(env.LIVE_DEMO_RETENTION_DAYS ?? DEFAULT_RETENTION_DAYS);
  const retentionDays = Number(value);

  if (!Number.isInteger(retentionDays)) {
    throw new Error("Retention days must be an integer.");
  }

  return retentionDays;
}

try {
  const result = await runAdminOpsMaintenance({
    anchor: parseAnchorArgument(),
    dryRun: process.argv.includes("--dry-run"),
    retentionDays: parseRetentionDays(),
  });

  console.log(
    result.dryRun
      ? "Admin Ops maintenance preview completed without database changes."
      : "Admin Ops maintenance completed successfully.",
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await disconnectPrisma();
}
