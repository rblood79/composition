import { useStore } from "../../../stores";
import { useViewportSyncStore } from "../stores";
import { PAGE_STACK_GAP } from "../pageLayoutConstants";

/**
 * 현재 breakpoint의 page 크기와 Settings의 배치 방향으로 모든 page를 재배치한다.
 * breakpoint 전환 자체는 page 위치를 변경하지 않으며, 이 명시적 command만 호출한다.
 */
export function alignPagesToScreen(): void {
  const { canvasSize } = useViewportSyncStore.getState();
  const { initializePagePositions, pageLayoutDirection, pages } =
    useStore.getState();

  if (pages.length === 0 || canvasSize.width <= 0 || canvasSize.height <= 0) {
    return;
  }

  initializePagePositions(
    pages,
    canvasSize.width,
    canvasSize.height,
    PAGE_STACK_GAP,
    pageLayoutDirection,
  );
}
