import { describe, expect, it } from "vitest";

import { racStateAttrs } from "../utils/racStateAttrs";

/**
 * ADR-912 단계 3 — racStateAttrs (RAC data-* → ComponentState) 계약.
 *
 * 검증 축:
 * - disabled 단독 derive (단계 3 실효 channel)
 * - RAC 시각 우선순위: disabled > pressed > hover > focusVisible > default
 *   (후속 단계에서 interaction threading 활성화 시 동작 확정)
 * - selection 직교성: 본 함수는 selected 를 반환하지 않는다(buildCatalogShapes 직교 차원)
 */
describe("racStateAttrs — RAC data-* → ComponentState (ADR-912 단계 3)", () => {
  it("입력 없음 → default", () => {
    expect(racStateAttrs({})).toBe("default");
  });

  it("isDisabled → disabled (단계 3 실효 channel)", () => {
    expect(racStateAttrs({ isDisabled: true })).toBe("disabled");
  });

  it("disabled 가 다른 상호작용을 가린다 (RAC: 비활성 요소는 hover/press 시각 미적용)", () => {
    expect(
      racStateAttrs({ isDisabled: true, isHovered: true, isPressed: true }),
    ).toBe("disabled");
  });

  it("우선순위: pressed > hover (둘 다 true 면 pressed)", () => {
    expect(racStateAttrs({ isPressed: true, isHovered: true })).toBe("pressed");
  });

  it("우선순위: hover > focusVisible", () => {
    expect(racStateAttrs({ isHovered: true, isFocusVisible: true })).toBe(
      "hover",
    );
  });

  it("focusVisible 단독 → focusVisible", () => {
    expect(racStateAttrs({ isFocusVisible: true })).toBe("focusVisible");
  });

  it("hover 단독 → hover", () => {
    expect(racStateAttrs({ isHovered: true })).toBe("hover");
  });

  it("pressed 단독 → pressed", () => {
    expect(racStateAttrs({ isPressed: true })).toBe("pressed");
  });

  it("반환 type 은 selection 을 포함하지 않는다 (selection 직교 — buildCatalogShapes props.isSelected)", () => {
    // racStateAttrs 의 반환은 default/hover/pressed/focused/focusVisible/disabled 만.
    // selected 같은 값을 만들 입력 자체가 없음(타입 보장) — 직교성 회귀 차단.
    const states = [
      racStateAttrs({}),
      racStateAttrs({ isDisabled: true }),
      racStateAttrs({ isHovered: true }),
      racStateAttrs({ isPressed: true }),
      racStateAttrs({ isFocusVisible: true }),
    ];
    expect(states).not.toContain("selected");
  });
});
