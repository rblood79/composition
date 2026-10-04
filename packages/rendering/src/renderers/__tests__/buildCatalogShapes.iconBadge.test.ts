import { describe, expect, it } from "vitest";

import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { SizeSpec, TokenRef } from "../../types";
import { getSkiaPrimitive } from "./catalogPaintFixture";
import { buildCatalogShapes } from "./catalogPaintFixture";

/**
 * ADR-142 family ① — Icon / Badge catalog-only 검증 (ADR-912 box+text leaf 군, 2026-06-11).
 *
 * Icon.spec.ts / Badge.spec.ts 삭제(ADR-912) 로 legacy render.shapes parity oracle 소멸.
 * 인라인 fixture visual/size 로 skiaPrimitive draw fn 및 buildCatalogShapes 의
 * catalog-only 동작을 직접 검증.
 *
 * **정본**: Icon=`skiaPrimitive:"icon_font"` / Badge dot=`skiaPrimitive:"dot"` /
 * Badge text 모드=buildCatalogShapes(box+text). buildCatalogShapes 안에
 * icon/dot 컴포넌트 식별 분기를 두지 않는다(N++ 복제 방지).
 */

// Icon 인라인 fixture — iconFont 는 size.iconSize + visual.text 만 소비.
function makeIconVisual(textColor: TokenRef): ComponentVisualRule {
  return {
    fill: undefined,
    text: textColor,
    textHover: undefined,
    textWeight: undefined,
    fontFamily: undefined,
    border: undefined,
    borderHover: undefined,
    borderStyle: undefined,
    fillBar: undefined,
    outlineText: undefined,
    outlineBorder: undefined,
    subtleText: undefined,
    selectedText: undefined,
    selectedBorder: undefined,
    emphasizedSelectedText: undefined,
    emphasizedSelectedBorder: undefined,
    leadingIcon: undefined,
    trailingIcon: undefined,
    textAlign: undefined,
  };
}

// Icon sizes fixture (iconSize 기준).
const ICON_SIZES: Record<string, number> = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 40,
};

function makeIconSize(key: string): SizeSpec {
  return { iconSize: ICON_SIZES[key] ?? 24 } as unknown as SizeSpec;
}

// Badge 인라인 fixture — box+text 는 fill.default.base + text 색 소비.
const BADGE_FILL_COLORS: Record<string, TokenRef> = {
  accent: "{color.accent}" as TokenRef,
  positive: "{color.positive}" as TokenRef,
  negative: "{color.negative}" as TokenRef,
  neutral: "{color.neutral-subtle}" as TokenRef,
};

const BADGE_TEXT_COLORS: Record<string, TokenRef> = {
  accent: "{color.on-accent}" as TokenRef,
  positive: "{color.on-accent}" as TokenRef,
  negative: "{color.on-accent}" as TokenRef,
  neutral: "{color.neutral}" as TokenRef,
};

function makeBadgeVisual(variant: string): ComponentVisualRule {
  return {
    fill: {
      default: {
        base: BADGE_FILL_COLORS[variant] ?? ("{color.accent}" as TokenRef),
      },
    },
    text: BADGE_TEXT_COLORS[variant] ?? ("{color.on-accent}" as TokenRef),
    textHover: undefined,
    textWeight: undefined,
    fontFamily: undefined,
    border: undefined,
    borderHover: undefined,
    borderStyle: undefined,
    fillBar: undefined,
    outlineText: undefined,
    outlineBorder: undefined,
    subtleText: undefined,
    selectedText: undefined,
    selectedBorder: undefined,
    emphasizedSelectedText: undefined,
    emphasizedSelectedBorder: undefined,
    leadingIcon: undefined,
    trailingIcon: undefined,
    textAlign: undefined,
  };
}

// Badge sizes fixture (height=dot 지름 기준).
const BADGE_SIZE_HEIGHTS: Record<string, number> = { sm: 20, md: 24, lg: 28 };

function makeBadgeSize(key: string): SizeSpec {
  return {
    height: BADGE_SIZE_HEIGHTS[key] ?? 24,
    fontSize: 12,
    borderRadius: 999,
    paddingX: 6,
    paddingY: 2,
  } as unknown as SizeSpec;
}

describe("skiaPrimitive 'icon_font' — Icon catalog-only 검증", () => {
  const draw = getSkiaPrimitive("icon_font")!;
  const sizes = ["xs", "sm", "md", "lg", "xl"] as const;

  it("draw 함수가 등록되어 있다", () => {
    expect(draw).toBeDefined();
  });

  it("Icon 은 단일 icon_font shape (box/text 없음)", () => {
    const shapes = draw({
      props: { iconName: "check" },
      size: makeIconSize("md"),
      visual: makeIconVisual("{color.neutral}" as TokenRef),
      style: undefined,
    })!;
    expect(shapes).toHaveLength(1);
    expect(shapes[0].type).toBe("icon_font");
    expect((shapes[0] as { iconName?: string }).iconName).toBe("check");
  });

  for (const size of sizes) {
    it(`${size} — icon_font shape 반환 + iconSize 반영`, () => {
      const shapes = draw({
        props: { iconName: "star", variant: "default" },
        size: makeIconSize(size),
        visual: makeIconVisual("{color.neutral}" as TokenRef),
        style: undefined,
      })!;
      expect(shapes).toHaveLength(1);
      expect(shapes[0].type).toBe("icon_font");
      expect((shapes[0] as { fontSize?: number }).fontSize).toBe(
        ICON_SIZES[size],
      );
    });
  }

  it("style.color 가 visual.text 보다 우선", () => {
    const shapes = draw({
      props: { iconName: "star" },
      size: makeIconSize("md"),
      visual: makeIconVisual("{color.neutral}" as TokenRef),
      style: { color: "#ff0000" },
    })!;
    expect(shapes[0].fill).toBe("#ff0000");
  });

  it("visual.text 색이 fill 에 반영", () => {
    const shapes = draw({
      props: { iconName: "circle" },
      size: makeIconSize("md"),
      visual: makeIconVisual("{color.accent}" as TokenRef),
      style: undefined,
    })!;
    expect(shapes[0].fill).toBe("{color.accent}");
  });
});

describe("Badge — text 모드(box+text) catalog-only 검증", () => {
  const sizes = ["sm", "md", "lg"] as const;
  const variants = ["accent", "positive", "negative", "neutral"] as const;

  for (const size of sizes) {
    for (const variant of variants) {
      it(`${variant}/${size} — roundRect + text shape 반환`, () => {
        const props = { children: "5", variant } as Record<string, unknown>;
        const sizeSpec = makeBadgeSize(size);
        const catalog = buildCatalogShapes(
          makeBadgeVisual(variant),
          props,
          sizeSpec,
          "default",
        );
        expect(catalog.some((s) => s.type === "roundRect")).toBe(true);
        expect(catalog.some((s) => s.type === "text")).toBe(true);
        // fill 색이 variant 기준으로 설정됨
        expect(catalog.find((s) => s.type === "roundRect")?.fill).toBe(
          BADGE_FILL_COLORS[variant],
        );
      });
    }
  }
});

describe("skiaPrimitive 'dot' — Badge dot 모드 catalog-only 검증", () => {
  const draw = getSkiaPrimitive("dot")!;
  const sizes = ["sm", "md", "lg"] as const;

  it("draw 함수가 등록되어 있다", () => {
    expect(draw).toBeDefined();
  });

  it("isDot — circle 단일 shape", () => {
    const shapes = draw({
      props: { variant: "accent", isDot: true },
      size: makeBadgeSize("md"),
      visual: makeBadgeVisual("accent"),
      style: undefined,
    })!;
    expect(shapes).toHaveLength(1);
    expect(shapes[0].type).toBe("circle");
  });

  it("non-dot — null 반환 (box+text 로 fallback)", () => {
    const shapes = draw({
      props: { children: "5", variant: "accent" },
      size: makeBadgeSize("md"),
      visual: makeBadgeVisual("accent"),
      style: undefined,
    });
    expect(shapes).toBeNull();
  });

  for (const size of sizes) {
    it(`isDot ${size} — circle fill=fill.default.base`, () => {
      const props = { variant: "negative", isDot: true } as Record<
        string,
        unknown
      >;
      const sizeSpec = makeBadgeSize(size);
      const shapes = draw({
        props,
        size: sizeSpec,
        visual: makeBadgeVisual("negative"),
        style: undefined,
      })!;
      expect(shapes).toHaveLength(1);
      expect(shapes[0].type).toBe("circle");
      expect(shapes[0].fill).toBe(BADGE_FILL_COLORS["negative"]);
    });
  }
});
