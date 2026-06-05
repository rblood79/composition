import { describe, expect, it } from "vitest";

import { ButtonSpec } from "../../components/Button.spec";
import type { ComponentSpec, SizeSpec, TokenRef } from "../../types";
import { buildCatalogShapes } from "../buildCatalogShapes";
import { resolveComponentVisual } from "../utils/resolveComponentVisual";
import { normalizeParityShapes } from "./normalizeParityShapes";

/**
 * ADR-142 G2(b) B — buildCatalogShapes 는 spec-free(visual rule 주입형). 테스트는 specs 내부
 * 어댑터 resolveComponentVisual(spec, name) 로 visual 을 만들어 전달한다(builder 는 rule 테이블,
 * specs 테스트는 spec 어댑터 — 동일 ComponentVisualRule 형태).
 */
function callCatalog(
  spec: ComponentSpec<Record<string, unknown>>,
  props: Record<string, unknown>,
  size: SizeSpec,
  state: Parameters<typeof buildCatalogShapes>[3],
) {
  const variantName =
    (props.variant as string | undefined) ?? spec.defaultVariant;
  const visual = resolveComponentVisual(spec, variantName);
  const textDecoration =
    spec.composition?.rootSelectors?.["&"]?.styles?.["text-decoration"];
  return buildCatalogShapes(
    visual,
    props,
    size,
    state,
    textDecoration && textDecoration !== "none" ? textDecoration : undefined,
  );
}

/**
 * fillStyle(outline/subtle) generic 소비 검증용 fixture.
 * ButtonSpec 의 outline 은 Button-specific 하드코딩(outlineTextMap)이라 parity oracle 로
 * 못 쓴다 — generic 메커니즘은 spec DATA(fill.outline/subtle + variant.outlineText/
 * outlineBorder/subtleText)에서 읽는다. (ButtonSpec outline 데이터 마이그레이션은 flip-time.)
 */
const fillFixtureSpec = {
  defaultVariant: "primary",
  variants: {
    primary: {
      fill: {
        default: { base: "{color.accent}" as TokenRef },
        outline: { base: "{color.transparent}" as TokenRef },
        subtle: { base: "{color.accent-subtle}" as TokenRef },
      },
      text: "{color.on-accent}" as TokenRef,
      outlineText: "{color.accent}" as TokenRef,
      subtleText: "{color.accent}" as TokenRef,
      border: "{color.accent}" as TokenRef,
      outlineBorder: "{color.border-hover}" as TokenRef,
    },
  },
} as unknown as ComponentSpec<Record<string, unknown>>;

const fixtureSize = {
  borderRadius: 6,
  paddingX: 12,
  fontSize: 14,
  gap: 8,
} as unknown as SizeSpec;

/**
 * ADR-142 #5 increment (a) — generic shape-descriptor 생성기 parity.
 *
 * buildCatalogShapes 는 per-component render.shapes 를 대체하는 generic 생성기.
 * box+text leaf primitive 의 공통 경로(bg roundRect + border + text-only)에 대해
 * ButtonSpec.render.shapes 출력과 동일해야 한다(parity oracle).
 *
 * cutover leaf Button(#7 binding)은 icon/fillStyle 을 받지 않으므로
 * (아이콘 Button=reusable, fillStyle deferred) 공통 경로만 검증 대상.
 */
describe("buildCatalogShapes — ADR-142 #5 generic box+text shape 생성기", () => {
  const md = ButtonSpec.sizes.md;

  it("primary Button default — render.shapes 와 parity (bg+border+text)", () => {
    const props = { children: "OK" } as Record<string, unknown>;
    const expected = ButtonSpec.render.shapes(
      props as Parameters<typeof ButtonSpec.render.shapes>[0],
      md,
      "default",
    );
    const actual = callCatalog(ButtonSpec, props, md, "default");
    expect(normalizeParityShapes(actual)).toEqual(
      normalizeParityShapes(expected),
    );
  });

  it("hover state — render.shapes 와 parity (state별 fill)", () => {
    const props = { children: "OK" } as Record<string, unknown>;
    const expected = ButtonSpec.render.shapes(
      props as Parameters<typeof ButtonSpec.render.shapes>[0],
      md,
      "hover",
    );
    const actual = callCatalog(ButtonSpec, props, md, "hover");
    expect(normalizeParityShapes(actual)).toEqual(
      normalizeParityShapes(expected),
    );
  });

  it("_hasChildren shell — text 없이 bg(+border)만 반환", () => {
    const props = { children: "OK", _hasChildren: true } as Record<
      string,
      unknown
    >;
    const expected = ButtonSpec.render.shapes(
      props as Parameters<typeof ButtonSpec.render.shapes>[0],
      md,
      "default",
    );
    const actual = callCatalog(ButtonSpec, props, md, "default");
    expect(actual).toEqual(expected);
    expect(actual.some((s) => s.type === "text")).toBe(false);
  });

  it("variant 지정 (secondary) — render.shapes 와 parity", () => {
    const props = { children: "Go", variant: "secondary" } as Record<
      string,
      unknown
    >;
    const expected = ButtonSpec.render.shapes(
      props as Parameters<typeof ButtonSpec.render.shapes>[0],
      md,
      "default",
    );
    const actual = callCatalog(ButtonSpec, props, md, "default");
    expect(normalizeParityShapes(actual)).toEqual(
      normalizeParityShapes(expected),
    );
  });

  it("label 이 legacy children 보다 우선한다", () => {
    const shapes = callCatalog(
      ButtonSpec,
      { label: "Actions", children: "Legacy" },
      md,
      "default",
    );
    expect(shapes.find((s) => s.type === "text")?.text).toBe("Actions");
  });
});

describe("buildCatalogShapes — fillStyle(outline/subtle) generic 소비 (foundation #2)", () => {
  it("fillStyle=outline — bg=fill.outline.base, text=variant.outlineText, border=variant.outlineBorder", () => {
    const shapes = callCatalog(
      fillFixtureSpec,
      { children: "X", variant: "primary", fillStyle: "outline" },
      fixtureSize,
      "default",
    );
    expect(shapes.find((s) => s.type === "roundRect")?.fill).toBe(
      "{color.transparent}",
    );
    expect(shapes.find((s) => s.type === "border")?.color).toBe(
      "{color.border-hover}",
    );
    expect(shapes.find((s) => s.type === "text")?.fill).toBe("{color.accent}");
  });

  it("fillStyle=subtle — bg=fill.subtle.base, text=variant.subtleText", () => {
    const shapes = callCatalog(
      fillFixtureSpec,
      { children: "X", variant: "primary", fillStyle: "subtle" },
      fixtureSize,
      "default",
    );
    expect(shapes.find((s) => s.type === "roundRect")?.fill).toBe(
      "{color.accent-subtle}",
    );
    expect(shapes.find((s) => s.type === "text")?.fill).toBe("{color.accent}");
  });

  it("fillStyle 미지정(fill) — fill.default.base / variant.text / variant.border (회귀 0)", () => {
    const shapes = callCatalog(
      fillFixtureSpec,
      { children: "X", variant: "primary" },
      fixtureSize,
      "default",
    );
    expect(shapes.find((s) => s.type === "roundRect")?.fill).toBe(
      "{color.accent}",
    );
    expect(shapes.find((s) => s.type === "text")?.fill).toBe(
      "{color.on-accent}",
    );
    expect(shapes.find((s) => s.type === "border")?.color).toBe(
      "{color.accent}",
    );
  });
});
