import { describe, expect, it } from "vitest";

import { resolveCatalogDensityField } from "../resolvers/resolveCatalogContainer";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";

/**
 * density 채널 (2026-08-21 신설) — Spectrum 규칙 채택.
 *
 * "density 는 폰트(size 축)를 유지하고 간격·수직 padding 만 바꾼다." 그래서 `sizes` 와
 * 직교하는 `densities` 축에 둔다. Skia 는 `resolveCatalogDensityField` 로, DOM 은
 * generate-css 가 같은 데이터를 `[data-density]` 규칙으로 emit 해 **같은 SSOT** 를 읽는다.
 *
 * 회귀 계약: `densities` 미정의 컴포넌트는 density prop 이 있어도 항상 undefined 를 받아
 * 기존 동작이 유지된다.
 */

describe("density 채널 — catalog SSOT", () => {
  it("TabList: compact/regular 이 서로 다른 gap 을 준다", () => {
    expect(resolveCatalogDensityField("TabList", "compact", "gap")).toBe(0);
    expect(resolveCatalogDensityField("TabList", "regular", "gap")).toBe(8);
  });

  it("density 미지정이면 defaultDensity 를 따른다", () => {
    const rule = COMPONENT_RULES_TABLE.TabList;
    expect(rule?.defaultDensity).toBe("compact");
    expect(resolveCatalogDensityField("TabList", undefined, "gap")).toBe(
      rule?.densities?.[rule.defaultDensity as string]?.gap,
    );
  });

  it("densities 미정의 컴포넌트는 density 를 줘도 undefined — 기존 동작 보존", () => {
    // Button 은 density 축이 없는 대표 컴포넌트.
    expect(COMPONENT_RULES_TABLE.Button?.densities).toBeUndefined();
    expect(
      resolveCatalogDensityField("Button", "regular", "gap"),
    ).toBeUndefined();
  });

  it("알 수 없는 density 키는 undefined — 임의 문자열이 gap 을 만들지 않는다", () => {
    expect(
      resolveCatalogDensityField("TabList", "spacious-typo", "gap"),
    ).toBeUndefined();
  });

  it("density 는 size 축을 침범하지 않는다 — 폰트는 sizes 가 단독 소유", () => {
    const densities = COMPONENT_RULES_TABLE.TabList?.densities ?? {};
    for (const spacing of Object.values(densities)) {
      expect(
        Object.keys(spacing).every((k) => k === "gap" || k === "paddingY"),
      ).toBe(true);
    }
  });
});
