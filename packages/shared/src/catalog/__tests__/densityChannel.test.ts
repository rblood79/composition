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

/**
 * TableView density (2026-08-21) — Spectrum `table.item.padding × density`.
 *
 * Spectrum 은 행 높이를 size 축이 정하고(`table-row-height-*` 은 density 무관 — 구
 * `-regular` 접미사 토큰은 deprecated) density 는 **item 내부 여백**만 바꾼다. 그래서
 * 채널이 TableView 가 아니라 소비 주체인 Column/Cell 에 산다 — TableView 는 density
 * **값**만 자손에 위임한다 (Skia: applyImplicitStyles / DOM: renderTableViewSubtree).
 */
describe("density 채널 — TableView(Column/Cell)", () => {
  it("Column/Cell 이 같은 축·같은 값을 갖는다 — 한 행 안에서 header/body 여백이 갈리면 안 된다", () => {
    for (const key of ["compact", "regular", "spacious"] as const) {
      expect(resolveCatalogDensityField("Column", key, "paddingY")).toBe(
        resolveCatalogDensityField("Cell", key, "paddingY"),
      );
    }
  });

  it("행 높이가 Spectrum medium 계열(32/40/48)로 떨어진다 — 텍스트 24 + paddingY×2", () => {
    const rowHeight = (density: string) => {
      const lineHeight = COMPONENT_RULES_TABLE.Cell?.sizes.md?.lineHeight ?? 0;
      const paddingY = resolveCatalogDensityField("Cell", density, "paddingY");
      return (lineHeight as number) + (paddingY as number) * 2;
    };
    expect(rowHeight("compact")).toBe(32);
    expect(rowHeight("regular")).toBe(40);
    expect(rowHeight("spacious")).toBe(48);
  });

  it("기본값 regular 는 기존 sizes.md.paddingY 와 같다 — 미지정 프로젝트 회귀 0", () => {
    for (const type of ["Column", "Cell"] as const) {
      const rule = COMPONENT_RULES_TABLE[type];
      expect(rule?.defaultDensity).toBe("regular");
      expect(resolveCatalogDensityField(type, undefined, "paddingY")).toBe(
        rule?.sizes.md?.paddingY,
      );
    }
  });

  it("density 는 세로 여백만 바꾼다 — paddingX/폰트는 densities 밖", () => {
    for (const type of ["Column", "Cell"] as const) {
      const densities = COMPONENT_RULES_TABLE[type]?.densities ?? {};
      expect(Object.keys(densities)).toEqual([
        "compact",
        "regular",
        "spacious",
      ]);
      for (const spacing of Object.values(densities)) {
        expect(Object.keys(spacing)).toEqual(["paddingY"]);
      }
    }
  });

  it("TableView 자신에는 densities 를 두지 않는다 — 두면 자기 padding 으로 CSS emit 된다", () => {
    // TableView 는 `structure` 보유라 virtual spec → generated CSS 가 나온다. 여기에
    // densities 를 두면 generate-css 가 containerVariants.density 로 합성해 컨테이너
    // 자신의 padding-top/bottom 을 emit 하는데, 바꿔야 할 대상은 자손 Column/Cell 이다.
    expect(COMPONENT_RULES_TABLE.TableView?.densities).toBeUndefined();
    expect(COMPONENT_RULES_TABLE.TableView?.structure).toBeDefined();
    // 반대로 Column/Cell 은 structure 미보유 → CSS emit 없음(DOM 은 인라인이 정본).
    expect(COMPONENT_RULES_TABLE.Column?.structure).toBeUndefined();
    expect(COMPONENT_RULES_TABLE.Cell?.structure).toBeUndefined();
  });
});
