import { promises as fs } from "fs";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { setUserDataPath } from "../fileUtils";
import {
  appendDeletionLog,
  deletionLogToCsv,
  loadDeletionLog,
  type DeletionLogEntry
} from "../deletionLog";

vi.mock("fs", () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn()
  }
}));

let stored: string | undefined;

function entry(index: number): DeletionLogEntry {
  return {
    at: "1999-01-01T00:00:00.000Z",
    path: `item-${index}`,
    size: index,
    status: "success"
  };
}

describe("deletionLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUserDataPath("/user/data");
    stored = undefined;
    vi.mocked(fs.readFile).mockImplementation(async () => {
      if (stored === undefined) {
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      }
      return stored;
    });
    vi.mocked(fs.writeFile).mockImplementation(async (_file, data) => {
      stored = String(data);
    });
  });

  it("corrupt file starts fresh", async () => {
    stored = "{not json";

    await expect(loadDeletionLog()).resolves.toEqual([]);

    await appendDeletionLog([entry(1)]);

    const log = await loadDeletionLog();
    expect(log).toHaveLength(1);
    expect(log[0].path).toBe("item-1");
    expect(log[0].status).toBe("success");
    expect(String(vi.mocked(fs.writeFile).mock.calls[0][0])).toContain("deletion-log.json");
  });

  it("append trims to 500", async () => {
    await appendDeletionLog(Array.from({ length: 501 }, (_, index) => entry(index)));

    const log = await loadDeletionLog();
    expect(log).toHaveLength(500);
    expect(log[0].path).toBe("item-1");
    expect(log[499].path).toBe("item-500");
    expect(stored).toContain('\n  {');
  });

  it("csv escapes a path that contains a comma and a quote", () => {
    const csv = deletionLogToCsv([
      {
        at: "2026-01-02T03:04:05.000Z",
        path: 'C:\\cache\\a,"b"',
        size: 42,
        status: "partial"
      }
    ]);

    expect(csv).toBe(
      'at,path,size,status\n2026-01-02T03:04:05.000Z,"C:\\cache\\a,""b""",42,partial'
    );
  });

  it("bad status becomes error", async () => {
    await appendDeletionLog([
      {
        at: "1999-01-01T00:00:00.000Z",
        path: "C:\\cache",
        size: 8,
        status: "nope" as DeletionLogEntry["status"]
      }
    ]);

    const [saved] = await loadDeletionLog();
    expect(saved.status).toBe("error");
    expect(saved.path).toBe("C:\\cache");
    expect(saved.size).toBe(8);
    expect(saved.at).not.toBe("1999-01-01T00:00:00.000Z");
  });
});
