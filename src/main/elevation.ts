import { isUnderUserPath } from "./deletionPolicy";

const DENIED_CODES = new Set(["EACCES", "EPERM"]);

export function isOutsideHome(target: string, home: string): boolean {
  return !isUnderUserPath(target, [home]);
}

export function isDeniedOutsideHome(
  code: string | undefined,
  target: string,
  home: string
): boolean {
  return DENIED_CODES.has(code ?? "") && isOutsideHome(target, home);
}

export function elevationCommandEnv(
  execPath: string,
  args: readonly string[]
): { DEVNULLIFIER_EXE: string; DEVNULLIFIER_ARGS: string } {
  const unsafe = args.some(arg => /["'\r\n]/.test(arg));
  return {
    DEVNULLIFIER_EXE: execPath,
    DEVNULLIFIER_ARGS: unsafe ? "" : args.join(" ")
  };
}
