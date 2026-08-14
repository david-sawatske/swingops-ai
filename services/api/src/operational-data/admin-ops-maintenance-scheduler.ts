import {
  runAdminOpsMaintenance,
  type RunAdminOpsMaintenanceOptions,
} from "./admin-ops-maintenance.js";

const MILLISECONDS_PER_HOUR = 60 * 60 * 1_000;

type MaintenanceRunner = (
  options: RunAdminOpsMaintenanceOptions,
) => Promise<unknown>;

type MaintenanceSchedulerLogger = {
  error(bindings: Record<string, unknown>, message: string): void;
  info(bindings: Record<string, unknown>, message: string): void;
  warn(bindings: Record<string, unknown>, message: string): void;
};

export type StartAdminOpsMaintenanceSchedulerOptions = {
  intervalHours: number;
  logger: MaintenanceSchedulerLogger;
  retentionDays: number;
  runMaintenance?: MaintenanceRunner;
};

export function startAdminOpsMaintenanceScheduler({
  intervalHours,
  logger,
  retentionDays,
  runMaintenance = runAdminOpsMaintenance,
}: StartAdminOpsMaintenanceSchedulerOptions): () => void {
  if (!Number.isInteger(intervalHours) || intervalHours <= 0) {
    throw new Error("Maintenance interval hours must be a positive integer.");
  }

  let maintenanceInProgress = false;

  async function executeScheduledMaintenance(): Promise<void> {
    if (maintenanceInProgress) {
      logger.warn(
        { intervalHours },
        "Skipping overlapping scheduled Admin Ops maintenance",
      );
      return;
    }

    maintenanceInProgress = true;

    try {
      const result = await runMaintenance({ retentionDays });

      logger.info(
        { intervalHours, result },
        "Scheduled Admin Ops maintenance completed",
      );
    } catch (error) {
      logger.error(
        { err: error, intervalHours },
        "Scheduled Admin Ops maintenance failed",
      );
    } finally {
      maintenanceInProgress = false;
    }
  }

  const timer = setInterval(
    () => void executeScheduledMaintenance(),
    intervalHours * MILLISECONDS_PER_HOUR,
  );
  timer.unref();

  logger.info(
    { intervalHours, retentionDays },
    "Scheduled Admin Ops maintenance enabled",
  );

  return () => {
    clearInterval(timer);
    logger.info({ intervalHours }, "Scheduled Admin Ops maintenance stopped");
  };
}
