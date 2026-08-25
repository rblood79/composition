import { describe, expect, it } from "vitest";

import type { ComponentSpec, SizeSpec, TokenRef } from "../../types";
import { buildCatalogShapes } from "./catalogPaintFixture";
import { resolveComponentVisual } from "../utils/resolveComponentVisual";

// ADR-912 box+text leaf 군 (2026-06-11): Button.spec 삭제 → render.shapes parity oracle 소멸.
//   첫 describe(ButtonSpec parity)는 제거(catalog 가 유일 정본, CSS diff 0 으로 시각 동등 입증).
//   둘째 describe(fillFixtureSpec generic fillStyle 소비)는 인라인 fixture 기반이라 보존.

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
 * box+text leaf 공통 경로(label 우선 / shell) generic 검증 — 인라인 fixture 기반(spec-free).
 *   Button.spec 삭제 후 parity oracle 대신 buildCatalogShapes 자체 동작을 직접 단언.
 */
describe("buildCatalogShapes — box+text generic 공통 경로", () => {
  it("label 이 legacy children 보다 우선한다", () => {
    const shapes = callCatalog(
      fillFixtureSpec,
      { label: "Actions", children: "Legacy", variant: "primary" },
      fixtureSize,
      "default",
    );
    expect(shapes.find((s) => s.type === "text")?.text).toBe("Actions");
  });

  it("_hasChildren shell — text 없이 bg(+border)만 반환", () => {
    const shapes = callCatalog(
      fillFixtureSpec,
      { children: "OK", variant: "primary", _hasChildren: true },
      fixtureSize,
      "default",
    );
    expect(shapes.some((s) => s.type === "text")).toBe(false);
    expect(shapes.some((s) => s.type === "roundRect")).toBe(true);
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

  it("transparent border channel은 layout 폭만 보존하고 border shape를 추가하지 않는다", () => {
    const visual = resolveComponentVisual(fillFixtureSpec, "primary")!;
    const shapes = buildCatalogShapes(
      { ...visual, border: "{color.transparent}" as TokenRef },
      { children: "X", variant: "primary" },
      { ...fixtureSize, borderWidth: 1 },
      "default",
    );

    expect(shapes.some((shape) => shape.type === "roundRect")).toBe(true);
    expect(shapes.some((shape) => shape.type === "border")).toBe(false);
  });
});
