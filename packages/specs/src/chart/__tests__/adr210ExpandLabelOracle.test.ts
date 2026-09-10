/**
 * ADR-210 P0 / G0 — "현행 expand raw 라벨 오라클" (review round 1 h1 의 first nail).
 *
 * §3.1 표의 근거를 현행 순수 함수로 고정한다: stacked/expand 에서도 **값 라벨은 raw
 * 개별 시리즈 집계값**이고, 정규화(0~100)는 **축 눈금과 마크 기하**에만 있다. tooltip 도
 * raw 다 (`tooltip.ts`). 새 formatter 는 이 문자열 의미를 바꾸지 않는다 (auto = 현행 문자열).
 *
 * 이 테스트가 깨지면 값 라벨 의미가 바뀐 것이고, 그것은 ADR-210 HC "기존 문자열 보존"
 * 재판정 대상이다 — 조용히 통과시키지 않는다.
 */
import { describe, expect, it } from "vitest";
import { computeChartScene, CHART_DEFAULT_PROPS } from "../computeChartScene";
import { resolveChartData } from "../runtimeData";
import { formatTick } from "../scales";
import type { ChartProps, ChartRow, TextMark } from "../types";

const SIZE = { width: 320, height: 240 };
/** T05 fixture — raw 120/80 (Jan) · 40/10 (Feb). expand 기하는 60/40 · 80/20 (%). */
const ROWS: ChartRow[] = [
  { month: "Jan", value: 120, series: "desktop" },
  { month: "Feb", value: 40, series: "desktop" },
  { month: "Jan", value: 80, series: "mobile" },
  { month: "Feb", value: 10, series: "mobile" },
];
const props = (o: Partial<ChartProps> = {}): ChartProps => ({
  ...CHART_DEFAULT_PROPS,
  dimension: "month",
  metric: "value",
  color: "series",
  showValueLabels: true,
  ...o,
});
const valueLabels = (o: Partial<ChartProps>): string[] =>
  computeChartScene(props(o), ROWS, SIZE)
    .marks.filter((m): m is TextMark => m.kind === "text" && m.role === "value")
    .map((t) => t.text);
const axisTicks = (o: Partial<ChartProps>): string[] =>
  computeChartScene(props(o), ROWS, SIZE)
    .axes.flatMap((axis) => axis.ticks)
    .filter((t) => t.role === "tick")
    .map((t) => t.text);

describe("ADR-210 G0 — 현행 값 라벨은 stack 모드와 무관하게 raw 다", () => {
  for (const chartType of ["bar", "area"] as const) {
    it(`${chartType} expand: 값 라벨 = raw (120/80/40/10), 축 = 0~100`, () => {
      const labels = valueLabels({ chartType, stackType: "expand" });
      expect(labels.sort()).toEqual(["10", "120", "40", "80"]);
      // 축 눈금만 정규화 단위 — 값 축 ticks 에 100 이 있고 raw 최대 120 은 없다.
      const ticks = axisTicks({ chartType, stackType: "expand" });
      expect(ticks).toContain("100");
      expect(ticks).not.toContain("120");
    });
    it(`${chartType} stacked: 값 라벨 = raw 개별값이지 누적 끝점(200/50) 이 아니다`, () => {
      const labels = valueLabels({ chartType, stackType: "stacked" });
      // 누적 안쪽 라벨은 조각이 글자 높이보다 작으면 생략된다 (bar.ts valueLabel `fits`) —
      //   Feb mobile 10 이 그 경우다. 남은 라벨은 전부 raw 집합의 원소이고 누적 끝점은 없다.
      expect(labels.length).toBeGreaterThan(0);
      for (const text of labels) expect(["10", "120", "40", "80"]).toContain(text);
      expect(labels).not.toContain("200");
      expect(labels).not.toContain("50");
    });
  }

  it("runtime 모델 (Recharts 입력) 도 같다 — label{si} 는 raw, series{si} 값은 raw, ticks 는 0~100", () => {
    const model = resolveChartData(
      ROWS,
      props({ chartType: "bar", stackType: "expand" }),
      8,
    );
    expect(model.stackMode).toBe("expand");
    expect(model.ticks.domain).toEqual([0, 100]);
    // 내부 행은 raw 값 — 정규화는 bands(range) 에만 있다 (RechartsChart 가 isRange 로 소비).
    expect(model.rows[0]).toMatchObject({
      category: "Jan",
      series0: 120,
      series1: 80,
    });
    expect(model.bands[0].get(0)).toEqual({ from: 0, to: 60 });
    expect(model.bands[1].get(0)).toEqual({ from: 60, to: 100 });
  });

  it("auto/미설정 문자열 = formatTick (en-US, 최대 2자리, 최소 0자리)", () => {
    expect(formatTick(25)).toBe("25");
    expect(formatTick(1234.5)).toBe("1,234.5");
    expect(formatTick(0.256)).toBe("0.26");
  });
});
