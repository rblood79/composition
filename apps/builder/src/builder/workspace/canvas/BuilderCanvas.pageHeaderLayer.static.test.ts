import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ADR-221 배선 정적 가드 (breakdown §7 "BuilderCanvas 정적 가드").
 * - 게이트 신호: `ViewportControlBridge` 마운트가 `onInteractionStart/End` 를 전달한다
 *   (round 1 h2 — 이전에는 dead prop 이었다).
 * - 헤더 층 마운트 1 + 히트 핸들러 props (drag/shift · 이름 편집).
 * - capture 가드: pointerdown capture 는 `[data-page-header]` 자손이면 즉시 return (Decision 4).
 *   dblclick capture 와 Skia 타이틀 bounds 순회는 없다 (Phase 2 이관).
 */
async function read(path: string): Promise<string> {
  return readFile(resolve(__dirname, path), "utf-8");
}

describe("BuilderCanvas — 페이지 헤더 DOM 층 배선", () => {
  it("ViewportControlBridge 에 게이트 신호 2개를 넘기고 PageHeaderLayer 를 1회 마운트한다", async () => {
    const source = await read("BuilderCanvas.tsx");
    const bridge = source.match(/<ViewportControlBridge[\s\S]*?\/>/);
    expect(bridge).not.toBeNull();
    expect(bridge?.[0]).toContain(
      "onInteractionStart={handleCameraGestureStart}",
    );
    expect(bridge?.[0]).toContain("onInteractionEnd={handleCameraGestureEnd}");
    expect(source).toContain("setCameraGestureActive(true)");
    expect(source).toContain("setCameraGestureActive(false)");

    expect(source.match(/<PageHeaderLayer\b/g)?.length).toBe(1);
    const mount = source.match(/<PageHeaderLayer[\s\S]*?\/>/);
    expect(mount?.[0]).toContain(
      "frames={sceneStructureSnapshot.document.visiblePageFrames}",
    );
    expect(mount?.[0]).toContain(
      "onHeaderPointerDown={handleHeaderPointerDown}",
    );
    expect(mount?.[0]).toContain("canRenamePage={canRenamePage}");
    expect(mount?.[0]).toContain("onBeginRename={setCurrentPageId}");
    expect(mount?.[0]).toContain("onRenamePage={renamePageTitle}");
  });

  it("pointerdown capture 는 헤더 자손이면 Skia 선판정 전에 return 하고, 타이틀 bounds 순회·dblclick capture 는 없다", async () => {
    const source = await read("BuilderCanvas.tsx");
    const capture = source.match(
      /const onPointerDownCapture = \(event: PointerEvent\) => \{[\s\S]*?\n    \};/,
    );
    expect(capture).not.toBeNull();
    const body = capture?.[0] ?? "";
    // 가드 문장 자체 (주석 처리·조건 변형이면 실패)
    expect(body).toContain("if (isPageHeaderEventTarget(event.target)) return;");
    // 눈금자 가드 다음, 프레임 편집 모드 판정보다 앞
    expect(
      body.indexOf("isPageHeaderEventTarget(event.target)"),
    ).toBeGreaterThan(body.indexOf("isRulerEventTarget(event.target)"));
    expect(body.indexOf("isPageHeaderEventTarget(event.target)")).toBeLessThan(
      body.indexOf("if (isFrameEditMode) return;"),
    );
    expect(source).not.toContain("pageTitleBoundsMapRef");
    expect(source).not.toContain("onDoubleClickCapture");
    expect(source).not.toContain('addEventListener("dblclick"');
    expect(source).not.toContain("resolvePageTitleEditorRect");
    expect(source).not.toContain('className="page-title-edit-input"');
  });

  it("헤더 핸들러는 스페이스 pan 에 양보하고, 잡으면 __handled 로 중앙 핸들러를 막는다", async () => {
    const source = await read("BuilderCanvas.tsx");
    const handler = source.match(
      /const handleHeaderPointerDown = useCallback\([\s\S]*?\n  \);/,
    );
    expect(handler).not.toBeNull();
    const body = handler?.[0] ?? "";
    expect(body).toContain("canvasGestureSession.spacePressed) return;");
    expect(body).toContain("tryClaimPage(");
    expect(body).toContain("promoteElementToPage(");
    expect(body).toContain("guarded.__handled = true;");
    expect(body).toMatch(/startPageDrag\(\s*pageId,\s*event\.pointerId,\s*event\.clientX,\s*event\.clientY,?\s*\)/);
    // 헤더 자체 핸들러에서 stopPropagation 하면 pan 리스너 (bubble) 가 죽는다 — 금지
    expect(body).not.toContain("stopPropagation");
  });

  it("이름 편집기는 헤더 노드 안 (PageHeaderLayer.css, 700) — Workspace.css 의 구 편집기 규칙은 없다", async () => {
    const layerCss = await read("overlay/pageHeader/PageHeaderLayer.css");
    const workspaceCss = await read("../Workspace.css");
    const editor = layerCss.match(
      /\.page-header \.page-title-edit-input\s*\{[\s\S]*?\n\}/,
    );
    expect(editor).not.toBeNull();
    expect(editor?.[0]).toContain("font-weight: 700;");
    expect(editor?.[0]).toContain("padding: 0;");
    expect(editor?.[0]).toContain("appearance: none;");
    expect(workspaceCss).not.toContain(".page-title-edit-input");
    // 헤더 노드만 이벤트를 받고 층은 통과
    expect(layerCss).toMatch(
      /\.page-header-layer\s*\{[^}]*pointer-events: none;/,
    );
    expect(layerCss).toMatch(/\.page-header\s*\{[^}]*pointer-events: auto;/);
  });
});
