/**
 * ADR-217 P1 / G1 — 미지원 `chartType` 안전 경로 (rollback 경계, round 1 h2).
 *
 * 구버전은 알 수 없는 종류를 `slotFit`/`markFactor` 의 throw 로 만나 캔버스 scene 빌드 · Preview
 * 렌더가 통째로 멈췄다 (두 leg 모두 catch 0). P1 부터는 validator 진단 `chartType.unsupported`
 * (error) → 설정 오류 scene ("Check chart settings") 이다 — 데이터는 그대로, throw 0.
 */
import { describe, expect, it } from "vitest";
import {
  CHART_DEFAULT_METRICS,
  CHART_DEFAULT_PROPS,
  CHART_INVALID_SETTINGS_TEXT,
  computeChartScene,
} from "../computeChartScene";
import { CHART_TYPES } from "../types";
import { resolveChartModel } from "../model";
import { resolveChartPresentation } from "../presentation";
import { resolveChartData } from "../runtimeData";
import type { ChartProps, ChartType } from "../types";

const size = { width: 400, height: 300 };
const rows = [
  { x: 1, y: 10 },
  { x: 2, y: 20 },
];
/** 아직 없는 종류 — P4 에서 `scatter` 가 들어오면 다른 문자열로 바꾼다 (미래 종류의 대역). */
const unknown = {
  ...CHART_DEFAULT_PROPS,
  chartType: "hexbin" as ChartType,
  dimension: "x",
  metric: "y",
} satisfies ChartProps;

describe("ADR-217 G1 — 미지원 chartType 안전 경로", () => {
  it("CHART_TYPES 는 ChartType 유니온의 값 목록이다 (6종)", () => {
    expect([...CHART_TYPES]).toEqual([
      "bar",
      "line",
      "area",
      "pie",
      "radar",
      "radial",
    ]);
  });

  it("validator 가 error 진단 `chartType.unsupported` 를 내고 ok=false", () => {
    const presentation = resolveChartPresentation(unknown, 8);
    expect(presentation.ok).toBe(false);
    expect(
      presentation.diagnostics.find((d) => d.code === "chartType.unsupported"),
    ).toMatchObject({ severity: "error", value: "hexbin" });
  });

  it("모델 · Canvas scene · DOM 데이터 모델이 throw 없이 설정 오류 상태를 돌려준다", () => {
    expect(() =>
      resolveChartModel(rows, unknown, {
        size,
        metrics: CHART_DEFAULT_METRICS,
      }),
    ).not.toThrow();
    const scene = computeChartScene(unknown, rows, size);
    expect(scene.empty).toBe(true);
    expect(
      scene.marks.map((m) => (m.kind === "text" ? m.text : m.kind)),
    ).toEqual([CHART_INVALID_SETTINGS_TEXT]);
    expect(
      scene.diagnostics?.some((d) => d.code === "chartType.unsupported"),
    ).toBe(true);
    const dom = resolveChartData(rows, unknown, 8, {
      size,
      metrics: CHART_DEFAULT_METRICS,
    });
    expect(dom.presentation.ok).toBe(false);
    // 데이터는 보존된다 — 입력 행이 격자에 그대로 남는다 (삭제 · 변환 0).
    expect(dom.grid.categories).toEqual(["1", "2"]);
  });

  it("6종은 그대로 — 진단 없이 ok (HC1)", () => {
    for (const chartType of CHART_TYPES) {
      const presentation = resolveChartPresentation(
        { ...CHART_DEFAULT_PROPS, chartType },
        8,
      );
      expect(
        presentation.diagnostics.some(
          (d) => d.code === "chartType.unsupported",
        ),
      ).toBe(false);
    }
  });
});
