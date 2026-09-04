import {
  isElementInCanonicalFrameScope,
  type CanonicalFrameScopedNode,
  type CanonicalFrameElementScope,
} from "./frameElementScope";
import { getFrameElementMirrorId } from "./frameMirror";

interface FrameElementLike extends CanonicalFrameScopedNode {
  type: string;
  props?: Record<string, unknown>;
  parent_id?: string | null;
  page_id?: string | null;
  layout_id?: string | null;
}

export function isFrameElementForFrame<T extends FrameElementLike>(
  element: T,
  frameScope: CanonicalFrameElementScope,
): boolean {
  return isElementInCanonicalFrameScope(element, frameScope);
}

export function isLegacyFrameElementForFrame<T extends FrameElementLike>(
  element: T,
  frameId: string,
): boolean {
  return (
    !element.deleted &&
    getFrameElementMirrorId(element) === frameId &&
    element.page_id == null
  );
}
