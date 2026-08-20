/**
 * quiet fill preset (2026-08-21 신설) — `isQuiet` boolean prop 이 고르는 fill 축.
 *
 * 의미론 (generated CSS `[data-quiet]` 규칙과 대칭):
 * - `fill.quiet` 이 **정의된** 경우에만 분기한다 — 미정의 컴포넌트에서 `isQuiet` 을 켜도
 *   기존 동작이 그대로여야 한다 (정의 없이 분기하면 배경이 통째 사라진다).
 * - selected 는 quiet 을 타지 않는다 — `isSelected` 가 fillStates 보다 우선 처리되어
 *   선택 표시가 유지된다 (Spectrum quiet ActionButton 정합).
 * - hover/pressed 는 quiet preset 안의 값으로 해소된다.
 *
 * 실행: pnpm vitest buildCatalogShapes.quiet
 */

import { describe, expect, it } from "vitest";

import type { ComponentSpec, SizeSpec, TokenRef } from "../../types";
import { buildCatalogShapes } from "../buildCatalogShapes";
import { resolveComponentVisual } from "../utils/resolveComponentVisual";

const size = {
  paddingX: 8,
  paddingY: 4,
  fontSize: "{typography.text-sm}" as TokenRef,
  borderRadius: "{radius.md}" as TokenRef,
  borderWidth: 1,
  height: 0,
} as unknown as SizeSpec;

/** quiet preset 을 갖는 ToggleButton 형. */
const quietCapableSpec = {
  defaultVariant: "default",
  variants: {
    default: {
      fill: {
        default: {
          base: "{color.neutral-subtle}" as TokenRef,
          hover: "{color.neutral-hover}" as TokenRef,
          selected: "{color.neutral}" as TokenRef,
        },
        quiet: {
          base: "{color.transparent}" as TokenRef,
          hover: "{color.neutral-subtle}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      border: "{color.transparent}" as TokenRef,
      selectedText: "{color.base}" as TokenRef,
    },
  },
} as unknown as ComponentSpec<Record<string, unknown>>;

/** quiet preset 이 없는 기존 컴포넌트 (회귀 대조군). */
const quietAbsentSpec = {
  defaultVariant: "default",
  variants: {
    default: {
      fill: {
        default: {
          base: "{color.neutral-subtle}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
    },
  },
} as unknown as ComponentSpec<Record<string, unknown>>;

function bgOf(
  spec: ComponentSpec<Record<string, unknown>>,
  props: Record<string, unknown>,
  state: "default" | "hover" | "pressed" = "default",
) {
  const visual = resolveComponentVisual(spec, spec.defaultVariant as string);
  const shapes = buildCatalogShapes(visual, props, size, state);
  const box = shapes.find((s) => s.type === "rect" || s.type === "roundRect");
  return (box as { fill?: string } | undefined)?.fill;
}

describe("buildCatalogShapes — quiet fill preset", () => {
  it("isQuiet=true 면 quiet.base 를 쓴다", () => {
    expect(bgOf(quietCapableSpec, { isQuiet: true })).toBe(
      "{color.transparent}",
    );
  });

  it("isQuiet 미지정이면 default.base 그대로", () => {
    expect(bgOf(quietCapableSpec, {})).toBe("{color.neutral-subtle}");
  });

  it("quiet 의 hover 는 preset 안의 값으로 해소된다", () => {
    expect(bgOf(quietCapableSpec, { isQuiet: true }, "hover")).toBe(
      "{color.neutral-subtle}",
    );
  });

  it("selected 는 quiet 을 타지 않는다 — 선택 표시 유지", () => {
    expect(bgOf(quietCapableSpec, { isQuiet: true, isSelected: true })).toBe(
      "{color.neutral}",
    );
  });

  it("quiet preset 미정의 컴포넌트는 isQuiet 을 켜도 기존 배경을 유지한다", () => {
    expect(bgOf(quietAbsentSpec, { isQuiet: true })).toBe(
      "{color.neutral-subtle}",
    );
  });
});
