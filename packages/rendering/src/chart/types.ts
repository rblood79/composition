/**
 * ADR-194 — 차트 기하 SSOT 의 타입 정본.
 *
 * `computeChartScene` 은 **순수 함수**다: DOM / CanvasKit / 폰트 측정기 어디에도
 * 의존하지 않고 같은 입력에 항상 같은 `ChartScene` 을 낸다. Builder(Skia) 와
 * Preview/Publish(SVG) 는 이 scene 의 좌표를 **복사만** 한다 — 어느 쪽도 기준이
 * 아니고 기하 함수가 기준이다 (D3 대칭, ssot-hierarchy §1).
 *
 * 색은 **hex 를 싣지 않고 series 인덱스/역할만** 싣는다. theme·dark 전환 시 두
 * consumer 가 각자 catalog rule 에서 같은 토큰을 해소하도록 (ADR-193 정합).
 */

/**
 * 마크 종류 — RSC `<Bar/>`·`<Line/>`·`<Area/>` 를 노코드 팔레트용 단일 enum 으로 평탄화.
 * `radar`/`radial` 은 극좌표 계열 (ADR-207) — 직교 축 대신 `buildPolarAxes` 를 쓴다.
 */
/** ADR-217 — `scatter` (행 = 점, x 숫자/시간). */
export type SeriesChartType =
  "bar" | "line" | "area" | "pie" | "radar" | "radial" | "scatter";
/**
 * ADR-306 — family 로 그리는 새 종류 27 (breakdown §2.2). 시리즈 격자 (`resolveChartModel`) 를
 * 지나지 않고 family 모듈 (`families/*`, 지연 로드) 이 원본 행을 읽는다.
 */
export type FamilyChartType =
  | "lollipop"
  | "segmented"
  | "waffle"
  | "funnel"
  | "pareto"
  | "waterfall"
  | "sparkline"
  | "marimekko"
  | "stream"
  | "bump"
  | "slope"
  | "skyline"
  | "gauge"
  | "bullet"
  | "dumbbell"
  | "histogram"
  | "box"
  | "beeswarm"
  | "ridgeline"
  | "heatmap"
  | "calendar"
  | "candlestick"
  | "parallel"
  | "treemap"
  | "sunburst"
  | "sankey"
  | "chord";
export type ChartType = SeriesChartType | FamilyChartType;
/**
 * ADR-217 P1 — 값 목록 (validator 가 알 수 없는 종류를 진단 `chartType.unsupported` 로 낸다).
 * 유니온에 종류를 더하면 `satisfies` 가 여기도 고치게 한다.
 */
export const SERIES_CHART_TYPES = [
  "bar",
  "line",
  "area",
  "pie",
  "radar",
  "radial",
  "scatter",
] as const satisfies readonly SeriesChartType[];

/** ADR-306 — family 5 (breakdown §2.2 · §4.2). */
export type ChartFamilyId =
  "category" | "kpi" | "distribution" | "matrix" | "network";

/**
 * ADR-306 — 새 종류 → family. 첫 화면 번들에 드는 것은 이 표와 등록 기구뿐이다 (사용자 결정 2 —
 * 계산 코드 · sample 은 family chunk). `satisfies` 가 종류 누락을 막는다.
 */
export const CHART_FAMILY_OF = {
  lollipop: "category",
  segmented: "category",
  waffle: "category",
  funnel: "category",
  pareto: "category",
  waterfall: "category",
  sparkline: "category",
  marimekko: "category",
  stream: "category",
  bump: "category",
  slope: "category",
  skyline: "category",
  gauge: "kpi",
  bullet: "kpi",
  dumbbell: "kpi",
  histogram: "distribution",
  box: "distribution",
  beeswarm: "distribution",
  ridgeline: "distribution",
  heatmap: "matrix",
  calendar: "matrix",
  candlestick: "matrix",
  parallel: "matrix",
  treemap: "network",
  sunburst: "network",
  sankey: "network",
  chord: "network",
} as const satisfies Record<FamilyChartType, ChartFamilyId>;

export const FAMILY_CHART_TYPES = Object.keys(
  CHART_FAMILY_OF,
) as readonly FamilyChartType[];

export const CHART_TYPES: readonly ChartType[] = [
  ...SERIES_CHART_TYPES,
  ...FAMILY_CHART_TYPES,
];

/** ADR-306 — family 로 그리는 새 종류인가 (type guard — 기존 7 의 분기를 좁힌다). */
export function isFamilyChartType(type: unknown): type is FamilyChartType {
  return (
    typeof type === "string" &&
    Object.prototype.hasOwnProperty.call(CHART_FAMILY_OF, type)
  );
}

/** ADR-306 — 새 종류면 그 family, 기존 7 이면 null. */
export function chartFamilyOf(type: unknown): ChartFamilyId | null {
  return isFamilyChartType(type) ? CHART_FAMILY_OF[type] : null;
}

/** radar 격자 모양 (shadcn `chart-radar-grid-circle` 축). */
export type PolarGridType = "polygon" | "circle";

/** 마크 위 레이블에 무엇을 적을지 (shadcn `LabelList dataKey`). */
export type ChartLabelKey = "value" | "category";

/**
 * 레이블 텍스트 생성기. 규칙을 `computeChartScene` 한 곳에 두고 각 마크 빌더는
 * **무엇을 적을지 모른 채** 자리만 정한다 — 빌더마다 분기를 두면 타입 6개에서
 * 규칙이 갈린다 (실제로 pie 만 값을 적고 나머지는 이름을 적는 식).
 */
export type ChartLabelFormatter = (
  categoryIndex: number,
  raw: number,
) => string;

export type ChartOrientation = "vertical" | "horizontal";

/**
 * 선 보간 (Recharts `type` 계열 — shadcn 예제의 축).
 * `monotone` 은 데이터에 없는 봉우리를 만들지 않는 단조 3차, `step` 은 중점 계단.
 */
export type ChartCurve = "linear" | "monotone" | "step";

/**
 * RSC `Bar.type` + shadcn `stacked-expand`. 다중 시리즈에서만 의미가 있다.
 * `expand` 는 범주별 합을 100 으로 정규화해 쌓는다 (비중 비교용).
 */
export type ChartStackType = "stacked" | "dodged" | "expand";

/**
 * 색을 무엇으로 가르는가. `series` 는 시리즈별(기본), `category` 는 범주별
 * (shadcn `chart-bar-mixed`). pie 는 구조상 항상 범주별이다.
 */
export type ChartColorBy = "series" | "category";

/** RSC `Legend.position`. */
export type ChartLegendPosition = "bottom" | "top" | "left" | "right";

export type ChartAnimationEasing =
  "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out";

/** 데이터 행 — dataBinding 이 준 그대로의 임의 레코드. */
export type ChartRow = Readonly<Record<string, unknown>>;

/**
 * ADR-210 — 시리즈를 무엇에서 얻는가.
 * - `group` (기존·미설정): 행의 `color` 필드 값이 시리즈, `metric` 하나가 값.
 * - `columns`: `valueFields` 의 **필드 하나가 시리즈 하나** (wide 표 `{month, desktop, mobile}`).
 *   원본 행을 long 으로 변환해 저장하지 않는다 — 집계에서 필드를 읽는다.
 */
export type ChartDataMode = "group" | "columns";

/**
 * ADR-215 — 시리즈 팔레트 id. `categorical` = rule `chart.series` (Spectrum categorical 8),
 * `mono` = rule `chart.palettes.mono` (accent 명도 사다리 4 + neutral 4). 참조: RSC `Chart.colors`
 * (팔레트 이름). `variant` (상자) · `colorBy` (데이터→색 매핑) 와 다른 축이다.
 */
export type ChartPalette = "categorical" | "mono";
export const CHART_PALETTES: readonly ChartPalette[] = ["categorical", "mono"];
export const CHART_DEFAULT_PALETTE: ChartPalette = "categorical";

/**
 * 시리즈 표시 설정 한 항목. `key` 는 `seriesIdentity()` 가 만드는 identity 문자열
 * (`["group", 그룹값]` / `["field", 필드키]` 의 JSON) 이며 표시명이 아니다. 배열 순서가
 * 시리즈 표시 순서 (stack 누적·dodge 슬롯·legend·tooltip 모두) 다.
 * `label` 이 있으면 빈 문자열도 **명시적 빈 이름**이다 — 속성 부재만 기본 이름이다.
 * `colorToken` 은 팔레트 토큰 이름 (`--chart-series-N`) — 임의 CSS 색을 싣지 않는다.
 */
export interface ChartSeriesConfig {
  key: string;
  label?: string;
  colorToken?: string;
}

/** 숫자 표시 형식. `auto`/미설정은 기존 `formatTick` 문자열 그대로다. */
export type ChartValueFormat = "auto" | "decimal" | "currency" | "percent";
export type ChartValueLocale = "en-US" | "ko-KR";
/** percent 입력 단위 — `ratio` 는 0.25 → 25%, `percentagePoints` 는 25 → 25%. */
export type ChartPercentUnit = "ratio" | "percentagePoints";

export type ChartDiagnosticCode =
  | "dataMode.invalid"
  | "valueFields.invalid"
  | "valueFields.empty"
  | "valueFields.duplicate"
  | "seriesConfig.invalid"
  | "seriesConfig.duplicateKey"
  | "seriesConfig.colorToken.invalid"
  | "valueFormat.invalid"
  | "valueLocale.invalid"
  | "valueFractionDigits.invalid"
  | "valueCurrency.missing"
  | "valueCurrency.unsupported"
  | "valuePercentUnit.missing"
  | "valuePercentUnit.invalid"
  | "columns.unsupportedChartType"
  | "columns.colorByCategory"
  // ADR-211 — 표시 예산 진단 (breakdown §2.1 `rows-truncated` · `plot-too-small` · `too-many-series`).
  | "budget.rowsTruncated"
  | "budget.plotTooSmall"
  | "budget.tooManySeries"
  | "budget.overflow.invalid"
  | "budget.overflow.unsupported"
  | "budget.aggregate.invalid"
  | "budget.axis.invalid"
  | "budget.othersLabel.invalid"
  // ADR-216 — 시간축 · 지시자 형식 (breakdown §2.1 · §2.2).
  | "dimensionScale.invalid"
  | "dimensionScale.unsupportedChartType"
  | "dimensionFormat.invalid"
  | "dimensionLabelFormat.invalid"
  // ADR-217 P1 — 알 수 없는 종류 (구버전 throw 대신 설정 오류 scene · rollback 경계).
  | "chartType.unsupported"
  // ADR-217 P2 — 기준선.
  | "referenceLines.invalid"
  | "referenceLines.tooMany"
  | "referenceLines.unsupportedChartType"
  // ADR-217 P4 — 산점도 희소 예산의 솎기 fallback (집계 대신 원본 점, HC9).
  | "budget.thinned"
  | "dimension.parse.failed"
  // ADR-306 — family 입력 (breakdown §4.2 「검증」 단계).
  | "role.missing"
  | "role.notNumeric"
  | "valueRange.invalid"
  | "bands.invalid"
  | "rangeFields.invalid"
  | "chartFamily.unavailable"
  // ADR-306 Phase 4 — 그리는 그룹 수 상한 (histogram 2) · 그리지 않은 값 (경계 밖 · log 의 0 이하).
  | "budget.groupsTruncated"
  | "values.excluded"
  // ADR-306 Phase 5 — 흐름의 순환 (sankey — 되돌아가는 연결은 열 계산에서 뺀다).
  | "links.cycle";

/**
 * 표시 설정 진단 (`resolveChartPresentation` 이 만든다). `error` 는 설정 오류 상태 —
 * scene 은 안내 텍스트만 내고 (`ChartScene.empty`) 데이터는 보존한다. `warning` 은
 * first-wins 등으로 렌더는 하되 사용자에게 알린다.
 */
export interface ChartDiagnostic {
  code: ChartDiagnosticCode;
  severity: "error" | "warning";
  message: string;
  /** 문제 값 (중복 키·잘못된 토큰 등). UI 가 해당 항목을 가리킬 때 쓴다. */
  value?: string;
}

export interface ChartProps {
  /** 기존 저장 문서는 미지정 시 정적, 신규 palette 생성은 명시적으로 활성화한다. */
  isAnimationActive?: boolean;
  animationBegin?: number;
  animationDuration?: number;
  animationEasing?: ChartAnimationEasing;
  chartType: ChartType;
  /** 범주 축 필드 키 (RSC `Bar.dimension`) */
  dimension: string;
  /** 값 축 필드 키 (RSC `Bar.metric`) */
  metric: string;
  /** 시리즈 분할 필드 키 (RSC `Bar.color`). 없으면 단일 시리즈. */
  color?: string;
  orientation: ChartOrientation;
  stackType: ChartStackType;
  /** line/area 보간 */
  curve: ChartCurve;
  /** line/area 의 데이터 점 표시 */
  showDots: boolean;
  /** 마크 위 값 레이블 */
  showValueLabels: boolean;
  /** 색을 가르는 축 (bar 전용 — pie 는 항상 범주, line/area 는 시리즈) */
  colorBy: ChartColorBy;
  /**
   * 안쪽 반지름 비율 (0~90%). pie 는 0 보다 크면 도넛, radial 은 첫 링의 시작
   * 반지름이다 (ADR-207 — 극좌표 두 계열이 같은 prop 을 쓴다).
   */
  innerRadius: number;
  /** radar 격자 모양 (ADR-207) */
  gridType: PolarGridType;
  /**
   * radar 스포크 (중심 → 각 범주 방향의 선). shadcn `PolarGrid radialLines`.
   * `showAxis` 안의 하위 스위치다 — `showAxis=false` 면 레이블과 함께 통째로 사라진다.
   */
  showSpokes: boolean;
  /** 동심 격자 링 개수. 0 이면 값 눈금 개수를 따른다 (shadcn `polarRadius`) */
  gridRings: number;
  /** 가장 바깥 격자 링을 축 토큰으로 채운다 (shadcn `PolarGrid fill`) */
  fillGrid: boolean;
  /** radar 다각형을 채운다. false 면 선만 (shadcn `chart-radar-lines-only`) */
  fillArea: boolean;
  /**
   * radial 값 호가 도는 각도 범위 (도). **12시 = 0, 시계 방향** — Recharts 는
   * 3시=0 반시계라 같은 그림이라도 숫자가 다르다. `endAngle - startAngle` 이
   * 값 상한이 차지하는 각도이며, 0 이하·360 초과는 한 바퀴로 접는다.
   * 반원 게이지 = `{ startAngle: 0, endAngle: 180 }` (shadcn `chart-radial-stacked`).
   */
  startAngle: number;
  endAngle: number;
  /** 마크 위 레이블 내용 — 값 또는 범주명 (shadcn `LabelList dataKey`) */
  labelKey: ChartLabelKey;
  /** 도넛 구멍 안 합계 표시 */
  showTotal: boolean;
  /** hover 툴팁 (Preview/Publish 전용 — Skia 는 정적) */
  showTooltip: boolean;
  showAxis: boolean;
  showGrid: boolean;
  showLegend: boolean;
  legendPosition: ChartLegendPosition;

  // ── ADR-210 — 전부 선택적. 기존 문서·`CHART_DEFAULT_PROPS` 에는 없고 opt-in 으로만 저장된다.
  /** 시리즈 원천. 미설정 = `group`. */
  dataMode?: ChartDataMode;
  /** `columns` 의 값 필드 순서. 빈 배열은 미완성 설정 (legacy metric 으로 되돌리지 않는다). */
  valueFields?: readonly string[];
  /** 시리즈 이름·팔레트 토큰·순서. 보이지 않는 시리즈의 항목도 휴면 보존한다. */
  seriesConfig?: readonly ChartSeriesConfig[];
  valueFormat?: ChartValueFormat;
  /** 새 format 의 숫자 locale. UI 언어와 연동하지 않는다. 미설정 = en-US. */
  valueLocale?: ChartValueLocale;
  /** 정수 0–6. 명시하면 minimum = maximum. */
  valueFractionDigits?: number;
  /** ISO 4217 코드 (`currency` 필수). 미설정은 진단 — 통화를 추정하지 않는다. */
  valueCurrency?: string;
  /** `percent` 의 raw 입력 단위 (필수). 값 크기로 추론하지 않는다. */
  valuePercentUnit?: ChartPercentUnit;

  // ── ADR-211 — 표시 예산. 평면 키 4개 (P0 계약 보정 — 객체 kind 가 catalog 에 없다),
  //   전부 선택적·직교. 미설정 = `auto` (종류·축별 기본, breakdown §2.4 지원표).
  /** 넘칠 때 무엇을 하는가. `auto` = bar/line/area 범주 창 · pie/radar/radial others. */
  budgetOverflow?: ChartBudgetOverflow;
  /** bucket 집계 통계 (`aggregate` 전용). 표시 형식 `valueFormat` 과 분리된다. */
  budgetAggregate?: ChartBudgetAggregate;
  /** 축 종류 강제. `auto` 는 엄격 ISO-8601 단조일 때만 `ordinal`. */
  budgetAxis?: ChartBudgetAxis;
  /** others 합산 범주의 표시 라벨 (기본 영문 상수 `"Other"`). */
  budgetOthersLabel?: string;

  // ── ADR-215 — 시리즈 팔레트 선택. 미설정 = `categorical`. seriesConfig.colorToken 순번은 그대로다.
  palette?: ChartPalette;

  // ── ADR-216 — 시간축 (line/area opt-in). 미설정 = `category` (현행 등간격 · byte 동일).
  /** 범주 축 스케일. `time` 은 `dimension` 문자열을 epoch 으로 파싱해 시간 간격으로 놓는다 (RSC `scaleType`). */
  dimensionScale?: ChartDimensionScale;
  /** `time` 입력 파싱 지시자 (d3-time-format 부분집합, UTC). 미설정 = 엄격 ISO-8601. */
  dimensionFormat?: string;
  /** `time` 축 라벨 지시자 — 있으면 1단, 없으면 RSC 2단 표 (눈금 단위별). */
  dimensionLabelFormat?: string;

  // ── ADR-217 — 값 축 기준선 (RSC `ReferenceLine`). 미설정/빈 배열 = 현행 (byte 동일).
  /** 값 축 위 가로선 (수평 차트는 세로선) — ≤ 4. domain 은 값을 포함하도록 넓어진다 (scene 이 정한다). */
  referenceLines?: readonly ChartReferenceLine[];

  // ── ADR-306 — family 종류의 역할 · 옵션 (breakdown §2.2). 전부 선택적이고 기존 7 종은 읽지 않는다.
  //   필드 역할은 `dimension` · `metric` 과 같은 field 참조 (`#<fieldId>` 또는 key) 다.
  /** 목표값 필드 (gauge 의 목표 눈금 · bullet 의 목표 표시). */
  goalField?: string;
  /** 구간 경계 필드들 — 작은 것부터 (bullet). */
  rangeFields?: readonly string[];
  /** 이전 값 필드 (dumbbell). */
  startField?: string;
  /** 이후 값 필드 (dumbbell). */
  endField?: string;
  /** 값 축 하한 (gauge 기본 0). */
  valueMin?: number;
  /** 값 축 상한 (gauge 기본 100). 자동 domain 을 쓰지 않는다 — 42 / 100 은 42 % 다. */
  valueMax?: number;
  /** 가운데 숫자 아래 설명 (gauge · donut). */
  centerLabel?: string;
  /** 종류 안의 모양 (값 집합은 종류마다 — gauge: arc · semi · ring · ticks). */
  shape?: ChartShape;
  /** 구간 경계값 (gauge — valueMin 과 valueMax 사이만 쓴다). 패널 목록 칸의 숫자 글자도 받는다. */
  bands?: readonly (number | string)[];
  /** 행마다 축 범위를 따로 (bullet, 기본 true). */
  independent?: boolean;
  /** 정렬 (dumbbell 기본 descending — 이후 값 순). */
  sort?: ChartSort;
  /** 값 축에 0 포함 (dumbbell, 기본 false). */
  includeZero?: boolean;
  // ── ADR-306 Phase 3 — category family (breakdown §2.2 #10 ~ #21).
  /** 칸 수 (waffle, 기본 100 · 1 ~ 400). */
  cells?: number;
  /** 한 줄 칸 수 (waffle, 기본 10). */
  columns?: number;
  /** 오른쪽 전환율 열 (funnel, 기본 true). */
  showRates?: boolean;
  /** 전환율 기준 (funnel, 기본 previous). */
  rateBase?: ChartRateBase;
  /** 전환율 열 제목 (funnel). */
  rateLabel?: string;
  /** 누적 기준선 % (pareto, 기본 80). */
  threshold?: number;
  /** 범주 대신 순위 「#1」 (pareto). */
  rankLabels?: boolean;
  /** 「total」 행을 가리는 필드 (waterfall — 값이 `total` 이면 합계 막대). */
  kindField?: string;
  /** 첫 행을 시작 합계로 (waterfall, 기본 true). */
  startTotal?: boolean;
  /** 끝에 누적 합계 막대 (waterfall, 기본 false). */
  endTotal?: boolean;
  /** 막대 사이 연결선 (waterfall, 기본 true). */
  connectors?: boolean;
  /** 최고 · 최저 점 (sparkline). */
  showExtremes?: boolean;
  /** 쌓기 기준선 (stream, 기본 wiggle — Popover `offset` 과 다른 축이라 이름을 나눈다). */
  streamOffset?: ChartStreamOffset;
  /** 계열 순서를 안쪽에서 바깥으로 (stream, 기본 true). */
  reorder?: boolean;
  /** 순위 필드 (bump — 1 이 1 등. 없으면 값으로 순위). */
  rankField?: string;
  /** 양쪽 제목 2 (slope — 없으면 첫 · 끝 시점). */
  periodLabels?: readonly string[];
  /** 앞줄에 쌓을 필드 (skyline). */
  frontFields?: readonly string[];
  /** 칸 폭 대비 뒷줄 깊이 (skyline, 0.1 ~ 0.32 · 기본 0.32). */
  depth?: number;
  /** 뒷벽 눈금 (skyline, 기본 true). */
  wall?: boolean;
  /** 빗금을 그릴 줄 (skyline, 기본 front). */
  texture?: ChartTexture;
  /** 앞줄 ÷ 뒷줄 표시 (skyline, 기본 label). */
  frontRate?: ChartFrontRate;
  // ── ADR-306 Phase 4 — distribution · matrix family (breakdown §2.2 #25 ~ #32).
  //   `threshold` 는 histogram 에서 기준값 (그 값을 넘는 구간이 강조), `sort` 는 ridgeline 에서 중앙값 순.
  /** 사전 집계 행의 구간 시작 필드 (histogram — `countField` 와 같이). */
  binStartField?: string;
  /** 사전 집계 행의 구간 끝 필드 (histogram). */
  binEndField?: string;
  /** 사전 집계 행의 개수 필드 (histogram — 있으면 원시 표본 대신 이 행들을 구간으로 읽는다). */
  countField?: string;
  /** 분위 선 (histogram, 기본 [50, 95]) — 0 ~ 100 숫자 또는 「p95」. 패널 목록 칸의 글자도 받는다. */
  percentiles?: readonly (number | string)[];
  /** 구간 경계 직접 지정 (histogram — 작은 것부터 둘 이상). */
  edges?: readonly (number | string)[];
  /** 구간 폭 (histogram — 경계는 폭의 배수, log 면 쓰지 않는다). */
  binWidth?: number;
  /** 대략의 구간 수 (histogram — 폭은 1 · 2 · 2.5 · 5 × 10ⁿ). */
  bins?: number;
  /** 로그 구간 · 로그 축 (histogram — 0 이하 값은 빼고 진단). */
  log?: boolean;
  /** 밀도 곡선 (histogram 원시 표본만). */
  kde?: boolean;
  /** 이상값 점 (box, 기본 true). */
  outliers?: boolean;
  /** 수염 끝 백분위 [낮은 쪽, 높은 쪽] (box — 없으면 사분위 범위 1.5 배, Tukey). */
  whiskers?: readonly (number | string)[];
  /** 점 · 선의 이름 필드 (beeswarm · parallel). */
  labelField?: string;
  /** 점 반지름 px (beeswarm — 없으면 개수에 맞춘다). */
  dotRadius?: number;
  /** 그룹 중앙값 표시 (beeswarm, 기본 true). */
  showMedian?: boolean;
  /** 곡선이 위로 겹치는 정도 (ridgeline, 기본 1.5 · 0.5 ~ 4). */
  overlap?: number;
  /** 밀도 추정 대역폭 (ridgeline — 없으면 Silverman). */
  bandwidth?: number;
  /** 행 범주 필드 (heatmap — 열은 `dimension`). */
  rowField?: string;
  /** 색 범례 양 끝 이름 2 (heatmap — 없으면 Low · High). */
  legendLabels?: readonly string[];
  /** 주 시작 요일 (calendar — 0 일요일 · 1 월요일, 기본 0). */
  weekStart?: number;
  /** 칸 사이 틈 px (calendar, 기본 2.5). */
  cellGap?: number;
  /** 시가 · 고가 · 저가 · 종가 · 거래량 필드 (candlestick — 종가 필수). */
  openField?: string;
  highField?: string;
  lowField?: string;
  closeField?: string;
  volumeField?: string;
  /** 종가 이동평균 기간 (candlestick — 2 이상 · 봉 수 미만 · 앞의 3 개). */
  movingAverages?: readonly (number | string)[];
  /** 작은 값이 위인 축 (parallel — `valueFields` 중). */
  invertFields?: readonly string[];
  // ── ADR-306 Phase 5 — network family (breakdown §2.2 #33 ~ #36) · 기존 9 항목 보강 (§2.1).
  /** 계층 경로 필드 — 위 단계부터 (treemap · sunburst — 마지막 필드가 잎 이름). */
  pathFields?: readonly string[];
  /** 흐름의 출발 · 도착 필드 (sankey · chord). */
  sourceField?: string;
  targetField?: string;
  /** 노드 막대 폭 px (sankey, 기본 10 · 2 ~ 40). */
  nodeWidth?: number;
  /** 같은 열 노드 사이 간격 px (sankey, 기본 14 · 0 ~ 60). */
  nodePadding?: number;
  /** 마디 사이 틈 (도) (chord, 기본 3 · 0 ~ 20 — ztd 는 라디안 0.05). */
  padAngle?: number;
  /** 범위 띠 아래 · 위 경계 필드 (line · area — 값 필드와 같은 순서). */
  lowerFields?: readonly string[];
  upperFields?: readonly string[];
  /** 선 끝에 시리즈 이름 (line · area). */
  endLabels?: boolean;
  /** 결측 값 너머로 선을 잇는다 (line · area, 기본 false). */
  connectNulls?: boolean;
  /** 점 크기 필드 (scatter — 면적이 값에 비례). */
  sizeField?: string;
  /** 점 반지름 범위 px [작은, 큰] (scatter 의 sizeField, 기본 [3, 18]). */
  sizeRange?: readonly (number | string)[];
  /** 추세선 (scatter — linear 최소제곱). */
  fit?: ChartFit;
  /**
   * 사분면 이름 — 왼쪽 위 · 오른쪽 위 · 왼쪽 아래 · 오른쪽 아래 순서 (scatter, ztd 와 같은 순서). 기준은
   * 값 축 기준선 (`referenceLines` 의 첫 값) 과 x 평균 — ztd 의 `refLines.x` 에 해당하는 x 기준선이 없어서다.
   */
  quadrants?: readonly string[];

  // ── ADR-306 Phase 6 — 공통 상호작용 (사용자 결정 1, breakdown §8). 전부 선택적이고 비면 지금 그림 그대로.
  /**
   * 강조 대상 — 모드 (`max` · `min` · `first` · `last` · `none`) 또는 항목 이름, 여럿이면 합친다 (ztd
   * `highlight` — 판별 함수 · 인덱스는 받지 않는다). 비면 종류의 기본 강조 (family 는 지금과 같고, 시리즈
   * 종류는 강조 없음 — 팔레트 그대로). 시리즈 종류에 주면 강조 밖 시리즈 · 항목은 neutral 색.
   */
  highlight?: readonly string[];
  /** 주석 (line · area · bar · candlestick — 최대 `CHART_ANNOTATIONS_MAX`). 가로 기준선은 `referenceLines`. */
  annotations?: readonly ChartAnnotation[];
  /** 강조 시리즈 (비면 첫 시리즈) 를 `baseline` 위아래 색으로 (line · area, 누적이 아닐 때) — 아래는 neutral. */
  signColors?: boolean;
  /** `signColors` 의 기준값 (비면 0). */
  baseline?: number;
  /** 범위 띠를 그리기 시작하는 곳 — `forecast` 면 예측 주석의 시작 x 부터 (없으면 띠 없음). 비면 처음부터. */
  bandFrom?: ChartBandFrom;
  /** 범위 띠 밖으로 나간 점을 표시한다 (line · area). */
  outside?: boolean;
  /**
   * 범위 선택 (line · area · bar · candlestick) — `select` 는 끌어서 고른 구간의 등락 · 최고 · 최저,
   * `zoom` 은 그 구간으로 확대. Preview · Publish 의 실행 상태이고 저장하지 않는다 (Canvas 는 그대로).
   */
  brush?: ChartBrush;
  /** 같은 이름의 차트끼리 가리킨 x 를 함께 보인다 (line · area · bar · candlestick, Preview · Publish). */
  syncId?: string;
}

export type ChartFit = "none" | "linear";

/** ADR-306 Phase 6 — 주석 종류 (ztd `Annotation.type`, 가로 기준선 `line` 은 `referenceLines` 가 맡는다). */
export type ChartAnnotationType =
  "band" | "event" | "forecast" | "trend" | "weekends";
export const CHART_ANNOTATION_TYPES: readonly ChartAnnotationType[] = [
  "band",
  "event",
  "forecast",
  "trend",
  "weekends",
];
export const CHART_ANNOTATIONS_MAX = 8;

/**
 * 주석 한 칸. ztd 의 `x: [a, b]` · `y: [lo, hi]` · `from` 을 평평한 칸으로 (패널 목록 편집):
 * - `band`: `y` ~ `yEnd` (값 구간) 또는 `x` ~ `xEnd` (범주 · 날짜 구간).
 * - `event`: `x` 의 세로 표시 + 이름.
 * - `forecast`: `x` 부터 예측 (선이 파선, 구간 음영).
 * - `trend`: 강조 시리즈의 최소제곱 직선.
 * - `weekends`: 시간 축 (`dimensionScale: time`) 의 주말 음영.
 */
export interface ChartAnnotation {
  type: ChartAnnotationType;
  x?: string;
  xEnd?: string;
  y?: number | string;
  yEnd?: number | string;
  label?: string;
}

export type ChartBandFrom = "start" | "forecast";
export type ChartBrush = "none" | "select" | "zoom";

export type ChartRateBase = "previous" | "first";
export type ChartStreamOffset = "wiggle" | "silhouette";
export type ChartTexture = "front" | "all" | "none";
export type ChartFrontRate = "label" | "strip" | "none";

/** ADR-306 — 종류 안의 모양 (`shape`). rule 의 `variant` (상자) 와 다른 축이다. */
export type ChartShape =
  | "arc"
  | "semi"
  | "ring"
  | "ticks"
  // segmented
  | "tall"
  | "thin"
  // sparkline
  | "line"
  | "area"
  | "bar"
  // histogram (bar 와 함께)
  | "dots"
  | "step"
  // box
  | "box"
  | "violin"
  | "both";
export type ChartSort = "none" | "ascending" | "descending";

/** ADR-217 — RSC `ReferenceLineOptions` 의 채택 부분집합 (`value` · `label` · `lineType` · `layer`). */
export interface ChartReferenceLine {
  /** 값 축 좌표 (expand 는 0–100 정규화 단위). 비유한 값은 진단. */
  value: number;
  /** 선 끝 안쪽 라벨 (없으면 선만). */
  label?: string;
  /** 기본 `solid`. */
  lineType?: ChartLineType;
  /** `back` 은 격자 뒤 · 데이터 마크 앞, `front` (기본) 는 데이터 마크 뒤 · 축선 앞. */
  layer?: ChartReferenceLayer;
}
export type ChartLineType = "solid" | "dashed" | "dotted";
export type ChartReferenceLayer = "back" | "front";

/** ADR-216 — 범주 축 스케일 (RSC `ScaleType` 의 `band` · `time` 에 해당). */
export type ChartDimensionScale = "category" | "time";

/** ADR-211 §2.4 — 넘칠 때의 처리. */
export type ChartBudgetOverflow =
  "auto" | "window" | "aggregate" | "extrema" | "others";
/** ADR-211 §2.4 — bucket 집계 통계. `mean` 은 bucket 안 **범주 값** 의 평균이다. */
export type ChartBudgetAggregate = "sum" | "mean" | "max" | "min";
/** ADR-211 §2.3 — 범주 축 종류. */
export type ChartBudgetAxis = "auto" | "category" | "ordinal";

export interface ChartSize {
  width: number;
  height: number;
}

/**
 * rule 에서 뽑은 기하용 metric — **토큰이 아니라 해소된 숫자만**.
 * 색 토큰은 여기 오지 않는다 (consumer 가 series 인덱스로 해소).
 */
export interface ChartMetrics {
  /** plot 바깥 여백 */
  padding:
    number | { top: number; right: number; bottom: number; left: number };
  /** tick·범례 글자 크기 */
  fontSize: number;
  /** line/area 선 두께 */
  strokeWidth: number;
  /** 팔레트 길이 — series 인덱스 순환(modulo)의 기준 */
  seriesCount: number;
  // ── ADR-211 — 표시 예산 (rule chart 채널, D3 SSOT). 테마 채널이 아니라 상수다 —
  //   P0 실측에서 light/dark 가 같았다 (`docs/adr/evidence/211-p0-spike.md` §1).
  /** bar 슬롯 (막대 + 틈) 최소 폭 px */
  minSlot: number;
  /** line/area 점 간 최소 간격 px */
  minPointGap: number;
  /** pie 조각 최소 호 길이 px (바깥 둘레 기준) */
  minArc: number;
  /** radar 축(스포크) 간 최소 호 길이 px */
  minAxisGap: number;
  /** radial 링 최소 두께 px (`RING_GAP` 포함) */
  minRing: number;
  /** `M` — 차트 하나의 요소 마크 총수 상한 (rect · 조각 · 점 · 링 · dot · 값 라벨) */
  markBudget: number;
  /** `P` — line/area 경로 점 총수 상한 (`S × 그려지는 슬롯`) */
  pointBudget: number;
  /** `R` — 모델 계산에 넣는 원본 행 상한 (두 leg 동일) */
  rowCap: number;
  /** 창 트랙이 플롯 아래에 예약하는 높이 px (두 leg 동일 예약) */
  windowTrackHeight: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type TextAnchor = "start" | "middle" | "end";
export type TextBaseline = "top" | "middle" | "bottom";
/** `reference` (ADR-217) 는 기준선 라벨 — 두 consumer 가 `chart.reference` 토큰으로 쓴다. */
export type TextRole = "tick" | "legend" | "empty" | "value" | "reference";
/** `reference` (ADR-217) 는 기준선 — `--chart-reference` / rule `chart.reference` 토큰. */
export type LineRole = "axis" | "grid" | "reference";

/**
 * ADR-306 — 시리즈 팔레트 밖의 뜻 있는 색 (breakdown §5.1). rule `Chart.chart` 의 같은 이름 채널을
 * 두 consumer 가 푼다 — DOM `--chart-<role>` · Skia TokenRef. 연속 색은 보간하지 않고 단계 토큰으로.
 */
export type ChartPaintRole =
  | "accent"
  | "neutral"
  | "positive"
  | "negative"
  | "step-0"
  | "step-1"
  | "step-2"
  | "step-3"
  | "step-4"
  /** 칸 안 글자 — accent · neutral 칠 위에서 읽히는 대비 색 (treemap · sunburst). */
  | "on-fill";
export const CHART_PAINT_ROLES: readonly ChartPaintRole[] = [
  "accent",
  "neutral",
  "positive",
  "negative",
  "step-0",
  "step-1",
  "step-2",
  "step-3",
  "step-4",
  "on-fill",
];

export interface RectMark {
  kind: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  /** 팔레트 인덱스 (이미 seriesCount 로 modulo 됨) */
  seriesIndex: number;
  /** ADR-306 — 있으면 시리즈 팔레트 대신 이 역할 색으로 채운다. */
  fillPaint?: ChartPaintRole;
  /** ADR-306 — 채우기 불투명도 (미지정 1). */
  fillOpacity?: number;
}

export interface PathMark {
  kind: "path";
  /** SVG path data — DOM 은 `<path d>`, Skia 는 `PathShape.d` 로 그대로 소비 */
  d: string;
  /** 컬링·노드 크기용 bbox. `d` 재파싱 금지 — 기하가 이미 좌표를 안다 (ADR-194 R9). */
  bbox: Rect;
  /** 채우기 팔레트 인덱스 (없으면 채우지 않음) */
  fillSeries?: number;
  /**
   * ADR-217 — 시리즈 채우기 불투명도 (미지정 = 현행 0.85). 산점도 점은 1 — Skia 의 시리즈당
   * path 1개 (union) 와 DOM 의 점별 요소는 반투명에서만 합성이 갈린다 (round 1 m3).
   */
  fillOpacity?: number;
  /** 선 팔레트 인덱스 (없으면 긋지 않음) */
  strokeSeries?: number;
  strokeWidth?: number;
  fillRule?: "nonzero" | "evenodd";
  /**
   * 축/격자 역할 (ADR-207). 있으면 두 consumer 가 시리즈 팔레트가 아니라
   * `--chart-grid` / `--chart-axis` 토큰으로 **긋는다** — `LineMark.role` 과 같은 규약.
   */
  role?: LineRole;
  /**
   * 같은 토큰으로 **채운다** (ADR-207 radial 트랙). 선만 그으면 두께 있는 고리가
   * 동심원 2개로 보여 트랙이 아니라 격자처럼 읽힌다 — 트랙은 "여기까지가 100%" 를
   * 나타내는 면이므로 채워야 한다.
   */
  fillRole?: LineRole;
  /** ADR-306 — 역할 색으로 채운다 (`fillSeries` 대신, 불투명도는 `fillOpacity` · 미지정 1). */
  fillPaint?: ChartPaintRole;
  /** ADR-306 — 역할 색으로 긋는다 (`strokeSeries` 대신, 두께는 `strokeWidth` · 미지정 metrics). */
  strokePaint?: ChartPaintRole;
  /** ADR-306 Phase 6 — 선 파선 (Skia `strokeDasharray` · DOM `stroke-dasharray` 같은 배열). */
  dash?: readonly number[];
  /** ADR-306 Phase 6 — 선 불투명도 (미지정 1). */
  strokeOpacity?: number;
  /**
   * ADR-306 Phase 6 — 이 상자 안만 그린다 (손익 색의 기준선 위 · 아래, 예측 구간의 앞 · 뒤 — ztd 의
   * clipPath). Skia 는 `clipRect`, DOM 은 상자 크기의 중첩 `<svg>` (id 없이 자른다).
   */
  clip?: Rect;
}

export interface TextMark {
  kind: "text";
  x: number;
  y: number;
  text: string;
  anchor: TextAnchor;
  baseline: TextBaseline;
  role: TextRole;
  /**
   * 기본 글자 크기 대비 배율 (기본 1). 도넛 가운데 합계처럼 한 글자만 크게
   * 두는 자리에 쓴다 — DOM 은 `em`, Skia 는 metrics.fontSize 곱으로 푼다.
   */
  fontScale?: number;
  /** ADR-306 Phase 5 — 있으면 `role` 색 대신 이 역할 색 (칸 안 글자 = `on-fill`). */
  paint?: ChartPaintRole;
}

export interface LineMark {
  kind: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  role: LineRole;
  /** ADR-217 — 파선 패턴 (Skia `strokeDasharray` · DOM `stroke-dasharray` 같은 배열). 없으면 실선. */
  dash?: readonly number[];
  /** ADR-306 — 있으면 `role` 토큰 대신 이 역할 색으로 긋는다. */
  paint?: ChartPaintRole;
  /** ADR-306 — 선 두께 (미지정 1). */
  width?: number;
  /** ADR-306 Phase 6 — 선 불투명도 (미지정 1). */
  opacity?: number;
}

export type Mark = RectMark | PathMark | TextMark | LineMark;

/**
 * 축 종류. 직교 2종 + 극좌표 2종 (ADR-207 가산 확장 — 기존 값의 뜻은 그대로다).
 * `angular` 는 각도 축 (radar 스포크 + 범주 레이블), `radial` 은 반지름 축 (격자).
 */
export type AxisKind = "x" | "y" | "angular" | "radial";

export interface AxisScene {
  axis: AxisKind;
  /** 축선 (showAxis=false 면 null) */
  line: LineMark | null;
  /**
   * grid 원소 (showGrid=false 면 빈 배열).
   *
   * 직교 축은 `LineMark` 만 넣는다. 극좌표 축은 동심 다각형·원을 `PathMark` 로
   * 넣는다 — 이 유니온이 ADR-207 의 존재 이유다 (`LineMark[]` 로는 원을 못 담는다).
   * **유니온을 넓혀도 컴파일러는 소비처 갱신을 요구하지 않는다** (두 consumer 가
   * generic mark 렌더러로 넘긴다 — breakdown F15). 감시자는 스냅샷·parity 다.
   */
  grid: Array<LineMark | PathMark>;
  /** tick 레이블 — 폭 초과 시 every-nth 로 솎아낸 뒤의 잔여 (ADR-194 R3) */
  ticks: TextMark[];
}

export interface LegendItem {
  label: string;
  seriesIndex: number;
  swatch: RectMark;
  text: TextMark;
}

export interface LegendScene {
  position: ChartLegendPosition;
  items: LegendItem[];
}

/** 툴팁 한 줄 — 색 스와치 + 이름 + 값. */
export interface TooltipEntry {
  label: string;
  /** 팔레트 인덱스 (이미 modulo 됨) */
  colorIndex: number;
  text: string;
}

/**
 * 툴팁 히트 단위. bar/line/area 는 밴드 기둥(rect), pie 는 조각(arc) 이다.
 *
 * 히트 기하를 scene 에 싣는 이유: DOM 쪽에서 포인터 → 범주를 다시 계산하면
 * 밴드 규칙(패딩·방향·누적)이 기하와 갈린다. 마크와 같은 함수가 낸 값이라야
 * 툴팁이 가리키는 막대와 실제 막대가 같다.
 */
export interface TooltipBand {
  categoryIndex: number;
  label: string;
  /** 밴드 히트 영역 (pie 는 null) */
  rect: Rect | null;
  /** 조각 각도 범위 — 12시=0, 시계 방향 (pie 전용) */
  arc: { start: number; end: number } | null;
  /** 기준점 — 커서 선/툴팁 위치 */
  anchor: { x: number; y: number };
  /**
   * 반지름 밴드 (ADR-207 radial 전용). 누적 radial 은 같은 각도에 시리즈가
   * 반지름으로 쌓이므로 각도만으로 히트가 안 갈린다 — 링별 반지름 범위가 있어야
   * 어느 범주를 가리키는지 정해진다. 없으면 `TooltipScene.center` 의 범위를 쓴다.
   */
  ring?: { inner: number; outer: number };
  entries: TooltipEntry[];
}

export interface TooltipScene {
  bands: TooltipBand[];
  /** pie 히트 판정용 중심·반지름 (bar/line/area 는 null) */
  center: { x: number; y: number; outer: number; inner: number } | null;
}

export interface ChartScene {
  size: ChartSize;
  /** 마크가 그려지는 영역 (축·범례를 뺀 나머지) */
  plot: Rect;
  /** 데이터 마크 (rect/path) */
  marks: Mark[];
  axes: AxisScene[];
  legend: LegendScene | null;
  /**
   * 툴팁 데이터·히트 기하 (showTooltip=false 면 null).
   * **Skia consumer 는 읽지 않는다** — hover 는 D1 상호작용이고 Preview/Publish
   * (DOM) 소유다. Builder 캔버스는 정적 렌더를 유지한다.
   */
  tooltip: TooltipScene | null;
  /**
   * 그릴 데이터가 없는 상태 (행 0 · 값 전부 비수치 · 크기 0).
   * marks 는 안내 텍스트 1개만 담고 axes/legend 는 비어 있다 — 경계 케이스를
   * 예외가 아니라 scene 의 한 상태로 표현한다 (ADR-194 G2 대안).
   */
  empty: boolean;
  /**
   * ADR-210 — 표시 설정 진단 (없으면 생략). `empty` 와 함께 오는 error 는 설정 오류
   * 상태 (`CHART_INVALID_SETTINGS_TEXT`), warning 은 렌더하되 알릴 것 (중복 first-wins 등).
   */
  diagnostics?: readonly ChartDiagnostic[];
  /**
   * ADR-211 — 창 트랙 자리 (창 모드에서 범주가 넘칠 때만). `marks` 끝에 비활성 트랙 마크
   * (`fillRole`) 가 같이 실린다 — DOM leg 는 이 자리에 뷰 상태 Slider 를 얹는다.
   */
  windowTrack?: Rect;
  /**
   * ADR-306 — family 가 아직 로드되지 않았다 (`loadChartFamily`). 상자만 그리고 안내 글자는 없다 —
   * 로드가 끝나면 두 consumer 가 같은 입력으로 다시 계산한다.
   */
  pending?: boolean;
  /**
   * ADR-306 — hover · 키보드 대상 (breakdown §5.2). `id` 는 family 가 정하는 뜻 단위 (점 · 칸 · 노드 ·
   * 행), `rows` 는 원본 행 인덱스. 배열 순서 = 키보드 이동 순서. **Canvas 는 읽지 않는다** (`tooltip` 규약).
   */
  targets?: readonly ChartTarget[];
}

/** ADR-306 — scene 의 hover 대상 하나. */
export interface ChartTarget {
  id: string;
  /** 툴팁 기준점 */
  x: number;
  y: number;
  /** 히트 영역 — 사각형 (행 띠) 또는 반지름 (점). 둘 다 없으면 기준점 주변 12px. */
  rect?: Rect;
  r?: number;
  /**
   * ADR-306 Phase 5 — 고리 조각 히트 영역 (sunburst 조각 · chord 마디). 라디안 — 12 시 = 0 · 시계 방향.
   * 큰 조각은 가운데 점 둘레 원으로 덮이지 않는다 (live 에서 발견).
   */
  arc?: {
    cx: number;
    cy: number;
    r0: number;
    r1: number;
    a0: number;
    a1: number;
  };
  rows: readonly number[];
  /**
   * ADR-306 Phase 6 — 범주 축 종류 (candlestick) 의 범주 이름 · 대표 값 (종가). DOM 의 범위 선택 · 동기화가
   * 읽는다 (Canvas 는 targets 를 읽지 않는다).
   */
  key?: string;
  value?: number;
  /** 툴팁 제목 + 줄 (`label: text`). */
  title: string;
  entries: readonly {
    label: string;
    text: string;
    paint?: ChartPaintRole;
    /** 시리즈 팔레트 색 (paint 가 없을 때). */
    series?: number;
  }[];
}
