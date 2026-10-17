import { describe, it, expect } from "vitest";
import { diskUsage } from "../diskShare";

describe("diskUsage", () => {
  it("returns null when the volume size is missing", () => {
    expect(diskUsage(50, 100, 200, 0)).toBe(null);
    expect(diskUsage(50, 100, 200, -1)).toBe(null);
    expect(diskUsage(50, 100, -1, 1000)).toBe(null);
  });

  it("places found inside used and selected inside found", () => {
    expect(diskUsage(80, 200, 200, 1000)).toEqual({
      usedBytes: 800,
      otherUsedBytes: 600,
      foundBytes: 200,
      freeBytes: 200,
      selectedBytes: 80,
      foundOfUsedPercent: 25,
      selectedOfFoundPercent: 40,
      selectedOfUsedPercent: 10
    });
  });

  it("caps found at used and selected at found", () => {
    expect(diskUsage(900, 700, 100, 500)).toMatchObject({
      usedBytes: 400,
      foundBytes: 400,
      selectedBytes: 400,
      selectedOfFoundPercent: 100,
      selectedOfUsedPercent: 100
    });
  });

  it("treats a full disk as entirely occupied", () => {
    expect(diskUsage(0, 0, 0, 500)).toMatchObject({
      usedBytes: 500,
      otherUsedBytes: 500,
      foundBytes: 0,
      freeBytes: 0,
      selectedOfUsedPercent: 0
    });
  });
});
