/**
 * ADR-306 G3 (Canvas 층) — `chart_scene` 이 family scene 을 「복사만」 한다: Shape 좌표 = scene 마크 좌표,
 * paint 역할 = rule `chart.paint` 토큰 (없으면 `CHART_PAINT_FALLBACK_TOKENS`). family prop 은 Skia
 * allowlist (`pickChartFamilyProps`) 를 지나 scene 에 닿는다 — 빠지면 dumbbell 이 설정 오류가 된다.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { SKIA_PRIMITIVES } from "../../../renderers/skiaPrimitives";
import {
  computeChartScene,
  CHART_DEFAULT_PROPS,
  resolveChartMetrics,
} from "../../computeChartScene";
import { CHART_PAINT_FALLBACK_TOKENS } from "../../paint";
import type { ChartProps } from "../../types";
import { loadChartFamily } from "../registry";
import { kpiFamily } from "../kpi";

beforeAll(async () => {
  await loadChartFamily("kpi");
});

const channel = {
  series: ["{color.a}"],
  axis: "{color.axis}",
  grid: "{color.grid}",
  reference: "{color.ref}",
  metrics: { padding: 12, fontSize: 11 },
  paint: { accent: "{color.accent-test}" },
};
const draw = (props: Record<string, unknown>, w = 480, h = 270) =>
  SKIA_PRIMITIVES.chart_scene!({
    props: {
      ...props,
      _containerWidth: w,
      _containerHeight: h,
      _chartRule: channel,
    },
    size: { height: h } as never,
    visual: undefined,
    paint: {
      backgroundColor: "{color.layer-1}",
      color: "{color.neutral}",
    } as never,
    style: undefined,
  }) as Array<Record<string, unknown>>;

describe("ADR-306 G3 — kpi Canvas = scene", () => {
  for (const type of ["gauge", "bullet", "dumbbell"] as const)
    it(`${type} — rect · line · path 좌표와 paint 토큰`, () => {
      const props = {
        ...CHART_DEFAULT_PROPS,
        chartType: type,
        ...kpiFamily.sampleProps(type),
        data: kpiFamily.sample(type),
      } as ChartProps & { data: unknown };
      const shapes = draw(props as never);
      const scene = computeChartScene(
        { ...(props as ChartProps), showTooltip: false },
        kpiFamily.sample(type),
        { width: 480, height: 270 },
        resolveChartMetrics(channel),
      );
      expect(scene.pending).toBeUndefined();
      expect(scene.diagnostics ?? []).toEqual([]);
      const rects = shapes.filter((s) => s.type === "rect");
      const sceneRects = scene.marks.filter((m) => m.kind === "rect");
      expect(rects).toHaveLength(
        sceneRects.length + (scene.legend?.items.length ?? 0),
      );
      sceneRects.forEach((m, i) => {
        if (m.kind !== "rect") return;
        expect([
          rects[i].x,
          rects[i].y,
          rects[i].width,
          rects[i].height,
        ]).toEqual([m.x, m.y, m.w, m.h]);
        if (m.fillPaint)
          expect(rects[i].fill).toBe(
            m.fillPaint === "accent"
              ? "{color.accent-test}"
              : CHART_PAINT_FALLBACK_TOKENS[m.fillPaint],
          );
        if (m.fillOpacity !== undefined)
          expect(rects[i].fillAlpha).toBe(m.fillOpacity);
      });
      const paths = shapes.filter((s) => s.type === "path");
      const scenePaths = scene.marks.filter((m) => m.kind === "path");
      expect(paths.map((p) => p.d)).toEqual(
        scenePaths.map((m) => m.kind === "path" && m.d),
      );
      for (const p of paths.filter((p) => p.fill === "{color.accent-test}"))
        expect(p.fillAlpha).toBe(1);
      const lines = shapes.filter((s) => s.type === "line");
      const sceneLines = [
        ...scene.axes.flatMap((a) => a.grid),
        ...scene.marks,
      ].filter((m) => m.kind === "line");
      expect(lines.map((l) => [l.x1, l.y1, l.x2, l.y2, l.strokeWidth])).toEqual(
        sceneLines.map(
          (m) => m.kind === "line" && [m.x1, m.y1, m.x2, m.y2, m.width ?? 1],
        ),
      );
    });

  it("pending (로드 전) 은 상자만 — Canvas 도 바탕 하나", async () => {
    const { __setChartFamilyLoaderForTest } = await import("../registry");
    const restore = __setChartFamilyLoaderForTest(
      "kpi",
      () => new Promise(() => undefined),
    );
    try {
      const shapes = draw({
        ...CHART_DEFAULT_PROPS,
        chartType: "gauge",
        metric: "value",
        data: [{ value: 1 }],
      });
      expect(shapes.map((s) => s.type)).toEqual(["roundRect"]);
    } finally {
      restore();
    }
  });
});
