import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export type ContainerEngine = "docker" | "podman";

export type ContainerPruneDeps = {
  execFile?: (
    file: string,
    args: string[],
    options?: { windowsHide?: boolean; timeout?: number; encoding?: BufferEncoding }
  ) => Promise<{ stdout: string; stderr: string }>;
  which?: (binary: string) => Promise<boolean>;
};

export interface ContainerPruneResult {
  ok: boolean;
  engine: ContainerEngine;
  error?: string;
  /** Combined command output for the UI summary. */
  output: string;
  commands: string[];
}

/** Commands never include --volumes. */
export function pruneCommandPlan(engine: ContainerEngine): string[][] {
  if (engine === "docker") {
    return [
      ["system", "prune", "-f"],
      ["builder", "prune", "-f"]
    ];
  }
  return [
    ["system", "prune", "-f"],
    ["image", "prune", "-f"]
  ];
}

async function defaultWhich(binary: string): Promise<boolean> {
  try {
    const check = process.platform === "win32" ? "where" : "which";
    await execFileAsync(check, [binary], { windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

export async function pruneContainerEngine(
  engine: ContainerEngine,
  deps: ContainerPruneDeps = {}
): Promise<ContainerPruneResult> {
  const run =
    deps.execFile ??
    ((file, args, options) =>
      execFileAsync(file, args, { encoding: "utf8", ...options }) as Promise<{
        stdout: string;
        stderr: string;
      }>);
  const which = deps.which ?? defaultWhich;
  const plan = pruneCommandPlan(engine);
  const commands = plan.map(args => `${engine} ${args.join(" ")}`);

  if (!(await which(engine))) {
    return {
      ok: false,
      engine,
      error: `${engine} not found on PATH`,
      output: "",
      commands
    };
  }

  const chunks: string[] = [];
  try {
    for (const args of plan) {
      // Hard guard: never pass --volumes.
      if (args.includes("--volumes") || args.includes("-a")) {
        return {
          ok: false,
          engine,
          error: "Refusing unsafe prune flags",
          output: chunks.join("\n"),
          commands
        };
      }
      const { stdout, stderr } = await run(engine, args, {
        windowsHide: true,
        timeout: 120_000,
        encoding: "utf8"
      });
      const out = String(stdout ?? "").trim();
      const err = String(stderr ?? "").trim();
      if (out) chunks.push(out);
      if (err) chunks.push(err);
    }
    return {
      ok: true,
      engine,
      output: chunks.join("\n").trim(),
      commands
    };
  } catch (error) {
    return {
      ok: false,
      engine,
      error: error instanceof Error ? error.message : String(error),
      output: chunks.join("\n").trim(),
      commands
    };
  }
}
