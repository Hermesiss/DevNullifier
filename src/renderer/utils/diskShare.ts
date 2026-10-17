export interface DiskUsage {
  usedBytes: number;
  otherUsedBytes: number;
  foundBytes: number;
  freeBytes: number;
  selectedBytes: number;
  /** Found share of occupied space, capped at 100. */
  foundOfUsedPercent: number;
  /** Selected share of found space, capped at 100. */
  selectedOfFoundPercent: number;
  /** How much of the occupied space the selection would free, capped at 100. */
  selectedOfUsedPercent: number;
}

function nonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function diskUsage(
  selectedBytes: number,
  foundBytes: number,
  freeBytes: number,
  totalBytes: number
): DiskUsage | null {
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) return null;
  if (!Number.isFinite(freeBytes) || freeBytes < 0) return null;

  const free = Math.min(freeBytes, totalBytes);
  const used = totalBytes - free;
  const found = Math.min(nonNegative(foundBytes), used);
  const selected = Math.min(nonNegative(selectedBytes), found);
  const otherUsed = used - found;

  return {
    usedBytes: used,
    otherUsedBytes: otherUsed,
    foundBytes: found,
    freeBytes: free,
    selectedBytes: selected,
    foundOfUsedPercent: used > 0 ? (found / used) * 100 : 0,
    selectedOfFoundPercent: found > 0 ? (selected / found) * 100 : 0,
    selectedOfUsedPercent: used > 0 ? (selected / used) * 100 : 0
  };
}
