import { describe, expect, it } from "vitest";

import { BadgeSpec } from "../../components/Badge.spec";
import { IconSpec } from "../../components/Icon.spec";
import { getSkiaPrimitive } from "../skiaPrimitives";
import { resolveComponentVisual } from "../utils/resolveComponentVisual";
import { callCatalogShapes as buildCatalogShapes } from "./callCatalogShapes";
import { normalizeParityShapes } from "./normalizeParityShapes";

/**
 * ADR-142 family ① — Icon / Badge 시각 parity 실측.
 *
 * **정본 (2026-05-31 정정)**: 비-DOM-trivial primitive(아이콘=icon_font / dot=circle)는
 * `skiaPrimitive` draw module 이 그린다. box+text(Badge text 모드)만 buildCatalogShapes.
 * Icon=`skiaPrimitive:"icon_font"` / Badge dot=`skiaPrimitive:"dot"`(isDot 아니면 null→box+text).
 * buildCatalogShapes 안에 icon/dot 컴포넌트 식별 분기를 두지 않는다(N++ 복제 방지).
 *
 * ADR-142 B2: draw fn 은 ComponentVisualRule 수신(spec-free). 테스트는 specs 어댑터로 변환.
 */

const visualOf = (spec: typeof IconSpec | typeof BadgeSpec, variant: string) =>
  resolveComponentVisual(spec as never, variant);

describe("skiaPrimitive 'icon_font' — Icon parity", () => {
  const draw = getSkiaPrimitive("icon_font")!;
  const sizes = ["xs", "sm", "md", "lg", "xl"] as const;

  for (const size of sizes) {
    it(`${size} — legacy icon_font 와 parity`, () => {
      const props = { iconName: "star", variant: "default" } as Record<
        string,
        unknown
      >;
      const sizeSpec = IconSpec.sizes[size];
      const legacy = IconSpec.render.shapes(
        props as Parameters<typeof IconSpec.render.shapes>[0],
        sizeSpec,
        "default",
      );
      const primitive = draw({
        props,
        size: sizeSpec,
        visual: visualOf(IconSpec, "default"),
        style: undefined,
      });
      expect(primitive).toEqual(legacy);
    });
  }

  it("Icon 은 단일 icon_font shape (box/text 없음)", () => {
    const shapes = draw({
      props: { iconName: "check" },
      size: IconSpec.sizes.md,
      visual: visualOf(IconSpec, "default"),
      style: undefined,
    })!;
    expect(shapes).toHaveLength(1);
    expect(shapes[0].type).toBe("icon_font");
    expect(shapes[0].iconName).toBe("check");
  });
});

describe("Badge — text 모드(box+text) buildCatalogShapes parity", () => {
  const sizes = ["sm", "md", "lg"] as const;
  const variants = ["accent", "positive", "negative", "neutral"] as const;

  for (const size of sizes) {
    for (const variant of variants) {
      it(`${variant}/${size} 일반 모드 — legacy parity (fillAlpha+lineHeight 정규화)`, () => {
        const props = { children: "5", variant } as Record<string, unknown>;
        const sizeSpec = BadgeSpec.sizes[size];
        const legacy = BadgeSpec.render.shapes(
          props as Parameters<typeof BadgeSpec.render.shapes>[0],
          sizeSpec,
          "default",
        );
        const catalog = buildCatalogShapes(
          BadgeSpec,
          props,
          sizeSpec,
          "default",
        );
        // 시각 동등성 정규화(fillAlpha + box leaf text lineHeight) — normalizeParityShapes 공유 헬퍼.
        //   Badge legacy bg fillAlpha 생략(specShapeConverter ?? 1) + legacy text lineHeight 생략
        //   (getLabelLineHeight fallback = generic size.lineHeight 동일 토큰, box 시각 무영향).
        expect(normalizeParityShapes(catalog)).toEqual(
          normalizeParityShapes(legacy),
        );
      });
    }
  }
});

describe("skiaPrimitive 'dot' — Badge dot 모드 parity", () => {
  const draw = getSkiaPrimitive("dot")!;
  const sizes = ["sm", "md", "lg"] as const;

  it("isDot — circle 단일 shape", () => {
    const shapes = draw({
      props: { variant: "accent", isDot: true },
      size: BadgeSpec.sizes.md,
      visual: visualOf(BadgeSpec, "accent"),
      style: undefined,
    })!;
    expect(shapes).toHaveLength(1);
    expect(shapes[0].type).toBe("circle");
  });

  it("isDot circle — legacy parity", () => {
    for (const size of sizes) {
      const props = { variant: "negative", isDot: true } as Record<
        string,
        unknown
      >;
      const sizeSpec = BadgeSpec.sizes[size];
      const legacy = BadgeSpec.render.shapes(
        props as Parameters<typeof BadgeSpec.render.shapes>[0],
        sizeSpec,
        "default",
      );
      const primitive = draw({
        props,
        size: sizeSpec,
        visual: visualOf(BadgeSpec, "negative"),
        style: undefined,
      });
      expect(primitive).toEqual(legacy);
    }
  });

  it("non-dot — null 반환 (box+text 로 fallback)", () => {
    const shapes = draw({
      props: { children: "5", variant: "accent" },
      size: BadgeSpec.sizes.md,
      visual: visualOf(BadgeSpec, "accent"),
      style: undefined,
    });
    expect(shapes).toBeNull();
  });
});
