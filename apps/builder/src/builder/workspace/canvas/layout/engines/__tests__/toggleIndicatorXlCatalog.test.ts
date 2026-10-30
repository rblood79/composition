import { describe, expect, it } from "vitest";
import { resolveComponentRule } from "@composition/shared";
import { catalogToggleIndicatorMetrics } from "../../../../../../../../../packages/shared/src/catalog/document/rulePartRules";

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

// ADR-295 Phase 3c-2b: the indicator is S2 — `controlSize('sm')` boxes (size-map tokens), Checkbox
//   corners `controlBorderRadius('sm')`, the Radio's white dot 4, the Switch track width = font × 26 / 14
//   and its thumb inset 4 (selected 3). `catalogToggleIndicatorMetrics` resolves them (desktop maps).
const metrics = (type: string) =>
  (["S", "M", "L", "XL"] as const).map((k) =>
    catalogToggleIndicatorMetrics(
      resolveComponentRule(type)!.sizes[k] as never,
    ),
  );

describe("catalog indicator 채널 배선 (Skia size 무관 고정 해소)", () => {
  it("Checkbox: box 14/16/18/20 · radius 4/4/5/5 (S2 controlSize · controlBorderRadius 'sm')", () => {
    expect(
      metrics("Checkbox").map((m) => [m?.boxSize, m?.boxRadius]),
    ).toEqual([
      [14, 4],
      [16, 4],
      [18, 5],
      [20, 5],
    ]);
  });

  it("Radio: ring 14/16/18/20 · white dot 4 (S2 selected border (h − 4) / 2)", () => {
    expect(metrics("Radio").map((m) => [m?.boxSize, m?.dotSize])).toEqual([
      [14, 4],
      [16, 4],
      [18, 4],
      [20, 4],
    ]);
  });

  it("Switch: track font × 26/14 × 14~20 / thumb h − 8 (selected h − 6, end 3)", () => {
    expect(
      metrics("Switch").map((m) => [
        Math.round(m!.trackWidth! * 100) / 100,
        m?.trackHeight,
        m?.thumbSize,
        m?.thumbOffset,
        m?.thumbSizeSelected,
        m?.thumbOffsetSelected,
      ]),
    ).toEqual([
      [22.29, 14, 6, 4, 8, 3],
      [26, 16, 8, 4, 10, 3],
      [29.71, 18, 10, 4, 12, 3],
      [33.43, 20, 12, 4, 14, 3],
    ]);
  });
});
