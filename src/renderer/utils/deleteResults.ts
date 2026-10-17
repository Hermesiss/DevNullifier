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
