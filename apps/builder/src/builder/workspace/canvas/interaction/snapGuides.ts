/**
 * 스냅·정렬 가이드 판정 (ADR-179)
 *
 * 드래그 중인 박스를 후보 rect 들의 6축 (left/centerX/right × top/centerY/bottom)
 * 에 흡착시키는 순수 함수. 훅 밖 단일 진입점 (`resolveSelectionDragIntent` 패턴) —
 * 페이지 드래그(usePageDrag)와 absolute 요소 드래그(Phase 3)가 공유한다.
 *
 * - 축별 독립: x 는 수직선 후보, y 는 수평선 후보 — 최근접 1개만 채택,
 *   임계 밖이면 raw 유지 (breakdown §3.1).
 * - stateless: 판정 기준이 raw 위치라 raw 가 임계 밖으로 나가면 즉시 해제 —
 *   별도 해제 상태 불필요 (리뷰 round 1 판정).
 * - 임계는 scene px — 호출측이 screen 임계 / zoom 으로 환산해 전달 (C4).
 */

/** 흡착 임계 시작값 (screen px, Figma 관례 근사 — G1 live 조작감에서 조정) */
export const SNAP_THRESHOLD_SCREEN_PX = 8;

export interface SnapCandidateRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SnapGuide {
  /** "x" = 수직 정렬선 (x=position 고정), "y" = 수평 정렬선 (y=position 고정) */
  axis: "x" | "y";
  /** 정렬선의 scene 좌표 (수직선은 x, 수평선은 y) */
  position: number;
  /** 정렬선이 걸치는 직교 축 구간 (수직선은 y 구간, 수평선은 x 구간) */
  start: number;
  end: number;
}

export interface SnappedPositionResult {
  position: { x: number; y: number };
  guides: SnapGuide[];
  snappedX: boolean;
  snappedY: boolean;
}

/** 후보 라인 매칭 오차 — 같은 라인의 float 재계산 편차만 흡수한다 */
const LINE_MATCH_EPS = 0.5;

/** rect 한 축의 3라인 (min / center / max) */
function rectLines(min: number, size: number): [number, number, number] {
  return [min, min + size / 2, min + size];
}

interface AxisSnap {
  /** snapped - raw (이동 박스에 더할 보정량) */
  delta: number;
  /** 흡착된 정렬선의 scene 좌표 */
  line: number;
}

function resolveAxisSnap(
  movingEdges: readonly number[],
  candidates: readonly SnapCandidateRect[],
  axis: "x" | "y",
  threshold: number,
): AxisSnap | null {
  let best: AxisSnap | null = null;
  for (const candidate of candidates) {
    const lines =
      axis === "x"
        ? rectLines(candidate.x, candidate.width)
        : rectLines(candidate.y, candidate.height);
    for (const line of lines) {
      for (const edge of movingEdges) {
        const delta = line - edge;
        const distance = Math.abs(delta);
        if (distance > threshold) {
          continue;
        }
        if (!best || distance < Math.abs(best.delta)) {
          best = { delta, line };
        }
      }
    }
  }
  return best;
}

/**
 * 흡착된 정렬선의 표시 구간 — 이동 박스(스냅 반영)와, 같은 라인을 공유하는
 * 모든 후보의 직교 축 구간 합집합 (Figma 동형: 정렬된 두 박스를 관통).
 */
function buildGuide(
  axis: "x" | "y",
  line: number,
  movingMin: number,
  movingMax: number,
  candidates: readonly SnapCandidateRect[],
): SnapGuide {
  let start = movingMin;
  let end = movingMax;
  for (const candidate of candidates) {
    const lines =
      axis === "x"
        ? rectLines(candidate.x, candidate.width)
        : rectLines(candidate.y, candidate.height);
    if (!lines.some((l) => Math.abs(l - line) <= LINE_MATCH_EPS)) {
      continue;
    }
    const min = axis === "x" ? candidate.y : candidate.x;
    const max =
      axis === "x"
        ? candidate.y + candidate.height
        : candidate.x + candidate.width;
    start = Math.min(start, min);
    end = Math.max(end, max);
  }
  return { axis, position: line, start, end };
}

/**
 * 이동 박스의 raw 위치를 후보 6축에 흡착시킨다.
 *
 * @param raw 이동 박스의 좌상단 raw 위치 (scene px)
 * @param movingSize 이동 박스 크기 (scene px)
 * @param candidates 스냅 후보 rect — 드래그 대상 자신은 호출측이 제외 (C3)
 * @param threshold scene px 임계 (= SNAP_THRESHOLD_SCREEN_PX / zoom)
 */
export function resolveSnappedPosition(
  raw: { x: number; y: number },
  movingSize: { width: number; height: number },
  candidates: readonly SnapCandidateRect[],
  threshold: number,
): SnappedPositionResult {
  const snapX = resolveAxisSnap(
    rectLines(raw.x, movingSize.width),
    candidates,
    "x",
    threshold,
  );
  const snapY = resolveAxisSnap(
    rectLines(raw.y, movingSize.height),
    candidates,
    "y",
    threshold,
  );
  const x = raw.x + (snapX?.delta ?? 0);
  const y = raw.y + (snapY?.delta ?? 0);
  const guides: SnapGuide[] = [];
  // 구간은 스냅 반영 후 좌표 기준 — 양축이 동시에 흡착돼도 정렬선이 박스를 관통
  if (snapX) {
    guides.push(
      buildGuide("x", snapX.line, y, y + movingSize.height, candidates),
    );
  }
  if (snapY) {
    guides.push(
      buildGuide("y", snapY.line, x, x + movingSize.width, candidates),
    );
  }
  return {
    position: { x, y },
    guides,
    snappedX: snapX !== null,
    snappedY: snapY !== null,
  };
}
