import { describe, expect, it } from "vitest";
import {
  applySpacingStep,
  resolveSpacingSidesForModifiers,
} from "./useSpacingInteraction";

describe("useSpacingInteraction helpers (ADR-222 §1.1 수정키·step)", () => {
  it("Option/Alt 는 마주보는 두 변, Option/Alt+Shift 는 4변, 없으면 한 변", () => {
    expect(resolveSpacingSidesForModifiers("top", false, false)).toEqual([
      "top",
    ]);
    expect(resolveSpacingSidesForModifiers("top", true, false)).toEqual([
      "top",
      "bottom",
    ]);
    expect(resolveSpacingSidesForModifiers("left", true, false)).toEqual([
      "left",
      "right",
    ]);
    expect(resolveSpacingSidesForModifiers("right", true, true)).toEqual([
      "top",
      "right",
      "bottom",
      "left",
    ]);
    // Shift 단독은 step 만 바꾼다 (Framer 의 4변 동일 의미는 채택하지 않는다)
    expect(resolveSpacingSidesForModifiers("bottom", false, true)).toEqual([
      "bottom",
    ]);
  });

  it("Shift 는 10px 단위, 아니면 1px 단위로 delta 를 양자화한다", () => {
    expect(applySpacingStep(7.4, false)).toBe(7);
    expect(applySpacingStep(-7.6, false)).toBe(-8);
    expect(applySpacingStep(14, true)).toBe(10);
    expect(applySpacingStep(16, true)).toBe(20);
    expect(applySpacingStep(0, true)).toBe(0);
  });
});
