import { describe, expect, it } from "vitest";
import { directoryExcludedByMarker, pathMatchesExclude } from "../excludeGlobs";

describe("excludeGlobs", () => {
  const saveGames = ["*/Saved/SaveGames"];

  it("matches a SaveGames directory with one segment before Saved", () => {
    expect(pathMatchesExclude("C:/Games/Proj/Saved/SaveGames", saveGames)).toBe(true);
    expect(pathMatchesExclude("C:/Games/Saved/SaveGames", saveGames)).toBe(true);
    expect(pathMatchesExclude("C:\\Games\\Proj\\Saved\\SaveGames", ["*\\Saved\\SaveGames"])).toBe(true);
  });

  it("does not match a sibling of SaveGames", () => {
    expect(pathMatchesExclude("C:/Games/Proj/Saved/Config", saveGames)).toBe(false);
    expect(pathMatchesExclude("C:/Games/Proj/Saved/SaveGames/slot", saveGames)).toBe(false);
  });

  it("treats a slash-free glob as a marker file and as the final path segment", () => {
    expect(directoryExcludedByMarker(["readme", ".gitkeep"], [".gitkeep"])).toBe(true);
    expect(directoryExcludedByMarker(["readme"], [".gitkeep"])).toBe(false);
    expect(directoryExcludedByMarker([".gitkeep"], ["*/Saved/SaveGames"])).toBe(false);
    expect(pathMatchesExclude("a/b/.gitkeep", [".gitkeep"])).toBe(true);
    expect(pathMatchesExclude("a/b/src", [".gitkeep"])).toBe(false);
  });

  it("matches nothing for empty globs and ignores blank patterns", () => {
    expect(pathMatchesExclude("C:/Games/Proj/Saved/SaveGames", [])).toBe(false);
    expect(pathMatchesExclude("C:/Games/Proj/Saved/SaveGames", ["", "  "])).toBe(false);
    expect(directoryExcludedByMarker([".gitkeep"], [])).toBe(false);
    expect(directoryExcludedByMarker([".gitkeep"], ["", "   "])).toBe(false);
    expect(pathMatchesExclude("C:/Games/Proj/Saved/SaveGames", ["  */Saved/SaveGames  "])).toBe(true);
    expect(directoryExcludedByMarker([".gitkeep"], ["  .gitkeep  "])).toBe(true);
  });

  it("lets ** match zero or more segments", () => {
    expect(pathMatchesExclude("C:/repo/.git/objects", ["**/.git/**"])).toBe(true);
    expect(pathMatchesExclude("C:/repo/.git", ["**/.git/**"])).toBe(true);
    expect(pathMatchesExclude("C:/repo/src", ["**/.git/**"])).toBe(false);
  });
});