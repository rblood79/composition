/**
 * ADR-306 Phase 4 — matrix family (breakdown §2.2 #29 ~ #32): heatmap · calendar · candlestick ·
 * parallel — 행 하나가 칸 · 봉 · 선 하나인 종류. chunk 하나 (`registry.ts` 의 `import("./matrix")`).
 *
 * 칸 합계 · 이동평균은 원본 행 전체로 낸다 (`categoryContext(…, capRows = false)`) — 그리는 요소만
 * 종류마다 줄인다 (heatmap 칸 2px · calendar 해 · candlestick 봉 합치기 · parallel 선 1,500).
 *
 * 표본 행은 ztd-charts 0.5.0 (`3c4376c`, MIT — `src/spec/samples.ts`) 의 생성식을 그대로 쓴다.
 * calendar 표본은 날짜를 UTC 로 만든다 (timezone 과 무관 — breakdown §7.1).
 */
import { chartFrame } from "../../frame";
import {
  CHART_INVALID_SETTINGS_TEXT,
  chartEmptyScene,
} from "../../sceneStates";
import type { ChartProps, ChartRow, FamilyChartType } from "../../types";
import { categoryContext, type CategoryContext } from "../category/common";
import { gauss, seeded } from "../samples";
import type { ChartFamily } from "../types";
import { calendarScene, heatmapScene } from "./grid";
import { parallelScene } from "./parallel";
import { candlestickScene } from "./price";
import { withRowPolicy } from "../rowPolicy";

export const MATRIX_TYPES = [
  "heatmap",
  "calendar",
  "candlestick",
  "parallel",
] as const;
type MatrixType = (typeof MATRIX_TYPES)[number];
const isMatrix = (type: FamilyChartType): type is MatrixType =>
  (MATRIX_TYPES as readonly string[]).includes(type);

const SCENES: Record<
  MatrixType,
  (ctx: CategoryContext) => ReturnType<typeof heatmapScene>
> = {
  heatmap: heatmapScene,
  calendar: calendarScene,
  candlestick: candlestickScene,
  parallel: parallelScene,
};

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

const SAMPLES: Record<MatrixType, () => ChartRow[]> = {
  // 요일 × 시간대 주문 수.
  heatmap: () => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const hours = ["12am", "3am", "6am", "9am", "12pm", "3pm", "6pm", "9pm"];
    return days.flatMap((day, di) =>
      hours.map((hour, hi) => {
        const base = [2, 1, 3, 14, 22, 18, 26, 31][hi];
        const weekend = di >= 5 ? (hi >= 4 ? 1.35 : 0.8) : 1;
        const fri = di === 4 && hi >= 6 ? 1.3 : 1;
        return {
          day,
          hour,
          orders: Math.round(
            base * weekend * fri * (0.9 + ((di * 7 + hi * 3) % 5) * 0.06),
          ),
        };
      }),
    );
  },
  // 하루 커밋 수 (2025 년 상반기 26 주 — ztd 는 1 년, 저장 행 수를 줄였다).
  calendar: () => {
    const rnd = seeded(3);
    const start = Date.UTC(2025, 0, 1);
    return Array.from({ length: 182 }, (_, i) => {
      const t = start + i * 86_400_000;
      const wd = new Date(t).getUTCDay();
      const season = 1 + 0.5 * Math.sin((i / 365) * Math.PI * 2 - 1);
      const base = wd === 0 || wd === 6 ? 0.6 : 4.2;
      const burst = rnd() < 0.05 ? 8 : 0;
      return {
        date: iso(t),
        commits: Math.max(
          0,
          Math.round(base * season + gauss(rnd) * 1.6 + burst),
        ),
      };
    });
  },
  // 가상 종목의 일봉 60 일.
  candlestick: () => {
    const rnd = seeded(23);
    const out: ChartRow[] = [];
    let t = Date.UTC(2025, 8, 1);
    let close = 61200;
    while (out.length < 60) {
      const wd = new Date(t).getUTCDay();
      if (wd !== 0 && wd !== 6) {
        const k = out.length;
        const drift = k < 18 ? -0.004 : k < 34 ? 0.003 : 0.0065;
        const open = Math.round((close * (1 + gauss(rnd) * 0.006)) / 100) * 100;
        const next =
          Math.round((open * (1 + drift + gauss(rnd) * 0.014)) / 100) * 100;
        const high =
          Math.round(
            (Math.max(open, next) * (1 + Math.abs(gauss(rnd)) * 0.007)) / 100,
          ) * 100;
        const low =
          Math.round(
            (Math.min(open, next) * (1 - Math.abs(gauss(rnd)) * 0.007)) / 100,
          ) * 100;
        const volume = Math.round(
          (900 + Math.abs(next - open) / 20 + rnd() * 600) * 1000,
        );
        out.push({ date: iso(t), open, high, low, close: next, volume });
        close = next;
      }
      t += 86_400_000;
    }
    return out;
  },
  // 노트북 모델 비교.
  parallel: () => [
    {
      model: "Air 13",
      price: 159,
      weight: 1.24,
      battery: 18,
      perf: 72,
      screen: 13.6,
    },
    {
      model: "Pro 14",
      price: 299,
      weight: 1.55,
      battery: 17,
      perf: 91,
      screen: 14.2,
    },
    {
      model: "Ultra 16",
      price: 389,
      weight: 2.14,
      battery: 14,
      perf: 97,
      screen: 16.2,
    },
    {
      model: "Slim 15",
      price: 189,
      weight: 1.51,
      battery: 15,
      perf: 70,
      screen: 15.3,
    },
    {
      model: "Gaming 17",
      price: 329,
      weight: 2.8,
      battery: 6,
      perf: 95,
      screen: 17.3,
    },
    {
      model: "Basic 14",
      price: 89,
      weight: 1.45,
      battery: 10,
      perf: 48,
      screen: 14,
    },
    {
      model: "2-in-1 13",
      price: 179,
      weight: 1.29,
      battery: 13,
      perf: 66,
      screen: 13.3,
    },
    {
      model: "Creator 16",
      price: 349,
      weight: 1.98,
      battery: 12,
      perf: 93,
      screen: 16,
    },
  ],
};

const SAMPLE_PROPS: Record<MatrixType, Partial<ChartProps>> = {
  heatmap: { dimension: "hour", rowField: "day", metric: "orders" },
  calendar: { dimension: "date", metric: "commits" },
  candlestick: {
    dimension: "date",
    openField: "open",
    highField: "high",
    lowField: "low",
    metric: "close",
    volumeField: "volume",
    // 패널 목록 칸 (string-array) 이 저장하는 모양 그대로 — 문서 검증이 글자 배열만 받는다.
    movingAverages: ["5", "20"],
  },
  parallel: {
    dataMode: "columns",
    valueFields: ["price", "weight", "battery", "perf", "screen"],
    labelField: "model",
    invertFields: ["price", "weight"],
  },
};

export const matrixFamily: ChartFamily = {
  id: "matrix",
  buildScene: withRowPolicy((props, rows, size, metrics) => {
    const type = props.chartType as FamilyChartType;
    if (!isMatrix(type)) {
      const frame = chartFrame(size, metrics);
      return chartEmptyScene(
        frame.size,
        frame.outer,
        CHART_INVALID_SETTINGS_TEXT,
        [
          {
            code: "chartType.unsupported",
            severity: "error",
            message: `matrix family does not draw ${String(props.chartType)}`,
            value: String(props.chartType),
          },
        ],
      );
    }
    return SCENES[type](categoryContext(props, rows, size, metrics, false));
  }),
  sample(type) {
    return isMatrix(type) ? SAMPLES[type]() : [];
  },
  sampleProps(type) {
    return isMatrix(type) ? { ...SAMPLE_PROPS[type] } : {};
  },
};
