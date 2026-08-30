import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./useSkiaNode", () => ({
  notifyLayoutChange: vi.fn(),
}));

import { notifyLayoutChange } from "./useSkiaNode";
import {
  getDragSiblingOffsetRevision,
  setDragPresentationRetained,
  setDragSiblingOffsets,
  setDragVisualOffset,
} from "./nodeRendererTree";

const notify = vi.mocked(notifyLayoutChange);

describe("drag presentation invalidation", () => {
  beforeEach(() => {
    setDragVisualOffset(null, 0, 0, true);
    setDragSiblingOffsets(null);
    notify.mockClear();
  });

  it("같은 target의 pointer delta만 바뀌면 registry를 invalidate하지 않는다", () => {
    const ids = new Set(["instance"]);

    setDragVisualOffset(ids, 10, 20);
    setDragVisualOffset(ids, 30, 40);
    setDragVisualOffset(new Set(["instance"]), 50, 60);

    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("target topology 시작/교체/종료는 skip 인자와 무관하게 invalidate한다", () => {
    setDragVisualOffset("origin", 0, 0, true);
    setDragVisualOffset("instance", 0, 0, true);
    setDragVisualOffset(null, 0, 0, true);

    expect(notify).toHaveBeenCalledTimes(3);
  });

  it("retained command-tail 불변식이 없으면 delta별 legacy invalidation으로 폴백한다", () => {
    setDragVisualOffset("instance", 0, 0);
    setDragPresentationRetained(false);
    notify.mockClear();

    setDragVisualOffset("instance", 10, 20);

    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("sibling offset은 registry 대신 별도 presentation revision만 갱신한다", () => {
    const initialRevision = getDragSiblingOffsetRevision();

    setDragSiblingOffsets(null);
    setDragSiblingOffsets(new Map([["sibling", { dx: 10, dy: 5 }]]));
    setDragSiblingOffsets(new Map([["sibling", { dx: 10, dy: 5 }]]));
    setDragSiblingOffsets(new Map([["sibling", { dx: 20, dy: 5 }]]));
    setDragSiblingOffsets(null);
    setDragSiblingOffsets(null);

    expect(notify).not.toHaveBeenCalled();
    expect(getDragSiblingOffsetRevision()).toBe(initialRevision + 3);
  });
});
