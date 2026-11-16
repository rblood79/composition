import { CHART_DEFAULT_PROPS } from "./computeChartScene";
import type {
  ChartProps,
  ChartType,
  ChartRow,
  ChartAnimationEasing,
  ChartFamilyId,
} from "./types";
import { chartFamilyOf, isFamilyChartType } from "./types";
import { getChartFamily, loadChartFamily } from "./families/registry";

/**
 * 프리셋/종류 변경 patch — **시각 props 만**. ADR-210 의 표시 설정 (모드·필드·시리즈·
 * 형식) 은 프리셋이 덮어쓰지 않는다 (breakdown §2.3 4).
 */
type VisualPatch = Partial<
  Omit<
    ChartProps,
    | "dataMode"
    | "valueFields"
    | "seriesConfig"
    | "valueFormat"
    | "valueLocale"
    | "valueFractionDigits"
    | "valueCurrency"
    | "valuePercentUnit"
  >
>;
export interface ChartPreset {
  id: string;
  label: string;
  patch: VisualPatch;
}
/**
 * ADR-306 — 종류가 읽는 데이터 역할 하나 (breakdown §4.1). 이 표 하나에서 (a) 패널의 필드 지정
 * (b) family 의 입력 검증 이름 (c) prop 전달 목록 (`CHART_FAMILY_PROP_KEYS`) 이 나온다.
 */
export interface ChartRole {
  prop: keyof ChartProps & string;
  kind: "field" | "fields";
  required: boolean;
  accepts: "number" | "string" | "date" | "any";
}
export interface ChartDescriptor {
  paletteId: string;
  chartType: ChartType;
  /** ADR-306 — null = 시리즈 격자 종류 (기존 7). */
  family: ChartFamilyId | null;
  /** ADR-306 — 데이터 역할 (필드). 기존 7 종은 `dimension` · `metric` · `color` 그대로 (빈 배열). */
  roles: readonly ChartRole[];
  /** ADR-306 — 모양 · 옵션 prop (패널 Content). 전달 목록에 들어간다. */
  options: readonly (keyof ChartProps & string)[];
  /**
   * ADR-306 — 값 필드 목록 (columns 모드 — `valueFields` 하나하나가 시리즈) 을 읽는가. 기존 7 종은
   * 시리즈 경로가 정하고 (true), family 는 stream · slope · skyline 만.
   */
  columns: boolean;
  label: string;
  icon: string;
  searchLabels: readonly string[];
  defaults: VisualPatch;
  /** ADR-306 Phase 5 — 새로 만들 때만 싣는 값 (프리셋 판정에 쓰지 않는다 — 기존 저장본의 표시 유지). */
  initial?: VisualPatch;
  presets: readonly ChartPreset[];
}

function withInitial(
  row: ChartDescriptor,
  initial: VisualPatch,
): ChartDescriptor {
  return { ...row, initial };
}

function descriptor(
  chartType: ChartType,
  label: string,
  icon: string,
  searchLabels: string[],
  defaults: VisualPatch,
  extras: Array<[string, string, VisualPatch]>,
  defaultLabel = "Default",
  roles: readonly ChartRole[] = [],
  options: readonly (keyof ChartProps & string)[] = [],
  columns = chartFamilyOf(chartType) === null,
  paletteId = `chart-${chartType}`,
): ChartDescriptor {
  return {
    paletteId,
    chartType,
    family: chartFamilyOf(chartType),
    roles,
    options,
    columns,
    label,
    icon,
    searchLabels,
    defaults,
    presets: [
      { id: "default", label: defaultLabel, patch: defaults },
      ...extras.map(([id, name, patch]) => ({
        id,
        label: name,
        patch: { ...defaults, ...patch },
      })),
    ],
  };
}

const CATEGORY_ROLE: ChartRole = {
  prop: "dimension",
  kind: "field",
  required: true,
  accepts: "string",
};
const VALUE_ROLE: ChartRole = {
  prop: "metric",
  kind: "field",
  required: true,
  accepts: "number",
};

// ── ADR-306 Phase 5 — 기존 9 항목 보강 (breakdown §2.1). 시리즈 7 종의 새 역할 · 옵션.
const LINE_ROLES: readonly ChartRole[] = [
  { prop: "lowerFields", kind: "fields", required: false, accepts: "number" },
  { prop: "upperFields", kind: "fields", required: false, accepts: "number" },
];
// ADR-306 Phase 6 — 공통 상호작용 (사용자 결정 1): 주석 (line · area · bar · candlestick), 손익 색 ·
//   띠 시작 · 띠 밖 점 (line · area).
const ANNOTATION_OPTIONS: readonly (keyof ChartProps & string)[] = [
  "annotations",
];
const LINE_OPTIONS: readonly (keyof ChartProps & string)[] = [
  "valueMin",
  "valueMax",
  "includeZero",
  "connectNulls",
  "endLabels",
  ...ANNOTATION_OPTIONS,
  "signColors",
  "baseline",
  "bandFrom",
  "outside",
];
const PIE_OPTIONS: readonly (keyof ChartProps & string)[] = [
  "sort",
  "centerLabel",
];
const SCATTER_ROLES: readonly ChartRole[] = [
  { prop: "sizeField", kind: "field", required: false, accepts: "number" },
  { prop: "labelField", kind: "field", required: false, accepts: "string" },
];
const SCATTER_OPTIONS: readonly (keyof ChartProps & string)[] = [
  "sizeRange",
  "includeZero",
  "fit",
  "quadrants",
];
const PATH_ROLE: ChartRole = {
  prop: "pathFields",
  kind: "fields",
  required: true,
  accepts: "string",
};
const FLOW_ROLES: readonly ChartRole[] = [
  { prop: "sourceField", kind: "field", required: true, accepts: "string" },
  { prop: "targetField", kind: "field", required: true, accepts: "string" },
  { prop: "metric", kind: "field", required: true, accepts: "number" },
];

const cartesian = {
  orientation: "vertical",
  stackType: "dodged",
  showAxis: true,
  showGrid: true,
} as const;
/**
 * ADR-306 Phase 6 — 공통 옵션: 강조 (`highlight`) 는 강조할 항목이 있는 종류 전부 (gauge 는 값 하나라 없다
 * — ztd 도 없다). 범위 선택 · 동기화는 범주 축이 있는 line · area · bar · candlestick (실행 상태라 scene
 * 은 그대로 — 패널에 보이고 Preview · Publish 가 읽는다).
 */
const NO_HIGHLIGHT: ReadonlySet<ChartType> = new Set(["gauge"]);
const BRUSH_TYPES: ReadonlySet<ChartType> = new Set([
  "line",
  "area",
  "bar",
  "candlestick",
]);
function withCommonOptions(row: ChartDescriptor): ChartDescriptor {
  const extra: (keyof ChartProps & string)[] = [
    ...(NO_HIGHLIGHT.has(row.chartType) ? [] : ["highlight" as const]),
    ...(BRUSH_TYPES.has(row.chartType) ? (["brush", "syncId"] as const) : []),
  ];
  return extra.length === 0
    ? row
    : { ...row, options: [...row.options, ...extra] };
}

export const CHART_DESCRIPTORS: readonly ChartDescriptor[] = [
  descriptor(
    "area",
    "Area Chart",
    "ChartArea",
    ["영역", "영역 차트", "面積"],
    { ...cartesian, curve: "monotone", showDots: false },
    [
      ["linear", "Linear", { curve: "linear" }],
      ["step", "Step", { curve: "step" }],
      ["stacked", "Stacked", { stackType: "stacked" }],
      ["expand", "Stacked 100%", { stackType: "expand" }],
    ],
    "Default",
    LINE_ROLES,
    LINE_OPTIONS,
  ),
  descriptor(
    "bar",
    "Bar Chart",
    "BarChart3",
    ["막대", "막대 차트", "棒"],
    { ...cartesian, colorBy: "series" },
    [
      ["horizontal", "Horizontal", { orientation: "horizontal" }],
      ["stacked", "Stacked", { stackType: "stacked" }],
      ["expand", "Stacked 100%", { stackType: "expand" }],
    ],
    "Default",
    [],
    ["sort", ...ANNOTATION_OPTIONS],
  ),
  descriptor(
    "line",
    "Line Chart",
    "ChartLine",
    ["선", "선 차트", "꺾은선", "折れ線"],
    { ...cartesian, curve: "monotone", showDots: false },
    [
      ["linear", "Linear", { curve: "linear" }],
      ["step", "Step", { curve: "step" }],
      ["dots", "Dots", { showDots: true }],
    ],
    "Default",
    LINE_ROLES,
    LINE_OPTIONS,
  ),
  descriptor(
    "pie",
    "Pie Chart",
    "ChartPie",
    ["원형", "파이", "도넛", "円"],
    {
      innerRadius: 0,
      stackType: "dodged",
      showTotal: false,
      showAxis: false,
      showGrid: false,
    },
    [
      ["donut", "Donut", { innerRadius: 60 }],
      ["donut-total", "Donut Total", { innerRadius: 60, showTotal: true }],
    ],
    "Default",
    [],
    PIE_OPTIONS,
  ),
  // ADR-306 Phase 5 — 제공 항목 donut (§2.1 #05): pie 의 프리셋 행 (같은 chartType · 다른 기본값).
  descriptor(
    "pie",
    "Donut Chart",
    "Donut",
    ["도넛", "도넛 차트", "합계 가운데", "ドーナツ"],
    {
      innerRadius: 60,
      stackType: "dodged",
      showTotal: true,
      centerLabel: "Total",
      showAxis: false,
      showGrid: false,
    },
    [],
    "Default",
    [],
    PIE_OPTIONS,
    true,
    "chart-donut",
  ),
  descriptor(
    "radar",
    "Radar Chart",
    "Radar",
    ["방사형", "레이더", "レーダー"],
    {
      gridType: "polygon",
      showAxis: true,
      showGrid: true,
      showSpokes: true,
      gridRings: 0,
      fillGrid: false,
      fillArea: true,
      showDots: false,
      innerRadius: 0,
    },
    [
      ["circle", "Circle", { gridType: "circle" }],
      ["lines", "Lines Only", { fillArea: false }],
    ],
    "Polygon",
    [],
    ["valueMax"],
  ),
  // ADR-306 Phase 5 — 제공 항목 radialBar (§2.1 #07) 는 이 행이다: 새로 만드는 차트는 상한 100 (진행률 —
  //   `initial`), 기존 저장본은 `valueMax` 가 없어 자동 domain 그대로이고 프리셋 표시도 그대로다.
  withInitial(
    descriptor(
      "radial",
      "Radial Chart",
      "Gauge",
      ["라디얼", "반원", "게이지", "放射状"],
      {
        startAngle: 0,
        endAngle: 360,
        innerRadius: 20,
        stackType: "dodged",
        showTotal: false,
        showAxis: false,
        showGrid: false,
      },
      [
        ["stacked", "Stacked", { stackType: "stacked" }],
        ["half", "Half", { endAngle: 180 }],
        ["total", "Total", { showTotal: true }],
      ],
      "Default",
      [],
      ["valueMax"],
    ),
    { valueMax: 100 },
  ),
  // ADR-217 — 산점도: 행 = 점, x 숫자 (미설정 = linear) 또는 시간. 프리셋 없음.
  descriptor(
    "scatter",
    "Scatter Chart",
    "ScatterChart",
    ["산점도", "분포", "점", "散布"],
    { ...cartesian, showDots: true },
    [],
    "Default",
    SCATTER_ROLES,
    SCATTER_OPTIONS,
  ),
  // ADR-306 Phase 5 — 제공 항목 bubble (§2.1 #09): scatter 의 프리셋 행 — 점 크기 필드 지정.
  descriptor(
    "scatter",
    "Bubble Chart",
    "Bubbles",
    ["버블", "거품", "세 값 비교", "バブル"],
    { ...cartesian, showDots: true },
    [],
    "Default",
    SCATTER_ROLES,
    SCATTER_OPTIONS,
    true,
    "chart-bubble",
  ),
  // ── ADR-306 kpi family (Phase 2). 계산 · sample 은 family chunk (`families/kpi.ts`). ──
  descriptor(
    "gauge",
    "Gauge",
    "Gauge",
    ["게이지", "계기", "KPI", "ゲージ"],
    { shape: "arc", showAxis: false, showGrid: false, showLegend: false },
    [
      ["semi", "Semicircle", { shape: "semi" }],
      ["ring", "Ring", { shape: "ring" }],
      ["ticks", "Ticks", { shape: "ticks" }],
    ],
    "Arc",
    [
      { prop: "metric", kind: "field", required: true, accepts: "number" },
      { prop: "goalField", kind: "field", required: false, accepts: "number" },
    ],
    ["valueMin", "valueMax", "centerLabel", "shape", "bands"],
  ),
  descriptor(
    "bullet",
    "Bullet Chart",
    "ChartBarDecreasing",
    ["불릿", "목표 대비", "KPI", "ブレット"],
    { independent: true, showAxis: false, showGrid: false, showLegend: false },
    [["shared", "Shared Scale", { independent: false }]],
    "Default",
    [
      { prop: "dimension", kind: "field", required: true, accepts: "string" },
      { prop: "metric", kind: "field", required: true, accepts: "number" },
      { prop: "goalField", kind: "field", required: false, accepts: "number" },
      {
        prop: "rangeFields",
        kind: "fields",
        required: false,
        accepts: "number",
      },
    ],
    ["independent"],
  ),
  descriptor(
    "dumbbell",
    "Dumbbell Chart",
    "ChartNoAxesGantt",
    ["덤벨", "전후 비교", "차이", "ダンベル"],
    {
      sort: "descending",
      includeZero: false,
      showAxis: true,
      showGrid: true,
      showLegend: true,
    },
    [["unsorted", "Data Order", { sort: "none" }]],
    "Default",
    [
      { prop: "dimension", kind: "field", required: true, accepts: "string" },
      { prop: "startField", kind: "field", required: true, accepts: "number" },
      { prop: "endField", kind: "field", required: true, accepts: "number" },
    ],
    ["sort", "includeZero"],
  ),
  // ── ADR-306 category family (Phase 3). 계산 · sample 은 family chunk (`families/category/`). ──
  descriptor(
    "lollipop",
    "Lollipop Chart",
    "ChartBarBig",
    ["롤리팝", "막대 대신 점", "순위", "ロリポップ"],
    {
      orientation: "horizontal",
      sort: "descending",
      showValueLabels: true,
      showAxis: false,
      showGrid: true,
      showLegend: false,
    },
    [
      ["vertical", "Vertical", { orientation: "vertical" }],
      ["unsorted", "Data Order", { sort: "none" }],
    ],
    "Default",
    [CATEGORY_ROLE, VALUE_ROLE],
    ["orientation", "sort"],
  ),
  descriptor(
    "segmented",
    "Segmented Bar",
    "ChartBarStacked",
    ["비율 막대", "구성비", "100%", "セグメント"],
    { shape: "tall", sort: "descending", showLegend: true },
    [
      ["thin", "Thin", { shape: "thin" }],
      ["bar-only", "Bar Only", { showLegend: false }],
    ],
    "Default",
    [CATEGORY_ROLE, VALUE_ROLE],
    ["shape", "sort"],
  ),
  descriptor(
    "waffle",
    "Waffle Chart",
    "Grid2x2",
    ["와플", "100칸", "비율", "ワッフル"],
    { cells: 100, columns: 10, showTotal: true, showLegend: false },
    [["grid-only", "Grid Only", { showTotal: false }]],
    "Default",
    [CATEGORY_ROLE, VALUE_ROLE],
    ["cells", "columns", "valueMax", "showTotal", "centerLabel"],
  ),
  descriptor(
    "funnel",
    "Funnel Chart",
    "Funnel",
    ["퍼널", "전환", "이탈", "ファネル"],
    { showRates: true, rateBase: "previous", showLegend: false },
    [["first", "vs. First Step", { rateBase: "first" }]],
    "Default",
    [CATEGORY_ROLE, VALUE_ROLE],
    ["showRates", "rateBase", "rateLabel"],
  ),
  descriptor(
    "pareto",
    "Pareto Chart",
    "ChartColumnDecreasing",
    ["파레토", "80/20", "누적", "パレート"],
    {
      threshold: 80,
      sort: "descending",
      rankLabels: false,
      showValueLabels: true,
      showGrid: true,
      showLegend: false,
    },
    [["ranks", "Rank Labels", { rankLabels: true }]],
    "Default",
    [CATEGORY_ROLE, VALUE_ROLE],
    ["threshold", "sort", "rankLabels"],
  ),
  descriptor(
    "waterfall",
    "Waterfall Chart",
    "ChartColumnBig",
    ["폭포", "증감", "브리지", "ウォーターフォール"],
    {
      startTotal: true,
      endTotal: false,
      connectors: true,
      showValueLabels: true,
      showGrid: true,
      showLegend: false,
    },
    [["end-total", "End Total", { endTotal: true }]],
    "Default",
    [
      CATEGORY_ROLE,
      VALUE_ROLE,
      { prop: "kindField", kind: "field", required: false, accepts: "string" },
    ],
    ["startTotal", "endTotal", "connectors"],
  ),
  descriptor(
    "sparkline",
    "Sparkline",
    "Activity",
    ["스파크라인", "추세", "작은 선", "スパークライン"],
    {
      shape: "area",
      showTotal: true,
      showExtremes: false,
      showAxis: false,
      showGrid: false,
      showLegend: false,
    },
    [
      ["line", "Line", { shape: "line" }],
      ["bar", "Bar", { shape: "bar" }],
    ],
    "Area",
    [
      { prop: "metric", kind: "field", required: true, accepts: "number" },
      { prop: "dimension", kind: "field", required: false, accepts: "any" },
    ],
    ["shape", "showTotal", "showExtremes"],
  ),
  descriptor(
    "marimekko",
    "Marimekko Chart",
    "Columns3",
    ["마리메코", "모자이크", "두 비율", "マリメッコ"],
    { showLegend: true, showGrid: true },
    [],
    "Default",
    [
      CATEGORY_ROLE,
      { prop: "color", kind: "field", required: true, accepts: "string" },
      VALUE_ROLE,
    ],
    [],
  ),
  descriptor(
    "stream",
    "Streamgraph",
    "Waves",
    ["스트림", "흐름", "누적 영역", "ストリーム"],
    {
      streamOffset: "wiggle",
      reorder: true,
      curve: "monotone",
      showLegend: true,
    },
    [["silhouette", "Silhouette", { streamOffset: "silhouette" }]],
    "Wiggle",
    [
      CATEGORY_ROLE,
      VALUE_ROLE,
      { prop: "color", kind: "field", required: false, accepts: "string" },
    ],
    ["streamOffset", "reorder", "curve"],
    true,
  ),
  descriptor(
    "bump",
    "Bump Chart",
    "TrendingUpDown",
    ["범프", "순위 변화", "랭킹", "バンプ"],
    { showValueLabels: true, showLegend: false },
    [],
    "Default",
    [
      CATEGORY_ROLE,
      { prop: "color", kind: "field", required: true, accepts: "string" },
      { prop: "rankField", kind: "field", required: false, accepts: "number" },
      { prop: "metric", kind: "field", required: false, accepts: "number" },
    ],
    [],
  ),
  descriptor(
    "slope",
    "Slope Chart",
    "TrendingUp",
    ["슬로프", "두 시점", "전후", "スロープ"],
    { showValueLabels: true, showLegend: false },
    [],
    "Default",
    [
      CATEGORY_ROLE,
      { prop: "color", kind: "field", required: true, accepts: "string" },
      VALUE_ROLE,
    ],
    ["periodLabels"],
    true,
  ),
  descriptor(
    "skyline",
    "Skyline",
    "Building2",
    ["스카이라인", "입체 누적", "앞줄 뒷줄", "スカイライン"],
    {
      depth: 0.32,
      wall: true,
      texture: "front",
      frontRate: "label",
      showValueLabels: true,
      showLegend: true,
    },
    [
      ["strip", "Rate Strip", { frontRate: "strip" }],
      ["flat", "No Texture", { texture: "none" }],
    ],
    "Default",
    [
      CATEGORY_ROLE,
      VALUE_ROLE,
      { prop: "color", kind: "field", required: false, accepts: "string" },
      {
        prop: "frontFields",
        kind: "fields",
        required: false,
        accepts: "number",
      },
    ],
    ["depth", "wall", "texture", "frontRate"],
    true,
  ),
  // ── ADR-306 distribution family (Phase 4). 계산 · sample 은 family chunk (`families/distribution/`). ──
  descriptor(
    "histogram",
    "Histogram",
    "ChartColumnIncreasing",
    ["히스토그램", "분포", "구간", "ヒストグラム"],
    {
      shape: "bar",
      showValueLabels: true,
      showAxis: true,
      showGrid: true,
      showLegend: false,
    },
    [
      ["dots", "Dots", { shape: "dots" }],
      ["step", "Step", { shape: "step" }],
    ],
    "Bars",
    [
      // 원시 표본 (Value) 또는 사전 집계 (구간 시작 · 끝 · 개수) — 어느 쪽이든 되므로 둘 다 선택 역할이다.
      { prop: "metric", kind: "field", required: false, accepts: "number" },
      { prop: "color", kind: "field", required: false, accepts: "string" },
      {
        prop: "binStartField",
        kind: "field",
        required: false,
        accepts: "number",
      },
      {
        prop: "binEndField",
        kind: "field",
        required: false,
        accepts: "number",
      },
      { prop: "countField", kind: "field", required: false, accepts: "number" },
    ],
    [
      "shape",
      "percentiles",
      "threshold",
      "edges",
      "binWidth",
      "bins",
      "log",
      "kde",
    ],
  ),
  descriptor(
    "box",
    "Box Plot",
    "SlidersVertical",
    ["박스 플롯", "상자 수염", "바이올린", "箱ひげ図"],
    { shape: "box", outliers: true, includeZero: false, showLegend: false },
    [
      ["violin", "Violin", { shape: "violin" }],
      ["both", "Box + Violin", { shape: "both" }],
    ],
    "Box",
    [CATEGORY_ROLE, VALUE_ROLE],
    ["shape", "outliers", "whiskers", "includeZero"],
  ),
  descriptor(
    "beeswarm",
    "Beeswarm",
    "GripHorizontal",
    ["비스웜", "점 분포", "벌떼", "ビースウォーム"],
    { showMedian: true, showLegend: false },
    [],
    "Default",
    [
      VALUE_ROLE,
      { prop: "dimension", kind: "field", required: false, accepts: "string" },
      { prop: "labelField", kind: "field", required: false, accepts: "string" },
    ],
    ["dotRadius", "showMedian"],
  ),
  descriptor(
    "ridgeline",
    "Ridgeline",
    "ChartSpline",
    ["릿지라인", "밀도 곡선", "분포 비교", "リッジライン"],
    { overlap: 1.5, sort: "none", showLegend: false },
    [["median", "By Median", { sort: "ascending" }]],
    "Data Order",
    [CATEGORY_ROLE, VALUE_ROLE],
    ["overlap", "bandwidth", "sort"],
  ),
  // ── ADR-306 matrix family (Phase 4). 계산 · sample 은 family chunk (`families/matrix/`). ──
  descriptor(
    "heatmap",
    "Heatmap",
    "Grid3x3",
    ["히트맵", "격자 색", "요일 시간", "ヒートマップ"],
    { showLegend: true, showValueLabels: false },
    [["values", "Values", { showValueLabels: true }]],
    "Default",
    [
      CATEGORY_ROLE,
      { prop: "rowField", kind: "field", required: true, accepts: "string" },
      VALUE_ROLE,
    ],
    ["legendLabels"],
  ),
  descriptor(
    "calendar",
    "Calendar Heatmap",
    "CalendarDays",
    ["캘린더 히트맵", "잔디", "일별 활동", "カレンダー"],
    { weekStart: 0, cellGap: 2.5, showLegend: false },
    [["monday", "Monday Start", { weekStart: 1 }]],
    "Sunday Start",
    [{ ...CATEGORY_ROLE, accepts: "date" }, VALUE_ROLE],
    ["weekStart", "cellGap"],
  ),
  descriptor(
    "candlestick",
    "Candlestick",
    "ChartCandlestick",
    ["캔들", "봉 차트", "주가", "ローソク足"],
    { showGrid: true, showLegend: false },
    [],
    "Default",
    [
      { ...CATEGORY_ROLE, accepts: "date" },
      { prop: "openField", kind: "field", required: false, accepts: "number" },
      { prop: "highField", kind: "field", required: false, accepts: "number" },
      { prop: "lowField", kind: "field", required: false, accepts: "number" },
      { prop: "closeField", kind: "field", required: true, accepts: "number" },
      {
        prop: "volumeField",
        kind: "field",
        required: false,
        accepts: "number",
      },
    ],
    ["movingAverages", "valueMin", "valueMax", ...ANNOTATION_OPTIONS],
  ),
  descriptor(
    "parallel",
    "Parallel Coordinates",
    "ChartNoAxesCombined",
    ["평행 좌표", "다차원 비교", "사양 비교", "平行座標"],
    { showValueLabels: true, showLegend: false },
    [],
    "Default",
    [
      {
        prop: "valueFields",
        kind: "fields",
        required: true,
        accepts: "number",
      },
      { prop: "labelField", kind: "field", required: false, accepts: "string" },
      {
        prop: "invertFields",
        kind: "fields",
        required: false,
        accepts: "number",
      },
    ],
    [],
    true,
  ),
  // ── ADR-306 network family (Phase 5). 계산 · sample 은 family chunk (`families/network/`). ──
  descriptor(
    "treemap",
    "Treemap",
    "LayoutDashboard",
    ["트리맵", "면적 비율", "계층", "ツリーマップ"],
    {
      sort: "descending",
      labelKey: "category",
      showValueLabels: true,
      showLegend: false,
    },
    [
      ["share", "Share Only", { labelKey: "value" }],
      ["unsorted", "Data Order", { sort: "none" }],
    ],
    "Default",
    [PATH_ROLE, VALUE_ROLE],
    ["labelKey", "sort"],
  ),
  descriptor(
    "sunburst",
    "Sunburst",
    "CircleDotDashed",
    ["선버스트", "원형 계층", "고리", "サンバースト"],
    { sort: "none", innerRadius: 30, showValueLabels: true, showLegend: false },
    [
      ["pie", "No Hole", { innerRadius: 0 }],
      ["sorted", "Largest First", { sort: "descending" }],
    ],
    "Default",
    [PATH_ROLE, VALUE_ROLE],
    ["innerRadius", "sort"],
  ),
  descriptor(
    "sankey",
    "Sankey Diagram",
    "GitFork",
    ["생키", "흐름", "유입 경로", "サンキー"],
    {
      nodeWidth: 10,
      nodePadding: 14,
      showValueLabels: true,
      showLegend: false,
    },
    [["thin", "Thin Nodes", { nodeWidth: 4 }]],
    "Default",
    FLOW_ROLES,
    ["nodeWidth", "nodePadding"],
  ),
  descriptor(
    "chord",
    "Chord Diagram",
    "Orbit",
    ["코드 다이어그램", "주고받음", "관계", "コード"],
    { padAngle: 3, showValueLabels: true, showLegend: false },
    [["tight", "No Gaps", { padAngle: 0 }]],
    "Default",
    FLOW_ROLES,
    ["padAngle"],
  ),
].map(withCommonOptions);

/**
 * ADR-306 Phase 5 — 종류마다 첫 행 (프리셋 행 donut · bubble 을 뺀 것). 종류 선택지 ·
 * 종류 수를 세는 곳이 읽는다 — 팔레트 · 생성은 `CHART_DESCRIPTORS` (제공 항목 36).
 */
export const CHART_TYPE_DESCRIPTORS: readonly ChartDescriptor[] =
  CHART_DESCRIPTORS.filter((d) => d.paletteId === `chart-${d.chartType}`);

/** 이 종류가 이 prop 을 읽는가 (역할 · 옵션). 시리즈 7 종은 descriptor 에 적지 않는다. */
export function chartTypesReading(
  prop: keyof ChartProps & string,
): ChartType[] {
  return CHART_TYPE_DESCRIPTORS.filter(
    (d) =>
      d.roles.some((role) => role.prop === prop) || d.options.includes(prop),
  ).map((d) => d.chartType);
}

/** columns 모드 (값 필드 목록) 를 읽는 종류인가. */
export function chartTypeAcceptsColumns(type: unknown): boolean {
  return CHART_DESCRIPTORS.some((d) => d.chartType === type && d.columns);
}

/**
 * ADR-306 — family 종류의 새 prop 전부 (descriptor 의 역할 + 옵션 — 기존 prop 제외). binding
 * `propPassthrough` · DOM destructure · Skia allowlist 세 곳이 이 목록 하나를 읽는다 (R2).
 */
const SERIES_PROP_KEYS = new Set(["dimension", "metric", "color"]);
/** ADR-306 전부터 있던 prop — 시리즈 경로가 이미 싣는다 (family 가 읽어도 전달 목록에 다시 넣지 않는다). */
const EXISTING_PROP_KEYS: ReadonlySet<string> = new Set([
  ...SERIES_PROP_KEYS,
  ...Object.keys(CHART_DEFAULT_PROPS),
  "dataMode",
  "valueFields",
]);
export const CHART_FAMILY_PROP_KEYS: readonly (keyof ChartProps & string)[] = [
  ...new Set(
    CHART_DESCRIPTORS.flatMap((d) => [
      ...d.roles.map((role) => role.prop),
      ...d.options,
    ]).filter((key) => !EXISTING_PROP_KEYS.has(key)),
  ),
];

/** ADR-306 — 패널의 필드 지정 칸으로 승격되는 역할 prop (field 하나짜리). */
export const CHART_FIELD_ROLE_KEYS: readonly string[] = [
  ...SERIES_PROP_KEYS,
  ...new Set(
    CHART_DESCRIPTORS.flatMap((d) =>
      d.roles.filter((role) => role.kind === "field").map((role) => role.prop),
    ).filter((key) => !SERIES_PROP_KEYS.has(key)),
  ),
];

/** ADR-306 — family props 만 골라낸다 (DOM · Skia 전달 — 미설정 키는 싣지 않는다). */
export function pickChartFamilyProps(
  props: Readonly<Record<string, unknown>>,
): Partial<ChartProps> {
  const out: Record<string, unknown> = {};
  for (const key of CHART_FAMILY_PROP_KEYS)
    if (props[key] !== undefined) out[key] = props[key];
  return out as Partial<ChartProps>;
}

export function getChartDescriptor(type: unknown): ChartDescriptor {
  return (
    CHART_DESCRIPTORS.find(
      (d) => d.chartType === type || d.paletteId === type,
    ) ?? CHART_DESCRIPTORS[1]
  );
}

export function getChartPresetId(
  type: ChartType,
  props: Partial<ChartProps>,
): string {
  const effective = { ...CHART_DEFAULT_PROPS, ...props };
  return (
    getChartDescriptor(type).presets.find((p) =>
      Object.entries(p.patch).every(
        ([key, value]) => effective[key as keyof ChartProps] === value,
      ),
    )?.id ?? "custom"
  );
}

const legacySample: readonly ChartRow[] = [
  { category: "Mon", value: 12, series: "A" },
  { category: "Tue", value: 30, series: "A" },
  { category: "Wed", value: 18, series: "A" },
  { category: "Thu", value: 24, series: "A" },
  { category: "Mon", value: 20, series: "B" },
  { category: "Tue", value: 8, series: "B" },
  { category: "Wed", value: 25, series: "B" },
  { category: "Thu", value: 14, series: "B" },
];

/** ADR-217 — 산점도 sample (숫자 x · 겹친 점 1 쌍 · 시리즈 2). 범주 sample 은 x 파싱에 전부 실패한다. */
const scatterSample: readonly ChartRow[] = [
  { x: 1, y: 12, series: "A" },
  { x: 2, y: 20, series: "A" },
  { x: 3, y: 8, series: "A" },
  { x: 4, y: 25, series: "A" },
  { x: 4, y: 25, series: "A" },
  { x: 1.5, y: 6, series: "B" },
  { x: 2.5, y: 14, series: "B" },
  { x: 3.5, y: 18, series: "B" },
];

/** ADR-306 Phase 5 — bubble 표본 (산점도 표본 + 점 크기). */
const bubbleSample: readonly ChartRow[] = [
  { x: 1, y: 12, size: 40, series: "A" },
  { x: 2, y: 20, size: 120, series: "A" },
  { x: 3, y: 8, size: 15, series: "A" },
  { x: 4, y: 25, size: 90, series: "A" },
  { x: 1.5, y: 6, size: 60, series: "B" },
  { x: 2.5, y: 14, size: 30, series: "B" },
  { x: 3.5, y: 18, size: 150, series: "B" },
];

/**
 * Chart 직접 생성은 기존 bar 기본값, palette 생성은 종류별 기본값을 원자적으로 준다. `paletteId` 는
 * 제공 항목 (ADR-306 Phase 5 — donut · radialBar · bubble 은 같은 chartType 의 다른 기본값 행).
 */
export function createChartInitialProps(
  chartType?: ChartType,
  paletteId?: string,
): ChartProps & {
  data: ChartRow[];
} {
  const row =
    paletteId !== undefined
      ? (CHART_DESCRIPTORS.find((d) => d.paletteId === paletteId) ??
        getChartDescriptor(chartType))
      : getChartDescriptor(chartType);
  // ADR-306 — family 종류의 sample 행 · 역할 이름은 family chunk 에 있다 (첫 화면 번들 밖). 생성 경로가
  //   명령 실행 전에 `loadChartFamily` → `sample` · `sampleProps` 로 채운다 (breakdown §4.4).
  if (isFamilyChartType(chartType))
    return {
      ...CHART_DEFAULT_PROPS,
      ...row.defaults,
      ...row.initial,
      chartType,
      showTooltip: true,
      isAnimationActive: true,
      animationBegin: 0,
      animationDuration: 600,
      animationEasing: "ease-out" as const,
      data: [],
    };
  const fresh = chartType !== undefined;
  const single = chartType === "pie" || chartType === "radial";
  const scatter = chartType === "scatter";
  const bubble = row.paletteId === "chart-bubble";
  return {
    ...CHART_DEFAULT_PROPS,
    color: "series",
    showLegend: true,
    ...(scatter ? { dimension: "x", metric: "y" } : {}),
    ...(bubble ? { sizeField: "size" } : {}),
    ...(fresh
      ? {
          ...row.defaults,
          ...row.initial,
          chartType,
          showTooltip: true,
          isAnimationActive: true,
          animationBegin: 0,
          animationDuration: 600,
          animationEasing: "ease-out" as const,
        }
      : {}),
    data: (bubble ? bubbleSample : scatter ? scatterSample : legacySample)
      .filter((row) => !single || row.series === "A")
      .map((row) => ({ ...row })),
  };
}

export function resolveChartAnimation(
  props: Partial<ChartProps>,
): Required<
  Pick<
    ChartProps,
    | "isAnimationActive"
    | "animationBegin"
    | "animationDuration"
    | "animationEasing"
  >
> {
  const duration = (value: unknown, fallback: number): number =>
    typeof value === "number" && Number.isFinite(value) && value >= 0
      ? value
      : fallback;
  const easings: readonly ChartAnimationEasing[] = [
    "linear",
    "ease",
    "ease-in",
    "ease-out",
    "ease-in-out",
  ];
  return {
    isAnimationActive: props.isAnimationActive === true,
    animationBegin: duration(props.animationBegin, 0),
    animationDuration: duration(props.animationDuration, 600),
    animationEasing: easings.includes(props.animationEasing!)
      ? props.animationEasing!
      : "ease-out",
  };
}

/**
 * ADR-306 (R5) — 생성 경로: family 종류는 sample 행 · 역할 이름을 family chunk 에서 받아 initialProps
 * 를 완성한다. **명령 실행 앞에서** 기다린다 — 명령 · store action 은 동기 그대로 (breakdown §4.4).
 * 기존 7 종은 그대로 돌려준다.
 */
export function chartCreationNeedsFamily(
  initialProps: Readonly<Record<string, unknown>> | undefined,
): boolean {
  return (
    isFamilyChartType(initialProps?.chartType) &&
    !(Array.isArray(initialProps?.data) && initialProps.data.length > 0)
  );
}

function withFamilySample(
  initialProps: Readonly<Record<string, unknown>>,
  family: {
    sample: (t: never) => readonly ChartRow[];
    sampleProps: (t: never) => Partial<ChartProps>;
  },
): Record<string, unknown> {
  const type = initialProps.chartType as never;
  return {
    ...initialProps,
    ...family.sampleProps(type),
    data: family.sample(type).map((row) => ({ ...row })),
  };
}

export async function completeChartCreationProps(
  initialProps: Readonly<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  if (!chartCreationNeedsFamily(initialProps)) return { ...initialProps };
  const family = await loadChartFamily(chartFamilyOf(initialProps.chartType)!);
  return withFamilySample(initialProps, family);
}

/** 동기판 — family 가 이미 로드됐을 때만 채운다 (Library 표본처럼 기다릴 수 없는 곳). */
export function completeChartCreationPropsSync(
  initialProps: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  if (!chartCreationNeedsFamily(initialProps)) return { ...initialProps };
  const family = getChartFamily(chartFamilyOf(initialProps.chartType)!);
  return family ? withFamilySample(initialProps, family) : { ...initialProps };
}
