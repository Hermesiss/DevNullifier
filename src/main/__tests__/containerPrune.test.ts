import { describe, expect, it, vi } from "vitest";
import { pruneCommandPlan, pruneContainerEngine } from "../containerPrune";

describe("pruneCommandPlan", () => {
  it("never includes --volumes", () => {
    for (const engine of ["docker", "podman"] as const) {
      for (const args of pruneCommandPlan(engine)) {
        expect(args).not.toContain("--volumes");
        expect(args.join(" ")).not.toMatch(/--volumes/);
      }
    }
  });

  it("uses docker system prune and builder prune", () => {
    expect(pruneCommandPlan("docker")).toEqual([
      ["system", "prune", "-f"],
      ["builder", "prune", "-f"]
    ]);
  });
});

describe("pruneContainerEngine", () => {
  it("fails when the binary is missing", async () => {
    const result = await pruneContainerEngine("docker", {
      which: async () => false,
      execFile: vi.fn()
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not found/i);
    expect(result.commands[0]).toBe("docker system prune -f");
  });

  it("runs both docker prune commands when present", async () => {
    const execFile = vi.fn(async (_file: string, args: string[]) => ({
      stdout: `ok ${args.join(" ")}`,
      stderr: ""
    }));
    const result = await pruneContainerEngine("docker", {
      which: async () => true,
      execFile
    });
    expect(result.ok).toBe(true);
    expect(execFile).toHaveBeenCalledTimes(2);
    expect(execFile.mock.calls[0][1]).toEqual(["system", "prune", "-f"]);
    expect(execFile.mock.calls[1][1]).toEqual(["builder", "prune", "-f"]);
    expect(result.output).toContain("ok system prune -f");
  });
});
