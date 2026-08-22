import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("ADR-188 G2 publication boundary", () => {
  it("keeps targeted publication independent of the full layout publisher", async () => {
    const source = await readFile(
      resolve(__dirname, "editorLayoutPublication.ts"),
      "utf8",
    );

    expect(source).toContain('kind: "canonical-full"');
    expect(source).toContain('kind: "presentation-targeted"');
    expect(source).toContain("baseCanonicalRevision");
    expect(source).toContain("presentationRevision");
    expect(source).toContain("planSequence");
    expect(source).not.toContain("getSharedLayoutMap");
    expect(source).not.toContain("onLayoutPublished");
    expect(source).not.toContain("resync(true)");
    expect(source).not.toContain("new Map(input.previousLayoutMap)");
    expect(source).not.toContain("new Map(base)");
  });
});
