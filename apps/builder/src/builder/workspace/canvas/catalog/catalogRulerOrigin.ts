import type { CatalogSessionState } from "../../../catalogRuntime/session";

/** 활성 pageId는 초기 로드·선택 해제에도 남는다. 실제 선택이 있을 때만 page 원점을 쓴다. */
export function catalogRulerOrigin(
  state: Pick<CatalogSessionState, "pageId" | "selection" | "definitionView">,
  frames: ReadonlyMap<string, { x: number; y: number }>,
): { x: number; y: number } | null {
  if (!state.selection.length || !state.pageId || state.definitionView)
    return null;
  const frame = frames.get(state.pageId);
  return frame ? { x: frame.x, y: frame.y } : null;
}
