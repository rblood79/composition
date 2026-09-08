/**
 * shadcn charts 대조 후속 — radar 격자·선 제어 축 (예제 6종).
 *
 * shadcn 의 축 매핑은 `PolarAngleAxis` = 레이블 / `PolarGrid` = 스포크 + 동심 격자이고
 * `radialLines={false}` 가 스포크만 끈다. 우리는 `showAxis` 가 각도 축 전체를 켜고
 * 그 **안에서** `showSpokes` 가 스포크만 가르는 형태로 둔다 — 기본값 true 라
 * 기존 그림이 1px 도 바뀌지 않는다.
 */
import { describe, expect, it } from "vitest";
import { CHART_DEFAULT_PROPS, computeChartScene } from "../computeChartScene";
import type { ChartProps, ChartRow } from "../types";

const ROWS: ChartRow[] = [
  { category: "A", value: 10 },
  { category: "B", value: 20 },
  { category: "C", value: 30 },
  { category: "D", value: 25 },
];
const SIZE = { width: 320, height: 260 };

function scene(patch: Partial<ChartProps> = {}) {
  return computeChartScene(
    { ...CHART_DEFAULT_PROPS, chartType: "radar", showGrid: true, ...patch },
    ROWS,
    SIZE,
  );
}

const angular = (s: ReturnType<typeof scene>) =>
  s.axes.find((a) => a.axis === "angular")!;
const radialAxis = (s: ReturnType<typeof scene>) =>
  s.axes.find((a) => a.axis === "radial")!;

describe("showSpokes — radialLines (grid-none · lines-only · grid-circle-no-lines)", () => {
  it("기본값은 true — 기존 그림 그대로 스포크가 범주 수만큼", () => {
    expect(angular(scene()).grid).toHaveLength(4);
  });

  it("false 면 스포크만 사라지고 각도 레이블은 남는다", () => {
    const s = scene({ showSpokes: false });
    expect(angular(s).grid).toHaveLength(0);
    expect(angular(s).ticks).toHaveLength(4);
  });

  it("showAxis=false 는 종전대로 각도 축 전체를 끈다 (스포크 + 레이블)", () => {
    const s = scene({ showAxis: false });
    expect(angular(s).grid).toHaveLength(0);
    expect(angular(s).ticks).toHaveLength(0);
  });

  it("grid-none 조합 — 레이블만 남는다", () => {
    const s = scene({ showSpokes: false, showGrid: false });
    expect(angular(s).grid).toHaveLength(0);
    expect(radialAxis(s).grid).toHaveLength(0);
    expect(angular(s).ticks).toHaveLength(4);
  });
});

describe("gridRings — polarRadius (grid-custom)", () => {
  it("기본값 0 이면 값 눈금 개수를 따른다", () => {
    expect(radialAxis(scene()).grid.length).toBeGreaterThan(1);
  });

  it("1 이면 바깥 링 하나만 그린다", () => {
    const rings = radialAxis(scene({ gridRings: 1 })).grid;
    expect(rings).toHaveLength(1);
  });

  it("N 이면 균등 N 개 — 가장 바깥(배열 마지막)이 항상 포함된다", () => {
    const three = radialAxis(scene({ gridRings: 3 })).grid;
    const one = radialAxis(scene({ gridRings: 1 })).grid;
    expect(three).toHaveLength(3);
    // 두 경우의 바깥 링은 같은 자리다 (안쪽→바깥 순서라 마지막 원소)
    expect((three[2] as { d: string }).d).toBe((one[0] as { d: string }).d);
  });

  it("음수·비수치는 자동(0)으로 접는다", () => {
    expect(radialAxis(scene({ gridRings: -2 })).grid).toEqual(
      radialAxis(scene()).grid,
    );
  });
});

describe("fillGrid — PolarGrid fill (grid-fill · grid-circle-fill)", () => {
  it("기본값은 false — 격자는 선만", () => {
    for (const ring of radialAxis(scene()).grid) {
      expect((ring as { fillRole?: string }).fillRole).toBeUndefined();
    }
  });

  it("true 면 **가장 바깥 링 하나만** 채운다 (겹쳐 채우면 안쪽이 진해진다)", () => {
    const rings = radialAxis(scene({ fillGrid: true })).grid;
    const filled = rings.filter(
      (r) => (r as { fillRole?: string }).fillRole !== undefined,
    );
    expect(filled).toHaveLength(1);
    expect(filled[0]).toBe(rings[rings.length - 1]);
  });

  it("circle 격자에도 같이 적용된다", () => {
    const rings = radialAxis(scene({ fillGrid: true, gridType: "circle" })).grid;
    const outer = rings[rings.length - 1] as { fillRole?: string; d: string };
    expect(outer.fillRole).toBe("grid");
    expect(outer.d).toContain("A ");
  });
});

describe("fillArea — Radar fillOpacity 0 (lines-only)", () => {
  it("기본값은 true — 다각형이 채워진다", () => {
    const poly = scene().marks[0] as { fillSeries?: number };
    expect(poly.fillSeries).toBeDefined();
  });

  it("false 면 선만 남는다 — 좌표(d)는 그대로", () => {
    const on = scene().marks[0] as { fillSeries?: number; d: string };
    const off = scene({ fillArea: false }).marks[0] as {
      fillSeries?: number;
      strokeSeries?: number;
      d: string;
    };
    expect(off.fillSeries).toBeUndefined();
    expect(off.strokeSeries).toBeDefined();
    expect(off.d).toBe(on.d);
  });
});

describe("무시 계약 — 신규 4프롭은 radar 밖에서 좌표를 안 바꾼다", () => {
  const others: ChartProps["chartType"][] = ["bar", "line", "area", "pie", "radial"];
  it.each(others)("%s", (chartType) => {
    const base = { ...CHART_DEFAULT_PROPS, chartType, showGrid: true };
    const patched = {
      ...base,
      showSpokes: false,
      gridRings: 1,
      fillGrid: true,
      fillArea: false,
    };
    expect(computeChartScene(patched, ROWS, SIZE)).toEqual(
      computeChartScene(base, ROWS, SIZE),
    );
  });
});
