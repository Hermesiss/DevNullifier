export type LastPlayedFilter = "all" | "never" | "30" | "90" | "365";

const DAY_MS = 24 * 60 * 60 * 1000;

export function matchesLastPlayedFilter(
  lastPlayedAt: number | null,
  filter: LastPlayedFilter,
  nowMs: number = Date.now()
): boolean {
  if (filter === "all") return true;
  if (filter === "never") return lastPlayedAt === null;

  if (lastPlayedAt === null) return false;
  const minAgeDays = Number(filter);
  const ageMs = nowMs - lastPlayedAt;
  return ageMs >= minAgeDays * DAY_MS;
}
