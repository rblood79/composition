import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("useCanonicalPropertyRead", () => {
  it("reads a single property element without materializing the full canonical view", async () => {
    const source = await readFile(
      resolve(__dirname, "useCanonicalPropertyRead.ts"),
      "utf-8",
    );

    const elementHook = source.slice(
      source.indexOf("export function useCanonicalPropertyElement("),
      source.indexOf("export function useCanonicalPropertyElementsMap("),
    );

    expect(elementHook).toContain("getActiveCanonicalElementById(elementId)");
    expect(elementHook).not.toContain("useCanonicalPropertySourceElements()");
    expect(elementHook).not.toContain("getCanonicalDocumentElementsView(");
  });

  it("derives aggregate property lookups from one canonical-native shared index", async () => {
    const source = await readFile(
      resolve(__dirname, "useCanonicalPropertyRead.ts"),
      "utf-8",
    );
    const indexSource = await readFile(
      resolve(__dirname, "canonicalPropertyReadIndex.ts"),
      "utf-8",
    );
    const directElementMapFallback = ["state.", "elements", "Map.get"].join("");
    const directChildrenMapFallback = ["state.", "children", "Map"].join("");

    expect(source).toContain("useActiveCanonicalDocument");
    expect(source).toContain("getCanonicalPropertyReadIndex");
    expect(source).toContain("useCanonicalPropertyAggregateIndex");
    expect(source).not.toContain("useCanonicalElements()");
    expect(source).not.toContain("getCanonicalDocumentElementsView");
    expect(source).not.toContain("visitCanonicalDocumentElements");
    expect(source).not.toContain("useStore");
    expect(source).not.toContain("legacyElements");
    expect(source).toContain("EMPTY_PROPERTY_READ_INDEX");
    expect(indexSource).toContain("getProjectableNodeLookups()");
    expect(indexSource).toContain("canonicalIndexCache");
    expect(indexSource).not.toContain("getCanonicalDocumentElementsView");
    expect(indexSource).not.toContain("visitCanonicalDocumentElements");
    expect(indexSource).not.toContain("type { Element }");
    expect(source).not.toContain(directElementMapFallback);
    expect(source).not.toContain(directChildrenMapFallback);
  });
});
