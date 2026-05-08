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

describe("skiaOverlayBuilder page/frame border contract", () => {
  it("renders page and frame borders as visual-only overlay chrome using the shared border token", async () => {
    const source = await readFile(
      resolve(__dirname, "skiaOverlayBuilder.ts"),
      "utf-8",
    );
    const workflowRendererSource = await readFile(
      resolve(__dirname, "workflowRenderer.ts"),
      "utf-8",
    );

    expect(source).toContain("renderFrameAreaBorder(");
    expect(source).toContain('getCSSVariable("--border")');

    const pageFramesBlock = source.match(
      /const frames = visiblePageFrames \?\? \[\];[\s\S]*?const pageTitleItems = buildPageTitleRenderItems/,
    );
    expect(pageFramesBlock).not.toBeNull();
    expect(pageFramesBlock?.[0]).toContain("renderFrameAreaBorder(");

    const frameAreasBlock = source.match(
      /const reusableFrameAreas = frameAreas \?\? \[\];[\s\S]*?const frameTitleItems = buildFrameTitleRenderItems/,
    );
    expect(frameAreasBlock).not.toBeNull();
    expect(frameAreasBlock?.[0]).toContain("renderFrameAreaBorder(");
    expect(frameAreasBlock?.[0]).toContain("reusableFrameAreas");

    expect(workflowRendererSource).toContain(
      "export function renderFrameAreaBorder(",
    );
    expect(workflowRendererSource).toContain(
      "const strokeWidth = FRAME_AREA_BORDER_STROKE_WIDTH / safeZoom;",
    );
    expect(workflowRendererSource).toContain(
      "const halfStroke = strokeWidth / 2;",
    );
    expect(workflowRendererSource).toContain("frame.x - halfStroke");
    expect(workflowRendererSource).toContain("frame.width + strokeWidth");
    expect(workflowRendererSource).toContain(
      "canvas.drawRect(rect, borderPaint);",
    );
    expect(workflowRendererSource).not.toContain("pageFrameMap.set(");
  });
});
