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
  isUnderUserPath,
  normalizePathKey,
  sanitizeProtectedPaths
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

  it("protects a path inside a user-listed directory even when it is allowlisted", () => {
    const keep = path.join(home, "keep");
    const child = path.join(keep, "cache");
    const withUser = { ...ctx, protectedPaths: [keep] };
    const allowed = new Set([normalizePathKey(child), normalizePathKey(keep)]);

    expect(isUnderUserPath(child, [keep])).toBe(true);
    expect(isProtectedPath(child, withUser)).toBe(true);
    expect(isProtectedPath(keep, withUser)).toBe(true);
    expect(canDelete(child, allowed, withUser)).toBe(false);
    expect(canDelete(keep, allowed, withUser)).toBe(false);
    expect(canRead(child, allowed, withUser)).toBe(false);
  });

  it("does not protect the parent of a user-listed directory", () => {
    const keep = path.join(home, "projects", "keep");
    const parent = path.dirname(keep);
    const withUser = { ...ctx, protectedPaths: [keep] };

    expect(parent).not.toBe(home);
    expect(isUnderUserPath(parent, [keep])).toBe(false);
    expect(isProtectedPath(parent, withUser)).toBe(false);
    expect(canDelete(parent, new Set([normalizePathKey(parent)]), withUser)).toBe(true);
  });

  it("does not protect a sibling of a user-listed directory", () => {
    const keep = path.join(home, "keep");
    const sibling = path.join(home, "keep-extra");
    const withUser = { ...ctx, protectedPaths: [keep] };

    expect(isUnderUserPath(sibling, [keep])).toBe(false);
    expect(isProtectedPath(sibling, withUser)).toBe(false);
    expect(canDelete(sibling, new Set([normalizePathKey(sibling)]), withUser)).toBe(true);
  });

  it("keeps built-in home and userData protection when protectedPaths is omitted", () => {
    const cache = path.join(home, "AppData", "Local", "App", "Cache");

    expect(isProtectedPath(home, ctx)).toBe(true);
    expect(isProtectedPath(userData, ctx)).toBe(true);
    expect(isProtectedPath(path.join(userData, "Cache"), ctx)).toBe(true);
    expect(isProtectedPath(path.dirname(userData), ctx)).toBe(true);
    expect(isProtectedPath(cache, ctx)).toBe(false);
    expect(canDelete(cache, new Set([normalizePathKey(cache)]), ctx)).toBe(true);
    expect(isUnderUserPath(cache, [])).toBe(false);
  });

  it("does not allowlist a path rejected by user protection", () => {
    const list = new ScanAllowlist();
    const keep = path.join(home, "keep");
    const child = path.join(keep, "cache");
    const sibling = path.join(home, "other");
    const withUser = { ...ctx, protectedPaths: [keep] };

    list.addAppData([child, sibling], withUser);
    list.addDeveloper([keep], withUser);

    expect(list.keys().has(normalizePathKey(child))).toBe(false);
    expect(list.keys().has(normalizePathKey(keep))).toBe(false);
    expect(canDelete(sibling, list.keys(), withUser)).toBe(true);
  });

  it("stores the raw protected path and drops a normalized duplicate and a drive root", () => {
    const keep = path.join(home, "keep");
    const root = path.parse(keep).root;

    expect(sanitizeProtectedPaths([keep, `${keep}${path.sep}`, root, ""])).toEqual([keep]);
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
