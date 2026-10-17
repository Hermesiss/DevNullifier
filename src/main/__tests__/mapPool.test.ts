import { describe, expect, it, vi } from "vitest";
import { mapPool } from "../mapPool";

function delay(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

describe("mapPool", () => {
  it("returns an empty array when there are no items", async () => {
    const worker = vi.fn(async (item: number) => item);

    await expect(mapPool([], 4, worker)).resolves.toEqual([]);
    expect(worker).not.toHaveBeenCalled();
  });

  it("preserves input order and never exceeds the concurrency limit", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const results = await mapPool(
      [0, 1, 2, 3, 4, 5],
      2,
      async value => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await delay(20);
        inFlight -= 1;
        return value;
      }
    );

    expect(maxInFlight).toBe(2);
    expect(results).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("treats a limit below 1 as 1", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const results = await mapPool([0, 1, 2], 0, async value => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await delay(15);
      inFlight -= 1;
      return value;
    });

    expect(maxInFlight).toBe(1);
    expect(results).toEqual([0, 1, 2]);
  });

  it("leaves indexes that never started undefined when shouldStart becomes false", async () => {
    let started = 0;

    const results = await mapPool(
      [0, 1, 2, 3, 4, 5],
      2,
      async value => {
        await delay(15);
        return value;
      },
      () => {
        if (started >= 3) return false;
        started += 1;
        return true;
      }
    );

    expect(results).toHaveLength(6);
    expect(results).toEqual([0, 1, 2, undefined, undefined, undefined]);
  });

  it("rejects when a worker rejects", async () => {
    await expect(
      mapPool([0, 1, 2], 2, async value => {
        if (value === 1) throw new Error("worker failed");
        await delay(10);
        return value;
      })
    ).rejects.toThrow("worker failed");
  });
});
