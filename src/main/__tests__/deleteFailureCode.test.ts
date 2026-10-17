import { promises as fs } from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteFailureCode, deletePathResult } from "../appDataCleaner";

vi.mock("fs", () => ({
  promises: {
    lstat: vi.fn(),
    unlink: vi.fn(),
    rm: vi.fn(),
    readdir: vi.fn()
  },
  default: {
    existsSync: vi.fn()
  }
}));

const directoryStat = {
  isSymbolicLink: () => false,
  isDirectory: () => true,
  isFile: () => false
};

describe("deleteFailureCode", () => {
  it("reads a string code from a thrown fs.rm or trash error", () => {
    const error = Object.assign(new Error("busy"), { code: "EBUSY" });
    expect(deleteFailureCode(error)).toBe("EBUSY");
  });

  it("uses error when the thrown value has no string code", () => {
    expect(deleteFailureCode(new Error("busy"))).toBe("error");
    expect(deleteFailureCode({ code: 32 })).toBe("error");
    expect(deleteFailureCode(null)).toBe("error");
  });
});

describe("deletePathResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("surfaces code EBUSY on the result when fs.rm or trash throws", async () => {
    vi.mocked(fs.lstat).mockResolvedValue(directoryStat as never);
    const remove = vi.fn().mockRejectedValue(Object.assign(new Error("busy"), { code: "EBUSY" }));

    await expect(deletePathResult("/cache/locked", true, remove)).resolves.toEqual({
      path: "/cache/locked",
      success: false,
      code: "EBUSY"
    });
  });

  it("keeps a missing path successful without a code", async () => {
    vi.mocked(fs.lstat).mockRejectedValue(Object.assign(new Error("missing"), { code: "ENOENT" }));
    const remove = vi.fn();

    await expect(deletePathResult("/missing", true, remove)).resolves.toEqual({
      path: "/missing",
      success: true
    });
    expect(remove).not.toHaveBeenCalled();
  });

  it("does not call remove when the path is not permitted", async () => {
    const remove = vi.fn();

    await expect(deletePathResult("/secret", false, remove)).resolves.toEqual({
      path: "/secret",
      success: false
    });
    expect(remove).not.toHaveBeenCalled();
    expect(fs.lstat).not.toHaveBeenCalled();
  });
});
