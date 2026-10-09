import { resolveBorderWidthPx } from "@composition/rendering";
import { describe, expect, it } from "vitest";

import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";

/**
 * Disclosure · DisclosureGroup 테두리 폭 CSS↔Skia 대칭 (2026-09-24 Compare Mode 실측).
 *
 * starter `Disclosure.css` · `DisclosureGroup.css` 는 테두리가 없고, 생성 CSS 도 border-style 을 싣지 않아
 * DOM computed 는 `0px none` 이다. Skia generic shell (`buildCatalogShapes`) 은 border 폭을
 * `resolveBorderWidthPx(size.borderWidth)` 로 읽는데, 값이 없으면 기본 thin (1px) 이라 DisclosureGroup
 * variant 의 border 색 (`{color.border}`) 이 Skia 에만 1px 테두리로 그려졌다.
 *
 * 불변식: DisclosureGroup 의 모든 size 가 border 폭 0 으로 풀린다 (Skia 가 읽는 경로 그대로).
 *
 * Disclosure (2026-10-10 S2): 위아래 1px 테두리는 `composition.containerStyles` 의 `border-top` ·
 * `border-bottom` 이고 Canvas 는 `catalogDisclosureBorders` 로 읽는다. size 에는 균일 border 폭이 없고
 * (있으면 생성 CSS `[data-size]` 의 `border-width` 가 위아래를 덮는다), variant 가 없어 shell 의 기본
 * thin 폭을 칠할 border 색도 없다.
 */
describe("Disclosure 가족 border 폭 (DOM 과 대칭)", () => {
  it("Disclosure — size 에 균일 border 폭 없음 · variant 없음 (위아래는 containerStyles)", () => {
    const rule = COMPONENT_RULES_TABLE.Disclosure;
    for (const size of Object.values(rule.sizes))
      expect((size as { borderWidth?: unknown }).borderWidth).toBeUndefined();
    expect(rule.variants).toEqual({});
    const container = (
      rule.structure?.composition as
        { containerStyles?: Record<string, string> } | undefined
    )?.containerStyles;
    expect(container).toMatchObject({
      "border-top": "1px solid var(--border)",
      "border-bottom": "1px solid var(--border)",
    });
  });
  for (const type of ["DisclosureGroup"] as const) {
    const sizes = COMPONENT_RULES_TABLE[type]?.sizes ?? {};
    it(`${type} — sizes 가 있다`, () => {
      expect(Object.keys(sizes).length).toBeGreaterThan(0);
    });
    for (const [name, size] of Object.entries(sizes)) {
      it(`${type}.${name} — border 폭 0`, () => {
        expect(
          resolveBorderWidthPx((size as { borderWidth?: unknown }).borderWidth),
        ).toBe(0);
      });
    }
  }
});
