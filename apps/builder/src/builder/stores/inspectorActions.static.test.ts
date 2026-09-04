import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("inspectorActions canonical lookup contract", () => {
  it("uses canonical leaf lookup without rebuilding full Element collections", async () => {
    const source = await readFile(
      resolve(__dirname, "inspectorActions.ts"),
      "utf-8",
    );

    expect(source).toContain("getFirstProjectableNodeLookupById");
    expect(source).toContain("getFirstProjectableNodeLookupByReference");
    expect(source).toContain("projectCanonicalInspectorElement");
    expect(source).toContain("getActiveCanonicalInspectorElementById");
    expect(source).toContain("type InspectorElementMap");
    expect(source).toContain("type InspectorChildrenMap");
    expect(source).not.toContain("canonicalElementSnapshot");
    expect(source).not.toContain("visitCanonicalDocumentElements");
    expect(source).not.toContain("getActiveCanonicalInspectorElements");
    expect(source).not.toContain("getInspectorLookupElements");
    expect(source).toContain("getInspectorUpdateSource");
    expect(source).toContain("getActiveCanonicalDocumentElements");
    expect(source).toContain("canonical target은");
    expect(source).toContain("currentElement: canonicalElement.element");
    expect(source).not.toContain("restoredElementsMap.get(elementId)");
    expect(source).not.toContain("buildInspectorChildrenByParent");
    expect(source).toContain(
      "const newElementsMap = new Map(source.elementsMap)",
    );
    expect(source).toContain("prevState.childrenMap");
    expect(source).not.toContain("elementsMap: Map<string, Element>;");
    expect(source).not.toContain("childrenMap: Map<string, Element[]>;");
  });
});
