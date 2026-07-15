import { describe, expect, it } from "vitest";

import type { ComponentSpec, SizeSpec, TokenRef } from "../../types";
import { buildCatalogShapes } from "../buildCatalogShapes";
import { resolveComponentVisual } from "../utils/resolveComponentVisual";

/**
 * Phase 2 — catalog 경로 border-style 3경로 공통 소비 회귀 테스트.
 *
 * 확정 결함: buildCatalogShapes 가 catalog visual.borderStyle 만 읽고 사용자
 * style.borderStyle 을 무시했다. 수정: 사용자 style → catalog visual → (미지정 시)
 * converter "solid" fallback 우선순위. "none" 은 border shape 자체를 생성하지 않는다.
 */
const borderVariantSpec = {
  defaultVariant: "primary",
  variants: {
    primary: {
      fill: { default: { base: "{color.accent}" as TokenRef } },
      text: "{color.on-accent}" as TokenRef,
      border: "{color.accent}" as TokenRef,
      borderStyle: "dashed", // catalog visual.borderStyle
    },
  },
} as unknown as ComponentSpec<Record<string, unknown>>;

const size = {
  borderRadius: 6,
  paddingX: 12,
  fontSize: 14,
  gap: 8,
  borderWidth: 1,
} as unknown as SizeSpec;

function build(props: Record<string, unknown>) {
  const visual = resolveComponentVisual(borderVariantSpec, "primary");
  return buildCatalogShapes(visual, props, size, "default");
}

describe("buildCatalogShapes — border-style 3경로 공통 소비 (Phase 2)", () => {
  it("사용자 style.borderStyle 이 catalog visual.borderStyle 을 override", () => {
    const shapes = build({
      children: "X",
      variant: "primary",
      style: { borderStyle: "dotted" },
    });
    expect(shapes.find((s) => s.type === "border")?.style).toBe("dotted");
  });

  it("사용자 style.borderStyle 미지정 시 catalog visual.borderStyle 사용", () => {
    const shapes = build({ children: "X", variant: "primary" });
    expect(shapes.find((s) => s.type === "border")?.style).toBe("dashed");
  });

  it("style.borderStyle=none — border shape 생성 안 함 (테두리 숨김, bg 는 유지)", () => {
    const shapes = build({
      children: "X",
      variant: "primary",
      style: { borderStyle: "none", borderColor: "#ff0000" },
    });
    expect(shapes.some((s) => s.type === "border")).toBe(false);
    expect(shapes.some((s) => s.type === "roundRect")).toBe(true);
  });

  it("사용자 style.borderColor/borderWidth 가 border shape 에 반영 (companion 계약 산출물)", () => {
    const shapes = build({
      children: "X",
      variant: "primary",
      style: { borderColor: "#123456", borderWidth: 2, borderStyle: "solid" },
    });
    const border = shapes.find((s) => s.type === "border");
    expect(border?.color).toBe("#123456");
    expect(border?.borderWidth).toBe(2);
    // solid 는 명시 style 로 통과 (converter 가 동일 solid 처리)
    expect(border?.style).toBe("solid");
  });

  it("widening — 확장 style(double 등)도 border shape.style 로 통과", () => {
    const shapes = build({
      children: "X",
      variant: "primary",
      style: { borderStyle: "double" },
    });
    expect(shapes.find((s) => s.type === "border")?.style).toBe("double");
  });
});
