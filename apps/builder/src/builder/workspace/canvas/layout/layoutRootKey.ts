import type { CanvasLayoutNode } from "./layoutNode";

const LAYOUT_ID_PREFIX = "layout-";

/** The frame (layout) id a body carries, without the `layout-` prefix. */
function frameLayoutIdOf(node: CanvasLayoutNode): string | null {
  const raw = node.layoutId;
  if (typeof raw !== "string") return null;
  return raw.startsWith(LAYOUT_ID_PREFIX)
    ? raw.slice(LAYOUT_ID_PREFIX.length)
    : raw;
}

/**
 * Layout publication의 root partition을 결정하는 단일 규칙.
 *
 * page body와 reusable frame body가 같은 persistent/layout map을 공유하지
 * 않도록 publisher, cache, engine이 모두 이 helper를 사용한다.
 */
export function getLayoutRootKey(bodyElement: CanvasLayoutNode): string {
  return bodyElement.page_id ?? frameLayoutIdOf(bodyElement) ?? bodyElement.id;
}
