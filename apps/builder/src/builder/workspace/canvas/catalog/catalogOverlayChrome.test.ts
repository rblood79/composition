import { describe, expect, it, vi } from "vitest";
import {
  catalogDraggedSlotMarks,
  createOverlayChromeCache,
} from "./catalogOverlayChrome";

/**
 * Pan 중 camera-only 프레임에도 overlay 가 slot 표시 · 행 나머지 · 페이지 가림 상자를 record 전체를
 * 훑어 다시 계산했다 (2026-10-21 실측: 22 페이지 · record 11k 문서에서 프레임당 ~1 ms, 120 Hz 면
 * busy 12~18 %). 입력 (record · 상자) 은 scene 이 바뀔 때만 움직이므로 scene 버전으로 보관한다.
 */
describe("createOverlayChromeCache", () => {
  const box = { x: 0, y: 0, width: 10, height: 10 };
  const setup = () => {
    let version = 0;
    const slots = vi.fn(() => [
      { box, empty: true, role: "instance" as const, identity: "s" },
    ]);
    const remainders = vi.fn(() => [{ box, hiddenRows: 3, ownerId: "o" }]);
    const occluders = vi.fn((identity: string) =>
      identity === "s" ? [box] : [],
    );
    const cache = createOverlayChromeCache(() => version, {
      slots,
      remainders,
      occluders,
    });
    return { cache, slots, remainders, occluders, bump: () => (version += 1) };
  };

  it("같은 scene 버전에서는 한 번만 만들고 같은 배열을 돌려준다", () => {
    const { cache, slots, remainders, occluders } = setup();
    const first = cache.slots();
    expect(cache.slots()).toBe(first);
    expect(cache.remainders()).toBe(cache.remainders());
    expect(cache.occludersOf("s")).toBe(cache.occludersOf("s"));
    cache.occludersOf("o");
    expect(slots).toHaveBeenCalledTimes(1);
    expect(remainders).toHaveBeenCalledTimes(1);
    expect(occluders).toHaveBeenCalledTimes(2);
  });

  it("scene 버전이 바뀌면 다시 만든다 (slot · 나머지 · 가림 전부)", () => {
    const { cache, slots, remainders, occluders, bump } = setup();
    cache.slots();
    cache.remainders();
    cache.occludersOf("s");
    bump();
    const next = cache.slots();
    cache.remainders();
    cache.occludersOf("s");
    expect(slots).toHaveBeenCalledTimes(2);
    expect(remainders).toHaveBeenCalledTimes(2);
    expect(occluders).toHaveBeenCalledTimes(2);
    expect(next).not.toBe(undefined);
  });
});

/**
 * 2026-10-22 사용자 보고 「컴포넌트 내 빈 slot 자리가 드래그 이동 때 그 자리에 남는다」: 드래그 중
 * 요소는 그릴 때 offset 을 더하는데 slot 표시는 scene 상자 그대로 그려졌다. 끌리는 record (또는
 * 비켜나는 형제) 아래의 slot 표시는 같은 offset 으로 옮긴다.
 */
describe("catalogDraggedSlotMarks", () => {
  const box = { x: 10, y: 20, width: 30, height: 40 };
  const mark = (identity: string) => ({
    box,
    empty: true,
    role: "instance" as const,
    identity,
  });
  // card > body > slot · other > otherSlot
  const parents: Record<string, string> = {
    slot: "body",
    body: "card",
    card: "page",
    otherSlot: "other",
    other: "page",
  };
  const parentOf = (id: string) => parents[id];

  it("끌리는 record 의 자손 slot 은 drag offset 만큼, 비켜나는 형제의 자손은 그 형제 offset 만큼 옮긴다", () => {
    const marks = [mark("slot"), mark("otherSlot")];
    const moved = catalogDraggedSlotMarks(marks, parentOf, {
      drag: { elementIds: new Set(["card"]), dx: 5, dy: -7 },
      siblings: true,
      siblingOffset: (id) => (id === "other" ? { dx: 0, dy: 12 } : undefined),
    });
    expect(moved.map((item) => item.box)).toEqual([
      { ...box, x: 15, y: 13 },
      { ...box, y: 32 },
    ]);
  });

  it("드래그가 없으면 같은 배열을 돌려준다 (camera-only 프레임 비용 0)", () => {
    const marks = [mark("slot")];
    expect(
      catalogDraggedSlotMarks(marks, parentOf, {
        drag: null,
        siblings: false,
        siblingOffset: () => undefined,
      }),
    ).toBe(marks);
  });
});
