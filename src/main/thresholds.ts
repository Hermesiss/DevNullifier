const BYTES_PER_MB = 1024 * 1024;
const MS_PER_DAY = 86400000;

function activeThreshold(value: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

export function failsThreshold(
  sizeBytes: number,
  modifiedAt: string | null | undefined,
  rules: { minAgeDays: number | null; minSizeMb: number | null },
  now?: number
): boolean {
  const minSizeMb = activeThreshold(rules.minSizeMb);
  if (minSizeMb !== null && sizeBytes < minSizeMb * BYTES_PER_MB) return true;

  const minAgeDays = activeThreshold(rules.minAgeDays);
  if (minAgeDays === null || modifiedAt == null || modifiedAt === "") return false;

  const mtime = Date.parse(modifiedAt);
  if (!Number.isFinite(mtime)) return false;

  const current = now ?? Date.now();
  return mtime > current - minAgeDays * MS_PER_DAY;
}
