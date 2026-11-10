/**
 * chrome 층의 실효 CSS zoom — UI 배율 (`.app > .panel-workspace { zoom }`, builder-system.css).
 *
 * 포인터 좌표 (`clientX` · useMove `deltaX`) 는 viewport px 이고, 패널 레이아웃 (frame x/y ·
 * 폭 · 높이) 은 zoom 안쪽 px 이다. 끌기 델타를 이 값으로 나누지 않으면 UI 배율 L 에서 가장자리가
 * 커서보다 1.2 배 앞서고 S 에서는 뒤처진다 (2026-11-11 live: 100px 끌기 → 120px).
 * 지원하지 않는 환경 (jsdom) 은 1.
 */
export function effectiveCssZoom(element: Element | null | undefined): number {
  const zoom = (element as { currentCSSZoom?: unknown } | null | undefined)
    ?.currentCSSZoom;
  return typeof zoom === "number" && zoom > 0 ? zoom : 1;
}
