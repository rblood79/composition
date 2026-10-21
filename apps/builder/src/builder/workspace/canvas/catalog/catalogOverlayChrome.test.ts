import { describe, expect, it, vi } from "vitest";
import { createOverlayChromeCache } from "./catalogOverlayChrome";

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
