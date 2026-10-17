import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  ScanAllowlist,
  canDelete,
  canRead,
  collectDeveloperPaths,
  isDriveRoot,
  isProtectedPath,
  normalizePathKey
} from "../deletionPolicy";

const home = path.join(os.tmpdir(), "dn-home");
const userData = path.join(home, "AppData", "Roaming", "DevNullifier");
const ctx = { home, userData };

describe("deletionPolicy", () => {
  it("treats a drive root as protected", () => {
    const root = path.parse(process.cwd()).root;
    expect(isDriveRoot(root)).toBe(true);
    expect(isProtectedPath(root, ctx)).toBe(true);
    expect(canDelete(root, new Set([normalizePathKey(root)]), ctx)).toBe(false);
  });

  it("blocks the profile, the app userData tree, and their parents", () => {
    expect(isProtectedPath(home, ctx)).toBe(true);
    expect(isProtectedPath(userData, ctx)).toBe(true);
    expect(isProtectedPath(path.join(userData, "Cache"), ctx)).toBe(true);
    expect(isProtectedPath(path.dirname(userData), ctx)).toBe(true);
    expect(canDelete(home, new Set([normalizePathKey(home)]), ctx)).toBe(false);
  });

  it("deletes only a path the scan returned", () => {
    const cache = path.join(home, "AppData", "Local", "App", "Cache");
    const allowed = new Set([normalizePathKey(cache)]);

    expect(canDelete(cache, allowed, ctx)).toBe(true);
    expect(canDelete(path.dirname(cache), allowed, ctx)).toBe(false);
    expect(canDelete(path.join(cache, "blob"), allowed, ctx)).toBe(false);
  });

  it("reads a scanned folder and its children, not its parent", () => {
    const cache = path.join(home, "AppData", "Local", "App", "Cache");
    const allowed = new Set([normalizePathKey(cache)]);

    expect(canRead(cache, allowed, ctx)).toBe(true);
    expect(canRead(path.join(cache, "level", "file"), allowed, ctx)).toBe(true);
    expect(canRead(path.dirname(cache), allowed, ctx)).toBe(false);
    expect(canRead(path.join(userData, "logs"), allowed, ctx)).toBe(false);
  });

  it("keeps appdata and developer paths on separate scans", () => {
    const list = new ScanAllowlist();
    const appPath = path.join(home, "AppData", "Local", "TempCache");
    const devPath = path.join(home, "src", "app", "node_modules");

    list.addAppData([appPath]);
    list.addDeveloper([devPath]);
    expect(canDelete(appPath, list.keys(), ctx)).toBe(true);
    expect(canDelete(devPath, list.keys(), ctx)).toBe(true);

    list.beginAppDataScan();
    expect(canDelete(appPath, list.keys(), ctx)).toBe(false);
    expect(canDelete(devPath, list.keys(), ctx)).toBe(true);
  });

  it("collects project and cache paths", () => {
    expect(
      collectDeveloperPaths([
        {
          path: "/repo",
          caches: [{ matches: [{ path: "/repo/node_modules" }] }]
        }
      ])
    ).toEqual(["/repo", "/repo/node_modules"]);
  });
});
