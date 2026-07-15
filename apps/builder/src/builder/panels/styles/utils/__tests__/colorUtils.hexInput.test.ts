import { describe, expect, it } from "vitest";
import { normalizeHexInputToHex8 } from "../colorUtils";

/**
 * HEX 입력 필드 회귀 테스트 (2026-07-15).
 *
 * 결함: 사용자가 `#` 없이 bare hex ("FF3B30FF") 를 입력하면 colord 가 유효
 * CSS 색으로 인정하지 않아 normalizeToHex8 이 fallback(이전 값)으로 떨어졌고,
 * HexFields 가 **이전 색을 그대로 재커밋** — 입력이 조용히 원복되는 증상.
 * normalizeHexInputToHex8 은 사용자 타이핑 관용(공백/`#` 생략/3·4·6·8자리)을
 * 흡수한 뒤 normalizeToHex8 로 위임한다.
 */
describe("normalizeHexInputToHex8", () => {
  const FALLBACK = "#FFFFFFFF";

  it("# 없는 8자리 bare hex 를 수용한다 (회귀 케이스)", () => {
    expect(normalizeHexInputToHex8("FF3B30FF", FALLBACK)).toBe("#FF3B30FF");
  });

  it("# 없는 6자리 bare hex 를 수용한다 (alpha FF 보충)", () => {
    expect(normalizeHexInputToHex8("ff3b30", FALLBACK)).toBe("#FF3B30FF");
  });

  it("# 없는 3자리/4자리 축약형을 수용한다", () => {
    expect(normalizeHexInputToHex8("f30", FALLBACK)).toBe("#FF3300FF");
    // alpha 87(≈88): colord 가 alpha 를 소수 2자리로 반올림하는 기존
    // normalizeToHex8 왕복 정밀도 특성 — fallback 원복만 아니면 정상.
    expect(normalizeHexInputToHex8("f308", FALLBACK)).toBe("#FF330087");
  });

  it("# 붙은 입력은 기존과 동일하게 통과한다", () => {
    expect(normalizeHexInputToHex8("#FF3B30", FALLBACK)).toBe("#FF3B30FF");
    expect(normalizeHexInputToHex8("#FF3B30CC", FALLBACK)).toBe("#FF3B30CC");
  });

  it("앞뒤 공백을 무시한다", () => {
    expect(normalizeHexInputToHex8("  FF3B30  ", FALLBACK)).toBe("#FF3B30FF");
    expect(normalizeHexInputToHex8(" #FF3B30 ", FALLBACK)).toBe("#FF3B30FF");
  });

  it("유효하지 않은 입력은 fallback(이전 값)을 유지한다", () => {
    expect(normalizeHexInputToHex8("garbage", FALLBACK)).toBe(FALLBACK);
    expect(normalizeHexInputToHex8("FF3B3", FALLBACK)).toBe(FALLBACK); // 5자리
    expect(normalizeHexInputToHex8("", FALLBACK)).toBe(FALLBACK);
  });

  it("named color 등 colord 가 아는 CSS 색은 그대로 변환한다", () => {
    expect(normalizeHexInputToHex8("red", FALLBACK)).toBe("#FF0000FF");
  });
});
