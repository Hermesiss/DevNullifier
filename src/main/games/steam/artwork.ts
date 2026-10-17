import { promises as fs } from "fs";
import path from "path";

const MAX_ARTWORK_BYTES = 1_500_000;
const MIN_USEFUL_BYTES = 2_048;

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const NAMED_FILES = [
  "library_600x900.jpg",
  "library_600x900.png",
  "library_capsule.jpg",
  "library_hero.jpg",
  "header.jpg",
  "portrait.png",
  "logo.png",
  "icon.jpg",
  "icon.png"
];

const FLAT_SUFFIXES = [
  "_library_600x900.jpg",
  "_library_capsule.jpg",
  "_library_hero.jpg",
  "_header.jpg",
  "_capsule_616x353.jpg",
  "_capsule_231x87.jpg",
  "_icon.jpg",
  "_logo.png"
];

export type ArtworkDeps = {
  pathExists?: (target: string) => Promise<boolean>;
  /** Binary read for images — separate from VDF text `readFile`. */
  readArtworkFile?: (filePath: string) => Promise<Buffer>;
  readdir?: (dir: string) => Promise<string[]>;
  statSize?: (filePath: string) => Promise<number>;
};

export interface SteamArtwork {
  dataUrl: string | null;
  url: string | null;
}

async function defaultPathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function defaultStatSize(filePath: string): Promise<number> {
  const stats = await fs.stat(filePath);
  return stats.size;
}

function libraryCacheDir(steamRoot: string): string {
  return path.join(steamRoot, "appcache", "librarycache");
}

/** Prefer portrait cover, then header/hero, then logo — nested + flat names. */
export function steamArtworkCandidates(steamRoot: string, appId: string): string[] {
  const base = libraryCacheDir(steamRoot);
  const nested = NAMED_FILES.map(name => path.join(base, appId, name));
  const flat = FLAT_SUFFIXES.map(suffix => path.join(base, `${appId}${suffix}`));
  return [...nested, ...flat];
}

/** Public Steam CDN URLs — used when local librarycache has nothing useful. */
export function steamArtworkCdnUrls(appId: string): string[] {
  const hosts = [
    "https://cdn.cloudflare.steamstatic.com/steam/apps",
    "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps",
    "https://cdn.akamai.steamstatic.com/steam/apps"
  ];
  const files = [
    "library_600x900.jpg",
    "library_600x900_2x.jpg",
    "header.jpg",
    "capsule_616x353.jpg",
    "capsule_231x87.jpg"
  ];
  const urls: string[] = [];
  for (const host of hosts) {
    for (const file of files) {
      urls.push(`${host}/${appId}/${file}`);
    }
  }
  return urls;
}

export function steamPrimaryArtworkUrl(appId: string): string {
  return steamArtworkCdnUrls(appId)[0];
}

function scoreArtworkName(fileName: string): number {
  const lower = fileName.toLowerCase();
  if (lower.includes("blur")) return -100;
  if (lower.includes("library_600x900")) return 100;
  if (lower.includes("library_capsule") || lower.includes("portrait")) return 90;
  if (lower.includes("header")) return 80;
  if (lower.includes("library_hero") && !lower.includes("blur")) return 70;
  if (lower.includes("capsule")) return 60;
  if (lower === "logo.png" || lower.endsWith("_logo.png")) return 50;
  if (lower.includes("icon")) return 30;
  if (IMAGE_EXT.has(path.extname(lower))) return 20;
  return 0;
}

function looksLikeImageMagic(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
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

/** Scan app librarycache folder for any usable image (named or hashed). */
export async function findArtworkInAppDir(
  appDir: string,
  deps: ArtworkDeps = {}
): Promise<string | null> {
  const readdir = deps.readdir ?? ((dir: string) => fs.readdir(dir));
  const pathExists = deps.pathExists ?? defaultPathExists;
  const statSize = deps.statSize ?? defaultStatSize;

  if (!(await pathExists(appDir))) return null;

  let entries: string[];
  try {
    entries = await readdir(appDir);
  } catch {
    return null;
  }

  const scored: Array<{ filePath: string; score: number; size: number }> = [];
  for (const entry of entries) {
    const score = scoreArtworkName(entry);
    if (score < 0) continue;
    const filePath = path.join(appDir, entry);
    const ext = path.extname(entry).toLowerCase();
    const maybeImage = IMAGE_EXT.has(ext) || !ext;
    if (!maybeImage) continue;
    try {
      const size = await statSize(filePath);
      if (size < MIN_USEFUL_BYTES || size > MAX_ARTWORK_BYTES) continue;
      scored.push({ filePath, score: score || (ext ? 15 : 10), size });
    } catch {
      // skip
    }
  }

  scored.sort((a, b) => b.score - a.score || b.size - a.size);
  return scored[0]?.filePath ?? null;
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

  const appDir = path.join(libraryCacheDir(steamRoot), appId);
  return findArtworkInAppDir(appDir, deps);
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
    if (buf.length < MIN_USEFUL_BYTES) return null;
    const magic = looksLikeImageMagic(buf);
    const mime = magic ?? mimeForExt(filePath);
    if (!magic && !IMAGE_EXT.has(path.extname(filePath).toLowerCase())) {
      return null;
    }
    return `data:${mime};base64,${buf.toString("base64")}`;
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

/** Local cache first; CDN URL as fallback for the renderer `<img>`. */
export async function loadSteamArtwork(
  steamRoot: string,
  appId: string,
  deps: ArtworkDeps = {}
): Promise<SteamArtwork> {
  const dataUrl = await loadSteamArtworkDataUrl(steamRoot, appId, deps);
  return {
    dataUrl,
    url: dataUrl ? null : steamPrimaryArtworkUrl(appId)
  };
}
