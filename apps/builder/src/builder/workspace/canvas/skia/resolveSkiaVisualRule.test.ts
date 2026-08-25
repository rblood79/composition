import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { isCatalogCutover } from "@composition/shared";
import { buildCatalogShapes, type SizeSpec } from "@composition/specs";
import { getSpecForTag } from "../styleConversion/tagSpecMap";
import {
  resolveSkiaCatalogRenderInput,
  resolveSkiaVisualRule,
  resolveSkiaRule,
  ruleSizeToSizeSpec,
} from "./resolveSkiaVisualRule";

/**
 * ADR-912 단계5 (2026-06-18): "table(정본) ← spec(추종) drift 검출" describe 제거.
 *   cutover type 의 spec 은 전수 물리 삭제(spec map 114→3)되어 getSpecForTag(cutoverType)=null →
 *   추종 대상 0 = 검증 무의미(헤더가 예고한 단계5 제거 시점 도달). resolveComponentVisual 함수도
 *   barrel 제외(test-only) → 본 describe 가 유일 builder 측 import 였다. 아래 Button size /
 *   TokenRef 보존 describe 는 resolveSkiaRule/resolveSkiaVisualRule 만 쓰므로 보존.
 */

/**
 * ADR-912 1C — Button size source seam 제거 증명.
 *
 * Button(catalog Skia cutover)의 size 시각값이 **theme rule table(정본)**에서 나오고,
 * ButtonSpec.sizes 를 거치지 않아도 완전한지(paddingX 포함) 검증한다. dispatch
 * (buildSpecNodeData)가 catalog cutover type 에 대해 `resolveSkiaRule(type).sizes[size]`
 * → `ruleSizeToSizeSpec` 으로 sizeSpec 을 구성하므로, 본 검증이 통과하면 Button 이
 * ButtonSpec.sizes 없이 동작함(seam 실제 제거)이 구조적으로 증명된다.
 */
describe("resolveSkiaRule — Button size source = theme rule table (ADR-912 1C seam 제거)", () => {
  it("Button 은 catalog cutover (table size 경로 진입 조건)", () => {
    expect(isCatalogCutover("Button")).toBe(true);
  });

  it("table Button size 가 paddingX 를 포함 (1C 이전 완료 — leaf 텍스트 inset base)", () => {
    const rule = resolveSkiaRule("Button");
    expect(rule).toBeDefined();
    // 5 size 전부 paddingX 존재 (spec.sizes 4/8/12/16/24 이전).
    const expected: Record<string, number> = {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
    };
    for (const [size, px] of Object.entries(expected)) {
      expect(rule?.sizes[size]?.paddingX).toBe(px);
    }
  });

  it("table size → SizeSpec 투영(ruleSizeToSizeSpec)이 시각 필드 보존", () => {
    const rule = resolveSkiaRule("Button");
    const md = rule?.sizes["md"];
    expect(md).toBeDefined();
    const projected = ruleSizeToSizeSpec(md!);
    // buildCatalogShapes 가 소비하는 size 필드 전부 — table 값 그대로 통과.
    expect(projected.fontSize).toBe("{typography.text-sm}");
    expect(projected.borderRadius).toBe("{radius.md}");
    expect(projected.borderWidth).toBe(1);
    expect(projected.paddingX).toBe(12);
  });

  it("table Button size 가 spec.sizes(추종)와 시각 일치 — drift 0 (단계 5 전 guardrail)", () => {
    const rule = resolveSkiaRule("Button");
    const spec = getSpecForTag("Button");
    if (!spec?.sizes) return;
    for (const size of ["xs", "sm", "md", "lg", "xl"]) {
      const t = rule?.sizes[size];
      const s = spec.sizes[size] as unknown as
        Record<string, unknown> | undefined;
      if (!t || !s) continue;
      // 정본(table) 기준 — spec 이 따라오는지. fontSize/borderRadius/paddingX 핵심 시각값.
      expect(t.fontSize).toBe(s.fontSize);
      expect(t.borderRadius).toBe(s.borderRadius);
      expect(t.paddingX).toBe(s.paddingX);
    }
  });
});

describe("resolveSkiaVisualRule — TokenRef 문자열 보존 (dark mode 반전 runtime 위임)", () => {
  it("adaptive 토큰(`{color.base}` 등)이 변환 없이 string 그대로 전달된다", () => {
    // Badge accent variant 의 fill base 는 TokenRef — resolve(실수값 변환)는 runtime 책임.
    const visual = resolveSkiaVisualRule("Button", "primary");
    const base = visual?.fill?.default.base;
    expect(typeof base).toBe("string");
    // `{color.X}` 형태 보존 (resolveToken 이 light/dark 분기) — 미리 hex 로 변환되면 안 됨.
    if (base) expect(base.startsWith("{")).toBe(true);
  });
});

describe("resolveSkiaCatalogRenderInput — ADR-912 후속 Phase 2 paint adapter", () => {
  it("adapter production body의 resolveCatalogPaint 호출은 element당 1회다", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "src/builder/workspace/canvas/skia/resolveSkiaVisualRule.ts",
      ),
      "utf8",
    );
    const body = source.slice(
      source.indexOf("export function resolveSkiaCatalogRenderInput"),
      source.indexOf(
        "/** ComponentRuleSize",
        source.indexOf("export function resolveSkiaCatalogRenderInput"),
      ),
    );

    expect(body.match(/resolveCatalogPaint\(/g)).toHaveLength(1);
  });

  it("selected/emphasized authored state를 visual과 같은 rule에서 paint로 한 번 해소한다", () => {
    const resolved = resolveSkiaCatalogRenderInput(
      "ToggleButton",
      {
        variant: "default",
        size: "md",
        isSelected: true,
        isEmphasized: true,
      },
      "default",
    );

    expect(resolved.rule).toBe(resolveSkiaRule("ToggleButton"));
    expect(resolved.visual).toBeDefined();
    expect(resolved.paint).toMatchObject({
      backgroundColor:
        resolved.rule?.variants.default?.fill.default.emphasizedSelected ??
        resolved.rule?.variants.default?.fill.default.selected,
      color:
        resolved.rule?.variants.default?.colors?.emphasizedSelectedText ??
        resolved.rule?.variants.default?.colors?.selectedText,
      borderColor:
        resolved.rule?.variants.default?.colors?.emphasizedSelectedBorder ??
        resolved.rule?.variants.default?.colors?.selectedBorder,
    });
  });

  it("focused/disabled는 transient paint 축을 만들지 않고 default interaction으로 투영한다", () => {
    const props = { variant: "primary", size: "md" };
    const defaultPaint = resolveSkiaCatalogRenderInput(
      "Button",
      props,
      "default",
    ).paint;

    expect(
      resolveSkiaCatalogRenderInput("Button", props, "focused").paint,
    ).toEqual(defaultPaint);
    expect(
      resolveSkiaCatalogRenderInput("Button", props, "disabled").paint,
    ).toEqual(defaultPaint);
  });

  it("inline style과 staticColor를 shared resolver precedence로 보존한다", () => {
    expect(
      resolveSkiaCatalogRenderInput(
        "Button",
        {
          variant: "accent",
          size: "md",
          staticColor: "black",
          style: { color: "#123456" },
        },
        "pressed",
      ).paint,
    ).toMatchObject({
      backgroundColor: "#000000",
      color: "#123456",
      borderColor: "#000000",
    });
  });

  it.each([
    [
      "accent",
      "{color.accent}",
      "{color.accent-subtle}",
      "{color.on-accent}",
      "{color.accent}",
    ],
    [
      "informative",
      "{color.informative}",
      "{color.informative-subtle}",
      "{color.white}",
      "{color.informative}",
    ],
    [
      "neutral",
      "{color.neutral}",
      "{color.neutral-subtle}",
      "{color.base}",
      "{color.neutral}",
    ],
    [
      "positive",
      "{color.positive}",
      "{color.positive-subtle}",
      "{color.white}",
      "{color.positive}",
    ],
    [
      "notice",
      "{color.notice}",
      "{color.notice-subtle}",
      "{color.white}",
      "{color.notice}",
    ],
    [
      "negative",
      "{color.negative}",
      "{color.negative-subtle}",
      "{color.on-negative}",
      "{color.negative}",
    ],
  ])(
    "Badge %s의 bold/subtle/outline paint를 catalog에서 해소한다",
    (variant, boldBackground, subtleBackground, boldText, hue) => {
      const actual = (["bold", "subtle", "outline"] as const).map(
        (fillStyle) =>
          resolveSkiaCatalogRenderInput(
            "Badge",
            { size: "sm", variant, fillStyle },
            "default",
          ).paint,
      );

      expect(actual).toEqual([
        expect.objectContaining({
          backgroundColor: boldBackground,
          borderColor: "{color.transparent}",
          color: boldText,
        }),
        expect.objectContaining({
          backgroundColor: subtleBackground,
          borderColor: "{color.transparent}",
          color: hue,
        }),
        expect.objectContaining({
          backgroundColor: "{color.transparent}",
          borderColor: hue,
          color: hue,
        }),
      ]);

      const borderShapeCounts = (["bold", "subtle", "outline"] as const).map(
        (fillStyle) => {
          const props = {
            children: "Badge",
            size: "sm",
            variant,
            fillStyle,
          };
          const input = resolveSkiaCatalogRenderInput(
            "Badge",
            props,
            "default",
          );
          const size = ruleSizeToSizeSpec(input.rule!.sizes.sm) as SizeSpec;
          return buildCatalogShapes(
            input.visual,
            input.paint,
            props,
            size,
          ).filter((shape) => shape.type === "border").length;
        },
      );

      expect(borderShapeCounts).toEqual([0, 0, 1]);
    },
  );
});
