import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("ComponentsPanel canonical projection contract", () => {
  it("uses active canonical document instead of rebuilding projection during add", async () => {
    const source = await readFile(
      resolve(__dirname, "ComponentsPanel.tsx"),
      "utf-8",
    );

    expect(source).toContain("getActiveCanonicalDocument");
    expect(source).toContain("visitCanonicalDocumentElements");
    expect(source).toContain("getComponentsPanelElements(doc)");
    expect(source).not.toContain("const elements = state.elements");
    expect(source).not.toContain(
      "const getPageElements = state.getPageElements",
    );
    expect(source).not.toContain("selectCanonicalDocument");
  });
});
