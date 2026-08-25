import { describe, expect, it } from "vitest";

// ADR-912 단계5 step4 (2026-06-17): SliderSpec + callCatalogShapes import 제거 — Slider.spec.ts 물리 삭제로
//   Slider 빈 shell parity suite 삭제. callCatalogShapes 는 해당 suite 단독 사용처였음.
import { getSkiaPrimitive } from "./catalogPaintFixture";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { Shape, SizeSpec, TokenRef } from "../../types";

/**
 * ADR-142 family ③(selection) — Checkbox/Radio/Switch indicator skiaPrimitive 회귀 가드.
 *
 * **정본 (사용자 family ① 정정 정합)**: indicator(box/circle/track+thumb)는 box+text 로 표현
 * 불가한 비-DOM-trivial primitive → `skiaPrimitive` draw module(skiaPrimitives.ts)이 그린다.
 * label 은 자식 Label Element(canonical children)가 담당하므로 draw module 은 indicator 만.
 *
 * **ADR-912 단계5 step4 toggle-indicator 그룹 (2026-06-16)**: Checkbox/Radio/Switch.spec 삭제로
 * legacy oracle(spec.render.shapes) 소멸 → draw module 출력을 **rule 미러 visual + size(indicator
 * 명시)** 주입 후 **절대값 단언**으로 검증한다 (skiaPrimitives.sliderFill.test 동형 — SliderThumb
 * spec 삭제 시 동일 패턴). draw module 은 ADR-142 B2 에서 이미 spec-free(visual rule 주입형)이므로
 * spec 없이 회귀 가드 유지. indicator 치수는 구 *.spec.sizes.*.indicator SSOT 미러.
 */

const draw = {
  checkbox: getSkiaPrimitive("checkbox")!,
  radio: getSkiaPrimitive("radio")!,
  switch: getSkiaPrimitive("switch_toggle")!,
};

// ── Checkbox rule 미러 ─────────────────────────────────────────────────────
// 구 Checkbox.spec.sizes.*.indicator SSOT 미러 (boxSize/boxRadius). rule.sizes 는 generated CSS
// 전용이라 indicator 미포함 → draw module 측정용으로 여기 명시.
const checkboxSize = (boxSize: number, boxRadius: number): SizeSpec =>
  ({
    height: 0,
    paddingX: 0,
    paddingY: 0,
    fontSize: "{typography.text-base}" as never,
    borderRadius: "{radius.none}" as never,
    indicator: { boxSize, boxRadius },
  }) as SizeSpec;

// 구 Checkbox.spec.variants 미러 (default/emphasized — checked bg/border, 미선택 border).
const checkboxVisual = (
  variant: "default" | "emphasized",
): ComponentVisualRule =>
  ({
    fill: {
      default: {
        base: "{color.base}" as TokenRef,
        hover:
          variant === "emphasized"
            ? "{color.accent-subtle}"
            : "{color.layer-2}",
        pressed:
          variant === "emphasized"
            ? "{color.accent-subtle}"
            : "{color.layer-1}",
        selected:
          variant === "emphasized" ? "{color.accent}" : "{color.neutral}",
      },
    },
    text: "{color.neutral}" as TokenRef,
    border: "{color.border}" as TokenRef,
    selectedBorder:
      variant === "emphasized" ? "{color.accent}" : "{color.neutral}",
  }) as ComponentVisualRule;

describe("skiaPrimitive 'checkbox' — Checkbox indicator (rule 미러 절대값)", () => {
  // 구 Checkbox.spec.sizes: sm(16/4) md(20/4) lg(24/6)
  const sizes = {
    sm: checkboxSize(16, 4),
    md: checkboxSize(20, 4),
    lg: checkboxSize(24, 6),
  } as const;

  for (const [name, size] of Object.entries(sizes)) {
    const boxSize = size.indicator!.boxSize!;
    for (const variant of ["default", "emphasized"] as const) {
      it(`${variant}/${name}/미선택 — box(${boxSize}) + border(미선택색)`, () => {
        const shapes = draw.checkbox({
          props: { variant, isSelected: false, _hasChildren: true },
          size,
          visual: checkboxVisual(variant),
          style: undefined,
        });
        const box = shapes.find((s) => s.id === "box") as Extract<
          Shape,
          { type: "roundRect" }
        >;
        const border = shapes.find((s) => s.type === "border");
        expect(box.width).toBe(boxSize);
        expect(box.height).toBe(boxSize);
        // 미선택 box bg = fill.default.base
        expect(box.fill).toBe("{color.base}");
        expect(border).toBeTruthy();
        // 미선택 border = visual.border
        expect((border as { color?: string }).color).toBe("{color.border}");
        // 체크마크 없음
        expect(shapes.filter((s) => s.type === "line")).toHaveLength(0);
      });

      it(`${variant}/${name}/선택 — checked bg/border + 체크마크 2 line`, () => {
        const shapes = draw.checkbox({
          props: { variant, isSelected: true, _hasChildren: true },
          size,
          visual: checkboxVisual(variant),
          style: undefined,
        });
        const box = shapes.find((s) => s.id === "box") as Extract<
          Shape,
          { type: "roundRect" }
        >;
        const expected =
          variant === "emphasized" ? "{color.accent}" : "{color.neutral}";
        expect(box.fill).toBe(expected);
        // 체크마크 = 2 line
        expect(shapes.filter((s) => s.type === "line")).toHaveLength(2);
      });
    }
  }

  it("indeterminate — 단일 line", () => {
    const shapes = draw.checkbox({
      props: {
        variant: "default",
        isSelected: true,
        isIndeterminate: true,
        _hasChildren: true,
      },
      size: sizes.md,
      visual: checkboxVisual("default"),
      style: undefined,
    });
    expect(shapes.filter((s) => s.type === "line")).toHaveLength(1);
  });
});

// ── Radio rule 미러 ────────────────────────────────────────────────────────
const radioSize = (boxSize: number, dotSize: number): SizeSpec =>
  ({
    height: 0,
    paddingX: 0,
    paddingY: 0,
    fontSize: "{typography.text-base}" as never,
    borderRadius: "{radius.none}" as never,
    indicator: { boxSize, dotSize },
  }) as SizeSpec;

// 구 Radio.spec.variants 미러 (default/accent/neutral/negative).
const RADIO_VISUALS: Record<string, ComponentVisualRule> = {
  default: {
    fill: {
      default: {
        base: "{color.base}",
        hover: "{color.layer-2}",
        pressed: "{color.layer-1}",
        selected: "{color.accent}",
      },
    },
    text: "{color.neutral}",
    border: "{color.border-hover}",
    selectedBorder: "{color.accent}",
  } as ComponentVisualRule,
  accent: {
    fill: {
      default: {
        base: "{color.base}",
        hover: "{color.layer-2}",
        pressed: "{color.layer-1}",
        selected: "{color.accent}",
      },
    },
    text: "{color.neutral}",
    border: "{color.border-hover}",
    selectedBorder: "{color.accent}",
  } as ComponentVisualRule,
  neutral: {
    fill: {
      default: {
        base: "{color.base}",
        hover: "{color.layer-2}",
        pressed: "{color.layer-1}",
        selected: "{color.neutral-subtle}",
      },
    },
    text: "{color.neutral}",
    border: "{color.border-hover}",
    selectedBorder: "{color.neutral-subtle}",
  } as ComponentVisualRule,
  negative: {
    fill: {
      default: {
        base: "{color.base}",
        hover: "{color.negative-subtle}",
        pressed: "{color.negative-subtle}",
        selected: "{color.negative}",
      },
    },
    text: "{color.neutral}",
    border: "{color.negative}",
    selectedBorder: "{color.negative}",
  } as ComponentVisualRule,
};

describe("skiaPrimitive 'radio' — Radio indicator (rule 미러 절대값)", () => {
  // 구 Radio.spec.sizes: sm(16/6) md(20/8) lg(24/10) xl(28/12)
  const sizes = {
    sm: radioSize(16, 6),
    md: radioSize(20, 8),
    lg: radioSize(24, 10),
  } as const;
  const variants = ["default", "accent", "neutral", "negative"] as const;

  for (const [name, size] of Object.entries(sizes)) {
    const outerRadius = size.indicator!.boxSize! / 2;
    for (const variant of variants) {
      it(`${variant}/${name}/미선택 — ring(반지름 ${outerRadius}, fillAlpha 0) + border, dot 없음`, () => {
        const shapes = draw.radio({
          props: { variant, isSelected: false, _hasChildren: true },
          size,
          visual: RADIO_VISUALS[variant],
          style: undefined,
        });
        const ring = shapes.find((s) => s.id === "ring") as Extract<
          Shape,
          { type: "circle" }
        >;
        expect(ring.radius).toBe(outerRadius);
        expect((ring as { fillAlpha?: number }).fillAlpha).toBe(0);
        // 미선택: ring + border = 2 shape (dot 없음)
        expect(shapes).toHaveLength(2);
        const border = shapes.find((s) => s.type === "border");
        expect((border as { color?: string }).color).toBe(
          RADIO_VISUALS[variant].border,
        );
      });

      it(`${variant}/${name}/선택 — inner dot 추가(selected 색)`, () => {
        const shapes = draw.radio({
          props: { variant, isSelected: true, _hasChildren: true },
          size,
          visual: RADIO_VISUALS[variant],
          style: undefined,
        });
        // 선택: ring + border + dot = 3 shape
        expect(shapes).toHaveLength(3);
        const dot = shapes[2] as Extract<Shape, { type: "circle" }>;
        expect(dot.radius).toBe(size.indicator!.dotSize! / 2);
        expect(dot.fill).toBe(RADIO_VISUALS[variant].fill!.default.selected);
      });
    }
  }
});

// Slider — ADR-912 단계5 step4 (2026-06-17): Slider.spec.ts 물리 삭제로 본 suite 제거.
//   부모 Slider 는 _hasChildren 빈 shell(variant 없음 → buildCatalogShapes generic 이 빈 배열 produce) —
//   회귀 가드 불요. track/thumb 은 자식 SliderTrack/Thumb sub-part 의 slider_fill_bar/slider_thumb escape 담당.

// ── Switch rule 미러 ───────────────────────────────────────────────────────
const switchSize = (
  trackWidth: number,
  trackHeight: number,
  thumbSize: number,
): SizeSpec =>
  ({
    height: 0,
    paddingX: 0,
    paddingY: 0,
    fontSize: "{typography.text-sm}" as never,
    borderRadius: "{radius.full}" as never,
    indicator: { trackWidth, trackHeight, thumbSize, thumbOffset: 2 },
  }) as SizeSpec;

// 구 Switch.spec.variants 미러 (default/emphasized — selected track 색).
const switchVisual = (variant: "default" | "emphasized"): ComponentVisualRule =>
  ({
    fill: {
      default: {
        base: "{color.transparent}" as TokenRef,
        hover: "{color.transparent}" as TokenRef,
        pressed: "{color.transparent}" as TokenRef,
        selected:
          variant === "emphasized" ? "{color.accent}" : "{color.neutral}",
      },
    },
    text: "{color.neutral}" as TokenRef,
  }) as ComponentVisualRule;

describe("skiaPrimitive 'switch_toggle' — Switch indicator (rule 미러 절대값)", () => {
  // 구 Switch.spec.sizes: sm(32/18/14) md(36/20/16) lg(44/24/20)
  const sizes = {
    sm: switchSize(32, 18, 14),
    md: switchSize(36, 20, 16),
    lg: switchSize(44, 24, 20),
  } as const;

  for (const [name, size] of Object.entries(sizes)) {
    const ind = size.indicator!;
    for (const variant of ["default", "emphasized"] as const) {
      it(`${variant}/${name}/미선택 — track(${ind.trackWidth}x${ind.trackHeight}) + border + thumb 좌측`, () => {
        const shapes = draw.switch({
          props: { variant, isSelected: false, _hasChildren: true },
          size,
          visual: switchVisual(variant),
          style: undefined,
        });
        const track = shapes.find((s) => s.id === "track") as Extract<
          Shape,
          { type: "roundRect" }
        >;
        expect(track.width).toBe(ind.trackWidth);
        expect(track.height).toBe(ind.trackHeight);
        // 미선택 track = accent-subtle (전 variant 공통)
        expect(track.fill).toBe("{color.accent-subtle}");
        // 미선택 → border 존재
        expect(shapes.find((s) => s.type === "border")).toBeTruthy();
        const thumb = shapes.find((s) => s.id === "thumb") as Extract<
          Shape,
          { type: "circle" }
        >;
        // 미선택 thumb x = thumbOffset + thumbSize/2
        expect(thumb.x).toBe(ind.thumbOffset! + ind.thumbSize! / 2);
        expect(thumb.fill).toBe("{color.neutral-subtle}");
      });

      it(`${variant}/${name}/선택 — track selected색 + border 없음 + thumb 우측 white`, () => {
        const shapes = draw.switch({
          props: { variant, isSelected: true, _hasChildren: true },
          size,
          visual: switchVisual(variant),
          style: undefined,
        });
        const track = shapes.find((s) => s.id === "track") as Extract<
          Shape,
          { type: "roundRect" }
        >;
        const expected =
          variant === "emphasized" ? "{color.accent}" : "{color.neutral}";
        expect(track.fill).toBe(expected);
        // 선택 → border 없음
        expect(shapes.find((s) => s.type === "border")).toBeFalsy();
        const thumb = shapes.find((s) => s.id === "thumb") as Extract<
          Shape,
          { type: "circle" }
        >;
        // 선택 thumb x = trackWidth - thumbSize - thumbOffset + thumbSize/2
        expect(thumb.x).toBe(
          ind.trackWidth! -
            ind.thumbSize! -
            ind.thumbOffset! +
            ind.thumbSize! / 2,
        );
        expect(thumb.fill).toBe("{color.white}");
      });
    }
  }
});
