/**
 * ADR-312 HC6 — 1 만 행 scene 계산 시간 (Phase 0 기준선 · Phase 3 전후 비교). 기본 실행에서는 건너뛴다:
 *
 *   ADR312_PERF=<결과 json 경로> pnpm -F @composition/rendering exec vitest run src/chart/__tests__/adr312Perf.test.ts
 *
 * 행 = 표본 행을 돌려 쓰고, 글자 열에는 50 갈래 접미사 (키가 겹치는 원본 행 — 한 범주에 여러 행), 숫자 열에는
 * 결정적 흔들림을 준다. 같은 기계에서 변경 전 · 후 빌드를 교대로 3 쌍 재어 종류마다 중앙값을 비교한다
 * (breakdown §6.1 Q3). 수치는 커밋하지 않는다 — 기록은 breakdown §8.
 */
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CHART_DESCRIPTORS,
  completeChartCreationProps,
  createChartInitialProps,
} from "../authoring";
import { computeChartScene } from "../computeChartScene";
import type { ChartProps, ChartRow } from "../types";

const OUT = process.env.ADR312_PERF;
const ROWS = 10_000;
const RUNS = 15;

function scaleRows(sample: readonly ChartRow[]): ChartRow[] {
  const out: ChartRow[] = [];
  for (let i = 0; i < ROWS; i++) {
    const base = sample[i % sample.length];
    const lap = Math.floor(i / sample.length);
    const row: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(base))
      row[key] =
        typeof value === "number"
          ? value * (1 + ((lap * 7919) % 97) / 970)
          : typeof value === "string" && !/^\d{4}-\d{2}-\d{2}/.test(value)
            ? `${value} ${lap % 50}`
            : value;
    out.push(row);
  }
  return out;
}

describe.skipIf(!OUT)("ADR-312 HC6 — 1 만 행 scene 시간", () => {
  it("종류마다 중앙값 (ms)", async () => {
    const result: Record<string, number> = {};
    for (const d of CHART_DESCRIPTORS) {
      const props = (await completeChartCreationProps(
        createChartInitialProps(d.chartType, d.paletteId) as never,
      )) as unknown as ChartProps & { data: ChartRow[] };
      const rows = scaleRows(props.data);
      const size = { width: 640, height: 400 };
      for (let i = 0; i < 3; i++) computeChartScene(props, rows, size);
      const times: number[] = [];
      for (let i = 0; i < RUNS; i++) {
        const t = performance.now();
        computeChartScene(props, rows, size);
        times.push(performance.now() - t);
      }
      times.sort((a, b) => a - b);
      result[d.paletteId] = Math.round(times[RUNS >> 1] * 100) / 100;
    }
    expect(Object.keys(result)).toHaveLength(CHART_DESCRIPTORS.length);
    writeFileSync(OUT!, JSON.stringify(result, null, 1));
  }, 300_000);
});
