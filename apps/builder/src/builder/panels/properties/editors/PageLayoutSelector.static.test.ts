import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("PageLayoutSelector frame binding persistence contract", () => {
  it("delegates frame binding writes through the ADR-137 selection consumer contract", async () => {
    const source = await readFile(
      resolve(__dirname, "PageLayoutSelector.tsx"),
      "utf-8",
    );

    expect(source).toContain("readImmediateSelectionSnapshot");
    expect(source).toContain("applyPageFrameBindingFromSelection");
    expect(source).toContain("applyPageFrameBindingExplicit");
    expect(source).toMatch(/readImmediateSelectionSnapshot\(\)/);
    expect(source).not.toContain("applyPageFrameBindingCanonicalPrimary");
    expect(source).not.toMatch(
      /await applyPageFrameBindingFromSelection\(\{\s*pageId,/,
    );
    expect(source).not.toMatch(/LEGACY_LAYOUT_ID_FIELD/);
    expect(source).not.toMatch(/withLegacyLayoutId/);
    expect(source).not.toMatch(/await enqueuePagePersistence/);
    expect(source).not.toMatch(
      new RegExp(
        "await db\\.pages\\.update\\(pageId,\\s*\\{\\s*" + "layout_" + "id:",
      ),
    );
  });

  it("uses active canonical document without rebuilding projection for frame options", async () => {
    const source = await readFile(
      resolve(__dirname, "PageLayoutSelector.tsx"),
      "utf-8",
    );

    expect(source).toContain("useCanonicalReusableFrameLayouts");
    expect(source).not.toContain("selectCanonicalDocument");
    expect(source).not.toContain("useLayoutsStore");
  });
});
