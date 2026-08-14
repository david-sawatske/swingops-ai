import { afterEach, describe, expect, it, vi } from "vitest";

import { startAdminOpsMaintenanceScheduler } from "./admin-ops-maintenance-scheduler.js";

function createLogger() {
  return {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };
}

describe("Admin Ops maintenance scheduler", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs maintenance at the configured interval and stops cleanly", async () => {
    vi.useFakeTimers();
    const logger = createLogger();
    const runMaintenance = vi.fn(async () => ({ completed: true }));
    const stop = startAdminOpsMaintenanceScheduler({
      intervalHours: 24,
      logger,
      retentionDays: 14,
      runMaintenance,
    });

    expect(runMaintenance).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1_000);

    expect(runMaintenance).toHaveBeenCalledTimes(1);
    expect(runMaintenance).toHaveBeenCalledWith({ retentionDays: 14 });
    expect(logger.error).not.toHaveBeenCalled();

    stop();
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1_000);

    expect(runMaintenance).toHaveBeenCalledTimes(1);
  });

  it("logs a failed scheduled run without stopping future runs", async () => {
    vi.useFakeTimers();
    const logger = createLogger();
    const runMaintenance = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary database outage"))
      .mockResolvedValueOnce({ completed: true });
    const stop = startAdminOpsMaintenanceScheduler({
      intervalHours: 1,
      logger,
      retentionDays: 14,
      runMaintenance,
    });

    await vi.advanceTimersByTimeAsync(60 * 60 * 1_000);
    expect(logger.error).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60 * 60 * 1_000);
    expect(runMaintenance).toHaveBeenCalledTimes(2);

    stop();
  });

  it("rejects disabled or invalid intervals", () => {
    const logger = createLogger();

    expect(() =>
      startAdminOpsMaintenanceScheduler({
        intervalHours: 0,
        logger,
        retentionDays: 14,
      }),
    ).toThrow("Maintenance interval hours must be a positive integer.");
  });
});
