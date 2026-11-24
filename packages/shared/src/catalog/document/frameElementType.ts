import type { PropContract } from "../types";

/**
 * A frame's HTML element (사용자 결정 2026-11-24). The frame is the builder's one layout box; what it
 * is in the page — the main content, a section, the header, the navigation — is its element. The box (D3) is the
 * frame's whatever the element: the Canvas does not read this, the Preview · Publish DOM write the
 * tag. No ARIA role is written (ADR-130) — the element is the meaning.
 *
 * D2: no upstream prop (S2 · RAC have no layout box) — a composition extension named after RAC
 * `Text`'s `elementType` (`d2Provenance.ts`). It replaces the Section component (deleted 2026-11-24 — a
 * `div` box). The Nav component stays: it draws a real `<nav>` with a label and the current route.
 */
export const CATALOG_FRAME_ELEMENT_TYPES = [
  "div",
  // (The page's main content — one per page is HTML's rule; the author's to keep, not enforced.)
  "main",
  "section",
  "header",
  "footer",
  "nav",
  "article",
  "aside",
] as const;

export type CatalogFrameElementType =
  (typeof CATALOG_FRAME_ELEMENT_TYPES)[number];

const ELEMENT_TYPES: ReadonlySet<string> = new Set(CATALOG_FRAME_ELEMENT_TYPES);

export const FRAME_ELEMENT_TYPE_PROP: PropContract = {
  kind: "enum",
  label: "HTML tag",
  section: "accessibility",
  default: "div",
  // (The tags as written in HTML — not translated.)
  options: CATALOG_FRAME_ELEMENT_TYPES.map((value) => ({
    value,
    label: value,
  })),
};

/** The element a frame is drawn as — a value outside the list is a `div`. */
export function catalogFrameElementType(
  props: Readonly<Record<string, unknown>>,
): CatalogFrameElementType {
  const value = props.elementType;
  return typeof value === "string" && ELEMENT_TYPES.has(value)
    ? (value as CatalogFrameElementType)
    : "div";
}

/**
 * The frame's Layers name when it has none of its own: its element when that says something (not a
 * `div`), else 「Frame」.
 */
export function catalogFrameLayerName(
  props: Readonly<Record<string, unknown>>,
): string {
  const element = catalogFrameElementType(props);
  return element === "div" ? "Frame" : element;
}
