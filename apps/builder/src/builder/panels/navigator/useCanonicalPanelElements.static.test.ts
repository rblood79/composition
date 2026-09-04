import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("useCanonicalPanelElements", () => {
  it("uses the canonical-native panel node collector", async () => {
    const source = await readFile(
      resolve(__dirname, "useCanonicalPanelElements.ts"),
      "utf-8",
    );

    expect(source).toContain("useActiveCanonicalDocument");
    expect(source).toContain("collectCanonicalPanelNodes(canonicalDocument)");
    expect(source).not.toContain("visitCanonicalDocumentElements");
    expect(source).not.toContain("getCanonicalDocumentElementsView");
    expect(source).not.toContain("useCanonicalElements");
  });
});
