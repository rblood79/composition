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

/** 마크 종류 — RSC `<Bar/>`·`<Line/>`·`<Area/>` 를 노코드 팔레트용 단일 enum 으로 평탄화. */
export type ChartType = "bar" | "line" | "area" | "pie";

export type ChartOrientation = "vertical" | "horizontal";

/**
 * RSC `Bar.type` + shadcn `stacked-expand`. 다중 시리즈에서만 의미가 있다.
 * `expand` 는 범주별 합을 100 으로 정규화해 쌓는다 (비중 비교용).
 */
export type ChartStackType = "stacked" | "dodged" | "expand";

/** RSC `Legend.position`. */
export type ChartLegendPosition = "bottom" | "top" | "left" | "right";

/** 데이터 행 — dataBinding 이 준 그대로의 임의 레코드. */
export type ChartRow = Readonly<Record<string, unknown>>;

export interface ChartProps {
  chartType: ChartType;
  /** 범주 축 필드 키 (RSC `Bar.dimension`) */
  dimension: string;
  /** 값 축 필드 키 (RSC `Bar.metric`) */
  metric: string;
  /** 시리즈 분할 필드 키 (RSC `Bar.color`). 없으면 단일 시리즈. */
  color?: string;
  orientation: ChartOrientation;
  stackType: ChartStackType;
  showAxis: boolean;
  showGrid: boolean;
  showLegend: boolean;
  legendPosition: ChartLegendPosition;
}

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
  padding: number;
  /** tick·범례 글자 크기 */
  fontSize: number;
  /** line/area 선 두께 */
  strokeWidth: number;
  /** 팔레트 길이 — series 인덱스 순환(modulo)의 기준 */
  seriesCount: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type TextAnchor = "start" | "middle" | "end";
export type TextBaseline = "top" | "middle" | "bottom";
export type TextRole = "tick" | "legend" | "empty";
export type LineRole = "axis" | "grid";

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
}

export interface TextMark {
  kind: "text";
  x: number;
  y: number;
  text: string;
  anchor: TextAnchor;
  baseline: TextBaseline;
  role: TextRole;
}

export interface LineMark {
  kind: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  role: LineRole;
}

export type Mark = RectMark | PathMark | TextMark | LineMark;

export interface AxisScene {
  axis: "x" | "y";
  /** 축선 (showAxis=false 면 null) */
  line: LineMark | null;
  /** grid line (showGrid=false 면 빈 배열) */
  grid: LineMark[];
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

export interface ChartScene {
  size: ChartSize;
  /** 마크가 그려지는 영역 (축·범례를 뺀 나머지) */
  plot: Rect;
  /** 데이터 마크 (rect/path) */
  marks: Mark[];
  axes: AxisScene[];
  legend: LegendScene | null;
  /**
   * 그릴 데이터가 없는 상태 (행 0 · 값 전부 비수치 · 크기 0).
   * marks 는 안내 텍스트 1개만 담고 axes/legend 는 비어 있다 — 경계 케이스를
   * 예외가 아니라 scene 의 한 상태로 표현한다 (ADR-194 G2 대안).
   */
  empty: boolean;
}
