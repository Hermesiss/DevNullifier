function cleanGlobs(globs: readonly string[]): string[] {
  const cleaned: string[] = [];
  for (const glob of globs) {
    if (typeof glob !== "string") continue;
    const trimmed = glob.trim();
    if (trimmed) cleaned.push(trimmed);
  }
  return cleaned;
}

function splitSegments(value: string): string[] {
  return value.replace(/\\/g, "/").split("/").filter(segment => segment.length > 0);
}

function matchesAt(pathSegments: readonly string[], start: number, globSegments: readonly string[]): boolean {
  const memo = new Map<number, boolean>();
  const span = pathSegments.length;
  const globLength = globSegments.length;

  function rec(pathIndex: number, globIndex: number): boolean {
    const key = pathIndex * (globLength + 1) + globIndex;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    let matched = false;
    if (globIndex === globLength) {
      matched = pathIndex === span;
    } else if (globSegments[globIndex] === "**") {
      for (let next = pathIndex; next <= span; next++) {
        if (rec(next, globIndex + 1)) {
          matched = true;
          break;
        }
      }
    } else if (
      pathIndex < span &&
      (globSegments[globIndex] === "*" || globSegments[globIndex] === pathSegments[pathIndex])
    ) {
      matched = rec(pathIndex + 1, globIndex + 1);
    }

    memo.set(key, matched);
    return matched;
  }

  return rec(start, 0);
}

function matchesSuffix(pathSegments: readonly string[], globSegments: readonly string[]): boolean {
  if (pathSegments.length === 0 || globSegments.length === 0) return false;

  if (!globSegments.includes("**")) {
    if (globSegments.length > pathSegments.length) return false;
    return matchesAt(pathSegments, pathSegments.length - globSegments.length, globSegments);
  }

  for (let start = 0; start <= pathSegments.length; start++) {
    if (matchesAt(pathSegments, start, globSegments)) return true;
  }
  return false;
}

export function pathMatchesExclude(target: string, globs: readonly string[]): boolean {
  if (!target || globs.length === 0) return false;

  const pathSegments = splitSegments(target);
  if (pathSegments.length === 0) return false;

  for (const glob of cleanGlobs(globs)) {
    if (matchesSuffix(pathSegments, splitSegments(glob))) return true;
  }
  return false;
}

export function directoryExcludedByMarker(fileNames: readonly string[], globs: readonly string[]): boolean {
  if (fileNames.length === 0 || globs.length === 0) return false;

  const names = new Set(fileNames);
  for (const glob of cleanGlobs(globs)) {
    if (glob.includes("/") || glob.includes("\\")) continue;
    if (names.has(glob)) return true;
  }
  return false;
}
