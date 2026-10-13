import { describe, expect, it } from "vitest";

import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";

/**
 * ListBoxItem / GridListItem 의 Skia 축 시각 계약 (ADR-078 P1 / ADR-090 P1).
 *
 * **배경**: 두 항목의 시각 SSOT 는 원래 `ListBox.spec` / `GridList.spec` 의 `childSpecs` 로
 * 선언되고 `expandChildSpecs(BASE_TAG_SPEC_MAP)` 가 PascalCase 키로 자동 등록해 Skia 축
 * lookup(`sizes.M.paddingX` 등)을 공급했다. ADR-142 catalog cutover 로 컴포넌트당 spec 파일이
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

    it("sizes.M — paddingX 12 / paddingY 4 / gap 2 / minHeight 32 / fontWeight 400 (RAC 레퍼런스)", () => {
      const md = rule?.sizes?.M as Record<string, unknown> | undefined;
      expect(md).toBeDefined();
      expect(md?.paddingX).toBe(12);
      expect(md?.paddingY).toBe(4);
      expect(md?.gap).toBe(2);
      // 2026-10-13 — the reference `min-height: var(--spacing-8)`; the ListBox rule's item selector
      //   keeps items from shrinking under it (`flex-shrink: 0` — 9c2142e04's scroll note).
      expect(md?.minHeight).toBe(32);
      // The item's normal weight; its label is 500 (the ListBox rule's item selector).
      expect(md?.fontWeight).toBe(400);
      expect(md?.borderRadius).toBe("{radius.lg}");
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

    // 2026-10-13 — the RAC reference card (사용자 「이미지 카드로」): padded only at its bottom (16 —
    //   the manual sheet · `manualBoxRules`), its texts inset 16 themselves, 8 between children.
    it("sizes.M — paddingX 0 / paddingY 0 / gap 8 (RAC 레퍼런스 카드)", () => {
      const md = rule?.sizes?.M as Record<string, unknown> | undefined;
      expect(md).toBeDefined();
      expect(md?.paddingX).toBe(0);
      expect(md?.paddingY).toBe(0);
      expect(md?.gap).toBe(8);
    });

    it("항목에는 굵기를 선언하지 않는다 — description 이 600 을 물려받지 않게", () => {
      // 사용자 결정 2026-09-29: GridListItem 에 굵기 600 이 없어야 한다. 항목 굵기는 description
      // 까지 내려가므로 (DOM 상속), 카드 label 굵기는 label Text 규칙 · gridlist_card 기본값이 갖는다.
      for (const variant of Object.values(rule?.variants ?? {}))
        expect((variant as { textWeight?: number }).textWeight).toBeUndefined();
    });

    // 2026-10-13 — the RAC reference card: children from the top (no centring), relative (its
    //   selection ring · checkbox), the reference's one-layer shadow.
    it("containerStyles — flex column (minWidth 0 로 grid track 축소 허용) · relative · 그림자", () => {
      expect(rule?.structure?.containerStyles).toEqual({
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        position: "relative",
        boxShadow: "0 2px 8px rgb(0 0 0 / 0.15)",
      });
    });
  });
});
