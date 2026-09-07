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

  it("drag delta는 registry/content 재빌드 없이 overlay frame만 갱신한다", async () => {
    const source = await readFile(
      resolve(__dirname, "SkiaCanvas.tsx"),
      "utf-8",
    );
    const start = source.indexOf("// Drag visual presentation");
    const end = source.indexOf("// Drag animation", start);
    const dragPresentationBlock = source.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(dragPresentationBlock).toContain("getDragVisualOffsetRevision()");
    expect(dragPresentationBlock).toContain("overlayVersionRef.current++");
    expect(dragPresentationBlock).not.toContain("renderer.invalidateContent()");
    expect(dragPresentationBlock).not.toContain("notifyLayoutChange()");
    expect(source).toContain(
      "dragPresentationActive: getDragVisualOffset() !== null",
    );
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

  it("matching project revision을 실제 surface 제출 뒤에만 acknowledge한다", async () => {
    const source = await readFile(
      resolve(__dirname, "SkiaCanvas.tsx"),
      "utf-8",
    );

    const renderIndex = source.indexOf("const didPresent = observe(");
    const guardIndex = source.indexOf(
      "if (didPresent && pendingTarget)",
      renderIndex,
    );
    const acknowledgmentIndex = source.indexOf(
      "acknowledgeBootPresentation(currentRendererInput.documentRevision)",
      guardIndex,
    );

    expect(renderIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeGreaterThan(renderIndex);
    expect(acknowledgmentIndex).toBeGreaterThan(guardIndex);
    // 확정은 헬퍼 한 곳이 소유한다 — 호출부가 늘어도 store 계약이 갈리지 않는다.
    expect(source).toContain("lifecycle.acknowledgePresentedFrame({");
    expect(source).toContain(
      "projectId: renderedProjectId,\n        documentRevision,",
    );
    expect(source).toContain("rendererRef.current?.invalidateContent()");
  });

  it("그릴 것이 없는 빈 프레임도 clearFrame 의 실제 flush 로 boot target 을 확정한다", async () => {
    const source = await readFile(
      resolve(__dirname, "SkiaCanvas.tsx"),
      "utf-8",
    );

    // 저장된 viewport 가 화면 밖이면 페이지가 전부 culling 돼 content build 가
    // 빈 프레임을 돌려준다. 그 경로가 readiness 를 확정하지 않으면 bootstrapPhase
    // 가 first-frame(95%)에 영구히 머문다 (2026-09-07 live 재현).
    const emptyBranch = source.indexOf("if (!contentResult) {");
    const clearIndex = source.indexOf("renderer.clearFrame();", emptyBranch);
    const ackIndex = source.indexOf(
      "acknowledgeBootPresentation(currentRendererInput.documentRevision)",
      clearIndex,
    );

    expect(emptyBranch).toBeGreaterThan(-1);
    expect(clearIndex).toBeGreaterThan(emptyBranch);
    expect(ackIndex).toBeGreaterThan(clearIndex);
    // layout 이 아직 안 나온 상태는 결과가 확정되지 않았으므로 계속 기다린다.
    expect(source).toContain('buildOutcome.reason === "no-visible-content"');
  });

  it("빈 프레임은 같은 입력에서 surface 를 다시 지우지 않는다", async () => {
    const source = await readFile(
      resolve(__dirname, "SkiaCanvas.tsx"),
      "utf-8",
    );

    // clearFrame + invalidateContent 를 매 프레임 반복하면 invalidateContent 안의
    // requestCanvasFrame 이 다음 프레임을 다시 예약해 빈 화면에서 flush 가 영원히
    // 돈다 (2026-09-07 실측 120 flush/s). camera/revision 이 키에 들어가야 화면
    // 안으로 돌아왔을 때 콘텐츠가 다시 그려진다.
    expect(source).toContain("let lastEmptyFrameKey: string | null = null;");
    expect(source).toContain("if (emptyFrameKey !== lastEmptyFrameKey) {");
    for (const part of [
      "currentRendererInput.documentRevision",
      "registryVersion",
      "layoutVersion",
      "cameraX",
      "cameraY",
      "cameraZoom",
    ]) {
      expect(
        source.slice(
          source.indexOf("const emptyFrameKey = "),
          source.indexOf("if (emptyFrameKey !== lastEmptyFrameKey) {"),
        ),
        `빈 프레임 키에 ${part} 가 없으면 그 축이 바뀌어도 화면이 빈 채로 남는다`,
      ).toContain(part);
    }
    // 콘텐츠가 다시 그려지면 latch 를 풀어야 다음 빈 상태에서 surface 를 지운다.
    expect(source).toContain("lastEmptyFrameKey = null;");
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
