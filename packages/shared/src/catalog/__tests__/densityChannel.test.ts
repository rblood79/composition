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

  it("density 미지정이면 defaultDensity 를 따른다 — Spectrum default 인 regular", () => {
    // design-data `tabs.options.items.density.default` = "regular" (ActionGroup 도 동일).
    //   2026-08-21 사용자 결정으로 구 compact 기본에서 전환.
    const rule = COMPONENT_RULES_TABLE.TabList;
    expect(rule?.defaultDensity).toBe("regular");
    expect(resolveCatalogDensityField("TabList", undefined, "gap")).toBe(8);
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

/**
 * ToggleButtonGroup density (2026-08-21) — Spectrum ActionGroup 규정:
 * "compact density retains the same font and icon sizes, but has tighter spacing.
 * **The action buttons also become connected** for non-quiet action groups."
 *
 * 즉 연결(segmented)은 orientation 의 성질이 아니라 compact density 의 성질이다. 구 구조는
 * 연결 규칙을 `containerVariants.orientation` 에 매달아 **항상 연결**이었고(= Spectrum 기준
 * compact 고정), 그래서 default 인 regular(분리)를 표현할 수 없었다.
 */
describe("density 채널 — ToggleButtonGroup(segmented ↔ 분리)", () => {
  const rule = () => COMPONENT_RULES_TABLE.ToggleButtonGroup;

  it("기본은 Spectrum default 인 regular — gap 8 로 버튼이 분리된다", () => {
    expect(rule()?.defaultDensity).toBe("regular");
    expect(
      resolveCatalogDensityField("ToggleButtonGroup", undefined, "gap"),
    ).toBe(8);
  });

  it("compact 는 gap 0 — 연결 bar 의 간격 성분", () => {
    expect(
      resolveCatalogDensityField("ToggleButtonGroup", "compact", "gap"),
    ).toBe(0);
  });

  it("연결 규칙(nested)은 density.compact 에만 있고 orientation 에는 없다", () => {
    const cv = rule()?.structure?.composition?.containerVariants as
      | Record<string, Record<string, { nested?: unknown[] }>>
      | undefined;
    // orientation 은 flex-direction 만 — 연결 규칙을 여기 두면 regular 에서도 붙는다.
    expect(cv?.orientation?.horizontal?.nested).toBeUndefined();
    expect(cv?.orientation?.vertical?.nested).toBeUndefined();
    // compact 는 (middle / first / last) × (horizontal / vertical) × (marker 경유 / 직접 자식).
    //   marker div 는 빌더 preview 구조이고 publish 는 ToggleButton 이 직접 자식이라 두 형태를
    //   함께 emit 한다 — 한쪽만 두면 그 축에서 연결이 안 걸린다(2026-08-21 publish 실측).
    expect(cv?.density?.compact?.nested).toHaveLength(12);
    // regular 에는 코너 override 가 없어야 버튼이 자기 균등 radius 를 유지한다.
    expect(cv?.density?.regular?.nested).toBeUndefined();
  });

  it("compact nested 는 orientation 을 compound selector 로 결합한다", () => {
    const cv = rule()?.structure?.composition?.containerVariants as
      | Record<string, Record<string, { nested?: { selector: string }[] }>>
      | undefined;
    const selectors = (cv?.density?.compact?.nested ?? []).map(
      (n) => n.selector,
    );
    // containerVariants 는 attr gate 를 하나만 붙이므로, 2축 조합은 `&` compound 가 유일 표현.
    expect(selectors.every((s) => s.startsWith("&[data-orientation="))).toBe(
      true,
    );
  });
});

describe("density 채널 — 전역 회귀 계약", () => {
  it("densities 를 가진 컴포넌트는 간격 계열 필드만 쓴다 — 폰트는 sizes 단독 소유", () => {
    // Spectrum 규칙("retains the same font and icon sizes")의 기계 집행. 새 컴포넌트에
    // density 를 추가할 때 fontSize 류를 섞으면 여기서 걸린다.
    const ALLOWED = new Set(["gap", "paddingY"]);
    for (const [type, rule] of Object.entries(COMPONENT_RULES_TABLE)) {
      if (!rule?.densities) continue;
      for (const [name, spacing] of Object.entries(rule.densities)) {
        for (const key of Object.keys(spacing)) {
          expect(
            ALLOWED.has(key),
            `${type}.densities.${name}.${key} 는 간격 필드가 아니다`,
          ).toBe(true);
        }
      }
    }
  });

  it("densities 를 가진 컴포넌트는 defaultDensity 를 함께 선언한다", () => {
    // 미선언 시 resolver 가 "compact" 로 폴백하는데, 그 이름이 없는 컴포넌트면 조용히
    // undefined 가 되어 주입이 통째로 사라진다.
    for (const [type, rule] of Object.entries(COMPONENT_RULES_TABLE)) {
      if (!rule?.densities) continue;
      expect(
        rule.defaultDensity,
        `${type} 에 defaultDensity 누락`,
      ).toBeDefined();
      expect(
        rule.densities[rule.defaultDensity as string],
        `${type}.defaultDensity="${rule.defaultDensity}" 가 densities 에 없다`,
      ).toBeDefined();
    }
  });
});
