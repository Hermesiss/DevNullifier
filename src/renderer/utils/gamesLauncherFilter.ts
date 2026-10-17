import type { LauncherId } from "@/types";

export type LauncherFilter = "all" | LauncherId;

export function matchesLauncherFilter(
  launcherId: LauncherId,
  filter: LauncherFilter
): boolean {
  if (filter === "all") return true;
  return launcherId === filter;
}
