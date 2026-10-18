import type { ToolCacheItem } from "@/types";

/** Paths that may be passed to delete-folders for this scan item. */
export function selectableCachePaths(item: ToolCacheItem): string[] {
  if (item.aggregated && item.children && item.children.length > 0) {
    return item.children.map(child => child.path);
  }
  return [item.path];
}

export function cachePathSize(item: ToolCacheItem, target: string): number {
  if (item.aggregated && item.children) {
    const child = item.children.find(entry => entry.path === target);
    if (child) return child.size;
  }
  return item.path === target ? item.size : 0;
}

export function selectedSizeForItems(
  items: ToolCacheItem[],
  selectedPaths: readonly string[]
): number {
  const selected = new Set(selectedPaths);
  let sum = 0;
  for (const item of items) {
    if (item.aggregated && item.children) {
      for (const child of item.children) {
        if (selected.has(child.path)) sum += child.size;
      }
      continue;
    }
    if (selected.has(item.path)) sum += item.size;
  }
  return sum;
}
