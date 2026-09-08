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

/** radar 격자 모양 (shadcn `chart-radar-grid-circle` 축). */
export type PolarGridType = "polygon" | "circle";

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
  /** 도넛 구멍 안 합계 표시 */
  showTotal: boolean;
  /** hover 툴팁 (Preview/Publish 전용 — Skia 는 정적) */
  showTooltip: boolean;
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
export type TextRole = "tick" | "legend" | "empty" | "value";
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
}
