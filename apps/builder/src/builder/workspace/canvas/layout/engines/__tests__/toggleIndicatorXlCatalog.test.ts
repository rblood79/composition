import { describe, expect, it } from "vitest";
import { resolveComponentRule } from "@composition/shared";
import { getSkiaPrimitive } from "@composition/specs";
import type { Shape, SizeSpec } from "@composition/specs";

import {
  PHANTOM_INDICATOR_CONFIGS,
  getPhantomIndicatorSpace,
  phantomIndicatorSizeKey,
} from "../utils";
import { ruleSizeToSizeSpec } from "../../../skia/resolveSkiaVisualRule";

/**
 * design-data 감사 §1-3 toggle 계열 xl 완결 (2026-08-21).
 *
 * **갭 2종을 함께 잠근다**:
 * 1. Checkbox 계열만 xl 결손 (Spectrum 4단계 규정) — catalog xl + CheckboxGroup xl.
 * 2. Skia primitive(checkbox/radio/switch_toggle)는 `size.indicator.*` 를 읽도록 작성돼
 *    있었으나 catalog 에 indicator 부재로 전 size 가 md 하드코딩 fallback(20/8, 36/20/16/2)
 *    으로 고정 렌더 — DOM 수동 CSS(16/20/24/30)와 비대칭이던 기존 결손의 배선.
 *    PHANTOM_INDICATOR_CONFIGS(layout)와 catalog indicator(Skia)는 같은 값이어야 한다.
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
    const xl = sizes("Checkbox").xl;
    expect(xl).toBeDefined();
    expect(xl.fontSize).toBe("{typography.text-xl}");
    expect(xl.gap).toBe(12);
  });

  it("CheckboxGroup: xl 존재 — gap 20 (RadioGroup 미러)", () => {
    expect(sizes("CheckboxGroup").xl?.gap).toBe(20);
    expect(sizes("RadioGroup").xl?.gap).toBe(20);
  });
});

describe("catalog indicator 채널 배선 (Skia size 무관 고정 해소)", () => {
  it("Checkbox: boxSize 16/20/24/30 (DOM --cb-box-size 미러)", () => {
    const s = sizes("Checkbox");
    expect(
      (["sm", "md", "lg", "xl"] as const).map((k) => s[k].indicator?.boxSize),
    ).toEqual([16, 20, 24, 30]);
  });

  it("Radio: boxSize 16/20/24/30 + dotSize 6/8/10/14 (= box - 2×border)", () => {
    const s = sizes("Radio");
    expect(
      (["sm", "md", "lg", "xl"] as const).map((k) => [
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
      (["sm", "md", "lg", "xl"] as const).map((k) => [
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

  it("PHANTOM_INDICATOR_CONFIGS(layout)와 catalog indicator(Skia)가 동일 값", () => {
    for (const [tag, ruleType] of [
      ["checkbox", "Checkbox"],
      ["radio", "Radio"],
    ] as const) {
      const cfg = PHANTOM_INDICATOR_CONFIGS[tag];
      for (const k of ["sm", "md", "lg", "xl"] as const) {
        expect(cfg.widths[k], `${tag}.${k}`).toBe(
          sizes(ruleType)[k].indicator?.boxSize,
        );
      }
    }
    const sw = PHANTOM_INDICATOR_CONFIGS.switch;
    for (const k of ["sm", "md", "lg", "xl"] as const) {
      expect(sw.widths[k]).toBe(sizes("Switch")[k].indicator?.trackWidth);
      expect(sw.heights[k]).toBe(sizes("Switch")[k].indicator?.trackHeight);
    }
  });
});

describe("layout xl 공간 (구 sm|md|lg 캐스트로 xl 이 md fallback 이던 결손)", () => {
  it("phantomIndicatorSizeKey: xl 통과, 미지 값은 md", () => {
    expect(phantomIndicatorSizeKey("xl")).toBe("xl");
    expect(phantomIndicatorSizeKey("2xl")).toBe("md");
    expect(phantomIndicatorSizeKey(undefined)).toBe("md");
  });

  it("getPhantomIndicatorSpace('checkbox','xl') = 30 + gap 12", () => {
    const space = getPhantomIndicatorSpace("checkbox", "xl");
    expect(space).toEqual({ width: 42, height: 30, gap: 12 });
  });
});

describe("Skia leg — catalog size → ruleSizeToSizeSpec → primitive 소비", () => {
  function shapesOf(primitive: string, type: string, size: string): Shape[] {
    const draw = getSkiaPrimitive(primitive)!;
    return draw({
      props: {},
      size: ruleSizeToSizeSpec(
        sizes(type)[size] as never,
      ) as unknown as SizeSpec,
      visual: undefined,
      style: undefined,
    } as never) as Shape[];
  }

  it("checkbox xl → box 30×30 (구 하드코딩 20 해소)", () => {
    const box = shapesOf("checkbox", "Checkbox", "xl")[0] as {
      width?: number;
      height?: number;
    };
    expect(box.width).toBe(30);
    expect(box.height).toBe(30);
  });

  it("radio sm → ring 반지름 8 (16/2 — size 별 분화)", () => {
    const ring = shapesOf("radio", "Radio", "sm")[0] as { radius?: number };
    expect(ring.radius).toBe(8);
  });

  it("switch xl → track 52×30", () => {
    const track = shapesOf("switch_toggle", "Switch", "xl")[0] as {
      width?: number;
      height?: number;
    };
    expect(track.width).toBe(52);
    expect(track.height).toBe(30);
  });
});
