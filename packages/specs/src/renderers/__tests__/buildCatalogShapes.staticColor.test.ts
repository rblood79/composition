/**
 * staticColor (RSP S2 D2 prop) — 고정 흑백 스킴 분기 (2026-08-20 Button 채택).
 *
 * 의미론 (CSS Button.css `[data-static-color]` 와 대칭):
 * - opaque bg 채널 보유 + fill: bg=static, text=역상(흑↔백), border=static.
 * - outline/subtle: bg 는 fillStyle 규칙 유지(투명), text·border=static.
 * - bg 채널이 시각적으로 부재(Link 형 — transparent base / alpha 0): text 단독 static
 *   (기존 Link 동작 보존 — 역상 미적용).
 * - auto/미지정: variant 색 경로 그대로. 사용자 style.color 는 static 보다 우선.
 *
 * 실행: pnpm vitest buildCatalogShapes.staticColor
 */

import { describe, expect, it } from "vitest";

import type { ComponentSpec, SizeSpec, TokenRef } from "../../types";
import { buildCatalogShapes } from "./catalogPaintFixture";
import { resolveComponentVisual } from "../utils/resolveComponentVisual";

function callCatalog(
  spec: ComponentSpec<Record<string, unknown>>,
  props: Record<string, unknown>,
  size: SizeSpec,
) {
  const variantName =
    (props.variant as string | undefined) ?? spec.defaultVariant;
  const visual = resolveComponentVisual(spec, variantName);
  return buildCatalogShapes(visual, props, size, "default");
}

/** Button 형 — opaque bg + border 채널 보유. */
const buttonLikeSpec = {
  defaultVariant: "accent",
  variants: {
    accent: {
      fill: {
        default: { base: "{color.accent}" as TokenRef },
        outline: { base: "{color.transparent}" as TokenRef },
      },
      text: "{color.on-accent}" as TokenRef,
      outlineText: "{color.accent}" as TokenRef,
      border: "{color.accent}" as TokenRef,
      outlineBorder: "{color.border-hover}" as TokenRef,
    },
  },
} as unknown as ComponentSpec<Record<string, unknown>>;

/** Link 형 — bg 시각 부재(transparent + alpha 0), border 채널 없음. */
const textOnlySpec = {
  defaultVariant: "primary",
  variants: {
    primary: {
      fill: {
        default: { base: "{color.transparent}" as TokenRef },
        alpha: 0,
      },
      text: "{color.accent}" as TokenRef,
    },
  },
} as unknown as ComponentSpec<Record<string, unknown>>;

const size = {
  borderRadius: 6,
  paddingX: 12,
  fontSize: 14,
  gap: 8,
} as unknown as SizeSpec;

function shapeParts(shapes: ReturnType<typeof buildCatalogShapes>) {
  return {
    bg: shapes.find((s) => s.type === "roundRect"),
    border: shapes.find((s) => s.type === "border"),
    text: shapes.find((s) => s.type === "text"),
  };
}

describe("buildCatalogShapes — staticColor 고정 스킴", () => {
  it("fill + white: bg=#ffffff / text=역상 #000000 / border=#ffffff", () => {
    const { bg, border, text } = shapeParts(
      callCatalog(
        buttonLikeSpec,
        { children: "Save", staticColor: "white" },
        size,
      ),
    );
    expect(bg?.fill).toBe("#ffffff");
    expect(border?.color).toBe("#ffffff");
    expect(text?.fill).toBe("#000000");
  });

  it("fill + black: bg=#000000 / text=역상 #ffffff / border=#000000", () => {
    const { bg, border, text } = shapeParts(
      callCatalog(
        buttonLikeSpec,
        { children: "Save", staticColor: "black" },
        size,
      ),
    );
    expect(bg?.fill).toBe("#000000");
    expect(border?.color).toBe("#000000");
    expect(text?.fill).toBe("#ffffff");
  });

  it("outline + white: bg 는 outline 투명 유지, text·border=#ffffff", () => {
    const { bg, border, text } = shapeParts(
      callCatalog(
        buttonLikeSpec,
        { children: "Save", staticColor: "white", fillStyle: "outline" },
        size,
      ),
    );
    expect(bg?.fill).toBe("{color.transparent}");
    expect(border?.color).toBe("#ffffff");
    expect(text?.fill).toBe("#ffffff");
  });

  it("text-only(Link 형) + black: 역상 없이 text=#000000 (기존 동작 보존)", () => {
    const shapes = callCatalog(
      textOnlySpec,
      { children: "Link", staticColor: "black" },
      size,
    );
    const { text } = shapeParts(shapes);
    expect(text?.fill).toBe("#000000");
    // alpha 0 + border 채널 없음 → box 미생성 (배경/역상 오염 없음)
    expect(shapes.some((s) => s.type === "border")).toBe(false);
  });

  it("auto: variant 색 경로 유지", () => {
    const { bg, text } = shapeParts(
      callCatalog(
        buttonLikeSpec,
        { children: "Save", staticColor: "auto" },
        size,
      ),
    );
    expect(bg?.fill).toBe("{color.accent}");
    expect(text?.fill).toBe("{color.on-accent}");
  });

  it("사용자 style.color 명시는 staticColor 보다 우선", () => {
    const { text } = shapeParts(
      callCatalog(
        buttonLikeSpec,
        {
          children: "Save",
          staticColor: "white",
          style: { color: "#ff0000" },
        },
        size,
      ),
    );
    expect(text?.fill).toBe("#ff0000");
  });
});
