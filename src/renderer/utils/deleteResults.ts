export interface DeleteOutcome {
  success: boolean | "partial";
}

export function summarizeDeleteResults(results: DeleteOutcome[]): {
  successCount: number;
  partialCount: number;
  failCount: number;
} {
  let successCount = 0;
  let partialCount = 0;
  let failCount = 0;

  for (const result of results) {
    if (result.success === true) successCount += 1;
    else if (result.success === "partial") partialCount += 1;
    else failCount += 1;
  }

  return { successCount, partialCount, failCount };
}

export function unsuccessfulDeletes<T extends DeleteOutcome>(results: T[]): T[] {
  return results.filter(result => result.success === false || result.success === "partial");
}

export function applyRetryResult<T extends DeleteOutcome & { path: string }>(
  current: T[],
  retriedPath: string,
  results: T[]
): T[] {
  const next = results.find(result => result.path === retriedPath);
  return current.flatMap(item => {
    if (item.path !== retriedPath) return [item];
    if (!next || next.success === true) return [];
    return [next];
  });
}
