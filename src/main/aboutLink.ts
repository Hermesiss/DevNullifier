const REPOSITORY = "https://github.com/Hermesiss/DevNullifier";

export function isAboutRepositoryUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  if (parsed.search || parsed.hash) return false;
  if (parsed.host !== "github.com") return false;
  const path = parsed.pathname.replace(/\/+$/, "");
  return path === "/Hermesiss/DevNullifier";
}

export async function openAboutRepository(
  url: unknown,
  open: (target: string) => Promise<void>
): Promise<boolean> {
  if (typeof url !== "string" || !isAboutRepositoryUrl(url)) return false;
  await open(url);
  return true;
}

export const aboutRepositoryUrl = REPOSITORY;
