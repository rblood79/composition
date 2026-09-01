/** 모든 page/frame canvas 사이의 기본 간격 */
export const PAGE_STACK_GAP = 80;

/**
 * 화면에 보이는 폭을 page 위치가 저장되는 world 좌표 폭으로 환산한다.
 * page 폭과 간격은 world 좌표이므로 zoom은 여기서만 역산한다.
 */
export function resolvePageLayoutAvailableWidth(
  containerWidth: number,
  zoom: number,
): number {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) return 0;

  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return containerWidth / safeZoom;
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
