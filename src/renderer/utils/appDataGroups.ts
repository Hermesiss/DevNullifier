import type { FolderItem } from "../types/common";

const SCOPE_SEGMENTS = new Set(["local", "roaming", "locallow"]);

interface PathSegment {
  text: string;
  end: number;
}

function pathSegments(folderPath: string): PathSegment[] {
  const segments: PathSegment[] = [];
  let index = 0;
  while (index < folderPath.length) {
    const char = folderPath[index];
    if (char === "/" || char === "\\") {
      index += 1;
      continue;
    }
    const start = index;
    while (index < folderPath.length && folderPath[index] !== "/" && folderPath[index] !== "\\") {
      index += 1;
    }
    segments.push({ text: folderPath.slice(start, index), end: index });
  }
  return segments;
}

export function appDataGroupKey(folderPath: string): string | null {
  const segments = pathSegments(folderPath);
  for (let index = 0; index < segments.length; index += 1) {
    if (segments[index].text.toLowerCase() !== "appdata") continue;
    const scope = segments[index + 1];
    const vendor = segments[index + 2];
    const app = segments[index + 3];
    if (!scope || !vendor || !app) continue;
    if (!SCOPE_SEGMENTS.has(scope.text.toLowerCase())) continue;
    return folderPath.slice(0, app.end);
  }
  return null;
}

export interface AppDataGroup {
  key: string;
  size: number;
  children: FolderItem[];
}

export function groupAppDataFolders(
  folders: FolderItem[]
): Array<{ kind: "group"; group: AppDataGroup } | { kind: "folder"; folder: FolderItem }> {
  const childrenByKey = new Map<string, FolderItem[]>();
  const rows: Array<{ kind: "group"; key: string } | { kind: "folder"; folder: FolderItem }> = [];

  for (const folder of folders) {
    const key = appDataGroupKey(folder.path);
    if (key == null) {
      rows.push({ kind: "folder", folder });
      continue;
    }
    const existing = childrenByKey.get(key);
    if (existing) {
      existing.push(folder);
      continue;
    }
    childrenByKey.set(key, [folder]);
    rows.push({ kind: "group", key });
  }

  return rows.map(row => {
    if (row.kind === "folder") return row;
    const children = childrenByKey.get(row.key) ?? [];
    const size = children.reduce((sum, child) => sum + child.size, 0);
    return { kind: "group" as const, group: { key: row.key, size, children } };
  });
}
