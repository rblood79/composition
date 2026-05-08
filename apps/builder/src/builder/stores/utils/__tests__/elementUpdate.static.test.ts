import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("elementUpdate canonical read fallback contract", () => {
  it("uses active canonical elements before bootstrap store elements for mutation reads", async () => {
    const source = await readFile(
      resolve(__dirname, "../elementUpdate.ts"),
      "utf-8",
    );

    expect(source).toContain("getActiveCanonicalDocumentElements");
    expect(source).toContain("function getElementUpdateSourceElements");
    expect(source).toContain("function buildElementUpdateLookup");
    expect(source).toContain("function buildElementUpdateChildrenByParent");
    expect(source).toContain(
      "return getActiveCanonicalDocumentElements() ?? legacyElements",
    );
    expect(source).toContain("buildElementUpdateLookup(sourceElements)");
    expect(source).toContain(
      "buildElementUpdateChildrenByParent(sourceElements)",
    );
    expect(source).not.toContain("buildElementUpdateLookup(state.elements)");
    expect(source).not.toContain(
      "buildElementUpdateChildrenByParent(state.elements)",
    );

    const staleStateElementMap = ["state", ["elements", "Map"].join("")].join(
      ".",
    );
    const staleCurrentStateElementMap = [
      "currentState",
      ["elements", "Map"].join(""),
    ].join(".");
    const staleCurrentStateChildMap = [
      "currentState",
      ["children", "Map"].join(""),
    ].join(".");
    expect(source).not.toContain(staleStateElementMap);
    expect(source).not.toContain(staleCurrentStateElementMap);
    expect(source).not.toContain(staleCurrentStateChildMap);
    const staleHelper = ["get", "Element", "By", "Id"].join("");
    expect(source).not.toContain(staleHelper);
  });
});
