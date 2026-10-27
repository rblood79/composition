import { describe, expect, it } from "vitest";
import { codeEditorLineChanges } from "../CodeEditor";

/** ADR-285 — a snippet writes only the lines that differ (unchanged lines keep their identity). */
const apply = (
  text: string,
  changes: readonly { from: number; to: number; insert: string }[],
) =>
  [...changes]
    .reverse()
    .reduce(
      (out, change) =>
        out.slice(0, change.from) + change.insert + out.slice(change.to),
      text,
    );

describe("codeEditorLineChanges", () => {
  it.each([
    ["a\nb\nc\n", "a\nx\nb\nc\n"],
    ["a\nb\nc\n", "a\nc\n"],
    ["a\nb\nc", "z\na\nb\nc\nd"],
    ["import x;\n\nfn() {\n  <A/>\n}\n", "import x, y;\n\nfn() {\n  let s;\n  <B/>\n  <A/>\n}\n"],
    ["", "a\n"],
    ["a\n", ""],
  ])("%j → %j", (before, after) => {
    const changes = codeEditorLineChanges(before, after);
    expect(apply(before, changes)).toBe(after);
    for (let index = 1; index < changes.length; index += 1)
      expect(changes[index]!.from).toBeGreaterThanOrEqual(changes[index - 1]!.to);
  });

  it("an unchanged line is outside every change", () => {
    const changes = codeEditorLineChanges("a\nkeep\nb\n", "x\nkeep\ny\n");
    const keep = "a\n".length;
    expect(
      changes.some((change) => change.from <= keep && change.to > keep),
    ).toBe(false);
  });
});
