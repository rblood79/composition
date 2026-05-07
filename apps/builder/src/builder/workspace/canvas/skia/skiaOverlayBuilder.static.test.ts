import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("skiaOverlayBuilder slot placeholder chrome contract", () => {
  it("renders slot hatch only through empty slot marker targets, not hover/selection", async () => {
    const source = await readFile(
      resolve(__dirname, "skiaOverlayBuilder.ts"),
      "utf-8",
    );

    const hatchCalls = source.match(/renderSlotHatchPattern\(/g) ?? [];
    expect(hatchCalls).toHaveLength(1);
    expect(source).toContain("target.semanticRole ?? target.slotMarkerRole");
    expect(source).toContain(
      "selectionData.semanticRole ?? selectionData.slotMarkerRole",
    );
  });
});

describe("skiaOverlayBuilder drag hover suppression contract", () => {
  it("does not render element hover highlights while drop indicator is active", async () => {
    const source = await readFile(
      resolve(__dirname, "skiaOverlayBuilder.ts"),
      "utf-8",
    );

    expect(source).toContain("if (!dropIndicatorState) {");
    const hoverBlock = source.match(
      /if \(!dropIndicatorState\) \{[\s\S]*?const hoverTargets = buildHoverHighlightTargets[\s\S]*?renderOverflowContent\([\s\S]*?\);\s*\}\s*\}/,
    );
    expect(hoverBlock).not.toBeNull();
  });
});

describe("skiaOverlayBuilder frame title contract", () => {
  it("renders frame titles from frameAreas without registering page title hit bounds", async () => {
    const source = await readFile(
      resolve(__dirname, "skiaOverlayBuilder.ts"),
      "utf-8",
    );

    expect(source).toContain("buildFrameTitleRenderItems(");
    expect(source).toContain("frameAreas?: FrameAreaGroup[];");
    expect(source).toContain("Page title drag 동작과 섞이면 안 된다.");

    const frameTitleBlock = source.match(
      /const frameTitleItems = buildFrameTitleRenderItems\([\s\S]*?for \(const item of frameTitleItems\) \{[\s\S]*?renderPageTitle\([\s\S]*?\);[\s\S]*?\}/,
    );

    expect(frameTitleBlock).not.toBeNull();
    expect(frameTitleBlock?.[0]).not.toContain("pageTitleBoundsMap.set");
  });
});
