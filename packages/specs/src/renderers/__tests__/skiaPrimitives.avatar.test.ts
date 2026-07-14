import { describe, expect, it } from "vitest";

import { getSkiaPrimitive, getSkiaPrimitiveMode } from "../skiaPrimitives";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { Shape, SizeSpec } from "../../types";

/**
 * `avatar` escape — circle bg + (image | initials text) 회귀 게이트.
 *
 * **이니셜 가로 정렬 회귀 (2026-07-14)**: 이니셜이 원 중앙이 아니라 **우측 가장자리**에 그려지던 버그.
 *   root cause 는 specShapeConverter 의 text `x` 계약을 avatar 가 잘못 해석한 것:
 *
 *     converter (specShapeConverter.ts:759-767) — x 는 "중심 좌표"가 아니라 **좌측 오프셋 padding**:
 *       align:center + x>0  → paddingLeft = x,  maxWidth = containerWidth - x*2
 *       align:center + x=0  → paddingLeft = 0,  maxWidth = containerWidth   (컨테이너 전체 중앙)
 *
 *   avatar 가 `x: radius`(md=16) 를 넘기면 maxWidth = 32-32 = 0 → clamp(=containerWidth 32) 되어
 *   정렬 기준 구간이 [16, 48] 로 밀린다 → 그 중앙 x=32 = 지름 32 원의 **우측 끝**.
 *   DOM(Avatar.tsx 의 flex justifyContent:center)은 원 정중앙 → CSS↔Skia 시각 발산.
 *
 *   ⇒ 컨테이너 전체 기준 중앙을 원하는 다른 primitive(stepper/illustrated_message 등)와 동일하게
 *     **x=0 / y=0 + align:center + baseline:middle** 관용구를 쓴다.
 */

// COMPONENT_RULES_TABLE.Avatar sizes 미러 (지름 = height).
const sizeMd: SizeSpec = {
  height: 32,
  paddingX: 0,
  paddingY: 0,
  fontSize: "{typography.text-sm}" as never,
  borderRadius: "{radius.full}" as never,
};
const sizeXl: SizeSpec = {
  height: 48,
  paddingX: 0,
  paddingY: 0,
  fontSize: "{typography.text-lg}" as never,
  borderRadius: "{radius.full}" as never,
};

// COMPONENT_RULES_TABLE.Avatar variants.default 미러.
const visual: ComponentVisualRule = {
  fill: {
    default: {
      base: "{color.neutral-subtle}" as never,
    },
  },
  text: "{color.neutral}" as never,
} as ComponentVisualRule;

const draw = getSkiaPrimitive("avatar")!;

type TextShape = Extract<Shape, { type: "text" }>;
type CircleShape = Extract<Shape, { type: "circle" }>;

function textOf(shapes: Shape[]): TextShape {
  const t = shapes.find((s) => s.type === "text");
  if (!t) throw new Error("text shape 없음");
  return t as TextShape;
}
function circleOf(shapes: Shape[]): CircleShape {
  const c = shapes.find((s) => s.type === "circle");
  if (!c) throw new Error("circle shape 없음");
  return c as CircleShape;
}

describe("skiaPrimitive 'avatar'", () => {
  it("registry 에 replace 모드로 등록 (circle 이 전체 외형 → base box 무의미)", () => {
    expect(draw).toBeDefined();
    expect(getSkiaPrimitiveMode("avatar")).toBe("replace");
  });

  it("circle bg 는 지름(size.height) 기준 — 중심 (r, r), 반지름 r", () => {
    const shapes = draw({
      props: { initials: "A" },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    const bg = circleOf(shapes);
    expect(bg.x).toBe(16);
    expect(bg.y).toBe(16);
    expect(bg.radius).toBe(16);
  });

  describe("이니셜 정렬 — 원 정중앙 (CSS justifyContent:center 대칭)", () => {
    it("x=0 (중심 좌표 아님) — converter 가 containerWidth 전체를 정렬 기준으로 삼도록", () => {
      const shapes = draw({
        props: { initials: "AB" },
        size: sizeMd,
        visual,
        style: undefined,
      })!;
      const text = textOf(shapes);

      // ❌ 회귀: x=radius(16) 를 넘기면 converter 가 paddingLeft=16 / maxWidth=32-32=0(→clamp 32)
      //    로 해석해 정렬 구간이 [16,48] → 이니셜이 원 우측 끝에 그려진다.
      expect(text.x).toBe(0);
      expect(text.align).toBe("center");
    });

    it("y=0 + baseline:middle — 컨테이너 전체 기준 세로 중앙", () => {
      const shapes = draw({
        props: { initials: "AB" },
        size: sizeMd,
        visual,
        style: undefined,
      })!;
      const text = textOf(shapes);
      expect(text.y).toBe(0);
      expect(text.baseline).toBe("middle");
    });

    it("size 가 바뀌어도 x/y 는 0 유지 (지름에 비례한 오프셋 금지)", () => {
      const shapes = draw({
        props: { initials: "AB" },
        size: sizeXl,
        visual,
        style: undefined,
      })!;
      const text = textOf(shapes);
      expect(text.x).toBe(0);
      expect(text.y).toBe(0);
      // 원 자체는 지름(48)을 따른다 — 텍스트만 컨테이너 상대 정렬.
      expect(circleOf(shapes).radius).toBe(24);
    });
  });

  describe("이니셜 텍스트 내용 fallback", () => {
    it("initials 우선", () => {
      const shapes = draw({
        props: { initials: "AB", alt: "Zed Zulu" },
        size: sizeMd,
        visual,
        style: undefined,
      })!;
      expect(textOf(shapes).text).toBe("AB");
    });

    it("initials 없으면 alt 첫 2글자 대문자", () => {
      const shapes = draw({
        props: { alt: "zed" },
        size: sizeMd,
        visual,
        style: undefined,
      })!;
      expect(textOf(shapes).text).toBe("ZE");
    });

    it("둘 다 없으면 '?'", () => {
      const shapes = draw({
        props: {},
        size: sizeMd,
        visual,
        style: undefined,
      })!;
      expect(textOf(shapes).text).toBe("?");
    });
  });

  it("src 가 있으면 image shape (이니셜 text 미생성)", () => {
    const shapes = draw({
      props: { src: "https://example.com/a.png", initials: "AB" },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    expect(shapes.some((s) => s.type === "image")).toBe(true);
    expect(shapes.some((s) => s.type === "text")).toBe(false);
  });
});
