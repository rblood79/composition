import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("canvasStore canonical selected element contract", () => {
  it("derives current page canvas elements from canonical elements before page snapshot fallback", async () => {
    const source = await readFile(
      resolve(__dirname, "canvasStore.ts"),
      "utf-8",
    );

    expect(source).toContain("const currentPageId = useStore");
    expect(source).toContain(
      "canonicalElements || !currentPageId\n      ? EMPTY_ELEMENTS",
    );
    expect(source).toContain(
      "canonicalElements.filter((element) => element.page_id === currentPageId)",
    );
  });

  it("derives selected element from canonical elements before store fallback", async () => {
    const source = await readFile(
      resolve(__dirname, "canvasStore.ts"),
      "utf-8",
    );
    const directElementMapLookup = [
      "state.",
      "elements",
      "Map.get(state.selectedElementId)",
    ].join("");

    expect(source).toContain("useCanonicalElements");
    expect(source).toContain(
      "const sourceElements = canonicalElements ?? storeElements",
    );
    expect(source).not.toContain(directElementMapLookup);
  });
});
