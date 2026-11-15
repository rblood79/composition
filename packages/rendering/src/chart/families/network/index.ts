/**
 * ADR-306 Phase 5 — network family (breakdown §2.2 #33 ~ #36): treemap · sunburst · sankey · chord — 행이
 * 계층 경로 · 흐름 관계를 만드는 종류. chunk 하나 (`registry.ts` 의 `import("./network")`).
 *
 * 계층 합 · 노드 값 · 마디 합은 원본 행 전체로 낸다 (`categoryContext(…, capRows = false)`) — 그리는
 * 칸 · 조각만 1px 미만이면 빼고 진단한다.
 *
 * 표본 행은 ztd-charts 0.5.0 (`3c4376c`, MIT — `src/spec/samples.ts`) 의 것을 그대로 쓴다 (sankey 의 두
 * 「Drop-off」 는 ztd 가 끝 공백으로 갈랐다 — 여기서는 이름으로 가른다).
 */
import { chartFrame } from "../../frame";
import {
  CHART_INVALID_SETTINGS_TEXT,
  chartEmptyScene,
} from "../../sceneStates";
import type { ChartProps, ChartRow, FamilyChartType } from "../../types";
import { categoryContext, type CategoryContext } from "../category/common";
import type { ChartFamily } from "../types";
import { chordScene, sankeyScene } from "./links";
import { sunburstScene, treemapScene } from "./tree";

export const NETWORK_TYPES = [
  "treemap",
  "sunburst",
  "sankey",
  "chord",
] as const;
type NetworkType = (typeof NETWORK_TYPES)[number];
const isNetwork = (type: FamilyChartType): type is NetworkType =>
  (NETWORK_TYPES as readonly string[]).includes(type);

const SCENES: Record<
  NetworkType,
  (ctx: CategoryContext) => ReturnType<typeof treemapScene>
> = {
  treemap: treemapScene,
  sunburst: sunburstScene,
  sankey: sankeyScene,
  chord: chordScene,
};

const SAMPLES: Record<NetworkType, () => ChartRow[]> = {
  // 상품군 › 상품 매출 비중.
  treemap: () => [
    { category: "Running shoes", product: "Cushion Run", share: 22 },
    { category: "Running shoes", product: "Race X", share: 14 },
    { category: "Running shoes", product: "Daily Run", share: 10 },
    { category: "Outdoor", product: "Trail", share: 14 },
    { category: "Outdoor", product: "Hiking boots", share: 10 },
    { category: "Apparel", product: "Jacket", share: 11 },
    { category: "Apparel", product: "T-shirt", share: 7 },
    { category: "Gear", product: "Socks", share: 7 },
    { category: "Gear", product: "Insoles", share: 5 },
  ],
  // 광고 채널 › 캠페인 지출.
  sunburst: () => [
    { channel: "Search", campaign: "Brand", spend: 18 },
    { channel: "Search", campaign: "Generic", spend: 30 },
    { channel: "PMax", campaign: "All products", spend: 25 },
    { channel: "PMax", campaign: "Bestsellers", spend: 12 },
    { channel: "YouTube", campaign: "Remarketing", spend: 9 },
    { channel: "YouTube", campaign: "New users", spend: 6 },
  ],
  // 유입 → 페이지 → 장바구니 → 구매.
  sankey: () => [
    { source: "Search", target: "Product page", value: 4200 },
    { source: "Social", target: "Product page", value: 2600 },
    { source: "Social", target: "Promo page", value: 1400 },
    { source: "Direct", target: "Product page", value: 1800 },
    { source: "Direct", target: "Promo page", value: 600 },
    { source: "Product page", target: "Cart", value: 3900 },
    { source: "Product page", target: "Drop-off", value: 4700 },
    { source: "Promo page", target: "Cart", value: 900 },
    { source: "Promo page", target: "Drop-off", value: 1100 },
    { source: "Cart", target: "Purchase", value: 2900 },
    { source: "Cart", target: "Cart drop-off", value: 1900 },
  ],
  // 팀 사이 요청 수.
  chord: () => [
    { from: "Design", to: "Engineering", value: 42 },
    { from: "Engineering", to: "Design", value: 28 },
    { from: "Product", to: "Design", value: 36 },
    { from: "Product", to: "Engineering", value: 54 },
    { from: "Engineering", to: "Product", value: 22 },
    { from: "Marketing", to: "Product", value: 31 },
    { from: "Marketing", to: "Design", value: 26 },
    { from: "Design", to: "Marketing", value: 12 },
    { from: "Data", to: "Product", value: 18 },
    { from: "Data", to: "Marketing", value: 24 },
    { from: "Engineering", to: "Data", value: 16 },
    { from: "Product", to: "Marketing", value: 14 },
  ],
};

const SAMPLE_PROPS: Record<NetworkType, Partial<ChartProps>> = {
  treemap: { pathFields: ["category", "product"], metric: "share" },
  sunburst: {
    pathFields: ["channel", "campaign"],
    metric: "spend",
    innerRadius: 30,
  },
  sankey: { sourceField: "source", targetField: "target", metric: "value" },
  chord: { sourceField: "from", targetField: "to", metric: "value" },
};

export const networkFamily: ChartFamily = {
  id: "network",
  buildScene(props, rows, size, metrics) {
    const type = props.chartType as FamilyChartType;
    if (!isNetwork(type)) {
      const frame = chartFrame(size, metrics);
      return chartEmptyScene(
        frame.size,
        frame.outer,
        CHART_INVALID_SETTINGS_TEXT,
        [
          {
            code: "chartType.unsupported",
            severity: "error",
            message: `network family does not draw ${String(props.chartType)}`,
            value: String(props.chartType),
          },
        ],
      );
    }
    return SCENES[type](categoryContext(props, rows, size, metrics, false));
  },
  sample(type) {
    return isNetwork(type) ? SAMPLES[type]() : [];
  },
  sampleProps(type) {
    return isNetwork(type) ? { ...SAMPLE_PROPS[type] } : {};
  },
};
