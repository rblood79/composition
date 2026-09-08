import { describe, expect, it } from "vitest";
import {
  angleScale,
  circlePathAt,
  polarPoint,
  polygonPath,
  radiusScale,
} from "../polar";

describe("angleScale", () => {
  it("범주를 원둘레에 균등 배치한다 — 12시=0, 시계 방향", () => {
    const angle = angleScale(4);
    expect([angle(0), angle(1), angle(2), angle(3)]).toEqual([0, 90, 180, 270]);
    expect(angle.step).toBe(90);
  });

  it("시작 각도와 sweep 을 받는다 (반원 radial 대비)", () => {
    const angle = angleScale(3, 90, 180);
    expect([angle(0), angle(1), angle(2)]).toEqual([90, 150, 210]);
  });

  it("범주 0개면 step 0 · 각도 start", () => {
    const angle = angleScale(0);
    expect(angle.step).toBe(0);
    expect(angle(0)).toBe(0);
  });
});

describe("radiusScale", () => {
  it("값을 안쪽~바깥 반지름으로 선형 매핑한다", () => {
    const radius = radiusScale([0, 100], [10, 60]);
    expect(radius(0)).toBe(10);
    expect(radius(50)).toBe(35);
    expect(radius(100)).toBe(60);
  });

  it("음수 값은 안쪽 반지름으로 clamp — 반지름 음수 0건 (R2)", () => {
    const radius = radiusScale([-50, 100], [0, 60]);
    expect(radius(-50)).toBe(0);
    expect(radius(-10)).toBeGreaterThanOrEqual(0);
    expect(radius(0)).toBe(0);
  });

  it("비수치는 안쪽 반지름 (NaN 이 path 로 새지 않는다)", () => {
    const radius = radiusScale([0, 10], [4, 40]);
    expect(radius(Number.NaN)).toBe(4);
    expect(radius(Number.POSITIVE_INFINITY)).toBe(4);
  });

  it("domain 폭 0 이면 바깥 반지름으로 접는다", () => {
    const radius = radiusScale([5, 5], [0, 30]);
    expect(radius(5)).toBe(30);
  });
});

describe("polarPoint", () => {
  it("12시=0 시계 방향 규약 — pie 의 polar() 와 같은 값", () => {
    expect(polarPoint(100, 100, 50, 0)).toEqual({ x: 100, y: 50 });
    expect(polarPoint(100, 100, 50, 90)).toEqual({ x: 150, y: 100 });
    expect(polarPoint(100, 100, 50, 180)).toEqual({ x: 100, y: 150 });
    expect(polarPoint(100, 100, 50, 270)).toEqual({ x: 50, y: 100 });
  });
});

describe("polygonPath", () => {
  it("꼭짓점 수만큼 L 을 내고 Z 로 닫는다", () => {
    const d = polygonPath(100, 100, 50, 4, 0);
    expect(d).toBe("M 100 50 L 150 100 L 100 150 L 50 100 Z");
  });

  it("반지름 0 이하 · 꼭짓점 3 미만이면 빈 문자열", () => {
    expect(polygonPath(0, 0, 0, 5, 0)).toBe("");
    expect(polygonPath(0, 0, 10, 2, 0)).toBe("");
  });
});

describe("circlePathAt", () => {
  it("반원 2개로 원을 낸다 (dots 의 circlePath 규약)", () => {
    expect(circlePathAt(100, 100, 50)).toContain("A 50 50 0 1 1");
  });

  it("반지름 0 이하면 빈 문자열", () => {
    expect(circlePathAt(0, 0, 0)).toBe("");
  });
});

describe("R7 — 미처리 chartType 방어선", () => {
  it("분기 없는 chartType 은 line 으로 조용히 렌더되지 않고 throw 한다", async () => {
    const { computeChartScene, CHART_DEFAULT_PROPS } = await import(
      "../computeChartScene"
    );
    expect(() =>
      computeChartScene(
        // 컴파일 시점 방어선은 `pnpm -F @composition/specs build` (dts) 가 잡는다
        //   — `pnpm type-check` 는 specs 를 돌지 않는다 (breakdown F18). 런타임 절반은
        //   여기서 잡는다: else 폴백이던 자리가 이제 assertNever 다.
        { ...CHART_DEFAULT_PROPS, chartType: "scatter" as never },
        [{ category: "A", value: 1 }],
        { width: 200, height: 160 },
      ),
    ).toThrow(/unhandled chartType/);
  });
});
