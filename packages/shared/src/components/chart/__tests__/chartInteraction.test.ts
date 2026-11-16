/**
 * ADR-306 Phase 6 판독 HIGH-1 — 확대는 보이는 격자 이름이 아니라 원본 격자 (예산 전) 의 범주 구간으로 행을
 * 남긴다. extrema 예산 (긴 시간 축) 은 보이는 범주가 원본의 일부라, 보이는 이름만 남기면 구간 사이 행을 잃는다.
 */
import { describe, expect, it } from "vitest";
import {
  CHART_DEFAULT_METRICS,
  CHART_DEFAULT_PROPS,
  resolveChartModel,
  type ChartProps,
  type ChartRow,
} from "@composition/rendering";
import { zoomCategoryLabels } from "../chartInteraction";

describe("zoomCategoryLabels", () => {
  it("extrema 예산 (2,000 일) — 고른 두 범주 사이의 원본 범주 전부", () => {
    const rows: ChartRow[] = Array.from({ length: 2000 }, (_, i) => ({
      category: new Date(Date.UTC(2024, 0, 1) + i * 86400000)
        .toISOString()
        .slice(0, 10),
      value: Math.sin(i / 7) * 10 + i * 0.01,
    }));
    const props = {
      ...CHART_DEFAULT_PROPS,
      chartType: "line",
      dimensionScale: "time",
    } as ChartProps;
    const model = resolveChartModel(rows, props, {
      size: { width: 480, height: 300 },
      metrics: CHART_DEFAULT_METRICS,
    });
    expect(model.visible.categories.length).toBeLessThan(2000);
    const labels = zoomCategoryLabels(model.input, model.visible, {
      from: 10,
      to: 20,
    })!;
    const a = model.input.categories.indexOf(model.visible.categories[10]);
    const b = model.input.categories.indexOf(model.visible.categories[20]);
    expect(labels).toHaveLength(b - a + 1);
    expect(labels.length).toBeGreaterThan(11);
  });

  it("보이는 이름이 원본에 없으면 (묶음 · others) 확대하지 않는다", () => {
    expect(
      zoomCategoryLabels(
        { categories: ["a", "b", "c"] },
        { categories: ["a ~ b", "c"] },
        { from: 0, to: 1 },
      ),
    ).toBeNull();
  });
});
