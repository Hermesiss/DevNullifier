import path from "path";
import { describe, expect, it, vi } from "vitest";
import { listSteamLibraryPaths } from "../games/steam/library";
import { inferSteamKind, listManifestsInLibrary, parseAppManifest } from "../games/steam/manifests";
import { loadSteamLastPlayed, parseLastPlayedMap } from "../games/steam/lastPlayed";
import { steamUninstallUrl, uninstallSteamApp } from "../games/steam/uninstall";
import { createSteamProvider } from "../games/steam/provider";
import { scanGames, uninstallGame } from "../games/scanGames";
import { resolveSteamArtworkPath, steamArtworkCandidates } from "../games/steam/artwork";
import type { GameApp, LauncherProvider } from "../games/types";

const steamRoot = path.join("C:", "Steam");
const libraryExtra = path.join("D:", "SteamLibrary");

describe("Steam library + manifests", () => {
  it("reads libraryfolders.vdf paths", async () => {
    const libraryVdf = `
"libraryfolders"
{
	"0"
	{
		"path"		"${steamRoot.replace(/\\/g, "\\\\")}"
	}
	"1"
	{
		"path"		"${libraryExtra.replace(/\\/g, "\\\\")}"
	}
}
`;
    const paths = await listSteamLibraryPaths(steamRoot, {
      readFile: async () => libraryVdf
    });
    expect(paths.map(p => path.normalize(p))).toEqual(
      expect.arrayContaining([path.normalize(steamRoot), path.normalize(libraryExtra)])
    );
  });

  it("parses appmanifest and infers tool kind", () => {
    const text = `
"AppState"
{
	"appid"		"228980"
	"name"		"Steamworks Common Redistributables"
	"installdir"		"Steamworks Shared"
	"SizeOnDisk"		"1234"
}
`;
    const app = parseAppManifest(text, steamRoot);
    expect(app).toMatchObject({
      appId: "228980",
      name: "Steamworks Common Redistributables",
      size: 1234,
      kind: "tool"
    });
    expect(app?.installPath).toBe(
      path.join(steamRoot, "steamapps", "common", "Steamworks Shared")
    );
    expect(inferSteamKind("Dota 2")).toBe("game");
  });

  it("lists manifests from steamapps via deps", async () => {
    const appsDir = path.join(steamRoot, "steamapps");
    const apps = await listManifestsInLibrary(steamRoot, {
      pathExists: async target => target === appsDir,
      readdir: async () => ["appmanifest_570.acf", "readme.txt", "appmanifest_bad.acf"],
      readFile: async filePath => {
        if (filePath.endsWith("appmanifest_570.acf")) {
          return `
"AppState"
{
	"appid"		"570"
	"name"		"Dota 2"
	"installdir"		"dota 2 beta"
	"SizeOnDisk"		"100"
}
`;
        }
        throw new Error("broken");
      }
    });
    expect(apps).toHaveLength(1);
    expect(apps[0].appId).toBe("570");
  });
});

describe("Steam last played", () => {
  it("parses LastPlayed seconds into ms (lowercase valve key)", () => {
    const text = `
"UserLocalConfigStore"
{
	"Software"
	{
		"valve"
		{
			"Steam"
			{
				"apps"
				{
					"570"
					{
						"LastPlayed"		"1700000000"
					}
					"730"
					{
						"LastPlayed"		"0"
					}
				}
			}
		}
	}
}
`;
    const map = parseLastPlayedMap(text);
    expect(map.get("570")).toBe(1700000000 * 1000);
    expect(map.has("730")).toBe(false);
  });

  it("merges newest LastPlayed across userdata profiles", async () => {
    const userdata = path.join(steamRoot, "userdata");
    const map = await loadSteamLastPlayed(steamRoot, {
      pathExists: async target =>
        target === userdata ||
        target.endsWith(path.join("111", "config", "localconfig.vdf")) ||
        target.endsWith(path.join("222", "config", "localconfig.vdf")),
      readdir: async dir => (dir === userdata ? ["111", "222", "0"] : []),
      readFile: async filePath => {
        if (filePath.includes(`${path.sep}111${path.sep}`)) {
          return `
"UserLocalConfigStore"
{
	"Software"
	{
		"valve"
		{
			"Steam"
			{
				"apps"
				{
					"570" { "LastPlayed" "100" }
				}
			}
		}
	}
}
`;
        }
        return `
"UserLocalConfigStore"
{
	"Software"
	{
		"valve"
		{
			"Steam"
			{
				"apps"
				{
					"570" { "LastPlayed" "200" }
				}
			}
		}
	}
}
`;
      }
    });
    expect(map.get("570")).toBe(200000);
  });
});

describe("Steam artwork", () => {
  it("prefers library_600x900 then header then logo", async () => {
    const candidates = steamArtworkCandidates(steamRoot, "440");
    expect(candidates[0]).toBe(
      path.join(steamRoot, "appcache", "librarycache", "440", "library_600x900.jpg")
    );
    const hit = await resolveSteamArtworkPath(steamRoot, "440", {
      pathExists: async target => target.endsWith(path.join("440", "header.jpg"))
    });
    expect(hit).toBe(path.join(steamRoot, "appcache", "librarycache", "440", "header.jpg"));
  });
});

describe("Steam uninstall + scan routing", () => {
  it("builds steam://uninstall URL and opens it", async () => {
    expect(steamUninstallUrl("570")).toBe("steam://uninstall/570");
    const openExternal = vi.fn(async () => undefined);
    await expect(uninstallSteamApp("570", { openExternal })).resolves.toEqual({
      ok: true,
      mode: "protocol"
    });
    expect(openExternal).toHaveBeenCalledWith("steam://uninstall/570");
    await expect(uninstallSteamApp("nope", { openExternal })).resolves.toEqual({
      ok: false,
      error: "Invalid Steam app id"
    });
  });

  it("returns empty list when Steam is missing", async () => {
    const provider = createSteamProvider({
      resolveSteamPath: async () => null
    });
    expect(await provider.detect()).toBe(false);
    expect(await provider.listInstalled()).toEqual([]);
    expect(await scanGames([provider])).toEqual([]);
  });

  it("lists installed apps with lastPlayed and artwork from provider", async () => {
    const provider = createSteamProvider({
      resolveSteamPath: async () => steamRoot,
      readFile: async filePath => {
        if (filePath.endsWith("libraryfolders.vdf")) {
          return `
"libraryfolders"
{
	"0" { "path" "${steamRoot.replace(/\\/g, "\\\\")}" }
}
`;
        }
        if (filePath.endsWith("appmanifest_570.acf")) {
          return `
"AppState"
{
	"appid"		"570"
	"name"		"Dota 2"
	"installdir"		"dota 2 beta"
	"SizeOnDisk"		"50"
}
`;
        }
        if (filePath.endsWith("localconfig.vdf")) {
          return `
"UserLocalConfigStore"
{
	"Software"
	{
		"valve"
		{
			"Steam"
			{
				"apps"
				{
					"570" { "LastPlayed" "1700000000" }
				}
			}
		}
	}
}
`;
        }
        throw new Error(`unexpected read ${filePath}`);
      },
      readArtworkFile: async () => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      readdir: async dir => {
        if (dir.endsWith("steamapps")) return ["appmanifest_570.acf"];
        if (dir.endsWith("userdata")) return ["42"];
        return [];
      },
      pathExists: async target =>
        !String(target).includes(path.join("appcache", "librarycache")) ||
        String(target).endsWith(path.join("570", "logo.png"))
    });

    const apps = await provider.listInstalled();
    expect(apps).toHaveLength(1);
    expect(apps[0]).toMatchObject({
      id: "steam:570",
      launcherId: "steam",
      appId: "570",
      name: "Dota 2",
      size: 50,
      lastPlayedAt: 1700000000 * 1000
    });
    expect(apps[0].artworkDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("routes uninstall-game through provider registry", async () => {
    const uninstall = vi.fn(async () => ({ ok: true }));
    const fake: LauncherProvider = {
      id: "steam",
      label: "Steam",
      detect: async () => true,
      listInstalled: async () => [] as GameApp[],
      uninstall
    };
    await expect(
      uninstallGame({ launcherId: "steam", appId: "570" }, () => fake)
    ).resolves.toEqual({ ok: true });
    expect(uninstall).toHaveBeenCalledWith("570");

    await expect(
      uninstallGame({ launcherId: "steam", appId: "1" }, () => undefined)
    ).resolves.toEqual({ ok: false, error: "Unknown launcher: steam" });
  });
});
