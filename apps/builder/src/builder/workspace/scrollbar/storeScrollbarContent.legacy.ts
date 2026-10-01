import { useStore } from "../../stores";
import { useEditModeStore } from "../../stores/editMode";
import { useViewportSyncStore } from "../canvas/stores";
import type { ContentRect } from "./calculateWorldBounds";
import type { CanvasScrollbarContent } from "./CanvasScrollbar";

/**
 * ADR-248 4e-7: the old element store's scrollbar content (moved out of `viewportMetrics.ts` so
 * the catalog Builder's graph does not reach the old store). Goes with the old store.
 */
/**
 * 스크롤 대상이 되는 아트보드 rect 목록.
 *
 * 아트보드 크기는 `canvasSize`(= breakpoint 페이지 크기)다 — `panToPage` 가 페이지 중심을
 * `pos + canvasSize/2` 로 잡는 것과 같은 의미. frame 편집 모드에서는 캔버스가 페이지를
 * 비우고 프레임만 그리므로(`BuilderCanvas` 의 `isFrameEditMode ? [] : pages`) 대상도 그에
 * 맞춰 갈린다 — 섞으면 프레임 편집 중 스크롤 범위가 전 페이지로 부풀어 오른다.
 */
function collectStoreContentRects(canvasSize: {
  width: number;
  height: number;
}): ContentRect[] {
  const { derivedPagePositions: pagePositions, framePositions } =
    useStore.getState();
  const isFrameEditMode = useEditModeStore.getState().mode === "layout";
  const positions = isFrameEditMode ? framePositions : pagePositions;

  const rects: ContentRect[] = [];
  for (const position of Object.values(positions ?? {})) {
    if (!position) continue;
    rects.push({
      x: position.x,
      y: position.y,
      width: canvasSize.width,
      height: canvasSize.height,
    });
  }
  return rects;
}

/** The old store's artboards: page (or layout-mode frame) positions; moves on its version. */
export const STORE_SCROLLBAR_CONTENT: CanvasScrollbarContent = {
  rects: () =>
    collectStoreContentRects(useViewportSyncStore.getState().canvasSize),
  subscribe(notify) {
    let last = useStore.getState().derivedPagePositionsVersion;
    return useStore.subscribe((state) => {
      if (state.derivedPagePositionsVersion === last) return;
      last = state.derivedPagePositionsVersion;
      notify();
    });
  },
};
