/**
 * 눈금자 간격 결정 — ADR-181 Phase 1
 *
 * `renderRulers` 는 CanvasKit 캔버스를 받으므로 여기서는 그 안의 **카메라
 * 순수 함수** 만 검증한다. 이 두 함수가 순수라는 것이 C11(전용 invalidation
 * 카운터 불요)의 근거이므로, 회귀 시 성능 계약 쪽이 먼저 깨진다.
 */

import { describe, it, expect } from "vitest";
import { niceInterval, resolveTickPlan } from "./rulerRenderer";

/** rulerRenderer 내부 상수와 동일 — 어긋나면 아래 단언이 계약을 못 지킨다 */
const LABEL_MIN_SPACING_PX = 48;
const MINOR_MIN_SPACING_PX = 6;

describe("niceInterval", () => {
  it("1-2-5×10^n 계열에서 요청값 이상인 최소값을 고른다", () => {
    expect(niceInterval(1)).toBe(1);
    expect(niceInterval(1.5)).toBe(2);
    expect(niceInterval(3)).toBe(5);
    expect(niceInterval(6)).toBe(10);
    expect(niceInterval(48)).toBe(50);
    expect(niceInterval(51)).toBe(100);
    expect(niceInterval(240)).toBe(500);
  });

  it("1 미만도 같은 계열로 내려간다", () => {
    expect(niceInterval(0.4)).toBe(0.5);
    expect(niceInterval(0.06)).toBe(0.1);
  });

  it("0/음수에서도 유한한 양수를 낸다 (루프 폭주 차단)", () => {
    expect(niceInterval(0)).toBeGreaterThan(0);
    expect(Number.isFinite(niceInterval(0))).toBe(true);
    expect(niceInterval(-5)).toBeGreaterThan(0);
  });
});

describe("resolveTickPlan", () => {
  const ZOOMS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 4, 8, 16];

  it("주 눈금의 화면 간격은 라벨 최소 간격 이상이다", () => {
    for (const zoom of ZOOMS) {
      const { major } = resolveTickPlan(zoom);
      expect(major * zoom).toBeGreaterThanOrEqual(LABEL_MIN_SPACING_PX);
    }
  });

  it("보조 눈금은 주 눈금의 1/5 이거나 생략(0)이다", () => {
    for (const zoom of ZOOMS) {
      const { major, minor } = resolveTickPlan(zoom);
      if (minor === 0) continue;
      expect(minor).toBeCloseTo(major / 5, 10);
    }
  });

  it("보조 눈금이 최소 간격보다 촘촘해지면 생략한다", () => {
    for (const zoom of ZOOMS) {
      const { major, minor } = resolveTickPlan(zoom);
      const candidate = major / 5;
      if (candidate * zoom < MINOR_MIN_SPACING_PX) {
        expect(minor).toBe(0);
      } else {
        expect(minor).toBeGreaterThan(0);
        expect(minor * zoom).toBeGreaterThanOrEqual(MINOR_MIN_SPACING_PX);
      }
    }
  });

  it("zoom 이 커질수록 간격이 좁아진다 (단조)", () => {
    let prev = Number.POSITIVE_INFINITY;
    for (const zoom of ZOOMS) {
      const { major } = resolveTickPlan(zoom);
      expect(major).toBeLessThanOrEqual(prev);
      prev = major;
    }
  });

  it("zoom 0/음수를 1 로 취급한다 (0 나눗셈 차단)", () => {
    expect(resolveTickPlan(0)).toEqual(resolveTickPlan(1));
    expect(resolveTickPlan(-1)).toEqual(resolveTickPlan(1));
  });

  it("같은 zoom 은 같은 결과 — 카메라의 순수 함수 (C11 근거)", () => {
    for (const zoom of ZOOMS) {
      expect(resolveTickPlan(zoom)).toEqual(resolveTickPlan(zoom));
    }
  });
});
