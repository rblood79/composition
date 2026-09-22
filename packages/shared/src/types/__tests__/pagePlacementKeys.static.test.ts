/**
 * ADR-232 — 페이지 `placement` 가 쓰는 longhand 는 전부 기존 responsive eligibility 안이다.
 *
 * 이 테스트가 깨지면 "페이지 배치를 위해 eligibility 표를 넓혔다" 는 뜻이다 (리뷰 round 2 m3
 * 이 금지한 것). 넓히는 대신 placement 표현을 기존 eligible 키로 바꾼다.
 */
import { describe, expect, it } from "vitest";
import {
  PAGE_PLACEMENT_STYLE_KEYS,
  RESPONSIVE_ELIGIBLE_STYLE_PROPS,
  isResponsiveEligibleStyleProp,
} from "../responsive.types";

describe("ADR-232 PAGE_PLACEMENT_STYLE_KEYS", () => {
  it("모든 키가 responsive eligible 이다 (eligibility 확장 0)", () => {
    const notEligible = PAGE_PLACEMENT_STYLE_KEYS.filter(
      (key) => !isResponsiveEligibleStyleProp(key),
    );
    expect(notEligible).toEqual([]);
  });

  it("shorthand 는 쓰지 않는다 — source order 승자 문제 (ADR-168 M3)", () => {
    for (const shorthand of ["gridColumn", "gridRow", "inset", "gridArea"]) {
      expect(PAGE_PLACEMENT_STYLE_KEYS).not.toContain(shorthand);
    }
  });

  it("세 상태를 표현할 수 있다 — 흐름(키 0) · 칸 고정(line) · 격자 밖(absolute)", () => {
    expect(PAGE_PLACEMENT_STYLE_KEYS).toContain("gridColumnStart");
    expect(PAGE_PLACEMENT_STYLE_KEYS).toContain("gridRowStart");
    expect(PAGE_PLACEMENT_STYLE_KEYS).toContain("position");
    expect(PAGE_PLACEMENT_STYLE_KEYS).toContain("left");
    expect(PAGE_PLACEMENT_STYLE_KEYS).toContain("top");
  });

  it("eligibility 표 자체는 늘어나지 않았다 — placement 키는 전부 기존 원소", () => {
    for (const key of PAGE_PLACEMENT_STYLE_KEYS) {
      expect(RESPONSIVE_ELIGIBLE_STYLE_PROPS.has(key)).toBe(true);
    }
  });
});
