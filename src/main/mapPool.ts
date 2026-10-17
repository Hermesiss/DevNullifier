export const SIZE_CONCURRENCY = 4;

/**
 * Maps items through worker with at most limit calls in flight.
 * A limit below 1 runs one worker at a time. Result index i belongs to items[i].
 *
 * When shouldStart returns false, no further workers start. Workers already
 * running may finish. Indexes that never started stay undefined, and the
 * returned array length is still items.length. Callers that need a value for
 * every input must not treat those undefined slots as worker results.
 * A rejection from worker rejects the pool.
 */
export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  shouldStart?: () => boolean
): Promise<R[]> {
  if (items.length === 0) return [];

  const requested = Math.floor(limit);
  const concurrency = requested >= 1 ? requested : 1;
  const results: R[] = Array.from({ length: items.length }, () => undefined as R);
  let nextIndex = 0;
  let running = 0;
  let settled = false;

  return new Promise((resolve, reject) => {
    const pump = () => {
      if (settled) return;

      while (running < concurrency && nextIndex < items.length) {
        if (shouldStart && !shouldStart()) {
          if (running === 0) {
            settled = true;
            resolve(results);
          }
          return;
        }

        const index = nextIndex;
        nextIndex += 1;
        running += 1;

        let pending: Promise<R>;
        try {
          pending = Promise.resolve(worker(items[index], index));
        } catch (error) {
          settled = true;
          reject(error);
          return;
        }

        pending.then(
          value => {
            if (settled) return;
            results[index] = value;
            running -= 1;
            if (nextIndex >= items.length && running === 0) {
              settled = true;
              resolve(results);
              return;
            }
            pump();
          },
          error => {
            if (settled) return;
            settled = true;
            reject(error);
          }
        );
      }

      if (!settled && nextIndex >= items.length && running === 0) {
        settled = true;
        resolve(results);
      }
    };

    pump();
  });
}
