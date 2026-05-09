import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("elementRemoval canonical read fallback contract", () => {
  it("collects removal targets from active canonical elements before bootstrap store elements", async () => {
    const source = await readFile(
      resolve(__dirname, "../elementRemoval.ts"),
      "utf-8",
    );

    expect(source).toContain("getActiveCanonicalDocumentElements");
    expect(source).toContain("function getElementRemovalSourceElements");
    expect(source).toContain(
      "return getActiveCanonicalDocumentElements() ?? legacyElements",
    );
    expect(source).toContain("function collectElementsToRemove");
    expect(source).toContain(
      "collectElementsToRemove(elementId, sourceElements)",
    );
    expect(source).toContain("collectElementsToRemove(id, sourceElements)");
    expect(source).not.toContain(
      "collectElementsToRemove(elementId, state.elements)",
    );
    expect(source).not.toContain("collectElementsToRemove(id, state.elements)");

    const staleStateElementMap = ["state", ["elements", "Map"].join("")].join(
      ".",
    );
    const staleStateChildMap = ["state", ["children", "Map"].join("")].join(
      ".",
    );
    expect(source).not.toContain(staleStateElementMap);
    expect(source).not.toContain(staleStateChildMap);
  });

  it("removes nodes from canonical document before updating the derived store cache", async () => {
    const source = await readFile(
      resolve(__dirname, "../elementRemoval.ts"),
      "utf-8",
    );

    const canonicalSyncIndex = source.indexOf(
      "syncRemovedElementsToCanonical(updatedElements);",
    );
    const storeCacheIndex = source.indexOf(
      "set((state) => ({\n    elements: updatedElements,",
    );
    expect(canonicalSyncIndex).toBeGreaterThanOrEqual(0);
    expect(storeCacheIndex).toBeGreaterThanOrEqual(0);
    expect(canonicalSyncIndex).toBeLessThan(storeCacheIndex);
  });
});
