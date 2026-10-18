import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export type RegQueryDeps = {
  execReg?: (args: string[]) => Promise<string>;
};

async function defaultExecReg(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("reg", args, { windowsHide: true });
  return stdout;
}

function expandHive(key: string): string {
  return key
    .replace(/^HKLM\\/i, "HKEY_LOCAL_MACHINE\\")
    .replace(/^HKCU\\/i, "HKEY_CURRENT_USER\\")
    .replace(/^HKCR\\/i, "HKEY_CLASSES_ROOT\\");
}

/** List immediate subkey names under a registry key. */
export async function listRegistrySubkeys(
  key: string,
  deps: RegQueryDeps = {}
): Promise<string[]> {
  const execReg = deps.execReg ?? defaultExecReg;
  try {
    const stdout = await execReg(["query", key]);
    const prefix = expandHive(key).toLowerCase();
    return stdout
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => {
        const lower = line.toLowerCase();
        return lower.startsWith(prefix + "\\") && !lower.slice(prefix.length + 1).includes("\\");
      })
      .map(line => line.slice(expandHive(key).length + 1));
  } catch {
    return [];
  }
}

/** Read REG_SZ / REG_DWORD values from a registry key into a map. */
export async function readRegistryValues(
  key: string,
  deps: RegQueryDeps = {}
): Promise<Record<string, string>> {
  const execReg = deps.execReg ?? defaultExecReg;
  const result: Record<string, string> = {};
  try {
    const stdout = await execReg(["query", key]);
    for (const line of stdout.split(/\r?\n/)) {
      const match = line.match(/^\s+(\S+)\s+REG_(?:SZ|EXPAND_SZ|DWORD)\s+(.+)$/);
      if (!match) continue;
      result[match[1]] = match[2].trim();
    }
  } catch {
    // missing key
  }
  return result;
}

export async function pathExists(target: string): Promise<boolean> {
  try {
    const { promises: fs } = await import("fs");
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}
