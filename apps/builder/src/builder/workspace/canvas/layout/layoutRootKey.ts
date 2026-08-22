import { getFrameElementMirrorId } from "../../../../adapters/canonical/frameMirror";
import type { CanvasLayoutNode } from "./layoutNode";

/**
 * Layout publication의 root partition을 결정하는 단일 규칙.
 *
 * page body와 reusable frame body가 같은 persistent/layout map을 공유하지
 * 않도록 publisher, cache, engine이 모두 이 helper를 사용한다.
 */
export function getLayoutRootKey(bodyElement: CanvasLayoutNode): string {
  return (
    bodyElement.page_id ??
    getFrameElementMirrorId(bodyElement) ??
    bodyElement.id
  );
}
