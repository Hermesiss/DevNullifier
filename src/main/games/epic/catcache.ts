import { promises as fs } from "fs";
import path from "path";

export type EpicCatcacheDeps = {
  readCatcacheFile?: (filePath: string) => Promise<Buffer | string>;
  pathExists?: (target: string) => Promise<boolean>;
};

interface EpicKeyImage {
  type?: string;
  url?: string;
  width?: number;
  height?: number;
}

interface EpicCatalogEntry {
  id?: string;
  keyImages?: EpicKeyImage[];
}

const PREFERRED_TYPES = [
  "DieselGameBoxTall",
  "OfferImageTall",
  "Thumbnail",
  "DieselGameBox",
  "OfferImageWide",
  "DieselGameBoxWide"
];

async function defaultPathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export function epicCatcachePath(epicDataPath: string): string {
  return path.join(epicDataPath, "Catalog", "catcache.bin");
}

/** Pick best cover URL from Epic catalog keyImages. */
export function pickEpicArtworkUrl(images: EpicKeyImage[] | undefined): string | null {
  if (!images?.length) return null;
  for (const type of PREFERRED_TYPES) {
    const match = images.find(img => img.type === type && img.url);
    if (match?.url) return match.url;
  }
  const any = images.find(img => img.url);
  return any?.url ?? null;
}

/**
 * Decode Epic Catalog/catcache.bin (base64 JSON array) → catalogItemId → artwork URL.
 */
export function parseEpicCatcache(raw: Buffer | string): Map<string, string> {
  const map = new Map<string, string>();
  try {
    const text = (typeof raw === "string" ? raw : raw.toString("utf8")).trim();
    let jsonText = text;
    if (!text.startsWith("[") && !text.startsWith("{")) {
      jsonText = Buffer.from(text, "base64").toString("utf8");
    }
    const data = JSON.parse(jsonText) as EpicCatalogEntry[];
    if (!Array.isArray(data)) return map;

    for (const entry of data) {
      const id = entry.id?.trim();
      if (!id) continue;
      const url = pickEpicArtworkUrl(entry.keyImages);
      if (url) map.set(id, url);
    }
  } catch {
    // broken cache
  }
  return map;
}

export async function loadEpicArtworkUrls(
  epicDataPath: string,
  deps: EpicCatcacheDeps = {}
): Promise<Map<string, string>> {
  const pathExists = deps.pathExists ?? defaultPathExists;
  const readCatcacheFile =
    deps.readCatcacheFile ?? ((filePath: string) => fs.readFile(filePath));
  const filePath = epicCatcachePath(epicDataPath);
  if (!(await pathExists(filePath))) return new Map();
  try {
    const raw = await readCatcacheFile(filePath);
    return parseEpicCatcache(raw);
  } catch {
    return new Map();
  }
}
