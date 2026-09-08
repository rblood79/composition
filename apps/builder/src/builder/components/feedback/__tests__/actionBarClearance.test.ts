/**
 * 토스트 ↔ contextual action bar 회피값 — 절대값이라 바가 물러나면 0 으로 돌아온다.
 *
 * Why: 증분 누적으로 짜면 한 번 올라간 토스트가 영영 안 내려온다 (2026-09-08 초안 결함).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { measureClearance } from "../useActionBarClearance";

const VIEWPORT_H = 1000;

/** 실제 element 여야 한다 — measureClearance 가 `instanceof HTMLElement` 로 거른다. */
function stub(rect: { left: number; right: number; top: number }): HTMLElement {
  const el = document.createElement("div");
  el.getBoundingClientRect = () =>
    ({
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.top + 36,
      width: rect.right - rect.left,
      height: 36,
    }) as DOMRect;
  return el;
}

function withBar(bar: HTMLElement | null, run: () => number): number {
  const spy = vi
    .spyOn(document, "querySelector")
    .mockImplementation(() => bar as Element | null);
  vi.stubGlobal("innerHeight", VIEWPORT_H);
  try {
    return run();
  } finally {
    spy.mockRestore();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("measureClearance", () => {
  // 토스트: 우하단, bottom 940 (= 기본 offset 60px)
  const toast = stub({ left: 1204, right: 1584, top: 904 });

  it("바가 없으면 0", () => {
    expect(withBar(null, () => measureClearance(toast, 0))).toBe(0);
  });

  it("컨테이너가 없으면 0", () => {
    const bar = stub({ left: 1382, right: 1545, top: 922 });
    expect(withBar(bar, () => measureClearance(null, 0))).toBe(0);
  });

  it("가로로 안 겹치면 0 — 바가 왼쪽에 있을 때", () => {
    const bar = stub({ left: 482, right: 645, top: 922 });
    expect(withBar(bar, () => measureClearance(toast, 0))).toBe(0);
  });

  it("겹치면 바 윗선 + 간격까지 올린다", () => {
    // 바 top 922 → 필요한 bottom gap = 1000 - 922 + 8 = 86, 현재 60 → 26
    const bar = stub({ left: 1382, right: 1545, top: 922 });
    expect(withBar(bar, () => measureClearance(toast, 0))).toBe(26);
  });

  it("이미 반영된 값은 기준선에서 되돌린다 — 같은 배치면 같은 값", () => {
    const bar = stub({ left: 1382, right: 1545, top: 922 });
    // 26 을 이미 올린 상태의 rect (bottom 940 - 26 = 914 → top 878)
    const lifted = stub({ left: 1204, right: 1584, top: 878 });
    expect(withBar(bar, () => measureClearance(lifted, 26))).toBe(26);
  });

  it("바가 물러나면 0 으로 돌아온다 (누적 금지)", () => {
    const barAway = stub({ left: 482, right: 645, top: 922 });
    const lifted = stub({ left: 1204, right: 1584, top: 878 });
    expect(withBar(barAway, () => measureClearance(lifted, 26))).toBe(0);
  });

  it("바가 토스트보다 아래면 올리지 않는다", () => {
    const barBelow = stub({ left: 1382, right: 1545, top: 960 });
    expect(withBar(barBelow, () => measureClearance(toast, 0))).toBe(0);
  });
});
