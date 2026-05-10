import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("inspectorActions canonical lookup contract", () => {
  it("does not feed mutable elementsMap into inspector canonical lookup fallback", async () => {
    const source = await readFile(
      resolve(__dirname, "inspectorActions.ts"),
      "utf-8",
    );

    expect(source).toContain("visitCanonicalDocumentElements");
    expect(source).toContain("getActiveCanonicalInspectorElements");
    expect(source).toContain("type InspectorElementMap");
    expect(source).toContain("type InspectorChildrenMap");
    expect(source).not.toContain("canonicalElementSnapshot");
    expect(source).toContain(
      "function getInspectorLookupElements(\n  fallbackElements: Iterable<Element> = [],\n)",
    );
    expect(source).toContain("return canonicalElements ?? fallbackElements");
    expect(source).not.toContain("getInspectorLookupElements(get().elements)");
    expect(source).toContain("getInspectorLookupElements(elements)");
    expect(source).not.toContain(
      "getInspectorLookupElements(get().elementsMap)",
    );
    expect(source).not.toContain("getInspectorLookupElements(elementsMap)");
    expect(source).not.toContain(
      "function buildInspectorElementMap(\n  elements: Iterable<Element>,\n): Map<string, Element>",
    );
    expect(source).not.toContain(
      "function buildInspectorChildrenByParent(\n  elements: Iterable<Element>,\n): Map<string, Element[]>",
    );
    expect(source).not.toContain("elementsMap: Map<string, Element>;");
    expect(source).not.toContain("childrenMap: Map<string, Element[]>;");
  });
});
