import { describe, it, expect } from "vitest";
import type { FolderItem } from "../../types/common";
import { appDataGroupKey, groupAppDataFolders } from "../appDataGroups";

function folder(path: string, size = 1, keyword?: string): FolderItem {
  return { path, size, keyword };
}

describe("appDataGroupKey", () => {
  it("cuts the key at the application segment and keeps the written separators", () => {
    expect(appDataGroupKey("C:/Users/me/AppData/Local/Vendor/App/Cache")).toBe(
      "C:/Users/me/AppData/Local/Vendor/App"
    );
    expect(appDataGroupKey("C:/Users/me/AppData/Local/Vendor/App/Temp")).toBe(
      "C:/Users/me/AppData/Local/Vendor/App"
    );
    expect(appDataGroupKey("C:\\Users\\me\\AppData\\Roaming\\Vendor\\App\\Cache")).toBe(
      "C:\\Users\\me\\AppData\\Roaming\\Vendor\\App"
    );
  });

  it("keeps original casing while matching the scope segments case-insensitively", () => {
    expect(appDataGroupKey("C:/Users/me/appdata/LOCAL/Vendor/App/Cache")).toBe(
      "C:/Users/me/appdata/LOCAL/Vendor/App"
    );
    expect(appDataGroupKey("C:/Users/me/AppData/locallow/Vendor/App/GPUCache")).toBe(
      "C:/Users/me/AppData/locallow/Vendor/App"
    );
    expect(appDataGroupKey("D:\\Users\\me\\APPDATA\\ROAMING\\Vendor\\App\\Cache")).toBe(
      "D:\\Users\\me\\APPDATA\\ROAMING\\Vendor\\App"
    );
  });

  it("groups a folder that is exactly the application directory", () => {
    expect(appDataGroupKey("C:/Users/me/AppData/Local/Vendor/App")).toBe(
      "C:/Users/me/AppData/Local/Vendor/App"
    );
  });

  it("does not group a scope folder that has no vendor and app", () => {
    expect(appDataGroupKey("C:/Users/me/AppData/Local/Cache")).toBeNull();
    expect(appDataGroupKey("C:/Users/me/AppData/Roaming/Vendor")).toBeNull();
    expect(appDataGroupKey("C:/Users/me/AppData/LocalLow")).toBeNull();
  });

  it("does not group paths outside AppData or names that only contain AppData", () => {
    expect(appDataGroupKey("D:/tools/cache")).toBeNull();
    expect(appDataGroupKey("C:/Users/me/MyAppData/Local/Vendor/App/Cache")).toBeNull();
    expect(appDataGroupKey("")).toBeNull();
  });

  it("requires Local, Roaming, or LocalLow immediately after AppData", () => {
    expect(appDataGroupKey("C:/Users/me/AppData/Programs/Vendor/App/Cache")).toBeNull();
    expect(
      appDataGroupKey("C:/Users/me/AppData/Programs/AppData/Local/Vendor/App/Cache")
    ).toBe("C:/Users/me/AppData/Programs/AppData/Local/Vendor/App");
  });

  it("preserves mixed separators up to the application segment", () => {
    expect(appDataGroupKey("C:/Users/me/AppData\\Local/Vendor\\App/Cache")).toBe(
      "C:/Users/me/AppData\\Local/Vendor\\App"
    );
  });
});

describe("groupAppDataFolders", () => {
  it("sums child sizes and still returns a group when there is one child", () => {
    const only = folder("C:/Users/me/AppData/Local/Vendor/App/Cache", 12, "cache");
    const rows = groupAppDataFolders([only]);

    expect(rows).toEqual([
      {
        kind: "group",
        group: {
          key: "C:/Users/me/AppData/Local/Vendor/App",
          size: 12,
          children: [only],
        },
      },
    ]);
  });

  it("places each group at its first child and keeps ungrouped rows in order", () => {
    const cache = folder("C:/Users/me/AppData/Local/Vendor/App/Cache", 10, "cache");
    const loose = folder("D:/tools/cache", 3, "cache");
    const temp = folder("C:/Users/me/AppData/Local/Vendor/App/Temp", 4, "temp");
    const other = folder("E:/loose", 1);
    const logs = folder("C:\\Users\\me\\AppData\\Roaming\\Other\\Tool\\Logs", 2, "logs");
    const shallow = folder("C:/Users/me/AppData/Local/Cache", 8, "cache");

    const rows = groupAppDataFolders([cache, loose, temp, other, logs, shallow]);

    expect(rows).toEqual([
      {
        kind: "group",
        group: {
          key: "C:/Users/me/AppData/Local/Vendor/App",
          size: 14,
          children: [cache, temp],
        },
      },
      { kind: "folder", folder: loose },
      { kind: "folder", folder: other },
      {
        kind: "group",
        group: {
          key: "C:\\Users\\me\\AppData\\Roaming\\Other\\Tool",
          size: 2,
          children: [logs],
        },
      },
      { kind: "folder", folder: shallow },
    ]);
  });

  it("keeps separate groups for different applications", () => {
    const first = folder("C:/Users/me/AppData/Local/Vendor/App/Cache", 5);
    const second = folder("C:/Users/me/AppData/Local/Vendor/Other/Cache", 7);

    const rows = groupAppDataFolders([first, second]);

    expect(rows.map(row => (row.kind === "group" ? row.group.key : row.folder.path))).toEqual([
      "C:/Users/me/AppData/Local/Vendor/App",
      "C:/Users/me/AppData/Local/Vendor/Other",
    ]);
    expect(rows[0]).toMatchObject({ kind: "group", group: { size: 5, children: [first] } });
    expect(rows[1]).toMatchObject({ kind: "group", group: { size: 7, children: [second] } });
  });
});
