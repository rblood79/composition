import type { FrameNode } from "@composition/shared";
import {
  getLegacyLayoutId,
  hasLegacyLayoutId,
  LEGACY_LAYOUT_ID_FIELD,
  withLegacyLayoutId,
} from "./legacyElementFields";

export const FRAME_ELEMENT_MIRROR_ID_FIELD = LEGACY_LAYOUT_ID_FIELD;

export function getNullablePageFrameBindingId(page: unknown): string | null {
  return getLegacyLayoutId(page);
}

export function getPageFrameBindingId(page: unknown): string {
  return getNullablePageFrameBindingId(page) ?? "";
}

export function withPageFrameBinding<T extends object>(
  page: T,
  frameId: string | null,
): T {
  return withLegacyLayoutId(page, frameId);
}

export function getReusableFrameMirrorId(frame: FrameNode): string {
  const metadata = frame.metadata as { layoutId?: unknown } | undefined;
  const rawId =
    typeof metadata?.layoutId === "string" && metadata.layoutId.length > 0
      ? metadata.layoutId
      : frame.id;
  return rawId.startsWith("layout-") ? rawId.slice("layout-".length) : rawId;
}

export function getFrameElementMirrorId(element: unknown): string | null {
  return getLegacyLayoutId(element);
}

export function isPageFrameProjectionElement(element: unknown): boolean {
  if (!element || typeof element !== "object") return false;
  const pageId = (element as { page_id?: unknown }).page_id;
  return (
    typeof pageId === "string" && getFrameElementMirrorId(element) !== null
  );
}

export function hasFrameElementMirrorId(value: unknown): boolean {
  return hasLegacyLayoutId(value);
}

export function withFrameElementMirrorId<T extends object>(
  element: T,
  frameId: string | null,
): T {
  return withLegacyLayoutId(element, frameId);
}
