import { promises as fs } from "fs";
import path from "path";
import { getUserDataPath } from "./fileUtils";

export interface DeletionLogEntry {
  at: string; // ISO
  path: string;
  size: number;
  status: "success" | "partial" | "error";
}

const MAX_ENTRIES = 500;

function logPath(): string {
  return path.join(getUserDataPath(), "deletion-log.json");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStatus(value: unknown): value is DeletionLogEntry["status"] {
  return value === "success" || value === "partial" || value === "error";
}

function finiteSize(size: unknown): number {
  const numeric = typeof size === "number" ? size : Number(size);
  return Number.isFinite(numeric) ? numeric : 0;
}

function storedEntry(value: unknown): DeletionLogEntry | null {
  if (!isRecord(value)) return null;
  if (typeof value.at !== "string" || typeof value.path !== "string" || value.path.length === 0) {
    return null;
  }
  if (!isStatus(value.status) || typeof value.size !== "number" || !Number.isFinite(value.size)) {
    return null;
  }
  return {
    at: value.at,
    path: value.path,
    size: value.size,
    status: value.status
  };
}

function sanitizeEntries(entries: readonly DeletionLogEntry[]): DeletionLogEntry[] {
  const list: unknown[] = Array.isArray(entries) ? entries : [];
  const sanitized: DeletionLogEntry[] = [];

  for (const entry of list) {
    if (!isRecord(entry) || typeof entry.path !== "string" || entry.path.length === 0) continue;
    sanitized.push({
      at: new Date().toISOString(),
      path: entry.path,
      size: finiteSize(entry.size),
      status: isStatus(entry.status) ? entry.status : "error"
    });
  }

  return sanitized;
}

export async function loadDeletionLog(): Promise<DeletionLogEntry[]> {
  try {
    const data = await fs.readFile(logPath(), "utf-8");
    const parsed: unknown = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    const entries: DeletionLogEntry[] = [];
    for (const item of parsed) {
      const entry = storedEntry(item);
      if (entry) entries.push(entry);
    }
    return entries;
  } catch {
    return [];
  }
}

export async function appendDeletionLog(entries: DeletionLogEntry[]): Promise<void> {
  const next = (await loadDeletionLog()).concat(sanitizeEntries(entries)).slice(-MAX_ENTRIES);
  await fs.writeFile(logPath(), JSON.stringify(next, null, 2), "utf-8");
}

function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function deletionLogToCsv(entries: DeletionLogEntry[]): string {
  const rows = ["at,path,size,status"];
  for (const entry of entries) {
    rows.push(
      [csvField(entry.at), csvField(entry.path), csvField(String(entry.size)), csvField(entry.status)].join(",")
    );
  }
  return rows.join("\n");
}
