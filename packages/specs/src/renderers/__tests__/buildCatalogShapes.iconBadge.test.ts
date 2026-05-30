import { describe, expect, it } from "vitest";

import { BadgeSpec } from "../../components/Badge.spec";
import { IconSpec } from "../../components/Icon.spec";
import { buildCatalogShapes } from "../buildCatalogShapes";

/**
 * ADR-142 family ① — Icon(icon_font) / Badge(roundRect+text / isDot circle) 가
 * generic buildCatalogShapes 로 legacy render.shapes 와 parity 인지 실측.
 * 특수 shape(icon_font / circle)도 spec 데이터(iconName / isDot) 기반 generic 분기 — type 분기 없음.
 */

describe("buildCatalogShapes — Icon icon_font parity", () => {
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
      const catalog = buildCatalogShapes(IconSpec, props, sizeSpec, "default");
      expect(catalog).toEqual(legacy);
    });
  }

  it("Icon 은 단일 icon_font shape (box/text 없음)", () => {
    const catalog = buildCatalogShapes(
      IconSpec,
      { iconName: "check" },
      IconSpec.sizes.md,
      "default",
    );
    expect(catalog).toHaveLength(1);
    expect(catalog[0].type).toBe("icon_font");
    expect(catalog[0].iconName).toBe("check");
  });
});

describe("buildCatalogShapes — Badge parity (roundRect+text / isDot circle)", () => {
  const sizes = ["sm", "md", "lg"] as const;
  const variants = ["accent", "positive", "negative", "neutral"] as const;

  for (const size of sizes) {
    for (const variant of variants) {
      it(`${variant}/${size} 일반 모드 — legacy parity (fillAlpha 정규화)`, () => {
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
        // Badge legacy bg 는 fillAlpha 생략(undefined) → 시각 동등성 정규화(specShapeConverter ?? 1)
        const normalized = legacy.map((s) =>
          s.type === "roundRect" && s.fillAlpha == null
            ? { ...s, fillAlpha: 1 }
            : s,
        );
        expect(catalog).toEqual(normalized);
      });
    }
  }

  it("isDot — circle 단일 shape", () => {
    const catalog = buildCatalogShapes(
      BadgeSpec,
      { variant: "accent", isDot: true },
      BadgeSpec.sizes.md,
      "default",
    );
    expect(catalog).toHaveLength(1);
    expect(catalog[0].type).toBe("circle");
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
      const catalog = buildCatalogShapes(BadgeSpec, props, sizeSpec, "default");
      expect(catalog).toEqual(legacy);
    }
  });
});
