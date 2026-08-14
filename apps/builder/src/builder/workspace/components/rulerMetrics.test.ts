/**
 * 눈금자 지표 — ADR-181 Phase 1
 *
 * 렌더 표면(DOM)과 무관한 **카메라 순수 함수**만 검증한다. 이 순수성이
 * HC6(카메라 단일 소스)의 전제이므로, 회귀 시 팬 정합이 먼저 깨진다.
 *
 * `niceInterval` / `resolveTickPlan` 9건은 1차 Skia 구현의
 * `rulerRenderer.test.ts` 에서 그대로 이관했다 (렌더 표면 무관 로직).
 */

import { describe, it, expect } from "vitest";
import {
  LABEL_MIN_SPACING_PX,
  MINOR_MIN_SPACING_PX,
  calculateRulerAxisMetrics,
  collectRulerLabels,
  guideAxisForRulerStrip,
  niceInterval,
  positiveModulo,
  resolveTickPlan,
} from "./rulerMetrics";

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

  it("같은 zoom 은 같은 결과 — 카메라의 순수 함수", () => {
    for (const zoom of ZOOMS) {
      expect(resolveTickPlan(zoom)).toEqual(resolveTickPlan(zoom));
    }
  });
});

describe("positiveModulo", () => {
  it("음수 팬도 [0, gap) 으로 접는다", () => {
    expect(positiveModulo(-1, 10)).toBe(9);
    expect(positiveModulo(-10, 10)).toBe(0);
    expect(positiveModulo(23, 10)).toBe(3);
  });
});

describe("calculateRulerAxisMetrics", () => {
  it("위상은 눈금 간격 미만이다", () => {
    for (const pan of [-1234.5, -10, 0, 37, 980]) {
      for (const zoom of [0.25, 1, 2.5]) {
        const m = calculateRulerAxisMetrics({ pan, zoom, origin: 48 });
        expect(m.majorPhasePx).toBeGreaterThanOrEqual(0);
        expect(m.majorPhasePx).toBeLessThan(m.majorGapPx);
        if (m.minorGapPx > 0) {
          expect(m.minorPhasePx).toBeLessThan(m.minorGapPx);
        }
      }
    }
  });

  it("보조 눈금 생략 시 minor 지표가 0 이다 (CSS 레이어 미출력)", () => {
    // zoom 이 아주 작으면 보조 눈금이 촘촘해져 생략된다
    const m = calculateRulerAxisMetrics({ pan: 0, zoom: 0.1, origin: 0 });
    if (m.minor === 0) {
      expect(m.minorGapPx).toBe(0);
      expect(m.minorPhasePx).toBe(0);
    }
  });

  it("한 눈금 간격만큼 팬하면 위상이 제자리로 돌아온다 (반복 패턴 계약)", () => {
    const base = calculateRulerAxisMetrics({ pan: 100, zoom: 1, origin: 0 });
    const shifted = calculateRulerAxisMetrics({
      pan: 100 + base.majorGapPx,
      zoom: 1,
      origin: 0,
    });
    expect(shifted.majorPhasePx).toBeCloseTo(base.majorPhasePx, 10);
  });

  it("origin(좌측 패널 인셋)은 위상을 그만큼 되돌린다", () => {
    const a = calculateRulerAxisMetrics({ pan: 300, zoom: 1, origin: 0 });
    const b = calculateRulerAxisMetrics({ pan: 300, zoom: 1, origin: 48 });
    expect(b.majorPhasePx).toBeCloseTo(
      positiveModulo(a.majorPhasePx - 48, a.majorGapPx),
      10,
    );
  });
});

describe("collectRulerLabels", () => {
  const AXIS = { pan: 0, zoom: 1, origin: 0 };

  it("라벨 위치는 스트립 안이고 간격은 주 눈금과 같다", () => {
    const labels = collectRulerLabels(AXIS, 500);
    expect(labels.length).toBeGreaterThan(1);
    for (const l of labels) {
      expect(l.pos).toBeGreaterThanOrEqual(0);
      expect(l.pos).toBeLessThanOrEqual(500);
    }
    const { majorGapPx } = calculateRulerAxisMetrics(AXIS);
    for (let i = 1; i < labels.length; i++) {
      expect(labels[i].pos - labels[i - 1].pos).toBeCloseTo(majorGapPx, 6);
    }
  });

  it("scene 값과 화면 위치가 카메라 식과 일치한다", () => {
    const axis = { pan: -320, zoom: 1.5, origin: 48 };
    for (const l of collectRulerLabels(axis, 900)) {
      expect(l.pos).toBeCloseTo(
        axis.pan + l.value * axis.zoom - axis.origin,
        6,
      );
    }
  });

  it("skipHeadPx 이전 구간은 라벨을 만들지 않는다 (코너 겹침 차단)", () => {
    const labels = collectRulerLabels(AXIS, 500, 20);
    for (const l of labels) expect(l.pos).toBeGreaterThanOrEqual(20);
  });

  it("음수 scene 좌표도 라벨로 나온다", () => {
    const labels = collectRulerLabels({ pan: 400, zoom: 1, origin: 0 }, 300);
    expect(labels.some((l) => l.value < 0)).toBe(true);
  });

  it("길이 0/음수면 빈 목록", () => {
    expect(collectRulerLabels(AXIS, 0)).toEqual([]);
    expect(collectRulerLabels(AXIS, -10)).toEqual([]);
  });

  it("같은 입력은 같은 결과 (순수 함수)", () => {
    expect(collectRulerLabels(AXIS, 500)).toEqual(
      collectRulerLabels(AXIS, 500),
    );
  });
});

describe("guideAxisForRulerStrip — 자와 나란한 선이 나온다", () => {
  it("가로 자에서 끌면 가로 가이드", () => {
    // axis "y" = y 좌표를 고정하는 가로선 (guideRenderer 와 같은 어법)
    expect(guideAxisForRulerStrip("horizontal")).toBe("y");
  });

  it("세로 자에서 끌면 세로 가이드", () => {
    expect(guideAxisForRulerStrip("vertical")).toBe("x");
  });

  it("두 스트립의 축은 서로 달라야 한다", () => {
    // 매핑이 통째로 한쪽으로 쏠리는 실수(둘 다 "x")를 잡는다
    expect(guideAxisForRulerStrip("horizontal")).not.toBe(
      guideAxisForRulerStrip("vertical"),
    );
  });
});
