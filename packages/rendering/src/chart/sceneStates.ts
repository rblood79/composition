/**
 * 경계 상태 scene (ADR-194 G2 대안 — 예외가 아니라 scene 의 한 상태). 시리즈 경로
 * (`computeChartScene`) 와 family 모듈 (ADR-306) 이 같은 모양을 쓴다.
 */
import { r2 } from "./scales";
import type { ChartDiagnostic, ChartScene, ChartSize, Rect } from "./types";

/** ADR-210 — 설정 오류 상태의 안내 문구 (두 consumer 가 같은 텍스트 마크를 그린다). */
export const CHART_INVALID_SETTINGS_TEXT = "Check chart settings";
export const CHART_NO_DATA_TEXT = "No data";

export function chartEmptyScene(
  size: ChartSize,
  plot: Rect,
  text = CHART_NO_DATA_TEXT,
  diagnostics?: readonly ChartDiagnostic[],
): ChartScene {
  return {
    size,
    plot,
    marks: [
      {
        kind: "text",
        x: r2(plot.x + plot.w / 2),
        y: r2(plot.y + plot.h / 2),
        text,
        anchor: "middle",
        baseline: "middle",
        role: "empty",
      },
    ],
    axes: [],
    legend: null,
    tooltip: null,
    empty: true,
    ...(diagnostics && diagnostics.length > 0 ? { diagnostics } : {}),
  };
}

/** ADR-306 — family 로드 전: 상자만 (안내 글자 없음). */
export function chartPendingScene(size: ChartSize, plot: Rect): ChartScene {
  return {
    size,
    plot,
    marks: [],
    axes: [],
    legend: null,
    tooltip: null,
    empty: true,
    pending: true,
  };
}
