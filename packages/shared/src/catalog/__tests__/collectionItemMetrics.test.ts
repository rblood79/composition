import { describe, expect, it } from "vitest";

import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";

/**
 * ListBoxItem / GridListItem 의 Skia 축 시각 계약 (ADR-078 P1 / ADR-090 P1).
 *
 * **배경**: 두 항목의 시각 SSOT 는 원래 `ListBox.spec` / `GridList.spec` 의 `childSpecs` 로
 * 선언되고 `expandChildSpecs(BASE_TAG_SPEC_MAP)` 가 PascalCase 키로 자동 등록해 Skia 축
 * lookup(`sizes.md.paddingX` 등)을 공급했다. ADR-142 catalog cutover 로 컴포넌트당 spec 파일이
 * 폐기되면서(잔존 spec 은 Frame/Group/Slot 3개) 두 항목의 SSOT 는 catalog
 * `COMPONENT_RULES_TABLE` 로 이관됐고, 구 `tagSpecMap.test.ts` 의 childSpecs 등록 검증은
 * 메커니즘째 사라졌다. 값 계약 자체는 계속 지켜져야 하므로 SSOT(catalog) 기준으로 옮겨 둔다.
 *
 * **불변식**: 아래 metric 이 바뀌면 Builder(Skia) 의 collection item 렌더가 Preview(DOM/CSS) 와
 * 어긋난다 — 값 변경 시 CSS 측과 동시에 갱신하고 본 테스트를 함께 고칠 것.
 */
describe("collection item 시각 metric (catalog SSOT)", () => {
  describe("ListBoxItem (ADR-078 P1)", () => {
    const rule = COMPONENT_RULES_TABLE.ListBoxItem;

    it("catalog 에 등록되어 있다", () => {
      expect(rule).toBeDefined();
    });

    it("sizes.md — paddingX 12 / paddingY 4 / gap 2 / minHeight 미정의 / fontWeight 600", () => {
      const md = rule?.sizes?.md as Record<string, unknown> | undefined;
      expect(md).toBeDefined();
      expect(md?.paddingX).toBe(12);
      expect(md?.paddingY).toBe(4);
      expect(md?.gap).toBe(2);
      // minHeight 는 9c2142e04("fix(listbox): CSS ListBoxItem min-height 제거 — Skia 렌더 대칭
      //   복원")에서 catalog 에서 의도적으로 제거됨(min-height:20px 가 flex min-content 를 덮어써
      //   스크롤 미생성). Skia 는 element style.minHeight ?? 20 을 직접 읽으므로 catalog 불참조.
      expect(md?.minHeight).toBeUndefined();
      expect(md?.fontWeight).toBe(600);
    });

    // ADR-171 Phase 1 (2026-07-29): `position: "relative"` 는 수동 `ListBox.css` 에만
    //   있던 실효값을 catalog 로 옮긴 것이다 (실효 computed 불변 — G1).
    it("containerStyles — flex column, 좌측 정렬 + 수직 중앙 + relative", () => {
      expect(rule?.structure?.containerStyles).toEqual({
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        position: "relative",
      });
    });
  });

  describe("GridListItem (ADR-090 P1)", () => {
    const rule = COMPONENT_RULES_TABLE.GridListItem;

    it("catalog 에 등록되어 있다", () => {
      expect(rule).toBeDefined();
    });

    it("sizes.md — paddingX 16 / paddingY 12 / gap 2", () => {
      const md = rule?.sizes?.md as Record<string, unknown> | undefined;
      expect(md).toBeDefined();
      expect(md?.paddingX).toBe(16);
      expect(md?.paddingY).toBe(12);
      expect(md?.gap).toBe(2);
    });

    it("label 굵기 600 은 default variant 의 textWeight 채널로 공급된다", () => {
      // 구 spec 은 sizes.md.fontWeight 600 이었으나 catalog 는 variant visual.textWeight 채널을
      // 쓴다 (buildCatalogShapes 가 소비). 축이 바뀌었을 뿐 시각 결과는 동일해야 한다.
      const defaultVariant = rule?.defaultVariant ?? "default";
      const variant = rule?.variants?.[defaultVariant] as
        | { textWeight?: number }
        | undefined;
      expect(variant?.textWeight).toBe(600);
    });

    it("containerStyles — flex column (minWidth 0 로 grid track 축소 허용)", () => {
      expect(rule?.structure?.containerStyles).toEqual({
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
      });
    });
  });
});
