import { describe, expect, it } from "vitest";
import { parseVdf, vdfObject, vdfString } from "../games/vdf";

describe("parseVdf", () => {
  it("parses nested quoted keys and values", () => {
    const text = `
"libraryfolders"
{
	"0"
	{
		"path"		"C:\\\\Steam"
		"apps"
		{
			"570"		"1"
		}
	}
}
`;
    const root = parseVdf(text);
    expect(vdfString(root, "libraryfolders", "0", "path")).toBe("C:\\Steam");
    expect(vdfString(vdfObject(root, "libraryfolders", "0", "apps"), "570")).toBe("1");
  });

  it("parses appmanifest AppState", () => {
    const text = `
"AppState"
{
	"appid"		"570"
	"name"		"Dota 2"
	"installdir"		"dota 2 beta"
	"SizeOnDisk"		"42000000000"
}
`;
    const root = parseVdf(text);
    const state = vdfObject(root, "AppState");
    expect(vdfString(state, "appid")).toBe("570");
    expect(vdfString(state, "name")).toBe("Dota 2");
    expect(vdfString(state, "SizeOnDisk")).toBe("42000000000");
  });
});
