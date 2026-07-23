import { describe, expect, it } from "vitest";

import { effectOpensLayer, countEffectLayers } from "../effects";
import type { EffectStyle } from "../types";

/**
 * saveLayer opener(beginRenderEffects)와 restore counter(renderCommands.effectLayerCount)의
 * 정합 계약. inset(inner) drop-shadow 는 saveLayer 를 열지 않으므로(renderBox 가 지오메트리로
 * 그림) count 에서 제외돼야 한다. 제외 안 하면 endRenderEffects 가 over-restore → canvas save
 * 스택 붕괴 → 이후 요소 transform/clip 오염("페이지 내부 안 보임 + 특정 위치 렌더" 버그, 2026-07-23).
 */
const outerShadow: EffectStyle = {
  type: "drop-shadow",
  dx: 0,
  dy: 4,
  sigmaX: 2,
  sigmaY: 2,
  color: Float32Array.of(0, 0, 0, 0.3),
  inner: false,
} as EffectStyle;

const innerShadow: EffectStyle = {
  type: "drop-shadow",
  dx: 0,
  dy: 2,
  sigmaX: 3.4,
  sigmaY: 3.4,
  color: Float32Array.of(0, 0, 0, 0.16),
  inner: true,
} as EffectStyle;

const opacity: EffectStyle = { type: "opacity", value: 0.5 } as EffectStyle;

describe("effectOpensLayer — saveLayer 개방 predicate", () => {
  it("inner drop-shadow → false (renderBox 지오메트리 렌더)", () => {
    expect(effectOpensLayer(innerShadow)).toBe(false);
  });
  it("outer drop-shadow → true", () => {
    expect(effectOpensLayer(outerShadow)).toBe(true);
  });
  it("비-shadow effect(opacity/blur 등) → true", () => {
    expect(effectOpensLayer(opacity)).toBe(true);
  });
});

describe("countEffectLayers — restore 정합 count", () => {
  it("inner drop-shadow 는 count 제외 (over-restore 방지)", () => {
    // opacity(1) + inner(0) + outer(1) = 2 (length 3 이 아님)
    expect(countEffectLayers([opacity, innerShadow, outerShadow])).toBe(2);
  });
  it("inner 단독 → 0 (saveLayer 없음)", () => {
    expect(countEffectLayers([innerShadow])).toBe(0);
  });
  it("outer 만 → length 와 동일", () => {
    expect(countEffectLayers([outerShadow, opacity])).toBe(2);
  });
  it("빈 배열 → 0", () => {
    expect(countEffectLayers([])).toBe(0);
  });
});
