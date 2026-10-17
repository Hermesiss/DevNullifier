import path from "path";
import { pathMatchesExclude } from "./excludeGlobs";

export interface ProtectionContext {
  home: string;
  userData: string;
  protectedPaths?: string[];
  excludeGlobs?: string[];
}

export function normalizePathKey(input: string): string {
  const resolved = path.resolve(input).replace(/[\\/]+$/, "");
  const slashed = resolved.replace(/\\/g, "/");
  return process.platform === "win32" ? slashed.toLowerCase() : slashed;
}

export function isDriveRoot(input: string): boolean {
  const resolved = path.resolve(input);
  return resolved === path.parse(resolved).root;
}

function isSameOrInside(child: string, parent: string): boolean {
  return child === parent || child.startsWith(`${parent}/`);
}

function isAncestorOf(ancestor: string, descendant: string): boolean {
  return descendant.startsWith(`${ancestor}/`);
}

export function isUnderUserPath(target: string, protectedPaths: readonly string[]): boolean {
  if (!target || protectedPaths.length === 0) return false;

  const key = normalizePathKey(target);
  for (const entry of protectedPaths) {
    if (!entry) continue;
    const root = normalizePathKey(entry);
    if (key === root || key.startsWith(`${root}/`)) return true;
  }
  return false;
}

export function sanitizeProtectedPaths(paths: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of paths) {
    if (!entry || isDriveRoot(entry)) continue;
    const key = normalizePathKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}

export function isProtectedPath(target: string, ctx: ProtectionContext): boolean {
  if (isDriveRoot(target)) return true;

  const key = normalizePathKey(target);
  const home = normalizePathKey(ctx.home);
  const userData = normalizePathKey(ctx.userData);

  if (key === home || key === userData) return true;
  if (isSameOrInside(key, userData)) return true;
  if (isAncestorOf(key, home) || isAncestorOf(key, userData)) return true;
  if (isUnderUserPath(target, ctx.protectedPaths ?? [])) return true;
  return false;
}

export function canDelete(
  target: string,
  allowed: ReadonlySet<string>,
  ctx: ProtectionContext
): boolean {
  if (!target || isProtectedPath(target, ctx)) return false;
  if (pathMatchesExclude(target, ctx.excludeGlobs ?? [])) return false;
  return allowed.has(normalizePathKey(target));
}

export function canRead(
  target: string,
  allowed: ReadonlySet<string>,
  ctx: ProtectionContext
): boolean {
  if (!target || isDriveRoot(target) || isProtectedPath(target, ctx)) return false;

  const key = normalizePathKey(target);
  for (const item of allowed) {
    if (isSameOrInside(key, item)) return true;
  }
  return false;
}

export class ScanAllowlist {
  private appData = new Set<string>();
  private developer = new Set<string>();

  beginAppDataScan(): void {
    this.appData.clear();
  }

  beginDeveloperScan(): void {
    this.developer.clear();
  }

  addAppData(paths: string[], ctx?: ProtectionContext): void {
    for (const entry of paths) {
      if (!entry || (ctx && this.rejected(entry, ctx))) continue;
      this.appData.add(normalizePathKey(entry));
    }
  }

  addDeveloper(paths: string[], ctx?: ProtectionContext): void {
    for (const entry of paths) {
      if (!entry || (ctx && this.rejected(entry, ctx))) continue;
      this.developer.add(normalizePathKey(entry));
    }
  }

  private rejected(entry: string, ctx: ProtectionContext): boolean {
    return isProtectedPath(entry, ctx) || pathMatchesExclude(entry, ctx.excludeGlobs ?? []);
  }

  keys(): Set<string> {
    return new Set([...this.appData, ...this.developer]);
  }
}

export function collectDeveloperPaths(
  projects: Array<{
    path?: string;
    caches?: Array<{ matches?: Array<{ path?: string }> }>;
  }>
): string[] {
  const paths: string[] = [];
  for (const project of projects) {
    if (project?.path) paths.push(project.path);
    for (const group of project?.caches ?? []) {
      for (const match of group?.matches ?? []) {
        if (match?.path) paths.push(match.path);
      }
    }
  }
  return paths;
}
