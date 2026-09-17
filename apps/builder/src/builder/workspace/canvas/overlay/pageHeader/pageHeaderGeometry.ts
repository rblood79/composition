/**
 * ADR-221 — 페이지 헤더 DOM 층의 순수 기하.
 *
 * 헤더는 화면 px 고정 (높이 28 · 페이지 상단에서 8px 위) 이고 폭만 페이지 폭 × zoom 을
 * 따른다. **배치 계산에 쓰이는 값만** 이 파일이 소유한다 — 높이와 간격은 transform
 * 좌표(headerTransform)에 들어가므로 여기가 정본이고, CSS 는 `--page-header-height` 로
 * 같은 높이를 읽는다 (PageHeaderLayer.css).
 *
 * 헤더 **안쪽** 여백 (padding / 항목 gap) 은 배치 계산에 안 들어가므로 CSS 가 소유한다
 * (`--page-header-padding-x` = --spacing-xs, `.page-header { gap }` = --spacing-sm).
 * 종전 `PAGE_HEADER_PADDING_X` 는 Skia 시절 잔재로 소비처가 0 이었고 CSS 값과도
 * 어긋나 있어 제거했다 (2026-09-17).
 */

export const PAGE_HEADER_HEIGHT = 28;
export const PAGE_HEADER_GAP = 8;

export interface PageHeaderFrame {
  id: string;
  title?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HeaderCamera {
  zoom: number;
  panX: number;
  panY: number;
}

export interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ScenePoint {
  x: number;
  y: number;
}

/** 헤더 띠의 화면 rect — `position` 은 scene 좌표의 페이지 좌상단 (drag 델타 반영 뒤). */
export function pageHeaderScreenRect(
  position: ScenePoint,
  frame: Pick<PageHeaderFrame, "width">,
  camera: HeaderCamera,
): ScreenRect {
  return {
    left: position.x * camera.zoom + camera.panX,
    top:
      position.y * camera.zoom +
      camera.panY -
      (PAGE_HEADER_HEIGHT + PAGE_HEADER_GAP),
    width: frame.width * camera.zoom,
    height: PAGE_HEADER_HEIGHT,
  };
}

/**
 * 위 (페인트 순서 뒤) 페이지가 아래 페이지 헤더를 가리는 영역 — **body ∪ 헤더** 한 rect.
 * 헤더 폭 = 페이지 폭이라 합집합이 사각형 하나로 닫힌다 (round 1 m2).
 */
export function pageOccluderScreenRect(
  position: ScenePoint,
  frame: Pick<PageHeaderFrame, "width" | "height">,
  camera: HeaderCamera,
): ScreenRect {
  const headerTop =
    position.y * camera.zoom +
    camera.panY -
    (PAGE_HEADER_HEIGHT + PAGE_HEADER_GAP);
  const bodyBottom = (position.y + frame.height) * camera.zoom + camera.panY;
  return {
    left: position.x * camera.zoom + camera.panX,
    top: headerTop,
    width: frame.width * camera.zoom,
    height: bodyBottom - headerTop,
  };
}

function rectsIntersect(a: ScreenRect, b: ScreenRect): boolean {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  );
}

/**
 * `rect` 에서 `occluder` 를 뺀 나머지 중 **사각형 하나** 를 고른다 — clip-path 는 `inset()`
 * 하나만 쓰므로 (polygon 차집합 금지, R3) 네 방향 절단 후보 중 면적이 가장 큰 것을 남긴다.
 * 겹치지 않으면 `rect` 그대로, 전부 가리면 null.
 */
export function subtractRectKeepLargest(
  rect: ScreenRect,
  occluder: ScreenRect,
): ScreenRect | null {
  if (!rectsIntersect(rect, occluder)) return rect;
  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;
  const oRight = occluder.left + occluder.width;
  const oBottom = occluder.top + occluder.height;

  const candidates: ScreenRect[] = [];
  if (occluder.left > rect.left) {
    candidates.push({
      left: rect.left,
      top: rect.top,
      width: occluder.left - rect.left,
      height: rect.height,
    });
  }
  if (oRight < right) {
    candidates.push({
      left: oRight,
      top: rect.top,
      width: right - oRight,
      height: rect.height,
    });
  }
  if (occluder.top > rect.top) {
    candidates.push({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: occluder.top - rect.top,
    });
  }
  if (oBottom < bottom) {
    candidates.push({
      left: rect.left,
      top: oBottom,
      width: rect.width,
      height: bottom - oBottom,
    });
  }
  if (candidates.length === 0) return null;
  let best = candidates[0];
  for (const candidate of candidates) {
    if (candidate.width * candidate.height > best.width * best.height) {
      best = candidate;
    }
  }
  return best;
}

/**
 * 헤더 rect 에 위 페이지 occluder 들을 순차 적용해 남는 사각형 (3 겹침 이상은 순차 ∩).
 * 전부 가리면 null.
 */
export function resolveHeaderVisibleRect(
  header: ScreenRect,
  occluders: readonly ScreenRect[],
): ScreenRect | null {
  let remaining: ScreenRect | null = header;
  for (const occluder of occluders) {
    remaining = subtractRectKeepLargest(remaining, occluder);
    if (!remaining) return null;
  }
  return remaining;
}

/** `remaining` 을 헤더 로컬 좌표의 `inset(t r b l)` 로. 잘린 곳이 없으면 빈 문자열 (clip 해제). */
export function headerClipPath(
  header: ScreenRect,
  remaining: ScreenRect,
): string {
  const top = remaining.top - header.top;
  const left = remaining.left - header.left;
  const right = header.left + header.width - (remaining.left + remaining.width);
  const bottom =
    header.top + header.height - (remaining.top + remaining.height);
  if (top <= 0 && left <= 0 && right <= 0 && bottom <= 0) return "";
  return `inset(${fmtInset(top)}px ${fmtInset(right)}px ${fmtInset(bottom)}px ${fmtInset(left)}px)`;
}

function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function fmtInset(value: number): string {
  return fmt(value < 0 ? 0 : value);
}

export function isRectInViewport(
  rect: ScreenRect,
  viewport: { width: number; height: number },
): boolean {
  return (
    rect.left < viewport.width &&
    rect.left + rect.width > 0 &&
    rect.top < viewport.height &&
    rect.top + rect.height > 0
  );
}

export function headerTransform(rect: ScreenRect): string {
  return `translate3d(${fmt(rect.left)}px, ${fmt(rect.top)}px, 0)`;
}

export function headerWidthStyle(rect: ScreenRect): string {
  return `${fmt(rect.width)}px`;
}
