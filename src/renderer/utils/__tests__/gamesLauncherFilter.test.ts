import { describe, expect, it } from "vitest";
import { matchesLauncherFilter } from "../gamesLauncherFilter";

describe("matchesLauncherFilter", () => {
  it("keeps all when filter is all", () => {
    expect(matchesLauncherFilter("steam", "all")).toBe(true);
    expect(matchesLauncherFilter("epic", "all")).toBe(true);
  });

  it("matches a single launcher", () => {
    expect(matchesLauncherFilter("steam", "steam")).toBe(true);
    expect(matchesLauncherFilter("epic", "steam")).toBe(false);
    expect(matchesLauncherFilter("epic", "epic")).toBe(true);
  });
});
