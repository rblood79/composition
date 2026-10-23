import { describe, expect, it, vi } from "vitest";
import {
  catalogDragPlacement,
  catalogDraggedChrome,
  createOverlayChromeCache,
  type CatalogDragShift,
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
 * 비켜나는 형제) 아래의 표시는 렌더러와 같은 offset 으로 옮긴다.
 *
 * 2026-10-24 review: 렌더러는 단계마다 offset 을 부모 위치에 더한다 (`renderCommands.ts`
 * translateStack) — 첫 조상의 offset 하나만 쓰면 비켜나는 B 안의 비켜나는 자식 아래 표시가 B 의
 * offset 만큼 어긋난다. top layer root (끌리는 root · fixed box) 는 조상 offset 을 받지 않는다.
 */
describe("catalogDragPlacement", () => {
  const box = { x: 10, y: 20, width: 30, height: 40 };
  const mark = (identity: string) => ({
    box,
    empty: true,
    role: "instance" as const,
    identity,
  });
  // page > A > card > body > slot · A > other > otherSlot · A > B > child > childSlot
  const parents: Record<string, string> = {
    slot: "body",
    body: "card",
    card: "A",
    otherSlot: "other",
    other: "A",
    childSlot: "child",
    child: "B",
    B: "A",
    A: "page",
  };
  const parentOf = (id: string) => parents[id];
  const shift = (
    over: Partial<CatalogDragShift> & Pick<CatalogDragShift, "drag">,
  ): CatalogDragShift => ({
    siblings: false,
    siblingOffset: () => undefined,
    topLayerRoot: () => false,
    ...over,
  });
  const move = (
    items: ReturnType<typeof mark>[],
    placementOf: ReturnType<typeof catalogDragPlacement>,
  ) =>
    catalogDraggedChrome(
      items,
      (item) => item.identity,
      placementOf,
      (item, at) => ({
        ...item,
        box: { ...item.box, x: item.box.x + at.dx, y: item.box.y + at.dy },
        ...(at.onTop ? { onTop: true } : {}),
      }),
    );

  it("끌리는 record 의 자손은 drag offset 만큼, 비켜나는 형제의 자손은 그 형제 offset 만큼 옮긴다", () => {
    const moved = move(
      [mark("slot"), mark("otherSlot")],
      catalogDragPlacement(
        parentOf,
        shift({
          drag: { elementIds: new Set(["card"]), dx: 5, dy: -7 },
          siblings: true,
          siblingOffset: (id) =>
            id === "other" ? { dx: 0, dy: 12 } : undefined,
          topLayerRoot: (id) => id === "card",
        }),
      ),
    );
    expect(moved.map((item) => item.box)).toEqual([
      { ...box, x: 15, y: 13 },
      { ...box, y: 32 },
    ]);
  });

  it("비켜나는 B 안의 비켜나는 자식 아래 표시는 두 offset 의 합만큼 옮긴다 (렌더러 translateStack)", () => {
    const moved = move(
      [mark("childSlot")],
      catalogDragPlacement(
        parentOf,
        shift({
          drag: { elementIds: new Set(["card"]), dx: 5, dy: -7 },
          siblings: true,
          siblingOffset: (id) =>
            id === "B"
              ? { dx: 0, dy: -30 }
              : id === "child"
                ? { dx: 0, dy: 18 }
                : undefined,
          topLayerRoot: (id) => id === "card",
        }),
      ),
    );
    expect(moved[0].box).toEqual({ ...box, y: 8 });
  });

  it("top layer root 위의 조상 offset 은 받지 않고, 끌리는 서브트리는 맨 위 (onTop) 다", () => {
    const moved = move(
      [mark("slot")],
      catalogDragPlacement(
        parentOf,
        shift({
          drag: { elementIds: new Set(["card"]), dx: 5, dy: -7 },
          siblings: true,
          // A 가 비켜나도 top layer 로 옮긴 card 는 A 의 translate 밖에서 그려진다.
          siblingOffset: (id) => (id === "A" ? { dx: 40, dy: 40 } : undefined),
          topLayerRoot: (id) => id === "card",
        }),
      ),
    );
    expect(moved[0]).toMatchObject({ box: { ...box, x: 15, y: 13 }, onTop: true });
  });

  it("끌리지 않은 top layer root (fixed box) 도 조상 offset 을 받지 않고 onTop 이 아니다", () => {
    const placementOf = catalogDragPlacement(
      parentOf,
      shift({
        drag: { elementIds: new Set(["other"]), dx: 5, dy: 5 },
        siblings: true,
        siblingOffset: (id) => (id === "A" ? { dx: 9, dy: 9 } : undefined),
        topLayerRoot: (id) => id === "body",
      }),
    );
    expect(placementOf?.("slot")).toBeUndefined();
  });

  it("조상을 공유하면 사슬을 한 번만 걷는다", () => {
    const walked = vi.fn(parentOf);
    const placementOf = catalogDragPlacement(
      walked,
      shift({
        drag: { elementIds: new Set(["other"]), dx: 1, dy: 1 },
        siblings: true,
        siblingOffset: () => undefined,
      }),
    );
    placementOf?.("slot");
    const first = walked.mock.calls.length;
    placementOf?.("slot");
    placementOf?.("body");
    expect(walked.mock.calls.length).toBe(first);
  });

  it("드래그가 없으면 placement 가 없고 같은 배열을 돌려준다 (camera-only 프레임 비용 0)", () => {
    const marks = [mark("slot")];
    const placementOf = catalogDragPlacement(parentOf, shift({ drag: null }));
    expect(placementOf).toBeUndefined();
    expect(move(marks, placementOf)).toBe(marks);
  });
});
