import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("useTextEdit canonical live edit contract", () => {
  it("routes live text edits through canonical mutation before bootstrap fallback", async () => {
    const source = await readFile(resolve(__dirname, "useTextEdit.ts"), "utf8");

    expect(source).toContain("visitCanonicalDocumentElements");
    expect(source).toContain("getActiveCanonicalTextEditElements");
    expect(source).toContain("mergeElementsCanonicalPrimary([updatedElement])");
    expect(source).toContain(
      "if (result.changed || getActiveCanonicalTextEditElements()) return;",
    );
    expect(source).toContain("applyLegacyBootstrapTextProp(updatedElement)");
    expect(source).not.toContain("canonicalElementSnapshot");
    expect(source).not.toContain("useStore.getState().elements.find");
    expect(source).not.toContain("state.elementsMap.get(elementId)");
    expect(source).not.toContain("useStore.getState().elementsMap.get");
    expect(source).not.toContain("new Map(state.elementsMap)");
  });
});
