import { describe, expect, it } from "vitest";
import { matchesLastPlayedFilter } from "../gamesLastPlayedFilter";

const now = Date.UTC(2026, 0, 1);

describe("matchesLastPlayedFilter", () => {
  it("keeps all when filter is all", () => {
    expect(matchesLastPlayedFilter(null, "all", now)).toBe(true);
    expect(matchesLastPlayedFilter(now, "all", now)).toBe(true);
  });

  it("matches never played", () => {
    expect(matchesLastPlayedFilter(null, "never", now)).toBe(true);
    expect(matchesLastPlayedFilter(now, "never", now)).toBe(false);
  });

  it("matches age thresholds", () => {
    const days31 = now - 31 * 24 * 60 * 60 * 1000;
    const days10 = now - 10 * 24 * 60 * 60 * 1000;
    expect(matchesLastPlayedFilter(days31, "30", now)).toBe(true);
    expect(matchesLastPlayedFilter(days10, "30", now)).toBe(false);
    expect(matchesLastPlayedFilter(null, "30", now)).toBe(false);
  });
});
