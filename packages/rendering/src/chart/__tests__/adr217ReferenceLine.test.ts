/**
 * ADR-217 P2 / G1 — 값 축 기준선 (`referenceLines[]`) 모델.
 *
 * 손계산 oracle (breakdown §2.4): 데이터 max 100 (min 0) 에
 *   - `value 120` (domain 위) → domain `[0, 120]` (niceTicks 5) · 선 y = plot.y (맨 위)
 *   - `value -20` (domain 아래, bar) → domain `[-20, 100]`
 *   - `value 50` (안) → domain `[0, 100]` 그대로 (byte 동일) · 선 y = plot 중간
 * HC1: `referenceLines` 미설정 문서의 scene JSON 은 byte 동일. 진단 3종: 종류 · 개수 · 값.
 */
import { describe, expect, it } from "vitest";
import {
  CHART_DEFAULT_METRICS,
  CHART_DEFAULT_PROPS,
  computeChartScene,
} from "../computeChartScene";
import { resolveChartModel } from "../model";
import { resolveChartPresentation } from "../presentation";
import { niceTicks } from "../scales";
import type { ChartProps, LineMark, TextMark } from "../types";

const size = { width: 400, height: 300 };
const rows = [
  { category: "A", value: 40 },
  { category: "B", value: 100 },
  { category: "C", value: 70 },
];
const P = (extra: Partial<ChartProps> = {}): ChartProps => ({
  ...CHART_DEFAULT_PROPS,
  chartType: "bar",
  dimension: "category",
  metric: "value",
  ...extra,
});
const refLines = (scene: ReturnType<typeof computeChartScene>) =>
  scene.marks.filter(
    (m): m is LineMark => m.kind === "line" && m.role === "reference",
  );
const refLabels = (scene: ReturnType<typeof computeChartScene>) =>
  scene.marks.filter(
    (m): m is TextMark => m.kind === "text" && m.role === "reference",
  );

describe("ADR-217 G1 — 기준선 domain 확장 (scene 이 정한다)", () => {
  it("value 120 > max 100 → domain [0, 120] · 선은 plot 맨 위 · 두 leg 같은 ticks", () => {
    const props = P({ referenceLines: [{ value: 120, label: "Target" }] });
    const model = resolveChartModel(rows, props, {
      size,
      metrics: CHART_DEFAULT_METRICS,
    });
    expect(model.ticks.domain).toEqual(niceTicks(0, 120, 5).domain);
    expect(model.layout.ticks.domain).toEqual(model.ticks.domain);
    const scene = computeChartScene(props, rows, size);
    const [line] = refLines(scene);
    expect(line).toMatchObject({
      x1: scene.plot.x,
      x2: Number((scene.plot.x + scene.plot.w).toFixed(2)),
      y1: scene.plot.y,
      y2: scene.plot.y,
    });
    expect(line.dash).toBeUndefined();
    const [label] = refLabels(scene);
    expect(label).toMatchObject({ text: "Target", anchor: "end" });
    expect(label.x).toBeLessThanOrEqual(scene.plot.x + scene.plot.w);
  });

  it("value -20 < min 0 (bar) → domain [-20, 100]", () => {
    const props = P({ referenceLines: [{ value: -20 }] });
    const model = resolveChartModel(rows, props, {
      size,
      metrics: CHART_DEFAULT_METRICS,
    });
    expect(model.ticks.domain).toEqual(niceTicks(-20, 100, 5).domain);
  });

  it("value 50 (안) → domain 그대로 · dashed/dotted 는 dash 배열 · back 은 데이터 마크 앞, front 는 뒤", () => {
    const base = computeChartScene(P(), rows, size);
    const scene = computeChartScene(
      P({
        referenceLines: [
          { value: 50, lineType: "dashed", layer: "back" },
          { value: 80, lineType: "dotted" },
        ],
      }),
      rows,
      size,
    );
    expect(scene.axes).toEqual(base.axes);
    const lines = refLines(scene);
    expect(lines.map((l) => l.dash)).toEqual([
      [6, 4],
      [2, 3],
    ]);
    const firstRect = scene.marks.findIndex((m) => m.kind === "rect");
    const lastRect = scene.marks.map((m) => m.kind).lastIndexOf("rect");
    expect(scene.marks.indexOf(lines[0])).toBeLessThan(firstRect);
    expect(scene.marks.indexOf(lines[1])).toBeGreaterThan(lastRect);
  });

  it("수평 bar 는 값 축이 x — 세로 선", () => {
    const scene = computeChartScene(
      P({ orientation: "horizontal", referenceLines: [{ value: 50 }] }),
      rows,
      size,
    );
    const [line] = refLines(scene);
    expect(line.x1).toBe(line.x2);
    expect(line.y1).toBe(scene.plot.y);
    expect(line.y2).toBe(Number((scene.plot.y + scene.plot.h).toFixed(2)));
  });

  it("HC1 — 미설정 · 빈 배열은 byte 동일", () => {
    const a = JSON.stringify(computeChartScene(P(), rows, size));
    expect(
      JSON.stringify(computeChartScene(P({ referenceLines: [] }), rows, size)),
    ).toBe(a);
    expect(
      JSON.stringify(
        computeChartScene(P({ referenceLines: undefined }), rows, size),
      ),
    ).toBe(a);
  });

  it("진단 — pie 거부 · 5개 초과 · 비유한 값 · 잘못된 lineType", () => {
    const codes = (props: Partial<ChartProps>) =>
      resolveChartPresentation(P(props), 8).diagnostics.map((d) => d.code);
    expect(
      codes({ chartType: "pie", referenceLines: [{ value: 1 }] }),
    ).toContain("referenceLines.unsupportedChartType");
    expect(
      codes({ referenceLines: [1, 2, 3, 4, 5].map((value) => ({ value })) }),
    ).toContain("referenceLines.tooMany");
    expect(codes({ referenceLines: [{ value: Number.NaN }] })).toContain(
      "referenceLines.invalid",
    );
    expect(
      codes({ referenceLines: [{ value: 1, lineType: "wavy" as never }] }),
    ).toContain("referenceLines.invalid");
    expect(
      resolveChartPresentation(P({ referenceLines: [{ value: 1 }] }), 8).ok,
    ).toBe(true);
    // 설정 오류면 scene 은 "Check chart settings".
    expect(
      computeChartScene(
        P({ chartType: "pie", referenceLines: [{ value: 1 }] }),
        rows,
        size,
      ).empty,
    ).toBe(true);
  });
});
