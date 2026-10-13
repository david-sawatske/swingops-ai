import { describe, expect, it } from "vitest";

import type {
  AiReadyIntakeRecord,
  ListAiReadyIntakeRecordsResponse,
} from "../types/workflow";
import {
  AI_READY_INTAKE_RECORDS_PAGE_SIZE,
  listAllAiReadyIntakeRecordsForRun,
  type listAiReadyIntakeRecords,
} from "./workflows";

function createPagedFetcher(totalCount: number) {
  const requests: Parameters<typeof listAiReadyIntakeRecords>[0][] = [];
  const records = Array.from(
    { length: totalCount },
    (_, index) => ({ id: `record_${index + 1}` }) as AiReadyIntakeRecord,
  );

  const fetchPage: typeof listAiReadyIntakeRecords = async (filters = {}) => {
    requests.push(filters);

    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 25;
    const page = records.slice(offset, offset + limit);

    return {
      records: page,
      count: page.length,
      totalCount,
      limit,
      offset,
      hasMore: offset + page.length < totalCount,
    } satisfies ListAiReadyIntakeRecordsResponse;
  };

  return { fetchPage, requests };
}

describe("listAllAiReadyIntakeRecordsForRun", () => {
  it.each([0, 1, 100, 101, 250])(
    "returns all %i records using only valid page sizes",
    async (totalCount) => {
      const { fetchPage, requests } = createPagedFetcher(totalCount);

      const records = await listAllAiReadyIntakeRecordsForRun(
        "run_1",
        fetchPage,
      );

      expect(records.map((record) => record.id)).toEqual(
        Array.from({ length: totalCount }, (_, index) => `record_${index + 1}`),
      );
      expect(requests.length).toBe(
        Math.max(1, Math.ceil(totalCount / AI_READY_INTAKE_RECORDS_PAGE_SIZE)),
      );

      for (const request of requests) {
        expect(request?.workflowRunId).toBe("run_1");
        expect(request?.limit).toBeGreaterThanOrEqual(1);
        expect(request?.limit).toBeLessThanOrEqual(100);
      }
    },
  );
});
