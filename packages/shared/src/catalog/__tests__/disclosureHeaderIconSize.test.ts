import { describe, expect, it } from "vitest";

import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";

/**
 * DisclosureHeader chevron 크기 CSS↔Skia 대칭 회귀 방지 (2026-07-02).
 *
 * **배경**: Disclosure 는 부모가 `<Heading><Button slot="trigger"><svg class="disclosure-chevron">` 를
 *   self-compose 한다(Disclosure.tsx:72-82, DisclosureHeader 독립 DOM 노드 없음). chevron 크기는
 *   `.disclosure-chevron { width/height: var(--icon-size) }`.
 *
 *   **CSS cascade 실측 (live getComputedStyle)**: DOM chevron 은 **전 size 18px 고정**. trigger
 *   `<Button slot="trigger">` 는 data-size 를 안 받아 `.react-aria-Button` 기본 `--icon-size: 18px`
 *   (Button.css:40)이 적용된다. `.react-aria-Disclosure[data-size]` --icon-size(14/16/20)는 조상
 *   Heading 까지만 내려오고 Button 이 자기 기본 18 로 재선언해 덮음 → dead. 따라서 Disclosure.css 의
 *   size 반응 값이 아니라 **Button 기본 18(size 무관 고정)** 이 정본. TagGroup remove X / CalendarHeader
 *   chevron 과 동일한 DOM 고정-크기 컨벤션(값만 18).
 *
 *   Skia 는 `leading_icon` primitive 가 chevron glyph 를 rule `size.iconSize` 로 그린다. ADR-912
 *   cutover 시 rule 은 `md`(iconSize 15)만 정의 → sm/lg 는 primitive fallback `round(fontSize×1.1)`
 *   (sm 13 / lg 18) + md 15 → DOM 18 대비 sm 5 / md 3 / lg 0px 어긋남(CSS↔Skia 비대칭, D3 위반).
 *
 * **결정 (사용자 2026-07-02, CSS cascade 실측 정정)**: DOM 고정 18px 을 정본으로 rule 에 sm/md/lg
 *   3 size 를 명시하고 iconSize = 18 통일. fontSize/height/paddingX 는 Skia leaf 메트릭이라 size 별 유지.
 *
 * **불변식**: DisclosureHeader rule sizes.{sm,md,lg}.iconSize = 18 (DOM Button 기본 --icon-size 대칭).
 */

const DOM_ICON_SIZE = 18; // .react-aria-Button 기본 --icon-size (Button.css:40)

describe("DisclosureHeader rule iconSize = DOM chevron 18px 고정 (Button 기본 --icon-size)", () => {
  const rule = COMPONENT_RULES_TABLE.DisclosureHeader;

  (["sm", "md", "lg"] as const).forEach((sz) => {
    it(`sizes.${sz} 정의 존재 + iconSize = ${DOM_ICON_SIZE}`, () => {
      const s = rule.sizes[sz];
      expect(s, `DisclosureHeader rule.sizes.${sz} 미정의`).toBeDefined();
      expect(s!.iconSize).toBe(DOM_ICON_SIZE);
    });
  });

  it("iconSize 는 3 size 동일 18 (DOM Button --icon-size size 무관 고정)", () => {
    const icons = (["sm", "md", "lg"] as const).map(
      (sz) => rule.sizes[sz]?.iconSize,
    );
    expect(icons).toEqual([18, 18, 18]);
  });

  it("paddingX 는 3 size 동일 12 (DOM trigger padding size 무관 고정)", () => {
    const px = (["sm", "md", "lg"] as const).map(
      (sz) => rule.sizes[sz]?.paddingX,
    );
    expect(px).toEqual([12, 12, 12]);
  });

  it("height = fontSize + paddingY*2 (sm 28 / md 30 / lg 32)", () => {
    expect(rule.sizes.sm?.height).toBe(28);
    expect(rule.sizes.md?.height).toBe(30);
    expect(rule.sizes.lg?.height).toBe(32);
  });
});
