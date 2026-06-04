import { describe, expect, it } from "vitest";

import { LinkSpec } from "../../components/Link.spec";
import { ToggleButtonSpec } from "../../components/ToggleButton.spec";
import { callCatalogShapes as buildCatalogShapes } from "./callCatalogShapes";
import { normalizeParityShapes } from "./normalizeParityShapes";

/**
 * ADR-142 family ① — Link / ToggleButton 가 generic buildCatalogShapes 로 legacy
 * render.shapes 와 parity 인지 실측 (옵션 1: spec 데이터 기반 generic 재현, type 분기 없음).
 *
 * Link: text-only(배경 없음) + underline(composition.rootSelectors 데이터) + inline(height:0)
 *       → bg roundRect 생략 + textDecoration + baseline:top/align:left.
 * ToggleButton: selected/emphasizedSelected 상태 축 (spec.variant.fill.default.selected 데이터).
 */
describe("buildCatalogShapes — Link parity (text-only + underline)", () => {
  const variants = ["primary", "secondary"] as const;
  const sizes = ["xs", "sm", "md", "lg", "xl"] as const;

  for (const variant of variants) {
    for (const size of sizes) {
      it(`${variant}/${size} — legacy render.shapes 와 parity`, () => {
        const props = { variant, children: "Read more" } as Record<
          string,
          unknown
        >;
        const sizeSpec = LinkSpec.sizes[size];
        const legacy = LinkSpec.render.shapes(
          props as Parameters<typeof LinkSpec.render.shapes>[0],
          sizeSpec,
          "default",
        );
        const catalog = buildCatalogShapes(
          LinkSpec,
          props,
          sizeSpec,
          "default",
        );
        expect(normalizeParityShapes(catalog)).toEqual(
          normalizeParityShapes(legacy),
        );
      });
    }
  }

  it("Link 은 text shape 만 (bg roundRect 없음) + underline", () => {
    const catalog = buildCatalogShapes(
      LinkSpec,
      { variant: "primary", children: "x" },
      LinkSpec.sizes.md,
      "default",
    );
    expect(catalog).toHaveLength(1);
    expect(catalog[0].type).toBe("text");
    expect(catalog[0].textDecoration).toBe("underline");
    expect(catalog.some((s) => s.type === "roundRect")).toBe(false);
  });
});

describe("buildCatalogShapes — ToggleButton parity (selected 축)", () => {
  const sizes = ["xs", "sm", "md", "lg", "xl"] as const;
  const cases = [
    { isSelected: false, isEmphasized: false },
    { isSelected: true, isEmphasized: false },
    { isSelected: true, isEmphasized: true },
  ];

  // 시각 동등성 정규화(fillAlpha + box leaf text lineHeight)는 normalizeParityShapes 공유 헬퍼.
  //   fillAlpha: legacy ToggleButton bg roundRect 생략 ↔ generic 항상 1(specShapeConverter ?? 1 동일).
  //   lineHeight: legacy box leaf text 생략 ↔ generic size.lineHeight push(getLabelLineHeight fallback
  //   = 동일 typography 토큰 → paddingTop 불변, 시각 무영향). normalizeParityShapes.ts 참조.
  for (const size of sizes) {
    for (const c of cases) {
      it(`${size} sel=${c.isSelected} emp=${c.isEmphasized} — legacy parity (fillAlpha+lineHeight 정규화)`, () => {
        const props = { children: "B", ...c } as Record<string, unknown>;
        const sizeSpec = ToggleButtonSpec.sizes[size];
        const legacy = ToggleButtonSpec.render.shapes(
          props as Parameters<typeof ToggleButtonSpec.render.shapes>[0],
          sizeSpec,
          "default",
        );
        const catalog = buildCatalogShapes(
          ToggleButtonSpec,
          props,
          sizeSpec,
          "default",
        );
        expect(normalizeParityShapes(catalog)).toEqual(
          normalizeParityShapes(legacy),
        );
      });
    }
  }
});
