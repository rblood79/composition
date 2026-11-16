/**
 * ADR-306 Phase 3 — category family (breakdown §2.2 #10 ~ #21). chunk 하나 (`registry.ts` 의
 * `import("./category")`) — 계산 · sample 은 첫 화면 번들 밖이다.
 *
 * 표본 행은 ztd-charts 0.5.0 (`3c4376c`, MIT — `src/spec/samples.ts`) 의 영어 표본이다.
 */
import { chartFrame } from "../../frame";
import {
  CHART_INVALID_SETTINGS_TEXT,
  chartEmptyScene,
} from "../../sceneStates";
import type { ChartProps, ChartRow, FamilyChartType } from "../../types";
import type { ChartFamily } from "../types";
import {
  funnelScene,
  lollipopScene,
  paretoScene,
  segmentedScene,
  waffleScene,
  waterfallScene,
} from "./bars";
import { marimekkoScene, skylineScene } from "./blocks";
import { categoryContext, type CategoryContext } from "./common";
import { bumpScene, slopeScene, sparklineScene, streamScene } from "./lines";
import { withRowPolicy } from "../rowPolicy";

export const CATEGORY_TYPES = [
  "lollipop",
  "segmented",
  "waffle",
  "funnel",
  "pareto",
  "waterfall",
  "sparkline",
  "marimekko",
  "stream",
  "bump",
  "slope",
  "skyline",
] as const;
type CategoryType = (typeof CATEGORY_TYPES)[number];
const isCategory = (type: FamilyChartType): type is CategoryType =>
  (CATEGORY_TYPES as readonly string[]).includes(type);

const SCENES: Record<
  CategoryType,
  (ctx: CategoryContext) => ReturnType<typeof lollipopScene>
> = {
  lollipop: lollipopScene,
  segmented: segmentedScene,
  waffle: waffleScene,
  funnel: funnelScene,
  pareto: paretoScene,
  waterfall: waterfallScene,
  sparkline: sparklineScene,
  marimekko: marimekkoScene,
  stream: streamScene,
  bump: bumpScene,
  slope: slopeScene,
  skyline: skylineScene,
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];

function streamRows(): ChartRow[] {
  const genres = ["Drama", "Variety", "Docs", "Anime", "Sports", "Movies"];
  return Array.from({ length: 20 }, (_, w) =>
    genres.map((g, gi) => {
      const peak = [4, 9, 14, 6, 17, 11][gi];
      const amp = [38, 30, 14, 20, 26, 22][gi];
      const v =
        6 +
        amp * Math.exp(-((w - peak) ** 2) / (2 * (3 + gi) ** 2)) +
        ((w * (gi + 3)) % 4);
      return { week: `W${w + 1}`, genre: g, hours: Math.round(v * 10) / 10 };
    }),
  ).flat();
}

function bumpRows(): ChartRow[] {
  const apps = ["Our app", "App A", "App B", "App C", "App D", "App E"];
  const table = [
    [5, 4, 4, 3, 2, 2, 1],
    [1, 1, 2, 2, 3, 3, 3],
    [2, 3, 1, 1, 1, 1, 2],
    [3, 2, 3, 4, 4, 5, 5],
    [4, 5, 6, 5, 5, 4, 4],
    [6, 6, 5, 6, 6, 6, 6],
  ];
  return apps.flatMap((app, ai) =>
    MONTHS.map((month, mi) => ({ month, app, rank: table[ai][mi] })),
  );
}

const SAMPLES: Record<CategoryType, () => ChartRow[]> = {
  lollipop: () => [
    { feature: "Search", usage: 82 },
    { feature: "Cart", usage: 74 },
    { feature: "Wishlist", usage: 61 },
    { feature: "Reviews", usage: 48 },
    { feature: "Coupons", usage: 39 },
    { feature: "Gifting", usage: 22 },
    { feature: "Live", usage: 14 },
  ],
  segmented: () => [
    { method: "Card", amount: 412 },
    { method: "Mobile pay", amount: 278 },
    { method: "Bank transfer", amount: 134 },
    { method: "Phone bill", amount: 45 },
    { method: "Other", amount: 27 },
  ],
  waffle: () => [
    { segment: "New", customers: 38 },
    { segment: "Returning", customers: 62 },
  ],
  funnel: () => [
    { stage: "Visit", users: 10000 },
    { stage: "Product view", users: 6200 },
    { stage: "Cart", users: 1900 },
    { stage: "Purchase", users: 760 },
  ],
  pareto: () => [
    { keyword: "running shoes", spend: 54 },
    { keyword: "marathon shoes", spend: 25 },
    { keyword: "best sneakers", spend: 7 },
    { keyword: "cushioned shoes", spend: 4 },
    { keyword: "trail shoes", spend: 3 },
    { keyword: "light shoes", spend: 2.5 },
    { keyword: "running socks", spend: 2 },
    { keyword: "insoles", spend: 1.2 },
    { keyword: "running belt", spend: 0.8 },
    { keyword: "wristband", spend: 0.5 },
  ],
  waterfall: () => [
    { item: "Sep", amount: 3200, kind: "total" },
    { item: "New", amount: 1100 },
    { item: "Repeat", amount: 450 },
    { item: "Discounts", amount: -380 },
    { item: "Refunds", amount: -270 },
    { item: "Oct", kind: "total" },
  ],
  sparkline: () =>
    Array.from({ length: 30 }, (_, i) => ({
      day: `2025-06-${String(i + 1).padStart(2, "0")}`,
      revenue: Math.round(
        1200 + i * 18 + Math.sin(i * 0.8) * 120 + (i % 7 === 5 ? 160 : 0),
      ),
    })),
  marimekko: () => [
    { channel: "Search", device: "Mobile", sales: 26.1 },
    { channel: "Search", device: "Desktop", sales: 16.2 },
    { channel: "Search", device: "Tablet", sales: 2.7 },
    { channel: "PMax", device: "Mobile", sales: 25.9 },
    { channel: "PMax", device: "Desktop", sales: 7.7 },
    { channel: "PMax", device: "Tablet", sales: 1.4 },
    { channel: "Social", device: "Mobile", sales: 17.6 },
    { channel: "Social", device: "Desktop", sales: 1.8 },
    { channel: "Social", device: "Tablet", sales: 0.6 },
  ],
  stream: streamRows,
  bump: bumpRows,
  slope: () =>
    ["Our brand", "Brand A", "Brand B", "Brand C", "Brand D"].flatMap(
      (brand, i) => [
        { brand, period: "2024", share: [18, 31, 24, 15, 12][i] },
        { brand, period: "2025", share: [27, 28, 21, 14, 10][i] },
      ],
    ),
  skyline: () =>
    [
      [410000, 317223, 186999, 79534, 11000, 10000],
      [446030, 337921, 202044, 87942, 15314, 9190],
      [440886, 336150, 202507, 87489, 15398, 6051],
      [472300, 370227, 221753, 92899, 13276, 4626],
      [456358, 366468, 216506, 88261, 9041, 5714],
      [482495, 386711, 226337, 92466, 8633, 9460],
      [519595, 405554, 238274, 100345, 12610, 12608],
      [509048, 387050, 230518, 99954, 16653, 11318],
      [545022, 413595, 248950, 108123, 90000, 126000],
      [566932, 440538, 264628, 111944, 17316, 5841],
      [550201, 439688, 260808, 106914, 12001, 6097],
      [586400, 471716, 276507, 112488, 10262, 10281],
      [587529, 462627, 271133, 113044, 12856, 13840],
      [622545, 476047, 282345, 121668, 19059, 14613],
    ].map(([Input, Cached, Output, Reasoning, Failed, Retried], i) => ({
      day: `${i < 9 ? "10" : "11"}-${String(i < 9 ? 23 + i : i - 8).padStart(2, "0")}`,
      Input,
      Cached,
      Output,
      Reasoning,
      Failed,
      Retried,
    })),
};

const SAMPLE_PROPS: Record<CategoryType, Partial<ChartProps>> = {
  lollipop: { dimension: "feature", metric: "usage" },
  segmented: { dimension: "method", metric: "amount" },
  waffle: { dimension: "segment", metric: "customers" },
  funnel: { dimension: "stage", metric: "users" },
  pareto: { dimension: "keyword", metric: "spend" },
  waterfall: { dimension: "item", metric: "amount", kindField: "kind" },
  sparkline: { dimension: "day", metric: "revenue" },
  marimekko: { dimension: "channel", color: "device", metric: "sales" },
  stream: { dimension: "week", color: "genre", metric: "hours" },
  bump: { dimension: "month", color: "app", rankField: "rank" },
  slope: { dimension: "period", color: "brand", metric: "share" },
  skyline: {
    dimension: "day",
    dataMode: "columns",
    valueFields: ["Input", "Cached", "Output", "Reasoning"],
    frontFields: ["Failed", "Retried"],
  },
};

export const categoryFamily: ChartFamily = {
  id: "category",
  buildScene: withRowPolicy((props, rows, size, metrics) => {
    const type = props.chartType as FamilyChartType;
    if (!isCategory(type)) {
      const frame = chartFrame(size, metrics);
      return chartEmptyScene(
        frame.size,
        frame.outer,
        CHART_INVALID_SETTINGS_TEXT,
        [
          {
            code: "chartType.unsupported",
            severity: "error",
            message: `category family does not draw ${String(props.chartType)}`,
            value: String(props.chartType),
          },
        ],
      );
    }
    return SCENES[type](categoryContext(props, rows, size, metrics));
  }),
  sample(type) {
    return isCategory(type) ? SAMPLES[type]() : [];
  },
  sampleProps(type) {
    return isCategory(type) ? { ...SAMPLE_PROPS[type] } : {};
  },
};
