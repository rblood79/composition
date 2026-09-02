import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * BuilderCanvas 는 pageLayoutPanelMetrics 를 frame edit mode 에서만 구독한다.
 *
 * Why: 패널 크기 조절 중 PanelWorkspace 가 매 프레임 `data-page-layout-*-panel-width`
 * 를 고쳐 쓰고 → useWorkspaceCanvasSizing MutationObserver → viewport store →
 * 이 값을 그대로 구독한 BuilderCanvas 전체가 매 프레임 재렌더됐다 (2026-09-02 실측:
 * 드래그 중 JS 할당 109 MB/s · GC 10회/2초, 구독 차단 시 21 MB/s · 1회). 값은
 * frameAreas 계산에만 쓰이므로 frame edit mode 밖에서는 null 로 고정한다.
 */
describe("BuilderCanvas pageLayoutPanelMetrics 구독 범위", () => {
  const readSource = () =>
    readFile(resolve(__dirname, "BuilderCanvas.tsx"), "utf-8");

  it("무조건 구독 (state => state.pageLayoutPanelMetrics) 이 없다", async () => {
    const source = await readSource();
    expect(source).not.toMatch(
      /useViewportSyncStore\(\s*\(state\) => state\.pageLayoutPanelMetrics,?\s*\)/,
    );
  });

  it("frame edit mode 로 게이트된 selector 를 쓴다", async () => {
    const source = await readSource();
    expect(source).toContain(
      "selectFrameAreaPanelMetrics(state, isFrameEditMode)",
    );
    // selector 결과가 null 인 동안 frameAreas 는 빈 배열로 끝난다
    expect(source).toMatch(
      /const frameAreas = useMemo\(\(\) => \{\s*if \(!isFrameEditMode \|\| !pageLayoutPanelMetrics\) return \[\];/,
    );
  });
});
