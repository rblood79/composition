/**
 * useWorkspaceCanvasSizing — viewport containerSize 좌표계 정적 가드
 *
 * Phase C (2026-07-20): compare 모드에서 viewport containerSize 를 workspace
 * 전체 폭으로 측정하면 fit/줌 중심의 pan 이 좌측 preview pane 폭만큼 오른쪽으로
 * 밀려 콘텐츠가 우측 패널 아래로 사라진다 (렌더 파이프라인은 정상인데 화면상
 * 전체 미렌더로 보이는 결함). 측정 대상은 Skia canvas 가 실제 차지하는 영역
 * (compare 우측 pane, canvasAreaRef) 이어야 한다.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const hookSource = readFileSync(
  resolve(__dirname, "./useWorkspaceCanvasSizing.ts"),
  "utf8",
);
const compareModeSource = readFileSync(
  resolve(__dirname, "../components/WorkspaceCompareMode.tsx"),
  "utf8",
);
const workspaceSource = readFileSync(
  resolve(__dirname, "../Workspace.tsx"),
  "utf8",
);

describe("useWorkspaceCanvasSizing containerSize 좌표계 계약", () => {
  it("ResizeObserver 관측 대상은 canvasAreaRef 우선 (compare 우측 pane 기준)", () => {
    expect(hookSource).toContain(
      "canvasAreaRef?.current ?? containerRef.current",
    );
  });

  it("compareSplit 기반 effectiveWidth 수동 보정을 재도입하지 않는다", () => {
    // 보정이 필요 없도록 측정 요소 자체를 canvas 영역으로 교체했다.
    // compareSplit 이 hook 에 다시 들어오면 이중 보정으로 pan 이 재차 밀린다.
    expect(hookSource).not.toContain("compareSplit");
    expect(hookSource).not.toContain("effectiveWidth");
  });

  it("compare 토글 시 재관측: ResizeObserver effect deps 에 compareMode 포함", () => {
    expect(hookSource).toMatch(
      /\[canvasAreaRef, compareMode, containerRef, restoreInitialViewport\]/,
    );
  });

  it("WorkspaceCompareMode 우측 pane 에 canvasAreaRef 가 부착된다", () => {
    expect(compareModeSource).toContain(
      'ref={canvasAreaRef} className="workspace-compare-content"',
    );
  });

  it("Workspace 가 canvasAreaRef 를 sizing hook 과 compare 레이아웃 양쪽에 배선한다", () => {
    expect(workspaceSource).toContain("canvasAreaRef,");
    expect(workspaceSource).toContain("canvasAreaRef={canvasAreaRef}");
  });

  it("panel runtime을 구독하지 않고 actual local rect와 shell version을 함께 publish한다", () => {
    expect(hookSource).not.toContain("panelLayoutRuntime");
    expect(hookSource).not.toContain("subscribeToPanelLayoutChanges");
    expect(hookSource).toContain("publishCanvasLocalRect(");
    expect(hookSource).toContain("data-canvas-layout-version");
  });
});
