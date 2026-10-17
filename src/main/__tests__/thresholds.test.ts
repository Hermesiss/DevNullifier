import { describe, expect, it } from "vitest";
import { failsThreshold } from "../thresholds";

const MB = 1024 * 1024;
const DAY = 86400000;
const now = Date.parse("2026-01-15T00:00:00.000Z");
const off = { minAgeDays: null, minSizeMb: null };

describe("failsThreshold", () => {
  it("returns false when both thresholds are null", () => {
    expect(failsThreshold(1, new Date(now).toISOString(), off, now)).toBe(false);
    expect(failsThreshold(0, null, off, now)).toBe(false);
  });

  it("returns true when size is below minSizeMb and false when equal or above", () => {
    const rules = { minAgeDays: null, minSizeMb: 1 };

    expect(failsThreshold(MB - 1, null, rules, now)).toBe(true);
    expect(failsThreshold(MB, null, rules, now)).toBe(false);
    expect(failsThreshold(MB + 1, null, rules, now)).toBe(false);
  });

  it("returns true when mtime is newer than minAgeDays and false when older or equal", () => {
    const rules = { minAgeDays: 2, minSizeMb: null };
    const cutoff = now - 2 * DAY;

    expect(failsThreshold(MB, new Date(cutoff + 1).toISOString(), rules, now)).toBe(true);
    expect(failsThreshold(MB, new Date(cutoff).toISOString(), rules, now)).toBe(false);
    expect(failsThreshold(MB, new Date(cutoff - 1).toISOString(), rules, now)).toBe(false);
  });

  it("does not fail the age check when mtime is missing", () => {
    const rules = { minAgeDays: 30, minSizeMb: null };

    expect(failsThreshold(MB, null, rules, now)).toBe(false);
    expect(failsThreshold(MB, undefined, rules, now)).toBe(false);
  });

  it("treats 0, negative, and non-finite thresholds as off", () => {
    const recent = new Date(now).toISOString();

    expect(failsThreshold(1, recent, { minAgeDays: 0, minSizeMb: 0 }, now)).toBe(false);
    expect(failsThreshold(1, recent, { minAgeDays: -5, minSizeMb: -1 }, now)).toBe(false);
    expect(failsThreshold(1, recent, { minAgeDays: Number.NaN, minSizeMb: Number.POSITIVE_INFINITY }, now)).toBe(false);
  });

  it("fails when either an active age or size threshold fails", () => {
    const recent = new Date(now).toISOString();
    const old = new Date(now - 10 * DAY).toISOString();

    expect(failsThreshold(1, old, { minAgeDays: 1, minSizeMb: 1 }, now)).toBe(true);
    expect(failsThreshold(MB, recent, { minAgeDays: 1, minSizeMb: 1 }, now)).toBe(true);
    expect(failsThreshold(MB, old, { minAgeDays: 1, minSizeMb: 1 }, now)).toBe(false);
  });
});
