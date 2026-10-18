import { describe, expect, it } from "vitest";
import {
  cachePathSize,
  selectableCachePaths,
  selectedSizeForItems
} from "../toolCacheSelection";
import type { ToolCacheItem } from "@/types";

const base = {
  parentId: "user-temp",
  parentLabel: "User TEMP",
  parentPath: "C:/Temp",
  parentDescription: "temp",
  category: "temp",
  categoryLabel: "Temporary",
  description: "temp"
};

describe("toolCacheSelection", () => {
  it("expands aggregated children for selection", () => {
    const item: ToolCacheItem = {
      ...base,
      id: "user-temp",
      label: "User TEMP",
      path: "C:/Temp",
      size: 30,
      aggregated: true,
      children: [
        { path: "C:/Temp/a", label: "a", size: 10 },
        { path: "C:/Temp/b", label: "b", size: 20 }
      ]
    };
    expect(selectableCachePaths(item)).toEqual(["C:/Temp/a", "C:/Temp/b"]);
    expect(cachePathSize(item, "C:/Temp/b")).toBe(20);
    expect(selectedSizeForItems([item], ["C:/Temp/a"])).toBe(10);
  });

  it("uses the item path for normal caches", () => {
    const item: ToolCacheItem = {
      ...base,
      id: "chrome/cache",
      parentId: "chrome",
      label: "Cache",
      path: "C:/Chrome/Cache",
      size: 5
    };
    expect(selectableCachePaths(item)).toEqual(["C:/Chrome/Cache"]);
    expect(selectedSizeForItems([item], ["C:/Chrome/Cache"])).toBe(5);
  });
});
