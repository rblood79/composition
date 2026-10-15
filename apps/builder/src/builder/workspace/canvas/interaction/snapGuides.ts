/**
 * 스냅·정렬 가이드 판정 (ADR-179)
 *
 * 드래그 중인 박스를 후보 rect 들의 6축 (left/centerX/right × top/centerY/bottom)
 * 및 등간격(equal-spacing) 지점에 흡착시키는 순수 함수. 훅 밖 단일 진입점
 * (`resolveSelectionDragIntent` 패턴) — 페이지 드래그(usePageDrag)와 absolute
 * 요소 드래그(Phase 3)가 공유한다.
 *
 * - 축별 독립: x 는 수직선/가로 간격 후보, y 는 수평선/세로 간격 후보 —
 *   축마다 정렬선·등간격 제안 중 최근접 1개만 채택, 임계 밖이면 raw 유지
 *   (breakdown §3.1).
 * - stateless: 판정 기준이 raw 위치라 raw 가 임계 밖으로 나가면 즉시 해제 —
 *   별도 해제 상태 불필요 (리뷰 round 1 판정).
 * - 임계는 scene px — 호출측이 screen 임계 / zoom 으로 환산해 전달 (C4).
 * - 등간격 (Phase 4): 직교축이 겹치는 이웃들 사이의 간격 리듬에 흡착.
 *   between(두 이웃 사이 등간격 중앙 배치)과 sequence(인접 쌍의 간격을
 *   연장하는 배치) 두 패턴. 동률이면 정렬선이 이긴다.
 */

/**
 * 흡착 임계 (screen px) — Pen v1.2.1 실측값 5 채택 (2026-08-13 사용자 결정,
 * G1 조정 절차). 시작값 8(Figma 관례 근사)은 조작감 대비 흡착 반경이 넓었다.
 */
export const SNAP_THRESHOLD_SCREEN_PX = 5;

/**
 * 수동 가이드 라인 (ADR-181 Phase 6) — scene 좌표.
 *
 * rect 후보와 **다른 입력**이다: 가이드는 크기가 없는 선이라 6축 투영도,
 * 등간격 이웃도 될 수 없다 (`projectCandidate` 미통과). 그래서 정렬선 판정에만
 * 들어가고 spacing 경로에는 전달되지 않는다.
 */
export interface SnapGuideLines {
  /** 세로 가이드의 x 좌표들 */
  x: readonly number[];
  /** 가로 가이드의 y 좌표들 */
  y: readonly number[];
}

const EMPTY_GUIDE_LINES: SnapGuideLines = { x: [], y: [] };

export interface SnapCandidateRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SnapLineGuide {
  kind: "line";
  /** "x" = 수직 정렬선 (x=position 고정), "y" = 수평 정렬선 (y=position 고정) */
  axis: "x" | "y";
  /** 정렬선의 scene 좌표 (수직선은 x, 수평선은 y) */
  position: number;
  /** 정렬선이 걸치는 직교 축 구간 (수직선은 y 구간, 수평선은 x 구간) */
  start: number;
  end: number;
  /**
   * 정렬점 마커의 직교 축 좌표 (Pen 어법 — 어느 점들이 맞았는지 표식).
   * edge 매칭 = 그 변의 코너 2점, center 매칭 = 중심 1점. 이동 박스 +
   * 매칭 후보 전부, 근접 중복 제거.
   */
  markers: number[];
}

export interface SnapSpacingSegment {
  /** 간격 구간의 스냅 축 좌표 (axis "x" 면 x 구간, "y" 면 y 구간) */
  start: number;
  end: number;
}

export interface SnapSpacingGuide {
  kind: "spacing";
  /**
   * 간격이 측정되는 축 — 정렬선(SnapLineGuide)과 의미가 다르다:
   * "x" = 가로 간격 (수평 세그먼트), "y" = 세로 간격 (수직 세그먼트)
   */
  axis: "x" | "y";
  /** 간격 값 (scene px — 두 세그먼트가 같은 값) */
  value: number;
  /** 세그먼트가 그려질 직교 축 좌표 (참여 rect 들의 직교 겹침 중앙) */
  cross: number;
  /** 등간격을 이루는 두 간격 구간 (기존 간격 + 이동 박스가 만든 간격) */
  segments: [SnapSpacingSegment, SnapSpacingSegment];
}

export type SnapGuide = SnapLineGuide | SnapSpacingGuide;

/**
 * 흐름 drag 의 중심선 (2026-10-15 사용자 결정 — 표시만, 흡착 없음): 끄는 박스의 중심이
 * 놓일 컨테이너의 중심과 임계 (scene px) 안에서 맞으면 그 축의 중심선을 컨테이너에 걸쳐 그린다.
 */
export function resolveCentreGuides(
  moving: Omit<SnapCandidateRect, "id">,
  container: Omit<SnapCandidateRect, "id">,
  threshold: number,
): SnapLineGuide[] {
  const guides: SnapLineGuide[] = [];
  const movingX = moving.x + moving.width / 2;
  const movingY = moving.y + moving.height / 2;
  const centerX = container.x + container.width / 2;
  const centerY = container.y + container.height / 2;
  if (Math.abs(movingX - centerX) <= threshold)
    guides.push({
      kind: "line",
      axis: "x",
      position: centerX,
      start: container.y,
      end: container.y + container.height,
      markers: [movingY, centerY],
    });
  if (Math.abs(movingY - centerY) <= threshold)
    guides.push({
      kind: "line",
      axis: "y",
      position: centerY,
      start: container.x,
      end: container.x + container.width,
      markers: [movingX, centerX],
    });
  return guides;
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
  guideLines: readonly number[] = [],
): AxisSnap | null {
  let best: AxisSnap | null = null;
  // 수동 가이드가 먼저 — 동률이면 뒤에 오는 rect 가 이기지 않도록 `<` 비교를
  // 유지한다. 사용자가 명시적으로 놓은 선이므로 파생된 rect 라인과 같은
  // 거리면 가이드를 남긴다.
  for (const line of guideLines) {
    for (const edge of movingEdges) {
      const delta = line - edge;
      const distance = Math.abs(delta);
      if (distance > threshold) continue;
      if (!best || distance < Math.abs(best.delta)) {
        best = { delta, line };
      }
    }
  }
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
 * rect 하나의 정렬점 마커 수집 — 그 rect 의 어느 라인이 정렬선과 맞았는지에
 * 따라 edge(min/max) 매칭 = 그 변의 코너 2점, center 매칭 = 중심 1점
 * (Pen snapPointsForBounds 동형: 코너 4 + 중심 1 중 라인 위에 놓인 점).
 */
function collectMarkersForRect(
  axisLines: readonly [number, number, number],
  line: number,
  orthoMin: number,
  orthoMax: number,
  out: number[],
): void {
  if (
    Math.abs(axisLines[0] - line) <= LINE_MATCH_EPS ||
    Math.abs(axisLines[2] - line) <= LINE_MATCH_EPS
  ) {
    out.push(orthoMin, orthoMax);
  }
  if (Math.abs(axisLines[1] - line) <= LINE_MATCH_EPS) {
    out.push((orthoMin + orthoMax) / 2);
  }
}

/**
 * 흡착된 정렬선의 표시 구간 — 이동 박스(스냅 반영)와, 같은 라인을 공유하는
 * 모든 후보의 직교 축 구간 합집합 (Figma 동형: 정렬된 두 박스를 관통).
 * 정렬점 마커(직교 좌표)도 함께 수집한다 — 근접 중복은 제거.
 */
function buildGuide(
  axis: "x" | "y",
  line: number,
  movingAxisMin: number,
  movingAxisSize: number,
  movingOrthoMin: number,
  movingOrthoMax: number,
  candidates: readonly SnapCandidateRect[],
): SnapLineGuide {
  let start = movingOrthoMin;
  let end = movingOrthoMax;
  const rawMarkers: number[] = [];
  collectMarkersForRect(
    rectLines(movingAxisMin, movingAxisSize),
    line,
    movingOrthoMin,
    movingOrthoMax,
    rawMarkers,
  );
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
    collectMarkersForRect(lines, line, min, max, rawMarkers);
  }
  rawMarkers.sort((a, b) => a - b);
  const markers: number[] = [];
  for (const marker of rawMarkers) {
    if (
      markers.length === 0 ||
      marker - markers[markers.length - 1] > LINE_MATCH_EPS
    ) {
      markers.push(marker);
    }
  }
  return { kind: "line", axis, position: line, start, end, markers };
}

/**
 * 흡착 확정 위치에서 성립하는 정렬선 전부 수집 — 이동 박스의 3라인과
 * 어느 후보 라인이든 일치(EPS)하는 라인 위치를 중복 제거 후 각각
 * buildGuide 한다. 같은 크기 박스 정렬이면 상·중·하(또는 좌·중·우)
 * 3선이 동시에 나온다 (Figma/Pen recordedSnaps 동형).
 */
function collectMatchedLineGuides(
  axis: "x" | "y",
  movingAxisMin: number,
  movingAxisSize: number,
  movingOrthoMin: number,
  movingOrthoMax: number,
  candidates: readonly SnapCandidateRect[],
  guideLines: readonly number[] = [],
): SnapLineGuide[] {
  const movingEdges = rectLines(movingAxisMin, movingAxisSize);
  const linePositions: number[] = [];
  // 가이드에 맞았으면 그 선도 방출한다 — 안 그리면 "가이드 근처에 있을 뿐"과
  // "가이드에 붙었다" 가 구분되지 않는다 (가이드 자체는 상시 표시라 위치만으로
  // 흡착 여부를 알 수 없다).
  for (const line of guideLines) {
    if (!movingEdges.some((edge) => Math.abs(edge - line) <= LINE_MATCH_EPS)) {
      continue;
    }
    if (!linePositions.some((p) => Math.abs(p - line) <= LINE_MATCH_EPS)) {
      linePositions.push(line);
    }
  }
  for (const candidate of candidates) {
    const lines =
      axis === "x"
        ? rectLines(candidate.x, candidate.width)
        : rectLines(candidate.y, candidate.height);
    for (const line of lines) {
      if (
        !movingEdges.some((edge) => Math.abs(edge - line) <= LINE_MATCH_EPS)
      ) {
        continue;
      }
      if (!linePositions.some((p) => Math.abs(p - line) <= LINE_MATCH_EPS)) {
        linePositions.push(line);
      }
    }
  }
  linePositions.sort((a, b) => a - b);
  return linePositions.map((line) =>
    buildGuide(
      axis,
      line,
      movingAxisMin,
      movingAxisSize,
      movingOrthoMin,
      movingOrthoMax,
      candidates,
    ),
  );
}

// ============================================
// 등간격 스냅 (Phase 4)
// ============================================

/** 후보 rect 의 축 투영 — lo/hi 는 스냅 축, orthoLo/orthoHi 는 직교 축 */
interface AxisProjection {
  lo: number;
  hi: number;
  orthoLo: number;
  orthoHi: number;
}

interface AxisSpacingSnap {
  /** snapped - raw (이동 박스에 더할 보정량) */
  delta: number;
  /** 등간격 값 (scene px) */
  value: number;
  /** 스냅 확정 좌표 기준의 두 간격 구간 */
  segments: [SnapSpacingSegment, SnapSpacingSegment];
  /** cross 산출용 — 참여 이웃들의 직교 구간 */
  neighborOrtho: ReadonlyArray<{ lo: number; hi: number }>;
}

function projectCandidate(
  candidate: SnapCandidateRect,
  axis: "x" | "y",
): AxisProjection {
  return axis === "x"
    ? {
        lo: candidate.x,
        hi: candidate.x + candidate.width,
        orthoLo: candidate.y,
        orthoHi: candidate.y + candidate.height,
      }
    : {
        lo: candidate.y,
        hi: candidate.y + candidate.height,
        orthoLo: candidate.x,
        orthoHi: candidate.x + candidate.width,
      };
}

function considerSpacingProposal(
  best: AxisSpacingSnap | null,
  proposal: AxisSpacingSnap,
  threshold: number,
): AxisSpacingSnap | null {
  if (Math.abs(proposal.delta) > threshold) {
    return best;
  }
  if (!best || Math.abs(proposal.delta) < Math.abs(best.delta)) {
    return proposal;
  }
  return best;
}

/**
 * 등간격 흡착 제안 — 직교축이 raw 이동 박스와 겹치는 이웃("row/column")만
 * 대상으로 두 패턴을 판정한다.
 *
 * - between: 이동 박스 중심 기준 좌/우(상/하) 최근접 이웃 L/R 사이에
 *   양쪽 간격이 같아지는 지점 (컨테이너 rect 는 L.hi ≤ center ≤ R.lo
 *   자격 조건에서 자연 탈락 — 이동 박스를 포함하는 rect 는 이웃이 아니다).
 * - sequence: 서로 떨어진 인접 쌍 (A,B) 의 간격 g 를 리듬으로 삼아
 *   B 뒤 / A 앞에 같은 g 로 배치되는 지점. 쌍 사이 간격 안에 다른 이웃이
 *   포함되어 있으면 인접이 아니므로 제외.
 */
/** @internal 테스트 (`snapSpacing.test.ts`) 가 수정 전 구현과 동치를 대조한다 */
export function resolveAxisSpacingSnap(
  axis: "x" | "y",
  rawMin: number,
  movingLen: number,
  rawOrthoLo: number,
  rawOrthoHi: number,
  candidates: readonly SnapCandidateRect[],
  threshold: number,
): AxisSpacingSnap | null {
  const row: AxisProjection[] = [];
  for (const candidate of candidates) {
    const proj = projectCandidate(candidate, axis);
    const overlap =
      Math.min(proj.orthoHi, rawOrthoHi) - Math.max(proj.orthoLo, rawOrthoLo);
    if (overlap > 0) {
      row.push(proj);
    }
  }
  if (row.length === 0) {
    return null;
  }

  const rawCenter = rawMin + movingLen / 2;
  let best: AxisSpacingSnap | null = null;

  // ── between — 좌/우 최근접 이웃 사이 등간격 중앙 ──
  let left: AxisProjection | null = null;
  let right: AxisProjection | null = null;
  for (const proj of row) {
    if (proj.hi <= rawCenter && (!left || proj.hi > left.hi)) {
      left = proj;
    }
    if (proj.lo >= rawCenter && (!right || proj.lo < right.lo)) {
      right = proj;
    }
  }
  if (left && right && right.lo - left.hi > movingLen) {
    const gap = (right.lo - left.hi - movingLen) / 2;
    const target = left.hi + gap;
    best = considerSpacingProposal(
      best,
      {
        delta: target - rawMin,
        value: gap,
        segments: [
          { start: left.hi, end: target },
          { start: target + movingLen, end: right.lo },
        ],
        neighborOrtho: [
          { lo: left.orthoLo, hi: left.orthoHi },
          { lo: right.orthoLo, hi: right.orthoHi },
        ],
      },
      threshold,
    );
  }

  // ── sequence — 인접 쌍의 간격 리듬 연장 ──
  return resolveSequenceSpacing(row, rawMin, movingLen, threshold, best);
}

/**
 * sequence 탐색. 쌍 (a, b) 는 `b.lo - a.hi ≥ 0` 이고, 그 사이 구간 [a.hi − EPS, b.lo + EPS] 에
 * 통째로 들어가는 다른 이웃이 없을 때 인접이다.
 *
 * 쌍마다 모든 이웃을 다시 훑으면 O(r³) — 같은 열 형제 830 개에서 한 번에 수백 ms 였다
 * (2026-10-15 평평한 5,000 시드 drag p95 750 ms). 대신 이웃을 lo 순으로 정렬해 두고, 접미사마다
 * hi 가 가장 작은 세 개를 미리 구한다. "구간에 들어가는 다른 이웃이 있는가" 는 `lo ≥ a.hi − EPS`
 * 인 접미사에서 a · b 를 뺀 최소 hi 가 `b.lo + EPS` 이하인가와 같다. a 하나에 대해 b 는 lo 순으로
 * 보며, a 를 뺀 두 번째로 작은 hi 가 `b.lo + EPS` 이하가 되면 그 뒤의 b 는 전부 막힌다 (둘 중
 * 하나는 b 가 아니다).
 *
 * 결과는 종전과 같다: 제안 · 임계 판정이 같고, 같은 거리면 종전 순회 순서 (between → a 의 행 순서
 * → b 의 행 순서 → 뒤 배치 → 앞 배치) 에서 먼저 나온 제안이 이긴다 (`snapSpacing.test.ts` 동치).
 */
function resolveSequenceSpacing(
  row: readonly AxisProjection[],
  rawMin: number,
  movingLen: number,
  threshold: number,
  between: AxisSpacingSnap | null,
): AxisSpacingSnap | null {
  const n = row.length;
  const order: number[] = [];
  for (let i = 0; i < n; i++) order.push(i);
  const byLo = (p: number, q: number) => row[p].lo - row[q].lo || p - q;
  order.sort(byLo);
  // suffix[3p .. 3p+2] = order[p..] 중 hi 가 작은 세 행 번호 (-1 = 없음)
  const suffix = new Int32Array(3 * (n + 1)).fill(-1);
  for (let pos = n - 1; pos >= 0; pos--) {
    const idx = order[pos];
    const hi = row[idx].hi;
    let a = suffix[3 * pos + 3];
    let b = suffix[3 * pos + 4];
    let c = suffix[3 * pos + 5];
    if (a < 0 || hi < row[a].hi) {
      c = b;
      b = a;
      a = idx;
    } else if (b < 0 || hi < row[b].hi) {
      c = b;
      b = idx;
    } else if (c < 0 || hi < row[c].hi) {
      c = idx;
    }
    suffix[3 * pos] = a;
    suffix[3 * pos + 1] = b;
    suffix[3 * pos + 2] = c;
  }
  /** lo 가 bound 이상인 첫 위치 */
  const firstAtLeast = (bound: number) => {
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (row[order[mid]].lo >= bound) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  };

  let best = between;
  // 종전 순회 순서의 위치 — between 은 모든 sequence 제안보다 앞이다
  let bestI = -1;
  let bestJ = -1;
  let bestKind = 0;
  /** 이 제안이 지금 best 를 이기는가 — 이기면 위치를 기록한다 (객체는 호출부가 만든다) */
  const wins = (i: number, j: number, kind: 0 | 1, delta: number) => {
    const distance = Math.abs(delta);
    if (distance > threshold) return false;
    if (best) {
      const bestDistance = Math.abs(best.delta);
      if (distance > bestDistance) return false;
      if (
        distance === bestDistance &&
        (bestI < 0 ||
          bestI < i ||
          (bestI === i && (bestJ < j || (bestJ === j && bestKind <= kind))))
      )
        return false;
    }
    bestI = i;
    bestJ = j;
    bestKind = kind;
    return true;
  };

  for (let i = 0; i < n; i++) {
    const a = row[i];
    const blockFrom = firstAtLeast(a.hi - LINE_MATCH_EPS);
    // a 를 뺀 접미사의 hi 최소 두 행
    let m1 = -1;
    let m2 = -1;
    let m3 = -1;
    for (let t = 0; t < 3; t++) {
      const idx = suffix[3 * blockFrom + t];
      if (idx < 0 || idx === i) continue;
      if (m1 < 0) m1 = idx;
      else if (m2 < 0) m2 = idx;
      else m3 = idx;
    }
    for (let pos = firstAtLeast(a.hi); pos < n; pos++) {
      const j = order[pos];
      const b = row[j];
      const limit = b.lo + LINE_MATCH_EPS;
      if (m2 >= 0 && row[m2].hi <= limit) break;
      if (j === i) continue;
      const blocker = m1 !== j ? m1 : m2 >= 0 ? m2 : m3;
      if (blocker >= 0 && row[blocker].hi <= limit) continue;

      const gap = b.lo - a.hi;
      const neighborOrtho = [
        { lo: a.orthoLo, hi: a.orthoHi },
        { lo: b.orthoLo, hi: b.orthoHi },
      ];
      // B 뒤 배치: A | B | moving
      const afterTarget = b.hi + gap;
      if (wins(i, j, 0, afterTarget - rawMin))
        best = {
          delta: afterTarget - rawMin,
          value: gap,
          segments: [
            { start: a.hi, end: b.lo },
            { start: b.hi, end: afterTarget },
          ],
          neighborOrtho,
        };
      // A 앞 배치: moving | A | B
      const beforeTarget = a.lo - gap - movingLen;
      if (wins(i, j, 1, beforeTarget - rawMin))
        best = {
          delta: beforeTarget - rawMin,
          value: gap,
          segments: [
            { start: beforeTarget + movingLen, end: a.lo },
            { start: a.hi, end: b.lo },
          ],
          neighborOrtho,
        };
    }
  }
  return best;
}

/** 참여 rect 들의 직교 겹침 중앙 — 겹침이 비면 이동 박스 중앙 폴백 */
function resolveSpacingCross(
  spacing: AxisSpacingSnap,
  movingOrthoLo: number,
  movingOrthoHi: number,
): number {
  let lo = movingOrthoLo;
  let hi = movingOrthoHi;
  for (const ortho of spacing.neighborOrtho) {
    lo = Math.max(lo, ortho.lo);
    hi = Math.min(hi, ortho.hi);
  }
  if (hi > lo) {
    return (lo + hi) / 2;
  }
  return (movingOrthoLo + movingOrthoHi) / 2;
}

interface AxisResolution {
  delta: number;
  line: AxisSnap | null;
  spacing: AxisSpacingSnap | null;
}

/** 정렬선 vs 등간격 — 최근접 승, 동률은 정렬선 (기본 어포던스 우선) */
function pickAxisResolution(
  line: AxisSnap | null,
  spacing: AxisSpacingSnap | null,
): AxisResolution | null {
  if (line && spacing) {
    return Math.abs(spacing.delta) < Math.abs(line.delta)
      ? { delta: spacing.delta, line: null, spacing }
      : { delta: line.delta, line, spacing: null };
  }
  if (line) {
    return { delta: line.delta, line, spacing: null };
  }
  if (spacing) {
    return { delta: spacing.delta, line: null, spacing };
  }
  return null;
}

/**
 * 이동 박스의 raw 위치를 후보 6축·등간격 지점에 흡착시킨다.
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
  guideLines: SnapGuideLines = EMPTY_GUIDE_LINES,
): SnappedPositionResult {
  const resolvedX = pickAxisResolution(
    resolveAxisSnap(
      rectLines(raw.x, movingSize.width),
      candidates,
      "x",
      threshold,
      guideLines.x,
    ),
    resolveAxisSpacingSnap(
      "x",
      raw.x,
      movingSize.width,
      raw.y,
      raw.y + movingSize.height,
      candidates,
      threshold,
    ),
  );
  const resolvedY = pickAxisResolution(
    resolveAxisSnap(
      rectLines(raw.y, movingSize.height),
      candidates,
      "y",
      threshold,
      guideLines.y,
    ),
    resolveAxisSpacingSnap(
      "y",
      raw.y,
      movingSize.height,
      raw.x,
      raw.x + movingSize.width,
      candidates,
      threshold,
    ),
  );
  const x = raw.x + (resolvedX?.delta ?? 0);
  const y = raw.y + (resolvedY?.delta ?? 0);
  const guides: SnapGuide[] = [];
  // 구간·cross 는 스냅 반영 후 좌표 기준 — 양축이 동시에 흡착돼도 가이드가
  // 최종 박스를 기준으로 그려진다. 정렬선은 흡착 확정 위치에서 **성립하는
  // 라인 전부** 방출 (Figma/Pen 동형 — 같은 크기 정렬 시 상·중·하 3선.
  // Pen 은 recordedSnaps 배열로 동률 다중 기록, 단일 최근접 라인만 그리면
  // 나머지 성립 라인이 침묵한다).
  if (resolvedX?.line) {
    guides.push(
      ...collectMatchedLineGuides(
        "x",
        x,
        movingSize.width,
        y,
        y + movingSize.height,
        candidates,
        guideLines.x,
      ),
    );
  } else if (resolvedX?.spacing) {
    guides.push({
      kind: "spacing",
      axis: "x",
      value: resolvedX.spacing.value,
      cross: resolveSpacingCross(resolvedX.spacing, y, y + movingSize.height),
      segments: resolvedX.spacing.segments,
    });
  }
  if (resolvedY?.line) {
    guides.push(
      ...collectMatchedLineGuides(
        "y",
        y,
        movingSize.height,
        x,
        x + movingSize.width,
        candidates,
        guideLines.y,
      ),
    );
  } else if (resolvedY?.spacing) {
    guides.push({
      kind: "spacing",
      axis: "y",
      value: resolvedY.spacing.value,
      cross: resolveSpacingCross(resolvedY.spacing, x, x + movingSize.width),
      segments: resolvedY.spacing.segments,
    });
  }
  return {
    position: { x, y },
    guides,
    snappedX: resolvedX !== null,
    snappedY: resolvedY !== null,
  };
}
