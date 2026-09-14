import { describe, expect, it } from "vitest";
import {
  APPEARANCE_PROPS,
  BORDER_PROPS,
  EFFECT_PROPS,
  FILL_PROPS,
  SIZE_PROPS,
} from "./styleSectionProps";

/**
 * Style 탭 3절 (Fill · Border · Effect) reset 범위 ∪ Size 절의 overflow = APPEARANCE_PROPS.
 * 어긋나면 "탭 dot 은 켜지는데 어느 절 reset 도 안 잡는" 키가 생긴다 (panel-ui 02).
 */
describe("Style 탭 절별 reset 범위 ↔ APPEARANCE_PROPS", () => {
  it("FILL ∪ BORDER ∪ EFFECT ∪ {overflow} = APPEARANCE_PROPS", () => {
    const union = new Set([
      ...FILL_PROPS,
      ...BORDER_PROPS,
      ...EFFECT_PROPS,
      ...SIZE_PROPS.filter((prop) => prop === "overflow"),
    ]);
    expect([...union].sort()).toEqual([...APPEARANCE_PROPS].sort());
  });

  it("절끼리 겹치는 키가 없다", () => {
    const all = [...FILL_PROPS, ...BORDER_PROPS, ...EFFECT_PROPS];
    expect(new Set(all).size).toBe(all.length);
  });
});
