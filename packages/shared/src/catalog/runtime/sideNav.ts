import { resolveStaticItemKey } from "../slotRoles";
import type { CatalogConsumerNode } from "./compositionRoot";

/**
 * ADR-300 — the S2 SideNav family's place-derived state, one reading for the Canvas (presence ·
 * derived props · paint conditions) and the Preview DOM (the binding's effective keys):
 *
 * - **collapse** (Decision 3): a SideNavPanel's `isCollapsed` (`defaultCollapsed` while unset) reaches
 *   every node below it — the nearest panel wins (S2 `SideNavPanelContext`, the DOM's
 *   `[data-side-panel-collapsed]` ancestor).
 * - **effective expanded keys** (Decision 4): a collapsed panel's nav renders every item closed —
 *   the stored `expandedKeys` stay (S2 `SideNav.tsx` `visibleExpandedKeys`).
 * - **current route** (Decision 5): an item is current when its `href` is the nav's `selectedRoute`
 *   (RAC `NavigationTree` `isCurrent`), an ancestor of the current item is `isCurrentAncestor`; S2
 *   marks the closed current ancestor like the current row (`isDescendantSelected`).
 */

type Lookup = (id: string) => CatalogConsumerNode | undefined;
type TypeOf = (node: CatalogConsumerNode) => string;

const ITEM = "SideNavItem";
const NAV_PARTS: ReadonlySet<string> = new Set([
  "SideNavItem",
  "SideNavSection",
]);

/** The nearest SideNavPanel at or above `node`. */
export function catalogSideNavPanelOf(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode | undefined {
  const seen = new Set<string>();
  for (
    let cursor: CatalogConsumerNode | undefined = node;
    cursor && !seen.has(cursor.id);
    cursor = get(cursor.parentId)
  ) {
    seen.add(cursor.id);
    if (typeOf(cursor) === "SideNavPanel") return cursor;
  }
  return undefined;
}

/** A panel's collapse: `isCollapsed`, `defaultCollapsed` while that is unset (S2 controlled state). */
export function catalogSideNavPanelCollapsed(
  panel: CatalogConsumerNode,
): boolean {
  const own = panel.props.isCollapsed;
  return typeof own === "boolean" ? own : panel.props.defaultCollapsed === true;
}

/** Whether the nearest panel at or above `node` is collapsed. */
export function catalogSideNavCollapsed(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): boolean {
  const panel = catalogSideNavPanelOf(node, get, typeOf);
  return !!panel && catalogSideNavPanelCollapsed(panel);
}

/** The SideNav an item · section belongs to (through its parent items and sections). */
export function catalogSideNavOf(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode | undefined {
  let cursor = get(node.parentId);
  while (cursor && NAV_PARTS.has(typeOf(cursor))) cursor = get(cursor.parentId);
  return cursor && typeOf(cursor) === "SideNav" ? cursor : undefined;
}

/** An item's RAC key (its `id` — `resolveStaticItemKey`). */
export function catalogSideNavItemKey(item: CatalogConsumerNode): string {
  return resolveStaticItemKey(item.props as Record<string, unknown>, item.id);
}

function keyList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return typeof value === "string" && value ? [value] : [];
}

/** A nav's stored expanded keys — `expandedKeys`, `defaultExpandedKeys` while that is unset. */
export function catalogSideNavStoredKeys(nav: CatalogConsumerNode): string[] {
  return Array.isArray(nav.props.expandedKeys)
    ? keyList(nav.props.expandedKeys)
    : keyList(nav.props.defaultExpandedKeys);
}

/** Decision 4 — the keys RAC gets: none in a collapsed panel, else the stored ones. */
export function catalogSideNavEffectiveKeys(
  nav: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
  stored: readonly string[] = catalogSideNavStoredKeys(nav),
): string[] {
  return catalogSideNavCollapsed(nav, get, typeOf) ? [] : [...stored];
}

/** Whether an item is open (its child items shown) — its nav's effective keys. */
export function catalogSideNavItemExpanded(
  item: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): boolean {
  const nav = catalogSideNavOf(item, get, typeOf);
  if (!nav) return false;
  return catalogSideNavEffectiveKeys(nav, get, typeOf).includes(
    catalogSideNavItemKey(item),
  );
}

/** An item's child items. */
export function catalogSideNavChildItems(
  item: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode[] {
  return item.children
    .map((id) => get(id))
    .filter(
      (child): child is CatalogConsumerNode =>
        !!child && typeOf(child) === ITEM,
    );
}

/** The route a nav marks — its `selectedRoute` (the page route default comes with Phase 2). */
export function catalogSideNavRoute(
  nav: CatalogConsumerNode,
): string | undefined {
  const route = nav.props.selectedRoute;
  return typeof route === "string" && route ? route : undefined;
}

/** RAC `isCurrent` · `isCurrentAncestor` of an item for a route. */
export function catalogSideNavItemCurrent(
  item: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
  route: string | undefined,
): { isCurrent: boolean; isCurrentAncestor: boolean } {
  if (!route) return { isCurrent: false, isCurrentAncestor: false };
  const isCurrent = item.props.href === route;
  const below = (node: CatalogConsumerNode): boolean =>
    catalogSideNavChildItems(node, get, typeOf).some(
      (child) => child.props.href === route || below(child),
    );
  return { isCurrent, isCurrentAncestor: below(item) };
}

/** Its item's level (1 = a child of the nav or a section). */
export function catalogSideNavItemLevel(
  item: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): number {
  let level = 1;
  for (
    let cursor = get(item.parentId);
    cursor && typeOf(cursor) === ITEM;
    cursor = get(cursor.parentId)
  )
    level += 1;
  return level;
}

/** The item whose row `node` sits in (its SideNavItemContent, through a link). */
function rowItemOf(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode | undefined {
  let cursor = get(node.parentId);
  if (cursor && typeOf(cursor) === "SideNavItemLink")
    cursor = get(cursor.parentId);
  if (!cursor || typeOf(cursor) !== "SideNavItemContent") return undefined;
  const item = get(cursor.parentId);
  return item && typeOf(item) === ITEM ? item : undefined;
}

/**
 * The derived values a SideNav part carries (`presence.ts` `catalogDerivedProps`): `_sideNavCollapsed`
 * on the panel and every part below it (the paint condition `isCollapsed`), and on an item its
 * `_sideNavCurrent` (the `isCurrent` condition — current, or a closed current ancestor) and its level.
 */
export function catalogSideNavDerived(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): Record<string, boolean | number> | undefined {
  const panel = catalogSideNavPanelOf(node, get, typeOf);
  const collapsed = !!panel && catalogSideNavPanelCollapsed(panel);
  const type = typeOf(node);
  const out: Record<string, boolean | number> = {};
  if (collapsed) out._sideNavCollapsed = true;
  if (type === ITEM) {
    const nav = catalogSideNavOf(node, get, typeOf);
    const { isCurrent, isCurrentAncestor } = catalogSideNavItemCurrent(
      node,
      get,
      typeOf,
      nav && catalogSideNavRoute(nav),
    );
    if (
      isCurrent ||
      (isCurrentAncestor && !catalogSideNavItemExpanded(node, get, typeOf))
    )
      out._sideNavCurrent = true;
    out._sideNavLevel = catalogSideNavItemLevel(node, get, typeOf);
  }
  if (type === "SideNavItemContent") {
    const item = get(node.parentId);
    if (item && typeOf(item) === ITEM)
      out._sideNavLevel = catalogSideNavItemLevel(item, get, typeOf);
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Whether a SideNav part is not shown at rest (`catalogHiddenAtRest`): a closed item's child items
 * (Decision 4 — a collapsed panel closes every item), and in a collapsed panel the rows' text ·
 * chevron and the section headers (S2 `display: none`). A leaf item's chevron glyph is not drawn
 * (S2 `visibility: hidden` — the button keeps its box).
 */
export function catalogSideNavHidden(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): boolean {
  const type = typeOf(node);
  const parent = get(node.parentId);
  if (!parent) return false;
  const parentType = typeOf(parent);
  if (type === ITEM && parentType === ITEM)
    return !catalogSideNavItemExpanded(parent, get, typeOf);
  if (type === "SideNavHeader")
    return catalogSideNavCollapsed(node, get, typeOf);
  const rowItem = rowItemOf(node, get, typeOf);
  if (rowItem) {
    if (type === "Text") return catalogSideNavCollapsed(node, get, typeOf);
    if (type === "Button" && node.props.slot === "chevron")
      return catalogSideNavCollapsed(node, get, typeOf);
  }
  // (The chevron's glyph: drawn only for an item with child items.)
  if (
    parentType === "Button" &&
    parent.props.slot === "chevron" &&
    rowItemOf(parent, get, typeOf)
  ) {
    const item = rowItemOf(parent, get, typeOf)!;
    return (
      catalogSideNavChildItems(item, get, typeOf).length === 0 &&
      item.props.hasChildItems !== true
    );
  }
  return false;
}

/**
 * Decision 3 ⑤ — the records a change of `owner` re-derives (presence · derived props · paint): a
 * panel's every part below it (its collapse), a nav's items and their rows (its expanded keys and
 * route), an item's rows up and down its nav (its `href` · key move the current marks).
 */
export function catalogSideNavDependents(
  owner: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode[] {
  const type = typeOf(owner);
  const scope =
    type === "SideNavPanel" || type === "SideNav"
      ? owner
      : type === ITEM
        ? catalogSideNavOf(owner, get, typeOf)
        : undefined;
  if (!scope) return [];
  const out: CatalogConsumerNode[] = [];
  const visit = (node: CatalogConsumerNode) => {
    for (const id of node.children) {
      const child = get(id);
      if (!child) continue;
      out.push(child);
      visit(child);
    }
  };
  visit(scope);
  return out;
}
