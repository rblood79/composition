/**
 * ADR-150 A2' — 가상화 collection 의 **행 위치 단일 소스**.
 *
 * window index · lead/trail spacer · 행 영역 높이 · maxScrollTop 을 한 함수가 산출한다. scene
 * spacer (canvasSceneNode) 와 스크롤 범위 주입 (BuilderCanvas) 은 이 결과만 읽는다 — 값을 따로
 * 계산하는 자리를 두지 않는다 (ADR-160 "행 metric 한 곳" 원칙의 window 경로 확장).
 *
 * 좌표 규약 (CSS overflow scroll · fullTreeLayout GAP 4 와 같다):
 * - 행 j 의 top (행 영역 기준) = Σ_{i<j} (h_i + gap). 행 영역 높이 = Σ h_i + (n − 1)·gap.
 * - 행 영역은 owner border-box top 에서 `leadingExtent` (border-top + padding-top + 헤더 블록) 아래에서 시작한다.
 * - scroll content 끝 = leadingExtent + 행 영역 + `trailingExtent` (padding-bottom + border-bottom).
 * - maxScrollTop = scroll content 끝 − owner border-box 높이 (`viewportHeight`).
 *
 * spacer 는 행 묶음 (flex column / grid) 의 자식이라 이웃과의 사이에 gap 이 한 번씩 들어간다.
 * 그래서 lead = top(s) − gap, trail = 행 영역 − top(e) — 첫 window 행이 정확히 top(s) 에 온다.
 *
 * 행 높이는 균일 값 (O(1) 경로) 또는 시각 행별 목록 (누적합 + 이분 탐색) 이다. 목록은 호출자가
 * 행 데이터 · metric 이 바뀔 때만 만든다 — 이 함수는 스크롤마다 불려도 목록을 다시 만들지 않는다.
 */

export interface CollectionRowOffsetInput {
  /** 시각 행 수 (GridList grid 는 ceil(항목 / 열)). */
  visualRowCount: number;
  /** 균일 시각 행 높이, 또는 시각 행별 높이 목록 (길이 = visualRowCount). */
  rowHeights: number | readonly number[];
  /** 시각 행 사이 gap (행 묶음 rowGap). */
  gap: number;
  /** owner border-box top 에서 행 영역 시작까지 (border-top + padding-top + 헤더 블록). */
  leadingExtent: number;
  /** 행 영역 끝에서 scroll content 끝까지 (padding-bottom + border-bottom). */
  trailingExtent: number;
  /** owner border-box 높이 (`style.height`). */
  viewportHeight: number;
  /** 현재 scrollTop. */
  scrollTop: number;
  /** viewport 위/아래 여유 시각 행 수. */
  overscan: number;
  /**
   * 스크롤과 무관하게 투영할 시각 행 구간 (ADR-157 sample 모드 — 앞 N 행 + hatch). 주면
   * scrollTop · overscan 으로 window 를 구하지 않는다.
   */
  fixedWindow?: { startVisual: number; endVisual: number };
}

export interface CollectionRowOffsets {
  /** 투영할 시각 행 [startVisual, endVisual). */
  startVisual: number;
  endVisual: number;
  /** 행 묶음 첫 자식 spacer 높이 (startVisual 0 이면 0 — spacer 없음). */
  leadSpacer: number;
  /** 행 묶음 마지막 자식 spacer 높이 (endVisual = visualRowCount 면 0 — spacer 없음). */
  trailSpacer: number;
  /** 행 영역 높이 = Σ h + (n − 1)·gap. */
  rowsExtent: number;
  /** leadingExtent + rowsExtent + trailingExtent − viewportHeight (≥ 0). */
  maxScrollTop: number;
  /** 모든 행 높이가 같은가 (균일 입력이거나 목록 값이 전부 같음). */
  uniform: boolean;
}

/** 시각 행 top 누적합 (길이 n + 1, top[n] = Σ (h + gap)). */
function buildTops(heights: readonly number[], gap: number): Float64Array {
  const tops = new Float64Array(heights.length + 1);
  for (let i = 0; i < heights.length; i += 1) {
    tops[i + 1] = tops[i] + heights[i] + gap;
  }
  return tops;
}

/** tops 에서 bottom (= top + h) 이 y 보다 큰 첫 행. 없으면 n. */
function firstRowEndingAfter(
  tops: Float64Array,
  gap: number,
  y: number,
): number {
  const n = tops.length - 1;
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const bottom = tops[mid + 1] - gap;
    if (bottom > y) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/** tops 에서 top 이 y 이상인 첫 행. 없으면 n. */
function firstRowStartingAtOrAfter(tops: Float64Array, y: number): number {
  const n = tops.length - 1;
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (tops[mid] >= y) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

function allEqual(values: readonly number[]): boolean {
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] !== values[0]) return false;
  }
  return true;
}

export function resolveCollectionRowOffsets(
  input: CollectionRowOffsetInput,
): CollectionRowOffsets {
  const n = Math.max(0, input.visualRowCount);
  const gap = Math.max(0, input.gap);
  const overscan = Math.max(0, input.overscan);
  const heights =
    typeof input.rowHeights === "number" ? null : input.rowHeights;
  const uniformHeight =
    typeof input.rowHeights === "number"
      ? input.rowHeights
      : heights && heights.length > 0 && allEqual(heights)
        ? heights[0]
        : null;

  if (n === 0) {
    return {
      startVisual: 0,
      endVisual: 0,
      leadSpacer: 0,
      trailSpacer: 0,
      rowsExtent: 0,
      maxScrollTop: Math.max(
        0,
        input.leadingExtent + input.trailingExtent - input.viewportHeight,
      ),
      uniform: true,
    };
  }

  const visibleTop = input.scrollTop - input.leadingExtent;
  const visibleBottom = visibleTop + input.viewportHeight;

  let rowsExtent: number;
  let topOf: (j: number) => number;
  let firstVisible: number;
  let endVisible: number;

  if (uniformHeight != null) {
    const stride = uniformHeight + gap;
    rowsExtent = n * uniformHeight + (n - 1) * gap;
    topOf = (j) => j * stride;
    // bottom(j) = j·stride + h > visibleTop 인 첫 j.
    firstVisible =
      stride > 0
        ? Math.min(
            n,
            Math.max(0, Math.floor((visibleTop - uniformHeight) / stride) + 1),
          )
        : 0;
    // top(j) ≥ visibleBottom 인 첫 j.
    endVisible =
      stride > 0
        ? Math.min(n, Math.max(0, Math.ceil(visibleBottom / stride)))
        : n;
  } else {
    const tops = buildTops(heights!, gap);
    rowsExtent = tops[n] - gap;
    topOf = (j) => tops[j];
    firstVisible = firstRowEndingAfter(tops, gap, visibleTop);
    endVisible = firstRowStartingAtOrAfter(tops, visibleBottom);
  }

  if (endVisible < firstVisible) endVisible = firstVisible;
  const startVisual = input.fixedWindow
    ? Math.min(n, Math.max(0, input.fixedWindow.startVisual))
    : Math.max(0, firstVisible - overscan);
  const endVisual = input.fixedWindow
    ? Math.min(n, Math.max(startVisual, input.fixedWindow.endVisual))
    : Math.min(n, endVisible + overscan);

  const leadSpacer = startVisual > 0 ? topOf(startVisual) - gap : 0;
  const trailSpacer = endVisual < n ? rowsExtent - topOf(endVisual) : 0;
  const maxScrollTop = Math.max(
    0,
    input.leadingExtent +
      rowsExtent +
      input.trailingExtent -
      input.viewportHeight,
  );

  return {
    startVisual,
    endVisual,
    leadSpacer,
    trailSpacer,
    rowsExtent,
    maxScrollTop,
    uniform: uniformHeight != null,
  };
}
