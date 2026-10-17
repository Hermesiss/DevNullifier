export function selectedSharePercent(selectedBytes: number, freeBytes: number): number | null {
  if (!Number.isFinite(freeBytes) || freeBytes <= 0) {
    return null;
  }
  return (selectedBytes / freeBytes) * 100;
}
