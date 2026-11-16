/**
 * ADR-306 Phase 6 — 시리즈 종류의 `highlight` (ztd `resolveHighlight` — 기본은 강조 없음, 팔레트 그대로).
 * 지정하면 강조 밖 시리즈 · 범주를 neutral 로 칠한다 — 색 index −1 (`CHART_OTHERS_COLOR_INDEX`, 두 consumer
 * 가 이미 `--chart-others` · `chart.others` 토큰으로 푸는 값) 이라 마크 builder · 범례 · tooltip · DOM 이 새
 * 분기 없이 같은 색을 낸다.
 *
 * - 시리즈 단위 (line · area · scatter · radar · 시리즈 2 이상 bar · radial): 시리즈 이름 · 합계로 고르고
 *   강조 밖 시리즈의 `seriesIndex` 를 −1 로.
 * - 범주 단위 (pie · 시리즈 1 이하 bar · radial — ztd 와 같이 항목 = 행): 범주 이름 · 합계로 고르고
 *   `dimmed` (범주 index 집합) 로 — 범주색 · 시리즈색 자리 (`categoryColorIndex`) 가 읽는다.
 *
 * 고르는 것은 원본 격자 (예산 전) 에서 한 번 — 창 · 집계 뒤 격자에는 고른 이름으로 다시 적용한다 (창을
 * 옮겨도 max 가 바뀌지 않는다).
 */
import { CHART_OTHERS_COLOR_INDEX } from "./budget";
import { hasHighlight, resolveHighlight } from "./highlight";
import { seriesLabel } from "./series";
import type { SeriesGrid } from "./series";
import type { ChartProps } from "./types";

export interface GridHighlight {
  kind: "series" | "category";
  /** 강조할 이름 (시리즈 이름 또는 범주 이름). */
  labels: ReadonlySet<string>;
}

function categoryLevel(
  props: Pick<ChartProps, "chartType">,
  grid: SeriesGrid,
): boolean {
  const t = props.chartType;
  return (
    t === "pie" || ((t === "bar" || t === "radial") && grid.series.length <= 1)
  );
}

/** 원본 격자에서 강조 이름을 고른다 — 지정이 없거나 시리즈 종류가 아니면 null. */
export function resolveGridHighlight(
  props: Pick<ChartProps, "chartType" | "highlight">,
  grid: SeriesGrid,
): GridHighlight | null {
  if (!hasHighlight(props.highlight)) return null;
  if (categoryLevel(props, grid)) {
    const totals = grid.categories.map((_, ci) => {
      let t = 0;
      for (const s of grid.series) t += s.values.get(ci) ?? 0;
      return t;
    });
    const set = resolveHighlight(
      props.highlight,
      grid.categories,
      totals,
      "none",
    );
    return {
      kind: "category",
      labels: new Set([...set].map((ci) => grid.categories[ci])),
    };
  }
  const names = grid.series.map((s) => seriesLabel(s, "series"));
  const totals = grid.series.map((s) => {
    let t = 0;
    for (const v of s.values.values()) if (Number.isFinite(v)) t += v;
    return t;
  });
  const set = resolveHighlight(props.highlight, names, totals, "none");
  return {
    kind: "series",
    labels: new Set([...set].map((si) => names[si])),
  };
}

/** 고른 강조를 격자에 적용한다 (null 이면 그대로 — 같은 객체). */
export function applyGridHighlight(
  grid: SeriesGrid,
  highlight: GridHighlight | null,
): SeriesGrid {
  if (!highlight) return grid;
  if (highlight.kind === "category") {
    const dimmed = new Set<number>();
    grid.categories.forEach((label, ci) => {
      if (!highlight.labels.has(label)) dimmed.add(ci);
    });
    return { ...grid, dimmed };
  }
  return {
    ...grid,
    series: grid.series.map((s) =>
      highlight.labels.has(seriesLabel(s, "series"))
        ? s
        : { ...s, seriesIndex: CHART_OTHERS_COLOR_INDEX },
    ),
  };
}
