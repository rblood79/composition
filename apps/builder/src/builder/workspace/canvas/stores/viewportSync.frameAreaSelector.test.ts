import { beforeEach, describe, expect, it } from "vitest";
import {
  selectFrameAreaPanelMetrics,
  useViewportSyncStore,
} from "./viewportSync";

/**
 * 패널 크기 조절 중 pageLayoutPanelMetrics 는 매 프레임 바뀐다. frame edit mode 가
 * 아닌 BuilderCanvas 는 이 값을 쓰지 않으므로, selector 가 null 로 고정돼 store
 * 변경이 재렌더로 이어지지 않아야 한다 (2026-09-02 프레임 비용 실측).
 */
describe("selectFrameAreaPanelMetrics", () => {
  beforeEach(() => {
    useViewportSyncStore.getState().reset();
  });

  it("frame edit mode 가 아니면 metrics 가 바뀌어도 항상 같은 null 을 돌려준다", () => {
    const store = useViewportSyncStore;
    const before = selectFrameAreaPanelMetrics(store.getState(), false);
    store.getState().setPageLayoutPanelMetrics({
      leftWidth: 320,
      rightWidth: 283,
      gap: 4,
    });
    store.getState().setPageLayoutPanelMetrics({
      leftWidth: 326,
      rightWidth: 283,
      gap: 4,
    });
    const after = selectFrameAreaPanelMetrics(store.getState(), false);
    expect(before).toBeNull();
    expect(after).toBe(before);
  });

  it("frame edit mode 에서는 store 의 metrics 객체를 그대로 돌려준다", () => {
    const store = useViewportSyncStore;
    const metrics = { leftWidth: 320, rightWidth: 283, gap: 4 };
    store.getState().setPageLayoutPanelMetrics(metrics);
    expect(selectFrameAreaPanelMetrics(store.getState(), true)).toBe(metrics);
  });

  it("같은 값의 metrics 재설정은 store 상태를 바꾸지 않는다 (per-frame no-op)", () => {
    const store = useViewportSyncStore;
    const metrics = { leftWidth: 320, rightWidth: 283, gap: 4 };
    store.getState().setPageLayoutPanelMetrics(metrics);
    const first = store.getState().pageLayoutPanelMetrics;
    store.getState().setPageLayoutPanelMetrics({ ...metrics });
    expect(store.getState().pageLayoutPanelMetrics).toBe(first);
  });
});
