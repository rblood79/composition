/**
 * ADR-207 — 극좌표 축 (radar 스포크·동심 격자·각도 레이블).
 *
 * 직교 `buildAxes` 와 같은 계약 (`AxisScene[]`) 을 내지만 격자가 `PathMark` 다.
 * `AxisScene.grid: Array<LineMark | PathMark>` 확장이 여기 하나를 위해 있다.
 *
 * **회전 없음** (직교 축과 같은 제약 — Skia `TextShape` 에 회전 필드가 없다).
 * 각도 레이블은 방향에 따라 앵커/baseline 을 6방향으로 고르고, 겹치면 회전이
 * 아니라 **솎아낸다** (R9 — 직교의 `labelStride` 는 band step 기준이라 여기 못 쓴다).
 */
import { circlePathAt, polarPoint, polygonPath } from "./polar";
import type { AngleScale } from "./polar";
import { approxTextWidth, r2 } from "./scales";
import type { TickResult } from "./scales";
import type {
  AxisScene,
  LineMark,
  PathMark,
  PolarGridType,
  TextAnchor,
  TextBaseline,
  TextMark,
} from "./types";

export interface PolarCenter {
  x: number;
  y: number;
  /** 바깥 반지름 */
  outer: number;
  /** 안쪽 반지름 (radial 의 첫 링 시작, radar 는 0) */
  inner: number;
}

export interface PolarAxesInput {
  categories: readonly string[];
  angle: AngleScale;
  center: PolarCenter;
  ticks: TickResult;
  gridType: PolarGridType;
  fontSize: number;
  showAxis: boolean;
  showGrid: boolean;
  /**
   * 스포크 표시. `showAxis` 안의 하위 스위치다 — shadcn 은 `PolarAngleAxis`(레이블) 와
   * `PolarGrid`(스포크+링) 로 나누지만, 우리는 `showAxis` 가 각도 축 전체를 켜는 기존
   * 계약을 지키고 그 안에서만 스포크를 가른다 (기본 true → 기존 그림 무변경).
   */
  showSpokes: boolean;
  /** 링 개수. 0 이면 값 눈금 개수를 따른다 */
  gridRings: number;
  /** 가장 바깥 링만 채운다 — 모두 채우면 겹쳐서 안쪽이 진해진다 */
  fillGrid: boolean;
}

/**
 * 각도 레이블 몇 개 걸러 그릴지. 원둘레를 범주 수로 나눈 호 길이가 slot 이다 —
 * 직교의 `labelStride` (band step) 과 다른 축이라 함수를 따로 둔다 (R9).
 */
export function polarLabelStride(
  labels: readonly string[],
  radius: number,
  fontSize: number,
): number {
  const n = labels.length;
  if (n === 0 || radius <= 0) return 1;
  const slot = (2 * Math.PI * radius) / n;
  if (slot <= 0) return n;
  let widest = 0;
  for (const label of labels) {
    const w = approxTextWidth(label, fontSize);
    if (w > widest) widest = w;
  }
  // 레이블은 방사 방향으로 놓이므로 좌우 이웃과 겹치는 폭은 대략 절반이다.
  //   그래도 최소 간격을 글자 하나만큼 둔다.
  const needed = widest * 0.6 + fontSize * 0.5;
  if (needed <= slot) return 1;
  return Math.min(n, Math.ceil(needed / slot));
}

/**
 * 각도 → 텍스트 앵커/baseline 6방향. 위/아래는 가운데 정렬, 좌/우는 바깥쪽으로
 * 밀어 놓는다. 회전 없이 이것만으로 레이블이 격자와 겹치지 않는다.
 */
export function polarLabelAnchor(degrees: number): {
  anchor: TextAnchor;
  baseline: TextBaseline;
} {
  const d = ((degrees % 360) + 360) % 360;
  const EPS = 1e-6;
  if (Math.abs(d) < EPS || Math.abs(d - 360) < EPS) {
    return { anchor: "middle", baseline: "bottom" };
  }
  if (Math.abs(d - 180) < EPS) return { anchor: "middle", baseline: "top" };
  if (d < 180) {
    // 오른쪽 반원 — 글자가 바깥으로 나가도록 왼쪽 정렬
    return { anchor: "start", baseline: d < 90 ? "bottom" : d > 90 ? "top" : "middle" };
  }
  return {
    anchor: "end",
    baseline: d > 270 ? "bottom" : d < 270 ? "top" : "middle",
  };
}

function gridRing(
  center: PolarCenter,
  radius: number,
  gridType: PolarGridType,
  count: number,
  start: number,
): PathMark | null {
  const d =
    gridType === "circle"
      ? circlePathAt(center.x, center.y, radius)
      : polygonPath(center.x, center.y, radius, count, start);
  if (!d) return null;
  return {
    kind: "path",
    d,
    bbox: {
      x: r2(center.x - radius),
      y: r2(center.y - radius),
      w: r2(radius * 2),
      h: r2(radius * 2),
    },
    role: "grid",
    strokeWidth: 1,
  };
}

/**
 * [각도 축, 반지름 축] 순. 직교의 `[범주 축, 값 축]` 과 같은 자리다 —
 * scene 계약이므로 순서가 고정이다.
 */
export function buildPolarAxes(input: PolarAxesInput): AxisScene[] {
  const {
    categories,
    angle,
    center,
    ticks,
    gridType,
    fontSize,
    showAxis,
    showGrid,
    showSpokes,
    gridRings,
    fillGrid,
  } = input;

  // ── 각도 축 — 스포크 + 범주 레이블 ────────────────────────────────────────
  const spokes: LineMark[] = [];
  const labels: TextMark[] = [];
  const stride = polarLabelStride(categories, center.outer, fontSize);

  for (let i = 0; i < categories.length; i++) {
    const deg = angle(i);
    if (showAxis && showSpokes) {
      const from = polarPoint(center.x, center.y, center.inner, deg);
      const to = polarPoint(center.x, center.y, center.outer, deg);
      spokes.push({
        kind: "line",
        x1: from.x,
        y1: from.y,
        x2: to.x,
        y2: to.y,
        role: "grid",
      });
    }
    if (!showAxis || i % stride !== 0) continue;
    const at = polarPoint(center.x, center.y, center.outer + fontSize * 0.5, deg);
    const { anchor, baseline } = polarLabelAnchor(deg);
    labels.push({
      kind: "text",
      x: at.x,
      y: at.y,
      text: categories[i] || "",
      anchor,
      baseline,
      role: "tick",
    });
  }

  // ── 반지름 축 — 동심 격자 + 값 눈금 ──────────────────────────────────────
  const rings: PathMark[] = [];
  if (showGrid) {
    // 링 반지름 비율 목록 — **안쪽에서 바깥 순서**를 유지한다 (기존 규약).
    //   `gridRings` 가 있으면 균등 N 개, 없으면 값 눈금을 따른다.
    const fractions: number[] = [];
    const count = Math.floor(gridRings);
    if (count > 0) {
      for (let i = 1; i <= count; i++) fractions.push(i / count);
    } else {
      const [d0, d1] = ticks.domain;
      const span = d1 - d0;
      for (const tick of ticks.ticks) {
        // 눈금 값 → 반지름 비율. 중심(값 = domain 하한)은 격자가 없다.
        const t = span === 0 ? 1 : (tick - d0) / span;
        if (t > 0) fractions.push(t);
      }
    }
    for (const t of fractions) {
      const radius = center.inner + (center.outer - center.inner) * t;
      const ring = gridRing(center, radius, gridType, categories.length, angle.start);
      if (ring) rings.push(ring);
    }
    // 가장 바깥 링 **하나만** 채운다 (전부 채우면 겹쳐서 안쪽이 진해지고 값
    //   다각형을 가린다). 배열 마지막이 바깥이다.
    if (fillGrid && rings.length > 0) {
      rings[rings.length - 1].fillRole = "grid";
    }
  }
  return [
    { axis: "angular", line: null, grid: spokes, ticks: labels },
    { axis: "radial", line: null, grid: rings, ticks: [] },
  ];
}
