import { CHART_DEFAULT_PROPS } from "./computeChartScene";
import type {
  ChartProps,
  ChartType,
  ChartRow,
  ChartAnimationEasing,
} from "./types";

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
export interface ChartDescriptor {
  paletteId: string;
  chartType: ChartType;
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
): ChartDescriptor {
  return {
    paletteId: `chart-${chartType}`,
    chartType,
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
];

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

/** Chart 직접 생성은 기존 bar 기본값, palette 생성은 종류별 기본값을 원자적으로 준다. */
export function createChartInitialProps(
  chartType?: ChartType,
): ChartProps & {
  variant: string;
  size: string;
  data: ChartRow[];
  style: { width: number };
} {
  const fresh = chartType !== undefined;
  const single = chartType === "pie" || chartType === "radial";
  return {
    ...CHART_DEFAULT_PROPS,
    color: "series",
    showLegend: true,
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
    variant: "default",
    size: "md",
    style: { width: 320 },
    data: legacySample
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
