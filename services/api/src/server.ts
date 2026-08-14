import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { disconnectPrisma } from "./lib/prisma.js";
import { startAdminOpsMaintenanceScheduler } from "./operational-data/admin-ops-maintenance-scheduler.js";

const app = buildApp();
let stopAdminOpsMaintenanceScheduler: (() => void) | null = null;

async function startServer(): Promise<void> {
  try {
    await app.listen({
      host: env.API_HOST,
      port: env.API_PORT,
    });

    if (env.ADMIN_OPS_MAINTENANCE_INTERVAL_HOURS > 0) {
      stopAdminOpsMaintenanceScheduler = startAdminOpsMaintenanceScheduler({
        intervalHours: env.ADMIN_OPS_MAINTENANCE_INTERVAL_HOURS,
        logger: {
          error: (bindings, message) => app.log.error(bindings, message),
          info: (bindings, message) => app.log.info(bindings, message),
          warn: (bindings, message) => app.log.warn(bindings, message),
        },
        retentionDays: env.LIVE_DEMO_RETENTION_DAYS,
      });
    }
  } catch (error) {
    app.log.error(error, "Failed to start API server");
    process.exit(1);
  }
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  app.log.info({ signal }, "Shutting down API server");
  stopAdminOpsMaintenanceScheduler?.();
  stopAdminOpsMaintenanceScheduler = null;

  try {
    await app.close();
    await disconnectPrisma();
    process.exit(0);
  } catch (error) {
    app.log.error(error, "Error during API shutdown");
    process.exit(1);
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await startServer();
