import { describe, expect, it } from "vitest";
import { resolveComponentRule } from "@composition/shared";

/**
 * design-data 감사 §1-3 toggle 계열 xl 완결 (2026-08-21).
 *
 * **갭 2종을 함께 잠근다**:
 * 1. Checkbox 계열만 xl 결손 (Spectrum 4단계 규정) — catalog xl + CheckboxGroup xl.
 * 2. Skia primitive(checkbox/radio/switch_toggle)는 `size.indicator.*` 를 읽도록 작성돼
 *    있었으나 catalog 에 indicator 부재로 전 size 가 md 하드코딩 fallback(20/8, 36/20/16/2)
 *    으로 고정 렌더 — DOM 수동 CSS(16/20/24/30)와 비대칭이던 기존 결손의 배선.
 *    (옛 TS 레이아웃의 PHANTOM_INDICATOR_CONFIGS 대조와 옛 builder 래퍼 `resolveSkiaCatalogRenderInput` 경유
 *    primitive 대조는 2026-10-05 옛 레이아웃 경로와 함께 삭제)
 */

const sizes = (type: string) =>
  resolveComponentRule(type)!.sizes as unknown as Record<
    string,
    {
      gap?: number;
      fontSize?: string;
      indicator?: {
        boxSize?: number;
        dotSize?: number;
        trackWidth?: number;
        trackHeight?: number;
        thumbSize?: number;
        thumbOffset?: number;
      };
    }
  >;

describe("catalog xl 단계 (§1-3 Checkbox 계열 결손 보수)", () => {
  it("Checkbox: xl 존재 — fontSize text-xl / gap 12 (Radio 미러)", () => {
    const xl = sizes("Checkbox").XL;
    expect(xl).toBeDefined();
    expect(xl.fontSize).toBe("{typography.text-xl}");
    expect(xl.gap).toBe(12);
  });

  it("CheckboxGroup: xl 존재 — gap 20 (RadioGroup 미러)", () => {
    expect(sizes("CheckboxGroup").XL?.gap).toBe(20);
    expect(sizes("RadioGroup").XL?.gap).toBe(20);
  });
});

describe("catalog indicator 채널 배선 (Skia size 무관 고정 해소)", () => {
  it("Checkbox: boxSize 16/20/24/30 (DOM --cb-box-size 미러)", () => {
    const s = sizes("Checkbox");
    expect(
      (["S", "M", "L", "XL"] as const).map((k) => s[k].indicator?.boxSize),
    ).toEqual([16, 20, 24, 30]);
  });

  it("Radio: boxSize 16/20/24/30 + dotSize 6/8/10/14 (= box - 2×border)", () => {
    const s = sizes("Radio");
    expect(
      (["S", "M", "L", "XL"] as const).map((k) => [
        s[k].indicator?.boxSize,
        s[k].indicator?.dotSize,
      ]),
    ).toEqual([
      [16, 6],
      [20, 8],
      [24, 10],
      [30, 14],
    ]);
  });

  it("Switch: track 32~52 × 18~30 / thumb 14~24 (Switch.css 미러)", () => {
    const s = sizes("Switch");
    expect(
      (["S", "M", "L", "XL"] as const).map((k) => [
        s[k].indicator?.trackWidth,
        s[k].indicator?.trackHeight,
        s[k].indicator?.thumbSize,
      ]),
    ).toEqual([
      [32, 18, 14],
      [36, 20, 16],
      [44, 24, 20],
      [52, 30, 24],
    ]);
  });
});
