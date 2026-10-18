import { describe, expect, it, vi } from "vitest";
import { openAboutRepository } from "../aboutLink";

const repo = "https://github.com/Hermesiss/DevNullifier";

describe("openAboutRepository", () => {
  it("opens the repository url", async () => {
    const open = vi.fn(async () => undefined);
    await expect(openAboutRepository(repo, open)).resolves.toBe(true);
    expect(open).toHaveBeenCalledWith(repo);
  });

  it("accepts a trailing slash", async () => {
    const open = vi.fn(async () => undefined);
    await expect(openAboutRepository(`${repo}/`, open)).resolves.toBe(true);
    expect(open).toHaveBeenCalledWith(`${repo}/`);
  });

  it("refuses any other url", async () => {
    const open = vi.fn(async () => undefined);
    const blocked = [
      "http://github.com/Hermesiss/DevNullifier",
      "https://github.com/Hermesiss/DevNullifier/issues",
      "https://example.com/Hermesiss/DevNullifier",
      "https://github.com.evil/Hermesiss/DevNullifier",
      "https://user:pass@github.com/Hermesiss/DevNullifier",
      "javascript:alert(1)"
    ];
    for (const url of blocked) {
      await expect(openAboutRepository(url, open)).resolves.toBe(false);
    }
    expect(open).not.toHaveBeenCalled();
  });
});
