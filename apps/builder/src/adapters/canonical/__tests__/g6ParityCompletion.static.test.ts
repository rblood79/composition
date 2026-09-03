import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ADR-116 G6-3 Slot/Ref/Descendants/Frame parity completion contract", () => {
  it("keeps native mutation, resolver, navigation, and frame binding wiring", async () => {
    const [
      mutationsSource,
      resolverSource,
      componentSectionSource,
      pageFrameBindingSource,
      frameMirrorSource,
      pageLayoutSelectorSource,
      framesTabSource,
    ] = await Promise.all([
      readFile(resolve(__dirname, "../canonicalMutations.ts"), "utf-8"),
      readFile(
        resolve(__dirname, "../../../resolvers/canonical/index.ts"),
        "utf-8",
      ),
      readFile(
        resolve(
          __dirname,
          "../../../builder/panels/properties/ComponentSemanticsSection.tsx",
        ),
        "utf-8",
      ),
      readFile(resolve(__dirname, "../pageFrameBinding.ts"), "utf-8"),
      readFile(resolve(__dirname, "../frameMirror.ts"), "utf-8"),
      readFile(
        resolve(
          __dirname,
          "../../../builder/panels/properties/editors/PageLayoutSelector.tsx",
        ),
        "utf-8",
      ),
      readFile(
        resolve(
          __dirname,
          "../../../builder/panels/navigator/FramesTab/FramesTab.tsx",
        ),
        "utf-8",
      ),
    ]);

    expect(mutationsSource).toContain("findSlotPathForPageRef");
    expect(mutationsSource).toContain("descendants[slotPath]");
    expect(mutationsSource).toContain("appendChildToDescendants");
    expect(mutationsSource).toContain("removeNodeFromDescendants");
    expect(resolverSource).toContain("type: master.type");
    expect(resolverSource).toContain("_resolvedFrom: master.id");
    expect(componentSectionSource).toMatch(/resolveReference\(\s*originId,/);
    expect(componentSectionSource).toContain(
      "getEditingSemanticsImpactInstanceIds",
    );
    expect(pageFrameBindingSource).toContain("resolvePageFrameRefId");
    expect(pageFrameBindingSource).toContain("getReusableFrameMirrorId(frame)");
    expect(frameMirrorSource).toContain("getReusableFrameMirrorId");
    expect(pageLayoutSelectorSource).toContain("getPageFrameBindingId");
    expect(framesTabSource).toContain("useCanonicalReusableFrameLayouts");
  });
});
