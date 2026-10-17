import { describe, expect, it } from "vitest";
import { elevationCommandEnv, isOutsideHome } from "../elevation";

describe("isOutsideHome", () => {
  const home = "C:/Users/me";

  it("treats the home directory itself as inside", () => {
    expect(isOutsideHome(home, home)).toBe(false);
  });

  it("treats a profile child as inside the home directory", () => {
    expect(isOutsideHome("C:/Users/me/AppData/Local/X", home)).toBe(false);
  });

  it("treats a path outside the profile as outside", () => {
    expect(isOutsideHome("C:/ProgramData/X", home)).toBe(true);
  });

  it("treats a sibling of the home directory as outside", () => {
    expect(isOutsideHome("C:/Users/me2", home)).toBe(true);
  });
});

describe("elevationCommandEnv", () => {
  it("joins safe arguments and keeps the executable path in the environment", () => {
    expect(elevationCommandEnv("C:\\DevNullifier.exe", ["--enable-logging", "cache"])).toEqual({
      DEVNULLIFIER_EXE: "C:\\DevNullifier.exe",
      DEVNULLIFIER_ARGS: "--enable-logging cache"
    });
  });

  it("clears DEVNULLIFIER_ARGS when an argument contains a quote", () => {
    expect(elevationCommandEnv("C:\\DevNullifier.exe", ["--ok", 'say "hi"'])).toEqual({
      DEVNULLIFIER_EXE: "C:\\DevNullifier.exe",
      DEVNULLIFIER_ARGS: ""
    });
  });

  it("clears DEVNULLIFIER_ARGS when an argument contains a newline", () => {
    expect(elevationCommandEnv("C:\\DevNullifier.exe", ["line\nbreak"])).toEqual({
      DEVNULLIFIER_EXE: "C:\\DevNullifier.exe",
      DEVNULLIFIER_ARGS: ""
    });
  });
});
