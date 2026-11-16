/**
 * ADR-306 Phase 4 — distribution family (breakdown §2.2 #25 ~ #28): histogram · box · beeswarm ·
 * ridgeline. chunk 하나 (`registry.ts` 의 `import("./distribution")`) — 통계 · 계산 · 표본은 첫 화면
 * 번들 밖이다.
 *
 * 분포 통계는 원본 행 전체로 낸다 (`categoryContext(…, capRows = false)` — 잘린 표본으로 분위를 내지
 * 않는다, breakdown §4.2). 그리는 요소 (점 · 그룹) 만 종류마다 줄이고 진단한다.
 *
 * 표본 행은 ztd-charts 0.5.0 (`3c4376c`, MIT — `src/spec/samples.ts`) 의 생성식 (seed 난수 + 정규 분포) 을
 * 그대로 쓰되, 문서에 저장되는 행 수를 줄이려고 표본 수를 줄였다 — histogram 320 → 200 · box 그룹당 80 → 30 ·
 * ridgeline 120 → 30 (Library 의 Types 카드도 이 행을 저장한다 — 사용자 원칙
 * 「Builder 의 데이터 행 = 디자인 표본」).
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
import { histogramScene } from "./histogram";
import { beeswarmScene, boxScene, ridgelineScene } from "./spread";
import { withRowPolicy } from "../rowPolicy";

export const DISTRIBUTION_TYPES = [
  "histogram",
  "box",
  "beeswarm",
  "ridgeline",
] as const;
type DistributionType = (typeof DISTRIBUTION_TYPES)[number];
const isDistribution = (type: FamilyChartType): type is DistributionType =>
  (DISTRIBUTION_TYPES as readonly string[]).includes(type);

const SCENES: Record<
  DistributionType,
  (ctx: CategoryContext) => ReturnType<typeof histogramScene>
> = {
  histogram: histogramScene,
  box: boxScene,
  beeswarm: beeswarmScene,
  ridgeline: ridgelineScene,
};

const SAMPLES: Record<DistributionType, () => ChartRow[]> = {
  // API 요청 지연 200 건 (ms) — 20 건마다 캐시를 놓친 느린 요청이 꼬리를 만든다.
  histogram: () => {
    const rnd = seeded(17);
    return Array.from({ length: 200 }, (_, i) => ({
      ms: Math.round(
        i % 20 === 0
          ? 650 + rnd() * 800
          : Math.exp(Math.log(170) + gauss(rnd) * 0.42),
      ),
    }));
  },
  // 지점별 응답 시간 (ms).
  box: () => {
    const rnd = seeded(5);
    const apis = [
      { api: "/login", mu: 120, sd: 30 },
      { api: "/search", mu: 210, sd: 60 },
      { api: "/cart", mu: 150, sd: 35 },
      { api: "/pay", mu: 320, sd: 80 },
      { api: "/feed", mu: 180, sd: 45 },
    ];
    return apis.flatMap((a) =>
      Array.from({ length: 30 }, (_, i) => ({
        api: a.api,
        ms: Math.max(
          30,
          Math.round(
            a.mu + gauss(rnd) * a.sd + (i % 19 === 0 ? a.sd * 3.2 : 0),
          ),
        ),
      })),
    );
  },
  // 플랜별 하루 사용 시간 (분).
  beeswarm: () => {
    const rnd = seeded(7);
    const plans = [
      { plan: "Free", mu: 9, sd: 4, n: 70 },
      { plan: "Basic", mu: 17, sd: 5, n: 55 },
      { plan: "Pro", mu: 26, sd: 6, n: 40 },
    ];
    return plans.flatMap((pl) =>
      Array.from({ length: pl.n }, (_, i) => ({
        id: `${pl.plan}-${i + 1}`,
        plan: pl.plan,
        minutes: Math.max(
          1,
          Math.round((pl.mu + gauss(rnd) * pl.sd) * 10) / 10,
        ),
      })),
    );
  },
  // 지역별 배송 시간 (시간).
  ridgeline: () => {
    const rnd = seeded(11);
    const regions = [
      { region: "Seoul", mu: 18, sd: 5 },
      { region: "Gyeonggi", mu: 22, sd: 6 },
      { region: "Gangwon", mu: 34, sd: 9 },
      { region: "Chungcheong", mu: 28, sd: 7 },
      { region: "Jeolla", mu: 31, sd: 8 },
      { region: "Gyeongsang", mu: 29, sd: 7 },
      { region: "Jeju", mu: 46, sd: 11 },
    ];
    return regions.flatMap((r) =>
      Array.from({ length: 30 }, () => ({
        region: r.region,
        hours: Math.max(2, Math.round((r.mu + gauss(rnd) * r.sd) * 10) / 10),
      })),
    );
  },
};

const SAMPLE_PROPS: Record<DistributionType, Partial<ChartProps>> = {
  // 분위 선은 패널 목록 칸 (string-array) 이 보이도록 기본값 [50, 95] 을 글자로 싣는다.
  histogram: { metric: "ms", threshold: 400, percentiles: ["50", "95"] },
  box: { dimension: "api", metric: "ms" },
  beeswarm: { dimension: "plan", metric: "minutes", labelField: "id" },
  ridgeline: { dimension: "region", metric: "hours" },
};

export const distributionFamily: ChartFamily = {
  id: "distribution",
  buildScene: withRowPolicy((props, rows, size, metrics) => {
    const type = props.chartType as FamilyChartType;
    if (!isDistribution(type)) {
      const frame = chartFrame(size, metrics);
      return chartEmptyScene(
        frame.size,
        frame.outer,
        CHART_INVALID_SETTINGS_TEXT,
        [
          {
            code: "chartType.unsupported",
            severity: "error",
            message: `distribution family does not draw ${String(props.chartType)}`,
            value: String(props.chartType),
          },
        ],
      );
    }
    return SCENES[type](categoryContext(props, rows, size, metrics, false));
  }),
  sample(type) {
    return isDistribution(type) ? SAMPLES[type]() : [];
  },
  sampleProps(type) {
    return isDistribution(type) ? { ...SAMPLE_PROPS[type] } : {};
  },
};
