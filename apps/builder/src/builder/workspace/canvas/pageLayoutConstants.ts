/** 모든 page/frame canvas 사이의 기본 간격 */
export const PAGE_STACK_GAP = 80;

export interface PageLayoutPanelMetrics {
  leftWidth: number;
  rightWidth: number;
  gap: number;
}

const EMPTY_PAGE_LAYOUT_PANEL_METRICS: PageLayoutPanelMetrics = {
  leftWidth: 0,
  rightWidth: 0,
  gap: 0,
};

function safeNonNegativeDimension(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Canvas-local 폭에 좌·우 panel과 panel↔canvas gap을 더한 browser 폭을 구한다.
 * PanelWorkspace는 overlay 구조라 viewport containerSize 자체는 바꾸지 않고,
 * page auto 배치의 폭만 이 값으로 확장한다.
 */
export function resolvePageLayoutBrowserWidth(
  containerWidth: number,
  panelMetrics: PageLayoutPanelMetrics = EMPTY_PAGE_LAYOUT_PANEL_METRICS,
): number {
  const safeContainerWidth = safeNonNegativeDimension(containerWidth);
  const leftWidth = safeNonNegativeDimension(panelMetrics.leftWidth);
  const rightWidth = safeNonNegativeDimension(panelMetrics.rightWidth);
  const gap = safeNonNegativeDimension(panelMetrics.gap);

  return (
    safeContainerWidth +
    leftWidth +
    rightWidth +
    (leftWidth > 0 ? gap : 0) +
    (rightWidth > 0 ? gap : 0)
  );
}

/**
 * 화면에 보이는 폭을 page 위치가 저장되는 world 좌표 폭으로 환산한다.
 * page 폭과 간격은 world 좌표이므로 zoom은 여기서만 역산한다.
 */
export function resolvePageLayoutAvailableWidth(
  containerWidth: number,
  zoom: number,
  panelMetrics: PageLayoutPanelMetrics = EMPTY_PAGE_LAYOUT_PANEL_METRICS,
): number {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) return 0;

  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return resolvePageLayoutBrowserWidth(containerWidth, panelMetrics) / safeZoom;
}

/** auto 레이아웃에서 한 줄에 배치할 page 수를 계산한다. */
export function resolveAutoPageColumnCount(
  pageWidth: number,
  gap: number,
  availableWidth: number,
): number {
  if (
    !Number.isFinite(pageWidth) ||
    pageWidth <= 0 ||
    !Number.isFinite(gap) ||
    gap < 0 ||
    !Number.isFinite(availableWidth) ||
    availableWidth <= 0
  ) {
    return 1;
  }

  return Math.max(1, Math.floor((availableWidth + gap) / (pageWidth + gap)));
}
