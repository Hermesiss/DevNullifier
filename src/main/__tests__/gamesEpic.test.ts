import path from "path";
import { describe, expect, it } from "vitest";
import { createEpicProvider } from "../games/epic/provider";
import { parseEpicItem } from "../games/epic/manifests";
import { epicLibraryUrl, uninstallEpicApp } from "../games/epic/uninstall";
import { epicManifestsDir } from "../games/epic/detect";
import { parseEpicCatcache, pickEpicArtworkUrl } from "../games/epic/catcache";
import { scanGames } from "../games/scanGames";

const epicData = path.join("C:", "ProgramData", "Epic", "EpicGamesLauncher", "Data");

const sampleItem = JSON.stringify({
  FormatVersion: 0,
  bIsIncompleteInstall: false,
  DisplayName: "We Were Here Together",
  AppName: "828b2ff07ee548f59b7e172b4b4c9686",
  CatalogNamespace: "c5f6069e7dd644dab009294f0fddc7a7",
  CatalogItemId: "93e3dd361ab14ee9919914fa1ae199a2",
  InstallLocation: "E:\\Games\\WeWereHereTogether",
  InstallSize: 12414024558,
  bIsApplication: true
});

describe("Epic manifests", () => {
  it("parses .item JSON and skips incomplete installs", () => {
    const app = parseEpicItem(sampleItem);
    expect(app).toMatchObject({
      appId: "828b2ff07ee548f59b7e172b4b4c9686",
      name: "We Were Here Together",
      size: 12414024558,
      kind: "game",
      catalogNamespace: "c5f6069e7dd644dab009294f0fddc7a7",
      catalogItemId: "93e3dd361ab14ee9919914fa1ae199a2"
    });

    const incomplete = parseEpicItem(
      JSON.stringify({ ...JSON.parse(sampleItem), bIsIncompleteInstall: true })
    );
    expect(incomplete).toBeNull();
  });

  it("marks DLC / tools by MainGameAppName and name heuristics", () => {
    const dlc = parseEpicItem(
      JSON.stringify({
        ...JSON.parse(sampleItem),
        DisplayName: "Some DLC",
        MainGameAppName: "parentApp"
      })
    );
    expect(dlc?.kind).toBe("other");

    const tool = parseEpicItem(
      JSON.stringify({
        ...JSON.parse(sampleItem),
        DisplayName: "RealityCapture 1.4.2",
        AppName: "fghi4567"
      })
    );
    expect(tool?.kind).toBe("tool");
  });
});

describe("Epic catcache artwork", () => {
  it("prefers tall box art and parses base64 catcache", () => {
    expect(
      pickEpicArtworkUrl([
        { type: "DieselGameBox", url: "https://cdn.example/wide.jpg" },
        { type: "DieselGameBoxTall", url: "https://cdn.example/tall.jpg" }
      ])
    ).toBe("https://cdn.example/tall.jpg");

    const payload = Buffer.from(
      JSON.stringify([
        {
          id: "93e3dd361ab14ee9919914fa1ae199a2",
          keyImages: [{ type: "DieselGameBoxTall", url: "https://cdn.example/cover.png" }]
        }
      ]),
      "utf8"
    ).toString("base64");

    const map = parseEpicCatcache(payload);
    expect(map.get("93e3dd361ab14ee9919914fa1ae199a2")).toBe("https://cdn.example/cover.png");
  });
});

describe("Epic uninstall + provider", () => {
  it("returns empty when Epic is missing", async () => {
    const provider = createEpicProvider({
      resolveEpicDataPath: async () => null
    });
    expect(await provider.detect()).toBe(false);
    expect(await provider.listInstalled()).toEqual([]);
    expect(await scanGames([provider])).toEqual([]);
  });

  it("lists installed apps from Manifests/*.item with catcache artwork", async () => {
    const manifestsDir = epicManifestsDir(epicData);
    const catcachePath = path.join(epicData, "Catalog", "catcache.bin");
    const catcache = Buffer.from(
      JSON.stringify([
        {
          id: "93e3dd361ab14ee9919914fa1ae199a2",
          keyImages: [{ type: "DieselGameBoxTall", url: "https://cdn.example/wwht.png" }]
        }
      ]),
      "utf8"
    ).toString("base64");

    const provider = createEpicProvider({
      resolveEpicDataPath: async () => epicData,
      pathExists: async target =>
        target === manifestsDir || target === epicData || target === catcachePath,
      readdir: async dir => (dir === manifestsDir ? ["game.item", "readme.txt"] : []),
      readFile: async () => sampleItem,
      readCatcacheFile: async () => catcache
    });

    const apps = await provider.listInstalled();
    expect(apps).toHaveLength(1);
    expect(apps[0]).toMatchObject({
      id: "epic:828b2ff07ee548f59b7e172b4b4c9686",
      launcherId: "epic",
      launcherLabel: "Epic Games",
      name: "We Were Here Together",
      lastPlayedAt: null,
      artworkDataUrl: null,
      artworkUrl: "https://cdn.example/wwht.png"
    });
  });

  it("opens Epic launcher URI (no uninstall deep link)", async () => {
    expect(
      epicLibraryUrl(
        "c5f6069e7dd644dab009294f0fddc7a7",
        "93e3dd361ab14ee9919914fa1ae199a2",
        "828b2ff07ee548f59b7e172b4b4c9686"
      )
    ).toBe(
      "com.epicgames.launcher://apps/c5f6069e7dd644dab009294f0fddc7a7%3A93e3dd361ab14ee9919914fa1ae199a2%3A828b2ff07ee548f59b7e172b4b4c9686"
    );

    const opened: string[] = [];
    await expect(
      uninstallEpicApp("ns", "item", "app", {
        openExternal: async url => {
          opened.push(url);
        }
      })
    ).resolves.toEqual({ ok: true, mode: "protocol" });
    expect(opened[0]).toContain("com.epicgames.launcher://apps/");
    expect(opened[0]).not.toContain("action=uninstall");

    const manifestsDir = epicManifestsDir(epicData);
    const provider = createEpicProvider({
      resolveEpicDataPath: async () => epicData,
      pathExists: async target => target === manifestsDir,
      readdir: async () => ["game.item"],
      readFile: async () => sampleItem,
      openExternal: async url => {
        opened.push(url);
      }
    });
    await expect(provider.uninstall("missing")).resolves.toEqual({
      ok: false,
      error: "Unknown Epic app: missing"
    });
  });
});
