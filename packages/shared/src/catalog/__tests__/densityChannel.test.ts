import { describe, expect, it } from "vitest";
import { resolveToken, type TokenRef } from "@composition/rendering";

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
    expect(resolveCatalogDensityField("TabList", "compact", "gap")).toBe(24);
    expect(resolveCatalogDensityField("TabList", "regular", "gap")).toBe(32);
  });

  it("density 미지정이면 defaultDensity 를 따른다 — Spectrum default 인 regular", () => {
    // design-data `tabs.options.items.density.default` = "regular" (ActionGroup 도 동일).
    //   2026-08-21 사용자 결정으로 구 compact 기본에서 전환.
    const rule = COMPONENT_RULES_TABLE.TabList;
    expect(rule?.defaultDensity).toBe("regular");
    expect(resolveCatalogDensityField("TabList", undefined, "gap")).toBe(32);
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
 * Table density (2026-08-21) — Spectrum `table.item.padding × density`.
 *
 * Spectrum 은 행 높이를 size 축이 정하고(`table-row-height-*` 은 density 무관 — 구
 * `-regular` 접미사 토큰은 deprecated) density 는 **item 내부 여백**만 바꾼다. 그래서
 * 채널이 Table 이 아니라 소비 주체인 Column/Cell 에 산다 — Table 은 density
 * **값**만 자손에 위임한다 (`CATALOG_DENSITY_PROPAGATION_OWNER`). (옛 둘째 표 type 은 ADR-277 에서
 * Table 로 통합 — 2026-10-21.)
 */
describe("density 채널 — Table(Column/Cell)", () => {
  it("머리글 (Column) 은 density 를 따르지 않는다 — S2 `headingHeight: DEFAULT_HEADER_HEIGHT[scale]` (ADR-295 후속 B2)", () => {
    expect(COMPONENT_RULES_TABLE.Column?.densities).toBeUndefined();
    for (const key of ["compact", "regular", "spacious"] as const)
      expect(resolveCatalogDensityField("Column", key, "paddingY")).toBe(
        undefined,
      );
  });

  it("행 높이가 Spectrum medium 계열(32/40/48)로 떨어진다 — 텍스트 줄 + paddingY×2", () => {
    const rowHeight = (density: string) => {
      // (ADR-295 Phase 3: 줄은 행간 토큰 — S2 식 16 → 20.)
      const lineHeight = resolveToken(
        COMPONENT_RULES_TABLE.Cell?.sizes.M?.lineHeight as TokenRef,
      );
      const paddingY = resolveCatalogDensityField("Cell", density, "paddingY");
      return (lineHeight as number) + (paddingY as number) * 2;
    };
    expect(rowHeight("compact")).toBe(32);
    expect(rowHeight("regular")).toBe(40);
    expect(rowHeight("spacious")).toBe(48);
  });

  it("기본값 regular 는 기존 sizes.M.paddingY 와 같다 — 미지정 프로젝트 회귀 0", () => {
    for (const type of ["Cell"] as const) {
      const rule = COMPONENT_RULES_TABLE[type];
      expect(rule?.defaultDensity).toBe("regular");
      expect(resolveCatalogDensityField(type, undefined, "paddingY")).toBe(
        rule?.sizes.M?.paddingY,
      );
    }
  });

  it("density 는 세로 여백만 바꾼다 — paddingX/폰트는 densities 밖", () => {
    for (const type of ["Cell"] as const) {
      const densities = COMPONENT_RULES_TABLE[type]?.densities ?? {};
      expect(Object.keys(densities)).toEqual([
        "compact",
        "regular",
        "spacious",
      ]);
      for (const spacing of Object.values(densities)) {
        // (Cell 은 S2 cell `minHeight` 의 density 표도 — ADR-295 후속. 폰트 · paddingX 는 여전히 밖.)
        expect(Object.keys(spacing)).toEqual(["paddingY", "minHeight"]);
      }
    }
  });

  it("Table 자신에는 densities 를 두지 않는다 — 두면 자기 padding 으로 CSS emit 된다", () => {
    // Table 에 densities 를 두면 generate-css 가 containerVariants.density 로 합성해 컨테이너
    // 자신의 padding-top/bottom 을 emit 하는데, 바꿔야 할 대상은 자손 Column/Cell 이다.
    expect(COMPONENT_RULES_TABLE.Table?.densities).toBeUndefined();
    expect(COMPONENT_RULES_TABLE.TableView).toBeUndefined();
    // 반대로 Column/Cell 은 structure 미보유 → CSS emit 없음(DOM 은 인라인이 정본).
    expect(COMPONENT_RULES_TABLE.Column?.structure).toBeUndefined();
    expect(COMPONENT_RULES_TABLE.Cell?.structure).toBeUndefined();
  });
});

/**
 * ToggleButtonGroup density (2026-08-21 → S2 1.8.2 정렬 `3ca03f661`, 2026-11-06).
 *
 * Spectrum ActionGroup 규정: "compact density retains the same font and icon sizes, but has
 * tighter spacing. **The action buttons also become connected**". 연결은 orientation 이 아니라
 * compact 의 성질이다 — 그 원칙은 그대로다.
 *
 * S2 1.8.2 정렬로 모양이 바뀌었다: 그룹 rule 은 `densities` · `defaultDensity` 를 두지 않고
 * regular 간격은 `sizes[*].gap` (S2 `ToggleButtonGroup` gap — XS · S 4 · M ~ XL 8), compact 는
 * `containerVariants.density.compact` 의 `gap: 2px` 만 준다. 연결 모서리는 그룹의 nested 가
 * 아니라 자식 (ToggleButton · ActionButton) rule 의 `rootSelectors` `&[data-density="compact"]`
 * 가 소유한다 (S2 ActionButton `isInGroup` · density 분기와 같은 자리, componentRulesTable.ts
 * `ACTION_GROUP_BUTTON_COMPOSITION`). builder 의 live 계약은 `actionButtonFamily.test.tsx`
 * 「ToggleButtonGroup S2 layout」 (compact gap 2 · 모서리 [10,10,0,0] / [0,0,10,10]).
 */
describe("density 채널 — ToggleButtonGroup(segmented ↔ 분리)", () => {
  const rule = () => COMPONENT_RULES_TABLE.ToggleButtonGroup;
  type Variants = Record<
    string,
    Record<string, { styles?: Record<string, string>; nested?: unknown[] }>
  >;
  const cv = () =>
    rule()?.structure?.composition?.containerVariants as Variants | undefined;

  it("기본(regular) 간격은 size 축의 gap — XS · S 4, M ~ XL 8 로 버튼이 분리된다", () => {
    expect(rule()?.densities).toBeUndefined();
    expect(rule()?.defaultDensity).toBeUndefined();
    const gaps = Object.fromEntries(
      Object.entries(rule()?.sizes ?? {}).map(([size, s]) => [
        size,
        (s as { gap?: number }).gap,
      ]),
    );
    expect(gaps).toEqual({ XS: 4, S: 4, M: 8, L: 8, XL: 8 });
    // regular 은 생성 CSS 분기가 없다 — size gap 그대로.
    expect(cv()?.density?.regular).toBeUndefined();
  });

  it("compact 는 gap 2px — 연결 bar 의 간격 성분 (S2 1.8.2)", () => {
    expect(cv()?.density?.compact?.styles).toEqual({ gap: "2px" });
  });

  it("연결 규칙은 그룹의 nested 가 아니라 자식 rule 의 compact rootSelectors 에 있다", () => {
    // orientation 은 flex-direction 만 — 연결 규칙을 여기 두면 regular 에서도 붙는다.
    expect(cv()?.orientation?.horizontal?.nested).toBeUndefined();
    expect(cv()?.orientation?.vertical?.nested).toBeUndefined();
    expect(cv()?.density?.compact?.nested).toBeUndefined();
    for (const child of ["ToggleButton", "ActionButton"] as const) {
      const selectors = Object.keys(
        COMPONENT_RULES_TABLE[child]?.structure?.composition?.rootSelectors ??
          {},
      ).filter((s) => s.startsWith('&[data-density="compact"]'));
      // 가운데 0 + 처음 · 끝 공통 2 + (horizontal / vertical) × (처음 / 끝) 4.
      expect(selectors, child).toHaveLength(7);
    }
  });

  it("compact 모서리 선택자는 orientation 을 compound selector 로 결합한다", () => {
    const selectors = Object.keys(
      COMPONENT_RULES_TABLE.ToggleButton?.structure?.composition
        ?.rootSelectors ?? {},
    ).filter((s) => s.startsWith('&[data-density="compact"][data-orientation='));
    expect(selectors).toHaveLength(4);
    expect(
      selectors.every((s) => /:(first|last)-child$/.test(s)),
    ).toBe(true);
  });
});

describe("density 채널 — 전역 회귀 계약", () => {
  it("densities 를 가진 컴포넌트는 간격 계열 필드만 쓴다 — 폰트는 sizes 단독 소유", () => {
    // Spectrum 규칙("retains the same font and icon sizes")의 기계 집행. 새 컴포넌트에
    // density 를 추가할 때 fontSize 류를 섞으면 여기서 걸린다.
    // (minHeight: S2 Table cell `minHeight` 의 density 표 — 상자 높이지 글자가 아니다, ADR-295 후속.)
    const ALLOWED = new Set(["gap", "paddingY", "minHeight"]);
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
