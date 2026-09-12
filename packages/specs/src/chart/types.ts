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
export type ChartType = "bar" | "line" | "area" | "pie" | "radar" | "radial";
/**
 * ADR-217 P1 — 값 목록 (validator 가 알 수 없는 종류를 진단 `chartType.unsupported` 로 낸다).
 * 유니온에 종류를 더하면 `satisfies` 가 여기도 고치게 한다.
 */
export const CHART_TYPES = [
  "bar",
  "line",
  "area",
  "pie",
  "radar",
  "radial",
] as const satisfies readonly ChartType[];

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
  | "dimension.parse.failed";

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
}

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

export interface RectMark {
  kind: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  /** 팔레트 인덱스 (이미 seriesCount 로 modulo 됨) */
  seriesIndex: number;
}

export interface PathMark {
  kind: "path";
  /** SVG path data — DOM 은 `<path d>`, Skia 는 `PathShape.d` 로 그대로 소비 */
  d: string;
  /** 컬링·노드 크기용 bbox. `d` 재파싱 금지 — 기하가 이미 좌표를 안다 (ADR-194 R9). */
  bbox: Rect;
  /** 채우기 팔레트 인덱스 (없으면 채우지 않음) */
  fillSeries?: number;
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
}
