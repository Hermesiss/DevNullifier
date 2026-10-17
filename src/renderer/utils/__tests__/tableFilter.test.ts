import { describe, it, expect } from "vitest";
import { matchesCategory, matchesPathQuery } from "../tableFilter";

describe("matchesPathQuery", () => {
  it("matches every path when the query is empty or whitespace", () => {
    expect(matchesPathQuery("C:\\Users\\Cache", "")).toBe(true);
    expect(matchesPathQuery("C:\\Users\\Cache", "   ")).toBe(true);
    expect(matchesPathQuery("", "")).toBe(true);
  });

  it("matches a case-insensitive substring of the path", () => {
    expect(matchesPathQuery("C:\\Users\\Cache\\npm", "cache")).toBe(true);
    expect(matchesPathQuery("C:\\Users\\Cache\\npm", "NPM")).toBe(true);
    expect(matchesPathQuery("/home/dev/.cache/pip", " .Cache/ ")).toBe(true);
  });

  it("rejects a path that does not contain the query", () => {
    expect(matchesPathQuery("C:\\Users\\Cache\\npm", "missing")).toBe(false);
    expect(matchesPathQuery("", "cache")).toBe(false);
  });
});

describe("matchesCategory", () => {
  it("matches every value when the category is empty or whitespace", () => {
    expect(matchesCategory(undefined, "")).toBe(true);
    expect(matchesCategory(null, "")).toBe(true);
    expect(matchesCategory("Node.js", "   ")).toBe(true);
    expect(matchesCategory("", "")).toBe(true);
  });

  it("matches a single value case-insensitively", () => {
    expect(matchesCategory("cache", "cache")).toBe(true);
    expect(matchesCategory("Cache", "cache")).toBe(true);
    expect(matchesCategory("cache", "Cache")).toBe(true);
    expect(matchesCategory("temp", "cache")).toBe(false);
  });

  it("matches one trimmed part of a comma-separated list", () => {
    expect(matchesCategory("Node.js, Unity", "Unity")).toBe(true);
    expect(matchesCategory("Node.js, Unity", "node.js")).toBe(true);
    expect(matchesCategory("Node.js,Unity", "Unity")).toBe(true);
    expect(matchesCategory("Node.js, Unity", "Rust")).toBe(false);
  });

  it("matches the whole value when the category itself contains a comma", () => {
    expect(matchesCategory("Node.js, Unity", "Node.js, Unity")).toBe(true);
    expect(matchesCategory("Node.js, Unity", "node.js, unity")).toBe(true);
  });

  it("does not match a missing value against a chosen category", () => {
    expect(matchesCategory(undefined, "cache")).toBe(false);
    expect(matchesCategory(null, "Unity")).toBe(false);
    expect(matchesCategory("", "Unity")).toBe(false);
  });
});
