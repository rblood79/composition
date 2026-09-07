/**
 * ADR-194 후속 (shadcn 대조) — 도넛 · 다중 시리즈 링 · 구멍 안 합계.
 *
 * 고리 조각은 바깥 호와 안쪽 호가 **한 path 안에서 겹친다** — 감김 방향과
 * fillRule 을 잘못 두면 구멍이 안 뚫리고 그냥 파이가 된다. 그래서 여기서 보는
 * 것은 반지름 값이 아니라 **명령 구조와 fillRule** 이다.
 */
import { describe, it, expect } from "vitest";
import { arcPath, arcSlicePath } from "../marks/pie";
import { computeChartScene, CHART_DEFAULT_PROPS } from "../computeChartScene";
import type { ChartProps, ChartRow, Mark, TextMark } from "../types";

const SIZE = { width: 320, height: 240 };
const ROWS: ChartRow[] = [
  { category: "Mon", value: 12, series: "A" },
  { category: "Tue", value: 30, series: "A" },
  { category: "Mon", value: 20, series: "B" },
  { category: "Tue", value: 8, series: "B" },
];
const props = (o: Partial<ChartProps> = {}): ChartProps => ({
  ...CHART_DEFAULT_PROPS,
  chartType: "pie",
  color: "series",
  ...o,
});

const paths = (o: Partial<ChartProps> = {}) =>
  computeChartScene(props(o), ROWS, SIZE).marks.filter(
    (m): m is Extract<Mark, { kind: "path" }> => m.kind === "path",
  );

describe("arcSlicePath", () => {
  it("innerRadius 0 은 기존 파이 조각 (중심에서 시작)", () => {
    expect(arcSlicePath(0, 0, 10, 0, 0, 90)).toBe(arcPath(0, 0, 10, 0, 90));
    expect(arcPath(0, 0, 10, 0, 90).startsWith("M 0 0 L")).toBe(true);
  });

  it("고리 조각은 바깥 호 뒤에 안쪽 호를 반대로 되짚는다", () => {
    const d = arcSlicePath(0, 0, 10, 5, 0, 90);
    expect(d).toBe("M 0 -10 A 10 10 0 0 1 10 0 L 5 0 A 5 5 0 0 0 0 -5 Z");
  });

  it("전체 고리는 두 원의 감김 방향이 반대다 (evenodd 로 뚫린다)", () => {
    const d = arcSlicePath(0, 0, 10, 5, 0, 360);
    const sweeps = [...d.matchAll(/A \d+(?:\.\d+)? \d+(?:\.\d+)? 0 1 ([01])/g)].map(
      (m) => m[1],
    );
    expect(sweeps).toEqual(["1", "1", "0", "0"]);
  });

  it("sweep 0 또는 반지름 0 은 빈 문자열", () => {
    expect(arcSlicePath(0, 0, 10, 5, 0, 0)).toBe("");
    expect(arcSlicePath(0, 0, 0, 0, 0, 90)).toBe("");
  });
});

describe("도넛", () => {
  it("innerRadius 가 0 이면 조각은 중심에서 시작하고 fillRule 이 없다", () => {
    const [slice] = paths();
    expect(slice.d).toContain("L ");
    expect(slice.fillRule).toBeUndefined();
  });

  it("innerRadius > 0 이면 evenodd 고리가 된다", () => {
    const [slice] = paths({ innerRadius: 50 });
    expect(slice.fillRule).toBe("evenodd");
    // 바깥 호 + 안쪽 호 = A 명령 2개
    expect((slice.d.match(/ A /g) ?? []).length).toBe(2);
  });

  it("구멍 안 합계는 전체 합과 배율을 함께 싣는다", () => {
    const scene = computeChartScene(
      props({ innerRadius: 60, showTotal: true }),
      ROWS,
      SIZE,
    );
    const totals = scene.marks.filter(
      (m): m is TextMark => m.kind === "text" && m.fontScale !== undefined,
    );
    expect(totals).toHaveLength(1);
    expect(totals[0].text).toBe("42"); // 첫 시리즈 12 + 30
    expect(totals[0].fontScale).toBeGreaterThan(1);
    // 설명(metric 필드명) 도 같이
    expect(
      scene.marks.some((m) => m.kind === "text" && m.text === "value"),
    ).toBe(true);
  });

  it("구멍이 글자보다 작으면 합계를 그리지 않는다", () => {
    const scene = computeChartScene(
      props({ innerRadius: 5, showTotal: true }),
      ROWS,
      SIZE,
    );
    expect(
      scene.marks.some((m) => m.kind === "text" && m.fontScale !== undefined),
    ).toBe(false);
  });
});

describe("다중 시리즈 링 (shadcn chart-pie-stacked)", () => {
  it("dodged 는 첫 시리즈만 그린다 (겹쳐 가리지 않는다)", () => {
    expect(paths({ stackType: "dodged" })).toHaveLength(2);
  });

  it("stacked 는 시리즈마다 링을 하나씩 그린다", () => {
    const rings = paths({ stackType: "stacked" });
    expect(rings).toHaveLength(4); // 시리즈 2 × 범주 2
    // 바깥 링의 bbox 가 안쪽 링보다 크다
    expect(rings[0].bbox.w).toBeGreaterThan(rings[2].bbox.w);
  });

  it("링은 범주 색을 공유한다 (범례와 같은 축)", () => {
    const rings = paths({ stackType: "stacked" });
    expect(rings.map((r) => r.fillSeries)).toEqual([0, 1, 0, 1]);
  });

  it("링 조각도 evenodd 고리다 (안쪽이 뚫려야 아래 링이 보인다)", () => {
    for (const ring of paths({ stackType: "stacked" })) {
      expect(ring.fillRule).toBe("evenodd");
    }
  });
});
