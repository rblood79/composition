import { describe, expect, it } from "vitest";

import { ToggleButtonSpec } from "../../components/ToggleButton.spec";
import { buildCatalogShapes } from "../buildCatalogShapes";
import { callCatalogShapes } from "./callCatalogShapes";
import { normalizeParityShapes } from "./normalizeParityShapes";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { SizeSpec, TokenRef } from "../../types";

/**
 * ADR-142 family ① — Link / ToggleButton 가 generic buildCatalogShapes 로 시각 재현되는지 실측
 * (옵션 1: rule 데이터 기반 generic 재현, type 분기 없음).
 *
 * Link: text-only(배경 없음) + underline(catalog rule textDecoration) + inline(height:0)
 *       → bg roundRect 생략 + textDecoration + baseline:top/align:left + staticColor 꼬리.
 *       ADR-912 단계5 step5 에서 Link.spec.ts 삭제됨 → legacy render.shapes parity 기준 소멸.
 *       inline ComponentVisualRule 픽스처(builder ruleVariantToVisual 산출 형태 미러)로 buildCatalogShapes
 *       직접 검증 (specs ← shared 패키지 경계상 catalog rule table 직접 import 불가).
 * ToggleButton: selected/emphasizedSelected 상태 축 (spec 미삭제 — legacy parity 유지).
 */

// Link primary rule 미러 (componentRulesTable.Link.variants.primary — text={color.accent}).
const linkPrimaryVisual: ComponentVisualRule = {
  fill: {
    default: {
      base: "{color.base}" as TokenRef,
      hover: "{color.base}" as TokenRef,
      pressed: "{color.base}" as TokenRef,
    },
    alpha: 0,
  },
  text: "{color.accent}" as TokenRef,
  textHover: "{color.accent-hover}" as TokenRef,
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
};

// Link rule sizes.md 미러 (componentRulesTable.Link.sizes.md — height:0 inline, text-sm).
const linkSizeMd: SizeSpec = {
  fontSize: 14,
  borderRadius: 0,
  height: 0,
  paddingX: 0,
  paddingY: 0,
} as unknown as SizeSpec;

describe("buildCatalogShapes — Link (text-only + underline, rule 기반)", () => {
  it("Link 은 text shape 만 (bg roundRect 없음) + underline", () => {
    const catalog = buildCatalogShapes(
      linkPrimaryVisual,
      { variant: "primary", children: "x" },
      linkSizeMd,
      "default",
      "underline",
    );
    expect(catalog).toHaveLength(1);
    expect(catalog[0].type).toBe("text");
    expect(catalog[0].textDecoration).toBe("underline");
    expect(catalog.some((s) => s.type === "roundRect")).toBe(false);
  });

  it("hover state — textHover(accent-hover) 색 적용", () => {
    const catalog = buildCatalogShapes(
      linkPrimaryVisual,
      { variant: "primary", children: "x" },
      linkSizeMd,
      "hover",
      "underline",
    );
    expect((catalog[0] as { fill?: string }).fill).toBe("{color.accent-hover}");
  });

  // ADR-912 단계5 — staticColor(black/white) 꼬리. theme 무관 고정색 override.
  //   Link/Button/ToggleButton 공유 D2 prop — buildCatalogShapes 공통 처리(generic).
  for (const sc of ["black", "white"] as const) {
    it(`staticColor=${sc} — #000000/#ffffff 고정 override`, () => {
      const catalog = buildCatalogShapes(
        linkPrimaryVisual,
        { variant: "primary", children: "x", staticColor: sc },
        linkSizeMd,
        "default",
        "underline",
      );
      const expected = sc === "black" ? "#000000" : "#ffffff";
      expect((catalog[0] as { fill?: string }).fill).toBe(expected);
    });
  }

  it("staticColor=auto 는 variant 색 유지 (override 안 함)", () => {
    const catalog = buildCatalogShapes(
      linkPrimaryVisual,
      { variant: "primary", children: "x", staticColor: "auto" },
      linkSizeMd,
      "default",
      "underline",
    );
    // primary variant text = {color.accent} — staticColor auto 는 미적용
    expect((catalog[0] as { fill?: string }).fill).toBe("{color.accent}");
  });

  it("style.color 가 staticColor 보다 우선", () => {
    const catalog = buildCatalogShapes(
      linkPrimaryVisual,
      {
        variant: "primary",
        children: "x",
        staticColor: "black",
        style: { color: "#ff0000" },
      },
      linkSizeMd,
      "default",
      "underline",
    );
    expect((catalog[0] as { fill?: string }).fill).toBe("#ff0000");
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
        const catalog = callCatalogShapes(
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
