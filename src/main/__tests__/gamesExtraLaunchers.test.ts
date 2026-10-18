import { describe, expect, it, vi } from "vitest";
import { createBattleNetProvider } from "../games/battlenet/provider";
import { createEaProvider } from "../games/ea/provider";
import { createGogProvider } from "../games/gog/provider";
import { createRiotProvider } from "../games/riot/provider";
import { getProviders } from "../games/registry";

describe("extra launcher providers", () => {
  it("registers gog, battlenet, riot, and ea", () => {
    const ids = getProviders().map(provider => provider.id);
    expect(ids).toEqual(
      expect.arrayContaining(["steam", "epic", "gog", "battlenet", "riot", "ea"])
    );
  });

  it("lists GOG games from mocked registry values", async () => {
    const install = "D:\\GOG Games\\Witcher";
    const provider = createGogProvider({
      platform: "win32",
      pathExists: async target => target === install,
      execReg: async args => {
        const joined = args.join(" ");
        if (joined.includes("GOG.com\\Games") && !joined.includes("120766")) {
          return "HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\GOG.com\\Games\\120766\n";
        }
        if (joined.includes("120766")) {
          return [
            "    gameName    REG_SZ    The Witcher 3",
            `    path    REG_SZ    ${install}`
          ].join("\n");
        }
        return "";
      },
      dirSize: async () => 42,
      openExternal: vi.fn(async () => undefined)
    });

    expect(await provider.detect()).toBe(true);
    const apps = await provider.listInstalled();
    expect(apps).toEqual([
      expect.objectContaining({
        launcherId: "gog",
        appId: "120766",
        name: "The Witcher 3",
        installPath: install,
        size: 42
      })
    ]);

    const result = await provider.uninstall("120766");
    expect(result).toEqual({ ok: true, mode: "protocol" });
  });

  it("filters Battle.net uninstall entries by publisher", async () => {
    const install = "C:\\Games\\Overwatch";
    const provider = createBattleNetProvider({
      platform: "win32",
      pathExists: async target => target === install,
      execReg: async args => {
        const joined = args.join(" ");
        if (joined.endsWith("Uninstall")) {
          return [
            "HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Overwatch",
            "HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Other"
          ].join("\n");
        }
        if (joined.includes("\\Overwatch")) {
          return [
            "    DisplayName    REG_SZ    Overwatch 2",
            "    Publisher    REG_SZ    Blizzard Entertainment",
            `    InstallLocation    REG_SZ    ${install}`,
            "    EstimatedSize    REG_DWORD    0x400"
          ].join("\n");
        }
        if (joined.includes("\\Other")) {
          return [
            "    DisplayName    REG_SZ    Not Blizzard",
            "    Publisher    REG_SZ    Someone Else",
            `    InstallLocation    REG_SZ    ${install}`
          ].join("\n");
        }
        return "";
      }
    });

    const apps = await provider.listInstalled();
    expect(apps).toHaveLength(1);
    expect(apps[0]).toMatchObject({
      launcherId: "battlenet",
      name: "Overwatch 2",
      size: 0x400 * 1024
    });
  });

  it("returns empty lists on non-windows", async () => {
    const gog = createGogProvider({ platform: "linux" });
    const riot = createRiotProvider({ platform: "darwin" });
    const ea = createEaProvider({ platform: "linux" });
    expect(await gog.detect()).toBe(false);
    expect(await gog.listInstalled()).toEqual([]);
    expect(await riot.listInstalled()).toEqual([]);
    expect(await ea.listInstalled()).toEqual([]);
  });
});
