import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("SkiaCanvas render invalidation contract", () => {
  it("invalidates content and command stream cache when rendererInput changes", async () => {
    const source = await readFile(
      resolve(__dirname, "SkiaCanvas.tsx"),
      "utf-8",
    );

    expect(source).toMatch(
      /import \{[\s\S]*invalidateCommandStreamCache,[\s\S]*\} from "\.\/renderCommands";/,
    );

    const effectBlock = source.match(
      /useEffect\(\(\) => \{[\s\S]*?rendererInputRef\.current = rendererInput;[\s\S]*?storeRenderBridgeRef\.current\?\.sync\([\s\S]*?invalidateCommandStreamCache\(\);[\s\S]*?\}, \[rendererInput\]\);/,
    );

    expect(
      effectBlock,
      "rendererInput 변경 시 Skia content/cache invalidation effect 가 필요합니다.",
    ).not.toBeNull();
  });

  it("keeps subtree damage scoped to the matching canonical revision", async () => {
    const source = await readFile(
      resolve(__dirname, "SkiaCanvas.tsx"),
      "utf-8",
    );

    expect(source).toContain("pendingDamageRevisionRef");
    expect(source).toContain("syncResult.damageRevision");
    expect(source).toContain("syncResult.damageBounds");
    expect(source).toContain("isRedundantDamageInvalidation");
  });

  it("invalidates the content cache when page position presentation changes", async () => {
    const source = await readFile(
      resolve(__dirname, "SkiaCanvas.tsx"),
      "utf-8",
    );

    expect(source).toContain("subscribePagePositionPresentation");
    expect(source).toMatch(
      /subscribePagePositionPresentation\(\(\) => \{[\s\S]*?getPagePositionPresentationSnapshot\(\)\.version;[\s\S]*?rendererRef\.current\?\.invalidateContent\(\);[\s\S]*?overlayVersionRef\.current\+\+;/,
    );
  });

  it("sibling drag animation은 registry가 아닌 content presentation만 갱신한다", async () => {
    const source = await readFile(
      resolve(__dirname, "SkiaCanvas.tsx"),
      "utf-8",
    );
    const start = source.indexOf("// Drag animation");
    const end = source.indexOf("// Content build", start);
    const dragAnimationBlock = source.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(dragAnimationBlock).toContain("getDragSiblingOffsetRevision()");
    expect(dragAnimationBlock).toContain("renderer.invalidateContent()");
    expect(dragAnimationBlock).not.toContain("notifyLayoutChange()");
  });

  it("publishes the exact camera/page snapshot from the Skia render frame", async () => {
    const source = await readFile(
      resolve(__dirname, "SkiaCanvas.tsx"),
      "utf-8",
    );

    expect(source).toContain('from "../canvasFramePresentation"');
    expect(source).toContain(
      "publishCanvasFramePresentation(cameraState, pagePositionSnapshot);",
    );

    const presentationIndex = source.indexOf(
      "publishCanvasFramePresentation(cameraState, pagePositionSnapshot);",
    );
    const renderIndex = source.indexOf("renderer.render(", presentationIndex);
    expect(presentationIndex).toBeGreaterThan(-1);
    expect(renderIndex).toBeGreaterThan(presentationIndex);
  });

  it("feeds StoreRenderBridge from page-resolved rendererInput maps", async () => {
    const source = await readFile(
      resolve(__dirname, "SkiaCanvas.tsx"),
      "utf-8",
    );

    expect(source).toContain(
      "getElements: () => rendererInputRef.current.renderNodesMap,",
    );
    expect(source).toContain(
      "getChildrenMap: () => rendererInputRef.current.childrenMap,",
    );
    expect(source).toContain("rendererInput.renderNodesMap,");
    expect(source).toContain("rendererInput.childrenMap,");
    expect(source).toContain(
      "getHoverElementsMap: () => rendererInputRef.current.interactionNodesMap,",
    );
    expect(source).toContain(
      "getHoverChildrenMap: () => rendererInputRef.current.interactionChildrenMap,",
    );
    expect(source).toContain(
      "getScrollElementsMap: () => rendererInputRef.current.interactionNodesMap,",
    );
    expect(source).not.toContain(
      "getElements: () => useStore.getState().elementsMap,",
    );
    expect(source).not.toContain(
      "getChildrenMap: () => useStore.getState().childrenMap,",
    );
    expect(source).toContain("storeRenderBridgeRef.current?.sync(");
    expect(source).toContain("rendererInput.projectionVersion");
    expect(source).toContain(
      "getProjectionVersion: () => rendererInputRef.current.projectionVersion,",
    );
    expect(source).not.toContain(
      "let prevElements = useStore.getState().elementsMap;",
    );
    expect(source).not.toContain(
      "let prevChildren = useStore.getState().childrenMap;",
    );
    expect(source).not.toContain("state.elementsMap !== prevElements");
    expect(source).not.toContain("state.childrenMap !== prevChildren");
  });

  it("uses frameAreas for frame titles and suppresses page titles in layout mode", async () => {
    const source = await readFile(
      resolve(__dirname, "SkiaCanvas.tsx"),
      "utf-8",
    );

    expect(source).toContain(
      "const frameAreasRef = useRef(rendererInput.frameAreas);",
    );
    expect(source).toContain(
      "frameAreasRef.current = rendererInput.frameAreas;",
    );
    expect(source).toContain("frameAreas: frameAreasRef.current,");
    expect(source).toContain('currentRendererInput.editMode === "layout"');
  });
});
