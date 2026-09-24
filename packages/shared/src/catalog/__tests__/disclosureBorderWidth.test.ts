import { resolveBorderWidthPx } from "@composition/specs";
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
 * 불변식: 두 rule 의 모든 size 가 border 폭 0 으로 풀린다 (Skia 가 읽는 경로 그대로).
 */
describe("Disclosure 가족 border 폭 = 0 (DOM 테두리 없음과 대칭)", () => {
  for (const type of ["Disclosure", "DisclosureGroup"] as const) {
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
