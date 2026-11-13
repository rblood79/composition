/**
 * S2 Breadcrumbs collapse (`@react-spectrum/s2` 1.8.2 `Breadcrumbs.tsx` `useCollectionRender`) — one
 * judgement the Canvas (`CatalogCompositionRoot.settleBreadcrumbs`) and the DOM (`BreadcrumbsRun`)
 * both read, each from its own laid-out boxes with every crumb shown: which crumbs stay when the
 * crumbs do not fit or are more than four. A collapsed Breadcrumbs shows its first crumb, a folder
 * menu of the crumbs between (S2 `BreadcrumbMenu`) and its last one or two crumbs.
 */

/** S2 `MAX_VISIBLE_ITEMS` · `MIN_VISIBLE_ITEMS`. */
const MAX_VISIBLE_ITEMS = 4;
const MIN_VISIBLE_ITEMS = 1;

/**
 * The folder menu crumb (S2 `BreadcrumbMenu` — desktop px; the DOM's are the device lengths): a quiet
 * ActionButton M (`controlSize()` 32 square — icon only) around the folder glyph (`1lh` of the M
 * font — 18), then the crumb separator (its own size — S2 `chevronStyles` `isMenu` start margin 0),
 * the whole crumb pulled back by the list gap (`breadcrumbStyles` `marginStart: { isMenu: size(-6) }`).
 */
export const CATALOG_BREADCRUMB_MENU = {
  button: 32,
  glyph: 18,
  marginStart: -6,
} as const;

/**
 * How many crumbs S2 keeps at the end (`visibleItems`): every crumb when they fit in the list
 * (`widths` — each crumb box with every crumb shown, the last one current) and are at most four;
 * otherwise as many trailing crumbs (1 · 2) as fit after the first crumb and the folder button.
 * S2 measures `offsetWidth + 1` per crumb and the list's `offsetWidth` · `gap` as integers.
 */
export function catalogBreadcrumbsVisibleCount(
  widths: readonly number[],
  listWidth: number,
  gap: number,
  folderWidth: number,
): number {
  const size = widths.length;
  if (!size) return 0;
  // (A list with no laid-out box — no layout yet, a jsdom document — keeps every crumb.)
  if (!(listWidth > 0)) return size;
  const crumbs = widths.map((width) => Math.floor(width) + 1);
  const containerWidth = Math.floor(listWidth);
  const containerGap = Math.floor(gap);
  const totalWidth = crumbs.reduce((sum, width) => sum + width, 0);
  if (
    totalWidth <= containerWidth - size * containerGap &&
    size <= MAX_VISIBLE_ITEMS
  )
    return size;
  const [widthOfFirst, ...rest] = crumbs;
  // (S2's folder gap is the hidden ActionButton's start margin — 0.)
  let availableWidth =
    containerWidth - widthOfFirst! - folderWidth - containerGap;
  let visible = 0;
  for (const width of rest.reverse()) {
    availableWidth -= width;
    if (availableWidth <= 0) break;
    availableWidth -= containerGap;
    visible++;
  }
  return Math.max(MIN_VISIBLE_ITEMS, Math.min(MAX_VISIBLE_ITEMS - 2, visible));
}

/**
 * S2 renders the collapsed list when `visibleItems < collection.size && collection.size > 2`: the
 * crumbs between the first and the `visible` last go to the folder menu (none when only the first
 * one is left out of the end — S2 still draws the folder then). `undefined` = every crumb shows.
 */
export function catalogBreadcrumbsCollapse<T>(
  crumbs: readonly T[],
  visible: number,
): { readonly hidden: readonly T[] } | undefined {
  if (!(visible < crumbs.length && crumbs.length > 2)) return undefined;
  return { hidden: crumbs.slice(1, crumbs.length - visible) };
}
