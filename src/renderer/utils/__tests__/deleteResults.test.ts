import { describe, expect, it } from "vitest";
import { summarizeDeleteResults } from "../deleteResults";

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
