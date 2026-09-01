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

export interface PageLayoutBounds {
  /** Canvas-local 폭에 panel 점유 폭과 양쪽 Page Gap을 더한 browser 전체 world 폭 */
  browserWidth: number;
  /** 첫 page가 시작하는 world 좌표 x */
  leftInset: number;
  /** 마지막 page 뒤에 남겨야 하는 world 좌표 폭 */
  rightInset: number;
  /** page와 page 사이의 gap을 포함한 page 배치 가능 world 폭 */
  availableWidth: number;
}

/**
 * Canvas-local 폭에서 browser 전체 폭과 page 배치 bounds를 계산한다.
 *
 * `containerWidth`에 실제 panel 점유 폭과 shell gap, panel↔page Page Gap을
 * 양쪽에서 더해 browser 전체 폭을 만든다. page는 그 전체 폭의 left/right
 * inset 사이에만 배치한다.
 * panel metrics는 screen px이고 page 위치·크기·Page Gap은 world 좌표이므로,
 * panel 점유 폭을 zoom으로 환산한 뒤 같은 좌표계에서 계산한다.
 */
export function resolvePageLayoutBounds(
  containerWidth: number,
  zoom: number,
  pageGap: number,
  panelMetrics: PageLayoutPanelMetrics = EMPTY_PAGE_LAYOUT_PANEL_METRICS,
): PageLayoutBounds {
  const safeContainerWidth = safeNonNegativeDimension(containerWidth);
  if (safeContainerWidth <= 0) {
    return {
      browserWidth: 0,
      leftInset: 0,
      rightInset: 0,
      availableWidth: 0,
    };
  }

  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const safePageGap = safeNonNegativeDimension(pageGap);
  const leftWidth = safeNonNegativeDimension(panelMetrics.leftWidth);
  const rightWidth = safeNonNegativeDimension(panelMetrics.rightWidth);
  const panelGap = safeNonNegativeDimension(panelMetrics.gap);
  const leftPanelExtent = leftWidth > 0 ? leftWidth + panelGap : 0;
  const rightPanelExtent = rightWidth > 0 ? rightWidth + panelGap : 0;
  const leftInset =
    leftPanelExtent / safeZoom + (leftPanelExtent > 0 ? safePageGap : 0);
  const rightInset =
    rightPanelExtent / safeZoom + (rightPanelExtent > 0 ? safePageGap : 0);
  const browserWidth = safeContainerWidth / safeZoom + leftInset + rightInset;

  return {
    browserWidth,
    leftInset,
    rightInset,
    availableWidth: Math.max(0, browserWidth - leftInset - rightInset),
  };
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
