/**
 * shadcn charts 대조 후속 #5 — 극좌표 각도 범위 (radial-shape · radial-text ·
 * radial-stacked 반원).
 *
 * 각도 규약은 우리 것을 쓴다 — **12시 = 0°, 시계 방향**. Recharts 는 3시=0 반시계라
 * 같은 그림이라도 숫자가 다르다 (shadcn `endAngle={180}` 반원 = 우리 `endAngle: 180`
 * 이 아니라 시작 180 / 끝 360 처럼 읽히면 안 되므로, 우리 규약으로 다시 정의한다).
 */
import { describe, expect, it } from "vitest";
import { CHART_DEFAULT_PROPS, computeChartScene } from "../computeChartScene";
import { buildRadialMarks } from "../marks/radial";
import { buildSeriesGrid } from "../series";
import type { ChartProps, ChartRow } from "../types";

const ROWS: ChartRow[] = [
  { category: "A", value: 50 },
  { category: "B", value: 100 },
];
const SIZE = { width: 320, height: 260 };
const CENTER = { x: 100, y: 100, outer: 90, inner: 20 };

function marks(patch: Partial<Parameters<typeof buildRadialMarks>[0]> = {}) {
  const grid = buildSeriesGrid(
    ROWS,
    { dimension: "category", metric: "value" },
    8,
  );
  return buildRadialMarks({
    grid,
    center: CENTER,
    domain: [0, 100],
    seriesCount: 8,
    stackMode: "none",
    startAngle: 0,
    endAngle: 360,
    showValueLabels: false,
    showTotal: false,
    labelText: (_ci: number, raw: number) => String(raw),
    totalCaption: "value",
    fontSize: 11,
    ...patch,
  });
}

function scene(patch: Partial<ChartProps> = {}) {
  return computeChartScene(
    { ...CHART_DEFAULT_PROPS, chartType: "radial", ...patch },
    ROWS,
    SIZE,
  );
}

describe("startAngle / endAngle — 값이 차지하는 각도 범위", () => {
  it("기본은 0~360 — 값이 상한이면 한 바퀴", () => {
    const { rings } = marks();
    expect(rings[0].slices[0].sweep).toBeCloseTo(180, 5); // A=50 → 절반
    expect(rings[1].slices[0].sweep).toBeCloseTo(360, 5); // B=100 → 한 바퀴
  });

  it("반원 (0~180) — 상한 값이 180도만 돈다", () => {
    const { rings } = marks({ endAngle: 180 });
    expect(rings[1].slices[0].sweep).toBeCloseTo(180, 5);
    expect(rings[0].slices[0].sweep).toBeCloseTo(90, 5);
  });

  it("시작 각도가 조각의 출발점을 옮긴다", () => {
    const { rings } = marks({ startAngle: 90, endAngle: 270 });
    expect(rings[0].slices[0].start).toBeCloseTo(90, 5);
    expect(rings[1].slices[0].sweep).toBeCloseTo(180, 5);
  });

  it("트랙도 같은 범위만 돈다 (트랙이 한 바퀴면 반원 차트가 안 된다)", () => {
    const half = marks({ endAngle: 180 });
    const full = marks();
    const trackOf = (m: ReturnType<typeof marks>) =>
      m.marks.find((x) => x.fillRole === "grid")!;
    expect(trackOf(half).d).not.toBe(trackOf(full).d);
    // 한 바퀴 트랙은 원 2개(A 4번), 반원 트랙은 고리 조각(A 2번)
    expect((trackOf(full).d.match(/A /g) ?? []).length).toBe(4);
    expect((trackOf(half).d.match(/A /g) ?? []).length).toBe(2);
  });

  it("범위가 0 이하이거나 360 초과면 한 바퀴로 접는다", () => {
    const base = marks().rings[1].slices[0].sweep;
    expect(marks({ startAngle: 100, endAngle: 100 }).rings[1].slices[0].sweep)
      .toBeCloseTo(base, 5);
    expect(marks({ startAngle: 0, endAngle: 900 }).rings[1].slices[0].sweep)
      .toBeCloseTo(base, 5);
  });

  it("d 에 NaN/Infinity 가 없다", () => {
    for (const m of marks({ startAngle: -45, endAngle: 200 }).marks) {
      expect(m.d).not.toMatch(/NaN|Infinity/);
    }
  });
});

describe("showTotal — 중앙 합계 (radial-text · radial-shape · radial-stacked)", () => {
  it("radial 에서 showTotal 이 중앙 텍스트 2줄을 낸다", () => {
    const off = scene({ innerRadius: 60 });
    const on = scene({ innerRadius: 60, showTotal: true });
    const texts = (s: typeof on) => s.marks.filter((m) => m.kind === "text");
    expect(texts(on).length).toBe(texts(off).length + 2);
  });

  it("합계는 모든 링의 값을 더한 값이다", () => {
    const on = scene({ innerRadius: 60, showTotal: true });
    const texts = on.marks.filter(
      (m): m is Extract<typeof m, { kind: "text" }> => m.kind === "text",
    );
    expect(texts.some((t) => t.text === "150")).toBe(true);
  });

  it("구멍이 없으면(innerRadius 0) 중앙 텍스트를 안 그린다", () => {
    const off = scene({ innerRadius: 0 });
    const on = scene({ innerRadius: 0, showTotal: true });
    expect(on.marks.length).toBe(off.marks.length);
  });
});

describe("무시 계약 — 각도 범위는 radial 밖에서 좌표를 안 바꾼다", () => {
  const others: ChartProps["chartType"][] = ["bar", "line", "area", "pie", "radar"];
  it.each(others)("%s", (chartType) => {
    const base = { ...CHART_DEFAULT_PROPS, chartType };
    const patched = { ...base, startAngle: 90, endAngle: 200 };
    expect(computeChartScene(patched, ROWS, SIZE)).toEqual(
      computeChartScene(base, ROWS, SIZE),
    );
  });
});
