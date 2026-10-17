import { promises as fs } from "fs";
import path from "path";

const MAX_ARTWORK_BYTES = 512_000;

export type ArtworkDeps = {
  pathExists?: (target: string) => Promise<boolean>;
  /** Binary read for images — separate from VDF text `readFile`. */
  readArtworkFile?: (filePath: string) => Promise<Buffer>;
};

async function defaultPathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

/** Prefer portrait cover, then header, then logo — from Steam library cache only. */
export function steamArtworkCandidates(steamRoot: string, appId: string): string[] {
  const base = path.join(steamRoot, "appcache", "librarycache");
  return [
    path.join(base, appId, "library_600x900.jpg"),
    path.join(base, appId, "header.jpg"),
    path.join(base, appId, "logo.png"),
    path.join(base, `${appId}_library_600x900.jpg`),
    path.join(base, `${appId}_header.jpg`),
    path.join(base, `${appId}_icon.jpg`),
    path.join(base, `${appId}_logo.png`)
  ];
}

export async function resolveSteamArtworkPath(
  steamRoot: string,
  appId: string,
  deps: ArtworkDeps = {}
): Promise<string | null> {
  const pathExists = deps.pathExists ?? defaultPathExists;
  for (const candidate of steamArtworkCandidates(steamRoot, appId)) {
    if (await pathExists(candidate)) return candidate;
  }
  return null;
}

function mimeForExt(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

/** Read a local Steam cache image as a data URL (capped size). */
export async function readArtworkDataUrl(
  filePath: string,
  deps: ArtworkDeps = {}
): Promise<string | null> {
  const readArtworkFile = deps.readArtworkFile ?? ((target: string) => fs.readFile(target));
  try {
    const buf = await readArtworkFile(filePath);
    if (!buf.length || buf.length > MAX_ARTWORK_BYTES) return null;
    return `data:${mimeForExt(filePath)};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function loadSteamArtworkDataUrl(
  steamRoot: string,
  appId: string,
  deps: ArtworkDeps = {}
): Promise<string | null> {
  const artPath = await resolveSteamArtworkPath(steamRoot, appId, deps);
  if (!artPath) return null;
  return readArtworkDataUrl(artPath, deps);
}
