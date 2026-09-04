import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("useTextEdit canonical live edit contract", () => {
  it("routes live text edits through canonical mutation before bootstrap fallback", async () => {
    const source = await readFile(resolve(__dirname, "useTextEdit.ts"), "utf8");

    expect(source).toContain("getActiveCanonicalElementById");
    expect(source).toContain("hasActiveCanonicalTextEditDocument");
    expect(source).toContain("editingElementRef");
    expect(source).toContain("updateCanonicalNodePropsPrimary(");
    expect(source).toContain("updatedElement.props");
    expect(source).not.toContain("mergeElementsCanonicalPrimary");
    expect(source).toContain(
      "result.changed || hasActiveCanonicalTextEditDocument()",
    );
    expect(source).toContain("applyLegacyBootstrapTextProp(updatedElement)");
    expect(source).not.toContain("visitCanonicalDocumentElements");
    expect(source).not.toContain("getActiveCanonicalTextEditElements");
    expect(source).not.toContain("getTextEditElement(elementId, newValue)");
    expect(source).not.toContain("canonicalElementSnapshot");
    expect(source).not.toContain("useStore.getState().elements.find");
    expect(source).toContain("useStore.getState().elementsMap.get(elementId)");
    expect(source).toContain("new Map(state.elementsMap)");
    expect(source).not.toContain("legacyElements");
    expect(source).not.toContain("findIndex(");
    expect(source).not.toContain("new Map(nextElements.map");
  });
});
