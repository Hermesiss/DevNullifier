import { describe, expect, it } from "vitest";
import { applyRetryResult, summarizeDeleteResults, unsuccessfulDeletes } from "../deleteResults";

describe("summarizeDeleteResults", () => {
  it("does not count a partial deletion as success", () => {
    expect(
      summarizeDeleteResults([
        { success: true },
        { success: "partial" },
        { success: false }
      ])
    ).toEqual({ successCount: 1, partialCount: 1, failCount: 1 });
  });
});

describe("unsuccessfulDeletes", () => {
  it("keeps failed and partial results", () => {
    expect(
      unsuccessfulDeletes([
        { path: "ok", success: true },
        { path: "busy", success: false, code: "EBUSY" },
        { path: "half", success: "partial" }
      ])
    ).toEqual([
      { path: "busy", success: false, code: "EBUSY" },
      { path: "half", success: "partial" }
    ]);
  });
});

describe("applyRetryResult", () => {
  const current: Array<{ path: string; success: boolean | "partial"; code?: string }> = [
    { path: "a", success: false, code: "EBUSY" },
    { path: "b", success: "partial", code: "EPERM" }
  ];

  it("drops a retried path when the retry succeeds", () => {
    expect(applyRetryResult(current, "a", [{ path: "a", success: true }])).toEqual([
      { path: "b", success: "partial", code: "EPERM" }
    ]);
  });

  it("keeps a retried path when the retry fails or is partial", () => {
    expect(
      applyRetryResult(current, "a", [{ path: "a", success: false, code: "EACCES" }])
    ).toEqual([
      { path: "a", success: false, code: "EACCES" },
      { path: "b", success: "partial", code: "EPERM" }
    ]);
    expect(
      applyRetryResult(current, "b", [{ path: "b", success: "partial", code: "EBUSY" }])
    ).toEqual([
      { path: "a", success: false, code: "EBUSY" },
      { path: "b", success: "partial", code: "EBUSY" }
    ]);
  });
});
