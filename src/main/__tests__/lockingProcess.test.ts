import { describe, expect, it } from "vitest";
import { lockingProcessArgs, parseLockingProcessOutput } from "../lockingProcess";

describe("parseLockingProcessOutput", () => {
  it("returns null for empty output", () => {
    expect(parseLockingProcessOutput("")).toBeNull();
    expect(parseLockingProcessOutput("\n\n")).toBeNull();
  });

  it("returns a process name", () => {
    expect(parseLockingProcessOutput("notepad")).toBe("notepad");
  });

  it("returns the first non-empty line when there are extra blank lines", () => {
    expect(parseLockingProcessOutput("\r\n\r\nCode\r\n\r\n")).toBe("Code");
  });
});

describe("lockingProcessArgs", () => {
  it("keeps the target path out of the fixed script", () => {
    const args = lockingProcessArgs();
    expect(args[0]).toBe("-NoProfile");
    expect(args[1]).toBe("-NonInteractive");
    expect(args[2]).toBe("-EncodedCommand");
    const script = Buffer.from(args[3], "base64").toString("utf16le");
    expect(script).toContain("rstrtmgr.dll");
    expect(script).toContain("$env:DEVNULLIFIER_LOCK_PATH");
    expect(script).not.toContain("DEVNULLIFIER_LOCK_PATH +");
  });
});
