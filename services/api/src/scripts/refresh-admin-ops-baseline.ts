import "dotenv/config";

import { disconnectPrisma } from "../lib/prisma.js";
import { replaceAdminOpsBaseline } from "../operational-data/admin-ops-baseline-persistence.js";

function parseAnchorArgument(): Date {
  const anchorArgument = process.argv.find((argument) =>
    argument.startsWith("--anchor="),
  );

  if (!anchorArgument) {
    return new Date();
  }

  const anchor = new Date(anchorArgument.slice("--anchor=".length));

  if (Number.isNaN(anchor.getTime())) {
    throw new Error("--anchor must be a valid ISO-8601 date and time.");
  }

  return anchor;
}

try {
  const result = await replaceAdminOpsBaseline(parseAnchorArgument());

  console.log("Admin Ops operational baseline refreshed successfully.");
  console.log(JSON.stringify(result, null, 2));
} finally {
  await disconnectPrisma();
}
