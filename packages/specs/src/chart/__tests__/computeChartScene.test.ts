/**
 * ADR-194 Phase 2 G2 — scene 결정적 스냅샷 + 불변식.
 *
 * 스냅샷만으로는 "값이 안 바뀌었다" 밖에 못 본다. 그래서 **불변식** 을 같이 건다:
 * 좌표가 전부 유한한가 · 마크가 plot 안에 있는가 · 같은 입력이 두 번 호출에서
 * 같은가 · orientation/stackType 이 실제로 좌표를 바꾸는가.
 */
import { describe, it, expect } from "vitest";
import {
  CHART_DEFAULT_METRICS,
  CHART_DEFAULT_PROPS,
  computeChartScene,
} from "../computeChartScene";
import type { ChartProps, ChartRow, ChartScene, Mark } from "../types";

const SIZE = { width: 320, height: 240 };

const ROWS: ChartRow[] = [
  { category: "Mon", value: 12, series: "A" },
  { category: "Tue", value: 30, series: "A" },
  { category: "Wed", value: 18, series: "A" },
  { category: "Mon", value: 20, series: "B" },
  { category: "Tue", value: 8, series: "B" },
  { category: "Wed", value: 25, series: "B" },
];

function props(overrides: Partial<ChartProps> = {}): ChartProps {
  return { ...CHART_DEFAULT_PROPS, color: "series", ...overrides };
}

/** scene 안의 모든 숫자 좌표를 훑는다. */
function forEachNumber(scene: ChartScene, visit: (n: number) => void): void {
  const walk = (value: unknown): void => {
    if (typeof value === "number") return visit(value);
    if (Array.isArray(value)) return value.forEach(walk);
    if (value && typeof value === "object") {
      for (const v of Object.values(value)) walk(v);
    }
  };
  walk(scene);
}

function markBounds(mark: Mark): [number, number, number, number] | null {
  if (mark.kind === "rect") {
    return [mark.x, mark.y, mark.x + mark.w, mark.y + mark.h];
  }
  if (mark.kind === "path") {
    const b = mark.bbox;
    return [b.x, b.y, b.x + b.w, b.y + b.h];
  }
  return null;
}

describe("computeChartScene — 결정성 · 유한성", () => {
  it("같은 입력은 같은 scene 을 낸다 (순수 함수)", () => {
    const a = computeChartScene(props(), ROWS, SIZE);
    const b = computeChartScene(props(), ROWS, SIZE);
    expect(a).toEqual(b);
  });

  it("모든 좌표가 유한하다 — 차트 4종 × orientation 2 × stackType 2", () => {
    for (const chartType of ["bar", "line", "area", "pie"] as const) {
      for (const orientation of ["vertical", "horizontal"] as const) {
        for (const stackType of ["stacked", "dodged"] as const) {
          const scene = computeChartScene(
            props({ chartType, orientation, stackType, showGrid: true }),
            ROWS,
            SIZE,
          );
          forEachNumber(scene, (n) => {
            expect(Number.isFinite(n)).toBe(true);
          });
          expect(scene.empty).toBe(false);
          expect(scene.marks.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("path `d` 에 NaN/undefined 문자열이 절대 실리지 않는다", () => {
    for (const chartType of ["line", "area", "pie"] as const) {
      const scene = computeChartScene(props({ chartType }), ROWS, SIZE);
      for (const mark of scene.marks) {
        if (mark.kind !== "path") continue;
        expect(mark.d).not.toMatch(/NaN|undefined|Infinity/);
        expect(mark.d.length).toBeGreaterThan(0);
      }
    }
  });

  it("마크는 plot 영역 안에 있다 (bar/line/area)", () => {
    for (const chartType of ["bar", "line", "area"] as const) {
      const scene = computeChartScene(props({ chartType }), ROWS, SIZE);
      const p = scene.plot;
      for (const mark of scene.marks) {
        const bounds = markBounds(mark);
        if (!bounds) continue;
        const [left, top, right, bottom] = bounds;
        expect(left).toBeGreaterThanOrEqual(p.x - 0.5);
        expect(top).toBeGreaterThanOrEqual(p.y - 0.5);
        expect(right).toBeLessThanOrEqual(p.x + p.w + 0.5);
        expect(bottom).toBeLessThanOrEqual(p.y + p.h + 0.5);
      }
    }
  });
});

describe("computeChartScene — 축이 실제로 좌표를 바꾼다", () => {
  it("orientation 전환은 bar 좌표를 바꾼다", () => {
    const v = computeChartScene(props({ orientation: "vertical" }), ROWS, SIZE);
    const h = computeChartScene(
      props({ orientation: "horizontal" }),
      ROWS,
      SIZE,
    );
    expect(v.marks).not.toEqual(h.marks);
  });

  it("stacked 는 dodged 보다 막대가 두껍고 개수가 같다", () => {
    const dodged = computeChartScene(
      props({ stackType: "dodged" }),
      ROWS,
      SIZE,
    );
    const stacked = computeChartScene(
      props({ stackType: "stacked" }),
      ROWS,
      SIZE,
    );
    const widthOf = (s: ChartScene) =>
      s.marks.filter((m): m is Extract<Mark, { kind: "rect" }> =>
        m.kind === "rect",
      )[0].w;
    expect(stacked.marks.length).toBe(dodged.marks.length);
    expect(widthOf(stacked)).toBeGreaterThan(widthOf(dodged));
  });

  it("stacked 값 축은 시리즈 합까지 늘어난다 (막대가 plot 밖으로 안 나간다)", () => {
    const stacked = computeChartScene(
      props({ stackType: "stacked" }),
      ROWS,
      SIZE,
    );
    const p = stacked.plot;
    for (const mark of stacked.marks) {
      if (mark.kind !== "rect") continue;
      expect(mark.y).toBeGreaterThanOrEqual(p.y - 0.5);
      expect(mark.y + mark.h).toBeLessThanOrEqual(p.y + p.h + 0.5);
    }
  });

  it("showGrid 는 grid line 을, showAxis 는 축선·tick 을 켠다", () => {
    const off = computeChartScene(
      props({ showAxis: false, showGrid: false }),
      ROWS,
      SIZE,
    );
    const on = computeChartScene(
      props({ showAxis: true, showGrid: true }),
      ROWS,
      SIZE,
    );
    expect(off.axes.every((a) => a.grid.length === 0)).toBe(true);
    expect(off.axes.every((a) => a.line === null)).toBe(true);
    expect(off.axes.every((a) => a.ticks.length === 0)).toBe(true);
    expect(on.axes.some((a) => a.grid.length > 0)).toBe(true);
    expect(on.axes.some((a) => a.line !== null)).toBe(true);
    expect(on.axes.some((a) => a.ticks.length > 0)).toBe(true);
  });

  it("showLegend 는 시리즈마다 swatch+text 를 만들고 plot 을 줄인다", () => {
    const off = computeChartScene(props({ showLegend: false }), ROWS, SIZE);
    const on = computeChartScene(props({ showLegend: true }), ROWS, SIZE);
    expect(off.legend).toBeNull();
    expect(on.legend?.items).toHaveLength(2);
    expect(on.legend?.items.map((i) => i.label)).toEqual(["A", "B"]);
    expect(on.plot.h).toBeLessThan(off.plot.h);
  });

  it("legendPosition left 는 폭을, top 은 높이를 줄인다", () => {
    const base = computeChartScene(props({ showLegend: false }), ROWS, SIZE);
    const left = computeChartScene(
      props({ showLegend: true, legendPosition: "left" }),
      ROWS,
      SIZE,
    );
    const top = computeChartScene(
      props({ showLegend: true, legendPosition: "top" }),
      ROWS,
      SIZE,
    );
    expect(left.plot.w).toBeLessThan(base.plot.w);
    expect(top.plot.y).toBeGreaterThan(base.plot.y);
  });
});

describe("computeChartScene — empty 상태 (G2 대안)", () => {
  const cases: Array<[string, ChartRow[], { width: number; height: number }]> =
    [
      ["행 0", [], SIZE],
      ["값이 전부 비수치", [{ category: "A", value: "n/a" }], SIZE],
      ["크기 0", ROWS, { width: 0, height: 0 }],
      ["padding 보다 작은 크기", ROWS, { width: 4, height: 4 }],
      ["NaN 크기", ROWS, { width: NaN, height: NaN }],
    ];

  for (const [name, rows, size] of cases) {
    it(`${name} → empty scene (예외 없이 안내 텍스트 1개)`, () => {
      const scene = computeChartScene(props(), rows, size);
      expect(scene.empty).toBe(true);
      expect(scene.marks).toHaveLength(1);
      expect(scene.marks[0].kind).toBe("text");
      expect(scene.axes).toEqual([]);
      expect(scene.legend).toBeNull();
      forEachNumber(scene, (n) => expect(Number.isFinite(n)).toBe(true));
    });
  }

  it("값이 0 뿐인 파이도 empty (0 조각은 각도를 못 만든다)", () => {
    const scene = computeChartScene(
      props({ chartType: "pie" }),
      [{ category: "A", value: 0 }],
      SIZE,
    );
    expect(scene.empty).toBe(true);
  });
});

describe("computeChartScene — 데이터 해석", () => {
  it("같은 (범주,시리즈) 중복 행은 합산한다", () => {
    const doubled = computeChartScene(
      props({ color: undefined, showAxis: false }),
      [
        { category: "A", value: 10 },
        { category: "A", value: 5 },
      ],
      SIZE,
    );
    const single = computeChartScene(
      props({ color: undefined, showAxis: false }),
      [{ category: "A", value: 15 }],
      SIZE,
    );
    expect(doubled.marks).toEqual(single.marks);
  });

  it("비수치 값은 0 이 아니라 '없음' — 막대가 안 생긴다", () => {
    const scene = computeChartScene(
      props({ color: undefined, showAxis: true }),
      [
        { category: "A", value: 10 },
        { category: "B", value: "oops" },
      ],
      SIZE,
    );
    const rects = scene.marks.filter((m) => m.kind === "rect");
    expect(rects).toHaveLength(1);
    // 범주 B 는 축에는 남는다 (사용자가 준 범주를 지우지 않는다)
    expect(scene.axes[0].ticks.map((t) => t.text)).toContain("B");
  });

  it("line — 값이 끊긴 구간에서 subpath 를 나눈다 (없는 추세 금지)", () => {
    const scene = computeChartScene(
      props({ chartType: "line", color: undefined, showAxis: false }),
      [
        { category: "A", value: 10 },
        { category: "B", value: "gap" },
        { category: "C", value: 20 },
      ],
      SIZE,
    );
    const path = scene.marks.find((m) => m.kind === "path");
    expect(path?.kind).toBe("path");
    // M 이 2개 = subpath 2개
    expect((path as { d: string }).d.match(/M /g)).toHaveLength(2);
  });

  it("파이는 범주가 색을 가른다 (조각마다 다른 seriesIndex)", () => {
    const scene = computeChartScene(
      props({ chartType: "pie", color: undefined }),
      [
        { category: "A", value: 1 },
        { category: "B", value: 2 },
        { category: "C", value: 3 },
      ],
      SIZE,
    );
    const indices = scene.marks
      .filter((m) => m.kind === "path")
      .map((m) => (m as { fillSeries?: number }).fillSeries);
    expect(indices).toEqual([0, 1, 2]);
  });

  it("파이 조각 하나뿐이면 전체 원 (A 명령 2개로 360°)", () => {
    const scene = computeChartScene(
      props({ chartType: "pie", color: undefined }),
      [{ category: "A", value: 5 }],
      SIZE,
    );
    const d = (scene.marks[0] as { d: string }).d;
    expect(d.match(/A /g)).toHaveLength(2);
  });

  it("팔레트 길이를 넘는 시리즈는 색을 순환한다", () => {
    const rows: ChartRow[] = [];
    for (let i = 0; i < 10; i++) {
      rows.push({ category: "A", value: i + 1, series: `S${i}` });
    }
    const scene = computeChartScene(props(), rows, SIZE, {
      ...CHART_DEFAULT_METRICS,
      seriesCount: 4,
    });
    const indices = scene.marks
      .filter((m) => m.kind === "rect")
      .map((m) => (m as { seriesIndex: number }).seriesIndex);
    expect(Math.max(...indices)).toBeLessThan(4);
    expect(indices.slice(0, 5)).toEqual([0, 1, 2, 3, 0]);
  });
});

describe("computeChartScene — 스냅샷 (좌표 회귀 감시)", () => {
  it("bar / vertical / dodged", () => {
    expect(
      computeChartScene(props(), ROWS.slice(0, 3), SIZE),
    ).toMatchSnapshot();
  });

  it("line / horizontal / grid+legend", () => {
    expect(
      computeChartScene(
        props({
          chartType: "line",
          orientation: "horizontal",
          showGrid: true,
          showLegend: true,
        }),
        ROWS,
        SIZE,
      ),
    ).toMatchSnapshot();
  });

  it("area / vertical / stacked", () => {
    expect(
      computeChartScene(
        props({ chartType: "area", stackType: "stacked" }),
        ROWS,
        SIZE,
      ),
    ).toMatchSnapshot();
  });

  it("pie / legend right", () => {
    expect(
      computeChartScene(
        props({
          chartType: "pie",
          showLegend: true,
          legendPosition: "right",
        }),
        ROWS,
        SIZE,
      ),
    ).toMatchSnapshot();
  });
});
