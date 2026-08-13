/**
 * 눈금자 지표 — ADR-181 Phase 1 (카메라의 순수 함수)
 *
 * 렌더 표면(DOM)과 무관한 계산만 모은다. `DotBackground` 의
 * `calculateDotBackgroundMetrics` 와 같은 위상(位相) 어법이다 — 눈금은 반복
 * 패턴이라 팬 오프셋을 **간격에 대한 나머지**로 환산하면 배경 위치 이동만으로
 * 표현된다 (ADR-902 축 1 채택 기법 승계).
 *
 * 눈금 값은 **scene 좌표** 다. 페이지-로컬 원점으로 바꾸면 선택/활성 페이지에
 * 의존하게 되어 "카메라의 순수 함수" 계약이 깨진다.
 */

/** 스트립 두께 (screen px) */
export const RULER_SIZE_PX = 20;

/** 주 눈금(라벨 표시) 최소 화면 간격 — 라벨이 겹치지 않는 하한 */
export const LABEL_MIN_SPACING_PX = 48;
/** 보조 눈금 최소 화면 간격 — 이보다 촘촘해지면 보조 눈금을 생략한다 */
export const MINOR_MIN_SPACING_PX = 6;
/** 주 눈금 하나당 보조 눈금 분할 수 */
const MINOR_DIVISIONS = 5;

/** 한 축에 만들 라벨 상한 — 비정상 zoom/카메라 값에서 루프 폭주 차단 */
const MAX_LABELS_PER_AXIS = 512;

/** 음수도 [0, modulus) 로 접는 나머지 (`DotBackground` 와 동일) */
export function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

/**
 * 1-2-5×10^n 계열에서 `minSpan` 이상인 최소값 — 눈금자 관례 간격.
 */
export function niceInterval(minSpan: number): number {
  const span = Math.max(minSpan, 1e-6);
  const base = Math.pow(10, Math.floor(Math.log10(span)));
  for (const m of [1, 2, 5]) {
    if (base * m >= span) return base * m;
  }
  return base * 10;
}

export interface RulerTickPlan {
  /** 라벨이 붙는 주 눈금 간격 (scene 단위) */
  major: number;
  /** 보조 눈금 간격 (scene 단위). 0 이면 보조 눈금 생략 */
  minor: number;
}

/**
 * zoom 에 대한 눈금 간격 결정 — 카메라의 순수 함수.
 */
export function resolveTickPlan(zoom: number): RulerTickPlan {
  const safeZoom = zoom > 0 ? zoom : 1;
  const major = niceInterval(LABEL_MIN_SPACING_PX / safeZoom);
  const minor = major / MINOR_DIVISIONS;
  return {
    major,
    minor: minor * safeZoom >= MINOR_MIN_SPACING_PX ? minor : 0,
  };
}

export interface RulerAxisMetricsInput {
  /** 카메라 pan (screen px) */
  pan: number;
  zoom: number;
  /**
   * 스트립의 좌(상)단이 캔버스 좌표계에서 시작하는 위치 (screen px).
   * 캔버스가 full-bleed 라 좌측 패널 폭만큼 밀린다 (`canvasViewportInset`).
   */
  origin: number;
}

export interface RulerAxisMetrics {
  major: number;
  minor: number;
  /** 화면상 주/보조 눈금 간격 (px) — CSS `background-size` */
  majorGapPx: number;
  minorGapPx: number;
  /** 반복 패턴 위상 (px, [0, gap)) — CSS `background-position` */
  majorPhasePx: number;
  minorPhasePx: number;
}

/**
 * 한 축의 눈금 지표. 스트립 로컬 px 기준이다.
 *
 * scene 값 `v` 의 스트립 로컬 위치 = `pan + v * zoom - origin`. 눈금은
 * `v = k * major` 이므로 위상은 `positiveModulo(pan - origin, gapPx)` 가 된다.
 */
export function calculateRulerAxisMetrics({
  pan,
  zoom,
  origin,
}: RulerAxisMetricsInput): RulerAxisMetrics {
  const safeZoom = zoom > 0 ? zoom : 1;
  const { major, minor } = resolveTickPlan(safeZoom);
  const majorGapPx = major * safeZoom;
  const minorGapPx = minor * safeZoom;
  return {
    major,
    minor,
    majorGapPx,
    minorGapPx,
    majorPhasePx: positiveModulo(pan - origin, majorGapPx),
    minorPhasePx: minorGapPx > 0 ? positiveModulo(pan - origin, minorGapPx) : 0,
  };
}

export interface RulerLabel {
  /** 스트립 로컬 위치 (screen px) */
  pos: number;
  /** 표시 문자열 */
  text: string;
  /** scene 값 (키/디버깅용) */
  value: number;
}

/**
 * 스트립에 그릴 주 눈금 라벨 목록. `length` 는 스트립의 가시 길이(px).
 *
 * 코너(두 스트립이 만나는 `RULER_SIZE_PX` 영역)는 건너뛴다 — 세로 자 라벨이
 * 가로 자 아래로 들어가면 겹친다.
 */
export function collectRulerLabels(
  { pan, zoom, origin }: RulerAxisMetricsInput,
  length: number,
  skipHeadPx = 0,
): RulerLabel[] {
  const safeZoom = zoom > 0 ? zoom : 1;
  const { major } = resolveTickPlan(safeZoom);
  if (length <= 0) return [];

  // 스트립 로컬 px → scene: (px + origin - pan) / zoom
  const sceneFrom = (skipHeadPx + origin - pan) / safeZoom;
  const sceneTo = (length + origin - pan) / safeZoom;

  const labels: RulerLabel[] = [];
  let k = Math.ceil(sceneFrom / major);
  const kEnd = Math.floor(sceneTo / major);
  for (let i = 0; k <= kEnd && i < MAX_LABELS_PER_AXIS; k++, i++) {
    const value = k * major;
    labels.push({
      pos: pan + value * safeZoom - origin,
      // 간격이 1 미만으로 내려가는 줌에서도 자릿수가 폭발하지 않게 반올림
      text: major >= 1 ? String(Math.round(value)) : value.toFixed(1),
      value,
    });
  }
  return labels;
}
