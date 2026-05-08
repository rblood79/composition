import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("useComponentMemory canonical read contract", () => {
  it("derives monitor maps from canonical elements before store fallback", async () => {
    const source = await readFile(
      resolve(__dirname, "useComponentMemory.ts"),
      "utf-8",
    );

    expect(source).toContain("useCanonicalElements");
    expect(source).toContain("if (canonicalElements) return EMPTY_ELEMENTS;");
    expect(source).toContain("const { elements: legacyElements } = state;");
    expect(source).toContain("return legacyElements ?? EMPTY_ELEMENTS;");
    expect(source).toContain(
      "const analysisElements = canonicalElements ?? storeElements",
    );
    expect(source).toContain("buildElementMap(analysisElements)");
    expect(source).toContain("buildChildLookup(analysisElements)");
    expect(source).not.toContain(
      ["useStore((state) => state.", "elements", "Map)"].join(""),
    );
    expect(source).not.toContain(
      ["useStore((state) => state.", "children", "Map)"].join(""),
    );
    expect(source).not.toContain(["state", "elementsMap.size"].join("."));
  });
});
