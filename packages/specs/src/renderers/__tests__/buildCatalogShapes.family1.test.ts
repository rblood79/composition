import { describe, expect, it } from "vitest";

import { LinkSpec } from "../../components/Link.spec";
import { ToggleButtonSpec } from "../../components/ToggleButton.spec";
import { buildCatalogShapes } from "../buildCatalogShapes";

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
        expect(catalog).toEqual(legacy);
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

  /**
   * 시각 동등성 정규화: ToggleButton legacy render.shapes 는 bg roundRect 에 `fillAlpha` 를
   * 생략(undefined)하나, Button legacy 는 `fillAlpha: fill.alpha ?? 1` 로 항상 1 을 emit 한다 —
   * legacy spec 간 비일관. specShapeConverter 는 `shape.fillAlpha ?? 1` 로 둘을 동일 처리하므로
   * 시각 결과는 같다. generic buildCatalogShapes 는 Button 방식(항상 emit)을 택하므로,
   * 비교 전 legacy bg 의 누락된 fillAlpha 를 1 로 보강해 시각 동등성으로 parity 한다.
   */
  const normalizeFillAlpha = (shapes: ReturnType<typeof buildCatalogShapes>) =>
    shapes.map((s) =>
      s.type === "roundRect" && s.fillAlpha == null
        ? { ...s, fillAlpha: 1 }
        : s,
    );

  for (const size of sizes) {
    for (const c of cases) {
      it(`${size} sel=${c.isSelected} emp=${c.isEmphasized} — legacy parity (fillAlpha 정규화)`, () => {
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
        expect(catalog).toEqual(normalizeFillAlpha(legacy));
      });
    }
  }
});
