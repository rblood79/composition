import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("ComponentsPanel canonical projection contract", () => {
  it("uses the canonical-native panel node contract during add", async () => {
    const source = await readFile(
      resolve(__dirname, "ComponentsPanel.tsx"),
      "utf-8",
    );

    expect(source).toContain("getActiveCanonicalDocument");
    expect(source).toContain("collectCanonicalPanelNodes(doc)");
    expect(source).not.toContain("visitCanonicalDocumentElements");
    expect(source).not.toContain("getCanonicalDocumentElementsView");
    expect(source).not.toContain("getComponentsPanelElements");
    expect(source).not.toContain("type { Element }");
    expect(source).not.toContain("const elements = state.elements");
    expect(source).not.toContain(
      "const getPageElements = state.getPageElements",
    );
    expect(source).not.toContain("selectCanonicalDocument");
  });
});
