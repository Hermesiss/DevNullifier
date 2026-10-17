import { describe, it, expect } from "vitest";
import { selectedSharePercent } from "../diskShare";

describe("selectedSharePercent", () => {
  it("returns null when free is 0", () => {
    expect(selectedSharePercent(50, 0)).toBe(null);
  });

  it("returns 25 for 50 of 200", () => {
    expect(selectedSharePercent(50, 200)).toBe(25);
  });

  it("returns null for negative free", () => {
    expect(selectedSharePercent(50, -1)).toBe(null);
  });
});
