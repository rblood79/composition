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
  label: string;
  icon: string;
  searchLabels: readonly string[];
  defaults: VisualPatch;
  presets: readonly ChartPreset[];
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
): ChartDescriptor {
  return {
    paletteId: `chart-${chartType}`,
    chartType,
    family: chartFamilyOf(chartType),
    roles,
    options,
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

const cartesian = {
  orientation: "vertical",
  stackType: "dodged",
  showAxis: true,
  showGrid: true,
} as const;
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
  ),
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
  ),
  // ADR-217 — 산점도: 행 = 점, x 숫자 (미설정 = linear) 또는 시간. 프리셋 없음.
  descriptor(
    "scatter",
    "Scatter Chart",
    "ScatterChart",
    ["산점도", "분포", "점", "散布"],
    { ...cartesian, showDots: true },
    [],
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
];

/**
 * ADR-306 — family 종류의 새 prop 전부 (descriptor 의 역할 + 옵션 — 기존 prop 제외). binding
 * `propPassthrough` · DOM destructure · Skia allowlist 세 곳이 이 목록 하나를 읽는다 (R2).
 */
const SERIES_PROP_KEYS = new Set(["dimension", "metric", "color"]);
export const CHART_FAMILY_PROP_KEYS: readonly (keyof ChartProps & string)[] = [
  ...new Set(
    CHART_DESCRIPTORS.flatMap((d) => [
      ...d.roles.map((role) => role.prop),
      ...d.options,
    ]).filter((key) => !SERIES_PROP_KEYS.has(key)),
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

/** Chart 직접 생성은 기존 bar 기본값, palette 생성은 종류별 기본값을 원자적으로 준다. */
export function createChartInitialProps(chartType?: ChartType): ChartProps & {
  data: ChartRow[];
} {
  // ADR-306 — family 종류의 sample 행 · 역할 이름은 family chunk 에 있다 (첫 화면 번들 밖). 생성 경로가
  //   명령 실행 전에 `loadChartFamily` → `sample` · `sampleProps` 로 채운다 (breakdown §4.4).
  if (isFamilyChartType(chartType))
    return {
      ...CHART_DEFAULT_PROPS,
      ...getChartDescriptor(chartType).defaults,
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
  return {
    ...CHART_DEFAULT_PROPS,
    color: "series",
    showLegend: true,
    ...(scatter ? { dimension: "x", metric: "y" } : {}),
    ...(fresh
      ? {
          ...getChartDescriptor(chartType).defaults,
          chartType,
          showTooltip: true,
          isAnimationActive: true,
          animationBegin: 0,
          animationDuration: 600,
          animationEasing: "ease-out" as const,
        }
      : {}),
    data: (scatter ? scatterSample : legacySample)
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
