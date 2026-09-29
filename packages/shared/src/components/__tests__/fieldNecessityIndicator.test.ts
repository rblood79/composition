import { describe, expect, it } from "vitest";

import {
  getNecessityIndicatorSuffix,
  renderNecessityIndicator,
} from "../FieldNecessityIndicator";

/**
 * 값이 없는 necessityIndicator = icon (RSP 기본값 · binding default · Properties 패널 표시와 같음).
 * 필수 field 는 prop 을 고르지 않아도 `*` 를 붙인다 (사용자 결정 2026-09-29). Canvas suffix 와
 * Preview 요소가 같은 판정을 쓴다.
 */
describe("necessity indicator 기본값", () => {
  it("값 없음 + 필수 → *", () => {
    expect(getNecessityIndicatorSuffix(undefined, true)).toBe(" *");
    const node = renderNecessityIndicator(undefined, true) as {
      props: { children: string; className: string };
    };
    expect(node.props.children).toBe("*");
    expect(node.props.className).toBe("necessity-indicator icon");
  });
  it("값 없음 + 필수 아님 → 표시 없음", () => {
    expect(getNecessityIndicatorSuffix(undefined, false)).toBe("");
    expect(renderNecessityIndicator(undefined, false)).toBeNull();
  });
  it("label 은 그대로 (required)/(optional)", () => {
    expect(getNecessityIndicatorSuffix("label", false)).toBe(" (optional)");
  });
});
