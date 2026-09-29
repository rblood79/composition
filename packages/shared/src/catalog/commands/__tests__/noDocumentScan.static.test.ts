import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * ADR-248 §4.1 / Phase 4b: commands read single records and the graph's indexes — never an
 * export or a walk over every entry. A command that needs "all X" uses a project list, an index
 * (`referrersOf`, `instancesOf`, `ownerOf`) or the library.
 */
const DIR = new URL("..", import.meta.url);
const FORBIDDEN = [
  /\.exportDocument\(/,
  /\bdocument\.entries\b/, // CatalogDocument.entries
  /Object\.(values|keys|entries)\(\s*(graph|reader|draft)\b/,
  /collectAffectedIds\(/,
];

describe("ADR-248 Phase 4b commands never scan the document", () => {
  it("has no whole-document read in commands/", () => {
    const files = readdirSync(DIR).filter(
      (file) => file.endsWith(".ts") && !file.endsWith(".test.ts"),
    );
    expect(files.length).toBeGreaterThan(5);
    const hits = files.flatMap((file) =>
      readFileSync(new URL(file, DIR), "utf8")
        .split("\n")
        .map((line, index) => ({ file, line: index + 1, text: line }))
        .filter(({ text }) => FORBIDDEN.some((pattern) => pattern.test(text))),
    );
    expect(hits).toEqual([]);
  });
});
