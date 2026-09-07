/**
 * ADR-194 후속 (shadcn 대조) — 보간 + 점 표시.
 *
 * 곡선은 **기하 함수 하나**가 정한다: `d` 문자열이 두 consumer 에 그대로 간다.
 * 그래서 여기서 보는 것은 "곡선이 그려지나" 가 아니라 **명령 문자와 좌표**다.
 */
import { describe, it, expect } from "vitest";
import { curveCommands } from "../curves";
import { circlePath, dotRadius } from "../marks/dots";
import { computeChartScene, CHART_DEFAULT_PROPS } from "../computeChartScene";
import type { ChartProps, ChartRow, Mark } from "../types";

const POINTS = [
  { along: 0, across: 10 },
  { along: 10, across: 20 },
  { along: 20, across: 15 },
];

describe("curveCommands", () => {
  it("linear 는 L 만 쓴다", () => {
    const d = curveCommands(POINTS, "linear", "vertical", true);
    expect(d).toBe("M 0 10 L 10 20 L 20 15");
  });

  it("step 은 중점에서 꺾는다 (범주 사이 중앙)", () => {
    const d = curveCommands(POINTS, "step", "vertical", true);
    expect(d).toBe("M 0 10 L 5 10 L 5 20 L 10 20 L 15 20 L 15 15 L 20 15");
  });

  it("monotone 은 C 명령을 쓰고 봉우리를 만들지 않는다", () => {
    const d = curveCommands(POINTS, "monotone", "vertical", true);
    expect(d.startsWith("M 0 10 C ")).toBe(true);
    const numbers = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    // 제어점 across 값이 데이터 범위(10~20)를 벗어나면 없는 봉우리가 생긴다.
    const acrossValues = numbers.filter((_, i) => i % 2 === 1);
    for (const v of acrossValues) {
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThanOrEqual(20);
    }
  });

  it("가로 방향은 along 이 y 로 간다 (보간 축이 축과 어긋나지 않는다)", () => {
    const vertical = curveCommands(POINTS, "monotone", "vertical", true);
    const horizontal = curveCommands(POINTS, "monotone", "horizontal", true);
    // 같은 숫자를 x/y 만 바꿔 쓴다 — 좌표쌍을 뒤집으면 같아야 한다.
    const pairs = (d: string) =>
      d
        .replace(/[MCL]/g, "")
        .trim()
        .split(/\s+/)
        .map(Number);
    const v = pairs(vertical);
    const h = pairs(horizontal);
    for (let i = 0; i < v.length; i += 2) {
      expect(h[i]).toBe(v[i + 1]);
      expect(h[i + 1]).toBe(v[i]);
    }
  });

  it("move=false 면 현재 점에서 이어 붙는다 (area 아래 경계)", () => {
    expect(curveCommands(POINTS, "linear", "vertical", false)).toBe(
      " L 0 10 L 10 20 L 20 15",
    );
  });

  it("점 1개는 이동만 한다", () => {
    expect(curveCommands([POINTS[0]], "monotone", "vertical", true)).toBe(
      "M 0 10",
    );
  });
});

describe("dots", () => {
  it("원 하나는 반원 2개로 닫힌다 (A 는 시작=끝이면 사라진다)", () => {
    expect(circlePath(10, 20, 3)).toBe(
      "M 7 20 A 3 3 0 1 1 13 20 A 3 3 0 1 1 7 20 Z",
    );
  });

  it("반지름은 선 두께에서 파생하되 최소 2 를 지킨다", () => {
    expect(dotRadius(2)).toBe(3.2);
    expect(dotRadius(0.5)).toBe(2);
  });
});

const SIZE = { width: 320, height: 240 };
const ROWS: ChartRow[] = [
  { category: "Mon", value: 12 },
  { category: "Tue", value: 30 },
  { category: "Wed", value: 18 },
];
const props = (o: Partial<ChartProps> = {}): ChartProps => ({
  ...CHART_DEFAULT_PROPS,
  chartType: "line",
  ...o,
});

describe("scene 결선", () => {
  const paths = (o: Partial<ChartProps>) =>
    computeChartScene(props(o), ROWS, SIZE).marks.filter(
      (m): m is Extract<Mark, { kind: "path" }> => m.kind === "path",
    );

  it("curve 는 line 의 d 를 실제로 바꾼다", () => {
    const linear = paths({ curve: "linear" })[0].d;
    const monotone = paths({ curve: "monotone" })[0].d;
    const step = paths({ curve: "step" })[0].d;
    expect(monotone).not.toBe(linear);
    expect(step).not.toBe(linear);
    expect(monotone).toContain(" C ");
  });

  it("curve 는 area 의 위/아래 경계를 같이 바꾼다", () => {
    const linear = paths({ chartType: "area", curve: "linear" })[0].d;
    const monotone = paths({ chartType: "area", curve: "monotone" })[0].d;
    expect(monotone).not.toBe(linear);
    // 아래 경계도 곡선이어야 띠 두께가 데이터와 맞는다 — C 가 2개 구간 이상.
    expect((monotone.match(/ C /g) ?? []).length).toBeGreaterThan(
      ROWS.length - 1,
    );
    expect(monotone.endsWith(" Z")).toBe(true);
  });

  it("showDots 는 시리즈당 마크 1개만 늘린다 (점마다 마크 금지)", () => {
    const without = paths({ showDots: false });
    const withDots = paths({ showDots: true });
    expect(withDots).toHaveLength(without.length + 1);
    const dot = withDots[withDots.length - 1];
    expect((dot.d.match(/M /g) ?? []).length).toBe(ROWS.length);
    expect(dot.fillSeries).toBe(0);
    expect(dot.strokeSeries).toBeUndefined();
  });

  it("area 의 점은 위 경계에 찍힌다", () => {
    const withDots = paths({ chartType: "area", showDots: true });
    const dot = withDots[withDots.length - 1];
    expect(dot.bbox.h).toBeGreaterThan(0);
    expect((dot.d.match(/M /g) ?? []).length).toBe(ROWS.length);
  });

  it("점 마크의 bbox 는 반지름만큼 넓다 (컬링 상위집합)", () => {
    const dot = paths({ showDots: true }).at(-1)!;
    const line = paths({ showDots: true })[0];
    expect(dot.bbox.x).toBeLessThan(line.bbox.x);
    expect(dot.bbox.w).toBeGreaterThan(line.bbox.w);
  });
});
