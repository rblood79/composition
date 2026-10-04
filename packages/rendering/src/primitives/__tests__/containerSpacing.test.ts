import { describe, it, expect } from "vitest";
import {
  resolveContainerSpacing,
  type ContainerSpacingDefaults,
} from "../containerSpacing";

/**
 * ADR-907 Phase 2 — Layer B container spacing primitive
 *
 * 검증 원칙:
 * - style 에 padding/gap 계열 키 없으면 defaults 우선
 * - 있으면 Layer A parser 가 nullish/invalid 값을 defaults 로 resolve
 * - longhand override shorthand (CSS 규약)
 */

const baseDefaults: ContainerSpacingDefaults = {
  paddingTop: 8,
  paddingRight: 12,
  paddingBottom: 8,
  paddingLeft: 12,
  rowGap: 4,
  columnGap: 8,
  borderWidth: 1,
  fontSize: 14,
};

describe("resolveContainerSpacing", () => {
  // 케이스 1: style undefined → defaults 전부 반환
  it("style undefined → defaults 전부 반환", () => {
    const result = resolveContainerSpacing({ defaults: baseDefaults });
    expect(result).toEqual({
      paddingTop: 8,
      paddingRight: 12,
      paddingBottom: 8,
      paddingLeft: 12,
      rowGap: 4,
      columnGap: 8,
      borderWidth: 1,
      fontSize: 14,
    });
  });

  // 케이스 2: style.padding = 16 shorthand → 4-way 모두 16
  it("style.padding = 16 shorthand → 4-way 모두 16", () => {
    const result = resolveContainerSpacing({
      style: { padding: 16 },
      defaults: baseDefaults,
    });
    expect(result.paddingTop).toBe(16);
    expect(result.paddingRight).toBe(16);
    expect(result.paddingBottom).toBe(16);
    expect(result.paddingLeft).toBe(16);
  });

  // 케이스 3: style.padding = "8px 16px" → top/bottom 8, left/right 16
  it('style.padding = "8px 16px" → top/bottom 8, left/right 16', () => {
    const result = resolveContainerSpacing({
      style: { padding: "8px 16px" },
      defaults: baseDefaults,
    });
    expect(result.paddingTop).toBe(8);
    expect(result.paddingRight).toBe(16);
    expect(result.paddingBottom).toBe(8);
    expect(result.paddingLeft).toBe(16);
  });

  // 케이스 4: style.paddingTop = 24 longhand 만 → top 24, 나머지는 0 (Layer A 기본)
  it("style.paddingTop = 24 longhand 만 → top 24, 나머지 0", () => {
    const result = resolveContainerSpacing({
      style: { paddingTop: 24 },
      defaults: baseDefaults,
    });
    // padding 계열 키가 있으므로 Layer A 위임. shorthand 없으면 0 base 에 longhand override.
    expect(result.paddingTop).toBe(24);
    expect(result.paddingRight).toBe(0);
    expect(result.paddingBottom).toBe(0);
    expect(result.paddingLeft).toBe(0);
  });

  // 케이스 5: style.padding = 8, style.paddingLeft = 20 mixed → left 20 override
  it("shorthand + paddingLeft longhand mixed → left override", () => {
    const result = resolveContainerSpacing({
      style: { padding: 8, paddingLeft: 20 },
      defaults: baseDefaults,
    });
    expect(result.paddingTop).toBe(8);
    expect(result.paddingRight).toBe(8);
    expect(result.paddingBottom).toBe(8);
    expect(result.paddingLeft).toBe(20);
  });

  // 케이스 6: style.gap = 12 → rowGap 12, columnGap 12
  it("style.gap = 12 → rowGap 12, columnGap 12", () => {
    const result = resolveContainerSpacing({
      style: { gap: 12 },
      defaults: baseDefaults,
    });
    expect(result.rowGap).toBe(12);
    expect(result.columnGap).toBe(12);
  });

  // 케이스 7: style.gap = "4 8" string → rowGap 4, columnGap 8
  it('style.gap = "4 8" string → rowGap 4, columnGap 8', () => {
    const result = resolveContainerSpacing({
      style: { gap: "4 8" },
      defaults: baseDefaults,
    });
    expect(result.rowGap).toBe(4);
    expect(result.columnGap).toBe(8);
  });

  // 케이스 8: style.rowGap = 6 longhand 만 → rowGap 6, columnGap = defaults.columnGap
  it("style.rowGap = 6 longhand 만 → rowGap 6, columnGap 은 defaults", () => {
    const result = resolveContainerSpacing({
      style: { rowGap: 6 },
      defaults: baseDefaults,
    });
    expect(result.rowGap).toBe(6);
    expect(result.columnGap).toBe(8); // defaults.columnGap
  });

  // 케이스 9: style.borderWidth = "2px" → borderWidth 2
  it('style.borderWidth = "2px" → borderWidth 2', () => {
    const result = resolveContainerSpacing({
      style: { borderWidth: "2px" },
      defaults: baseDefaults,
    });
    expect(result.borderWidth).toBe(2);
  });

  // 케이스 10: style.fontSize = undefined → fontSize = defaults.fontSize
  it("style.fontSize = undefined → defaults.fontSize 반환", () => {
    const result = resolveContainerSpacing({
      style: { fontSize: undefined },
      defaults: { ...baseDefaults, fontSize: 16 },
    });
    expect(result.fontSize).toBe(16);
  });

  // 케이스 11: invalid string style.padding = "foo" → 전부 0 (파싱 실패 fallback)
  it('invalid style.padding = "foo" → padding 전부 0', () => {
    const result = resolveContainerSpacing({
      style: { padding: "foo" },
      defaults: baseDefaults,
    });
    expect(result.paddingTop).toBe(0);
    expect(result.paddingRight).toBe(0);
    expect(result.paddingBottom).toBe(0);
    expect(result.paddingLeft).toBe(0);
  });

  // 케이스 12: defaults 만 제공 + style={} → defaults 전수 반환
  it("style={} (빈 객체) → defaults 전수 반환", () => {
    const result = resolveContainerSpacing({
      style: {},
      defaults: baseDefaults,
    });
    expect(result).toEqual({
      paddingTop: 8,
      paddingRight: 12,
      paddingBottom: 8,
      paddingLeft: 12,
      rowGap: 4,
      columnGap: 8,
      borderWidth: 1,
      fontSize: 14,
    });
  });

  // 추가 케이스 13: defaults 에 columnGap 없으면 rowGap fallback
  it("defaults.columnGap 없으면 rowGap 으로 fallback", () => {
    const result = resolveContainerSpacing({
      style: {},
      defaults: { rowGap: 6 },
    });
    expect(result.rowGap).toBe(6);
    expect(result.columnGap).toBe(6); // defaults.columnGap 없으므로 rowGap fallback
  });

  // 추가 케이스 14: style.gap + style.rowGap → rowGap longhand override
  it("style.gap + style.rowGap → rowGap longhand 가 override", () => {
    const result = resolveContainerSpacing({
      style: { gap: "4 8", rowGap: 99 },
      defaults: baseDefaults,
    });
    expect(result.rowGap).toBe(99);
    expect(result.columnGap).toBe(8); // gap shorthand column 유지
  });

  // 추가 케이스 15: fontSize 숫자 문자열 파싱
  it('style.fontSize = "18px" → fontSize 18', () => {
    const result = resolveContainerSpacing({
      style: { fontSize: "18px" },
      defaults: baseDefaults,
    });
    expect(result.fontSize).toBe(18);
  });

  // 추가 케이스 16: borderWidth 숫자 0 → 0 (falsy 이지만 유효)
  it("style.borderWidth = 0 → borderWidth 0", () => {
    const result = resolveContainerSpacing({
      style: { borderWidth: 0 },
      defaults: { ...baseDefaults, borderWidth: 2 },
    });
    expect(result.borderWidth).toBe(0);
  });

  // 추가 케이스 17: 모든 필드가 defaults 에 없으면 0/14 기본값
  it("defaults 없는 필드는 0 (fontSize=14) 기본값", () => {
    const result = resolveContainerSpacing({
      style: {},
      defaults: {},
    });
    expect(result.paddingTop).toBe(0);
    expect(result.paddingRight).toBe(0);
    expect(result.paddingBottom).toBe(0);
    expect(result.paddingLeft).toBe(0);
    expect(result.rowGap).toBe(0);
    expect(result.columnGap).toBe(0);
    expect(result.borderWidth).toBe(0);
    expect(result.fontSize).toBe(14);
  });
});
