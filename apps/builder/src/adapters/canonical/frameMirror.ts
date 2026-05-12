import type { FrameNode } from "@composition/shared";
import {
  getLegacyLayoutId,
  LEGACY_LAYOUT_ID_FIELD,
  withLegacyLayoutId,
} from "./legacyElementFields";

export const FRAME_ELEMENT_MIRROR_ID_FIELD = LEGACY_LAYOUT_ID_FIELD;

const LAYOUT_ID_PREFIX = "layout-";

function normalizeLayoutId(rawId: string): string {
  if (!rawId.length) return rawId;
  return rawId.startsWith(LAYOUT_ID_PREFIX)
    ? rawId.slice(LAYOUT_ID_PREFIX.length)
    : rawId;
}

export function normalizeFrameLayoutId(
  rawId: string | null | undefined,
): string | null {
  return typeof rawId === "string" ? normalizeLayoutId(rawId) : null;
}

type LegacyOrCanonicalLayoutIdHolder = {
  [LEGACY_LAYOUT_ID_FIELD]?: unknown;
  layoutId?: unknown;
};

function asLayoutHolder(
  value: unknown,
): LegacyOrCanonicalLayoutIdHolder | null {
  return value && typeof value === "object"
    ? (value as LegacyOrCanonicalLayoutIdHolder)
    : null;
}

function getLegacyOrCanonicalLayoutId(value: unknown): string | null {
  const legacyLayoutId = getLegacyLayoutId(value);
  if (legacyLayoutId !== null) return normalizeLayoutId(legacyLayoutId);

  const fields = asLayoutHolder(value);
  const layoutId = fields?.layoutId;
  return typeof layoutId === "string" ? normalizeLayoutId(layoutId) : null;
}

export function getNullablePageFrameBindingId(page: unknown): string | null {
  return getLegacyOrCanonicalLayoutId(page);
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
  return normalizeLayoutId(rawId);
}

export function getFrameElementMirrorId(element: unknown): string | null {
  return getLegacyOrCanonicalLayoutId(element);
}

export function isPageFrameProjectionElement(element: unknown): boolean {
  if (!element || typeof element !== "object") return false;
  const pageId = (element as { page_id?: unknown }).page_id;
  return (
    typeof pageId === "string" && getFrameElementMirrorId(element) !== null
  );
}

export function hasFrameElementMirrorId(value: unknown): boolean {
  return getFrameElementMirrorId(value) !== null;
}

export function withFrameElementMirrorId<T extends object>(
  element: T,
  frameId: string | null,
): T {
  return withLegacyLayoutId(element, frameId);
}
