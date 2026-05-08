import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("useCanonicalPropertyRead", () => {
  it("derives property lookup maps from canonical/store elements instead of store maps", async () => {
    const source = await readFile(
      resolve(__dirname, "useCanonicalPropertyRead.ts"),
      "utf-8",
    );
    const directElementMapFallback = ["state.", "elements", "Map.get"].join("");
    const directChildrenMapFallback = ["state.", "children", "Map"].join("");

    expect(source).toContain("useCanonicalElements");
    expect(source).toContain("useCanonicalPropertySourceElements");
    expect(source).toContain("const { elements: legacyElements } = state;");
    expect(source).toContain("return legacyElements ?? EMPTY_ELEMENTS;");
    expect(source).toContain("buildElementsMap(sourceElements)");
    expect(source).toContain("buildChildrenMap(sourceElements)");
    expect(source).not.toContain(directElementMapFallback);
    expect(source).not.toContain(directChildrenMapFallback);
  });
});
