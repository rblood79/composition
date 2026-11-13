/**
 * 토스트 ↔ contextual action bar 회피값 — 절대값이라 바가 물러나면 0 으로 돌아온다.
 *
 * Why: 증분 누적으로 짜면 한 번 올라간 토스트가 영영 안 내려온다 (2026-09-08 초안 결함).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { act, renderHook } from "@testing-library/react";

import {
  measureClearance,
  useActionBarClearance,
} from "../useActionBarClearance";

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

describe("useActionBarClearance", () => {
  /**
   * Why (2026-11-13): 토스트가 생길 때 한 번 쟀는데 그때 region 은 아직 DOM 에 없어 0 이었고, 다시
   * 재지 않았다 — 고정 60 offset 이 바의 기본 자리를 비워 가리던 결함 (offset 을 S2 의 16 으로 내리자
   * 화면 아래 가운데의 바를 덮었다). region 이 나타나면 다시 잰다.
   */
  it("region 이 나중에 나타나도 다시 재서 바 위로 올린다", async () => {
    vi.stubGlobal("innerHeight", VIEWPORT_H);
    const bar = stub({ left: 700, right: 1000, top: 948 });
    bar.className = "contextual-action-bar";
    document.body.appendChild(bar);
    let region: HTMLElement | null = null;
    const ref = {
      get current() {
        return region;
      },
    };
    const { result } = renderHook(() => useActionBarClearance(ref, true));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(result.current).toBe(0);
    // 토스트: 가운데, bottom 984 (= S2 offset 16)
    region = stub({ left: 750, right: 950, top: 948 });
    await act(async () => {
      document.body.appendChild(region!);
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    // 바 윗선 948 + 간격 8 → 아래에서 60, 기본 16 → 44 올린다
    expect(result.current).toBe(44);
    bar.remove();
    region.remove();
  });
});
