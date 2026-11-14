import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import { evaluateConditionTree } from "../rule/conditionTree";
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
  // (A Library card's `Collapsed` state sample — `displayState`, no prop.)
  if (panel.displayState === "collapsed") return true;
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

/**
 * The route a nav marks — its `selectedRoute`, else the shown page's route (user decision 1: the
 * Preview's path — `CatalogCurrentRouteContext`; the Canvas's, the page the nav is drawn on).
 */
export function catalogSideNavRoute(
  nav: CatalogConsumerNode,
  shownRoute?: CatalogSideNavShownRoute,
): string | undefined {
  const route = nav.props.selectedRoute;
  return typeof route === "string" && route ? route : shownRoute?.(nav);
}

/** The route of the page a record is drawn on (the composition root's page). */
export type CatalogSideNavShownRoute = (
  node: CatalogConsumerNode,
) => string | undefined;

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

/**
 * The item whose row `node` sits in (its SideNavItemContent, through a link) — its Text and Icon
 * take the row's type and color (S2 `treeCellGrid` — the current row bold, `currentColor` glyphs).
 */
export function catalogSideNavRowItemOf(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode | undefined {
  return rowItemOf(node, get, typeOf);
}

/**
 * The SideNav part whose type and color a Text takes: its row's item, or the SideNavHeader it is in
 * (S2 draws the label · header text itself — `font: ui` / `ui-sm`, the row's current color).
 */
export function catalogSideNavTextOwner(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode | undefined {
  const row = rowItemOf(node, get, typeOf);
  if (row) return row;
  const parent = get(node.parentId);
  return parent && typeOf(parent) === "SideNavHeader" ? parent : undefined;
}

/** The item whose chevron `node` is: a `Button[slot=chevron]` in its row (RAC's expand button). */
export function catalogSideNavChevronItem(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode | undefined {
  return typeOf(node) === "Button" && node.props.slot === "chevron"
    ? rowItemOf(node, get, typeOf)
    : undefined;
}

/** The item whose chevron glyph `node` is (the Icon in its chevron Button). */
export function catalogSideNavChevronGlyphItem(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode | undefined {
  const button = get(node.parentId);
  return typeOf(node) === "Icon" && button
    ? catalogSideNavChevronItem(button, get, typeOf)
    : undefined;
}

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
  shownRoute?: CatalogSideNavShownRoute,
): Record<string, boolean | number | string> | undefined {
  const panel = catalogSideNavPanelOf(node, get, typeOf);
  const collapsed = !!panel && catalogSideNavPanelCollapsed(panel);
  const type = typeOf(node);
  const out: Record<string, boolean | number | string> = {};
  if (collapsed) out._sideNavCollapsed = true;
  const marked = (item: CatalogConsumerNode) => {
    // (A Library card's `Current` state sample — a row drawn alone, outside any SideNav.)
    if (item.displayState === "current") return true;
    const nav = catalogSideNavOf(item, get, typeOf);
    const { isCurrent, isCurrentAncestor } = catalogSideNavItemCurrent(
      item,
      get,
      typeOf,
      nav && catalogSideNavRoute(nav, shownRoute),
    );
    return (
      isCurrent ||
      (isCurrentAncestor && !catalogSideNavItemExpanded(item, get, typeOf))
    );
  };
  if (type === ITEM) {
    if (marked(node)) out._sideNavCurrent = true;
    out._sideNavLevel = catalogSideNavItemLevel(node, get, typeOf);
  }
  // (Its row on the Canvas — the current-route bar is drawn on it, `catalogSideNavIndicator`.)
  if (type === "SideNavItemContent") {
    const item = get(node.parentId);
    if (item && typeOf(item) === ITEM) {
      out._sideNavLevel = catalogSideNavItemLevel(item, get, typeOf);
      if (marked(item)) out._sideNavCurrent = true;
    }
  }
  // (An open item's chevron turns 90° — the DOM's `rotate(90deg)`; the Canvas draws the turned
  //  glyph, as the Disclosure's.)
  const chevronOf = catalogSideNavChevronGlyphItem(node, get, typeOf);
  if (
    chevronOf &&
    node.props.iconName === "chevron-right" &&
    catalogSideNavItemExpanded(chevronOf, get, typeOf)
  )
    out.iconName = "chevron-down";
  return Object.keys(out).length ? out : undefined;
}

/** The S2 SideNav rules the Canvas reads (`structure` · state trees). */
const RULES = COMPONENT_RULES_TABLE as unknown as Record<
  string,
  | {
      structure?: {
        containerStyles?: Record<string, unknown>;
        stateStyles?: Record<string, unknown>;
      };
    }
  | undefined
>;
const px = (value: unknown): number => Number.parseFloat(String(value)) || 0;

/**
 * The Canvas layout a SideNav part takes from its place (the DOM's inline style · selectors): a
 * collapsed panel's width (the panel rule's `isCollapsed` width beats an authored one, as S2's inline
 * `--collapsedWidth`), a row's start padding at its level (`12 + (level − 1) × --indent` — S2
 * `treeCellGrid`) and its collapsed end, and a collapsed row icon's end margin (S2 `isCollapsed: 0`).
 */
export function catalogSideNavPartLayout(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): Record<string, string | number> | undefined {
  const type = typeOf(node);
  if (type === "SideNavPanel")
    return catalogSideNavPanelCollapsed(node)
      ? {
          width: String(
            evaluateConditionTree(
              RULES.SideNavPanel?.structure?.stateStyles?.width as never,
              { isCollapsed: true },
            ),
          ),
        }
      : undefined;
  if (type === "SideNavItemContent") {
    const item = get(node.parentId);
    if (!item || typeOf(item) !== ITEM) return undefined;
    const row = RULES.SideNavItemContent?.structure;
    const indent = px(RULES.SideNav?.structure?.containerStyles?.["--indent"]);
    const level = catalogSideNavItemLevel(item, get, typeOf);
    return {
      paddingLeft: `${px(row?.containerStyles?.paddingLeft) + (level - 1) * indent}px`,
      // (The end too: the rule's box keys reach the engine as one horizontal padding.)
      paddingRight: catalogSideNavCollapsed(node, get, typeOf)
        ? collapsedPart("& .react-aria-SideNavItem%", "paddingInlineEnd")
        : String(row?.containerStyles?.paddingRight),
    };
  }
  // S2 `SideNavSection` `marginTop: 24` from the second on (the SideNav rule's `:not(:first-child)`
  //  margin) — on the Canvas over the nav's column gap, which the DOM turns off. An authored px
  //  margin is the distance too (the DOM inlines it — 2026-11-14 감사: the Canvas kept 24); any
  //  other length goes as written.
  if (type === "SideNavSection") {
    const parent = get(node.parentId);
    if (!parent || parent.children[0] === node.id) return undefined;
    const written = (node.authoredLayout as Record<string, unknown> | undefined)
      ?.marginTop;
    if (
      written !== undefined &&
      !/^-?\d*\.?\d+px$/.test(String(written).trim())
    )
      return undefined;
    const nav = RULES.SideNav as
      | {
          structure?: {
            containerStyles?: Record<string, unknown>;
            composition?: {
              staticSelectors?: Record<string, Record<string, string>>;
            };
          };
        }
      | undefined;
    const margin =
      written ??
      nav?.structure?.composition?.staticSelectors?.[
        ".react-aria-SideNavSection:not(:first-child)"
      ]?.["margin-top"];
    const gap =
      typeOf(parent) === "SideNav"
        ? px(nav?.structure?.containerStyles?.gap)
        : 0;
    return { marginTop: `${px(margin) - gap}px` };
  }
  // The row's nodes (S2 `treeIcon` · `treeContent` · `expandButton`): the DOM row's declarations
  //  (`SideNavItem` rule — RAC's gridcell is `display: contents`), the Canvas row being the content.
  const rowPart = (selector: string) =>
    rowItemOf(node, get, typeOf) && engineStyle(ROW_PARTS[selector]);
  if (type === "Button" && node.props.slot === "chevron")
    return rowPart(CHEVRON) || undefined;
  if (type === "Icon" && !catalogSideNavChevronGlyphItem(node, get, typeOf)) {
    const placed = rowPart("& > [role=gridcell] > .react-aria-Icon");
    if (!placed) return undefined;
    return catalogSideNavCollapsed(node, get, typeOf)
      ? {
          ...placed,
          marginRight: collapsedPart(
            "& .react-aria-SideNavItem .react-aria-Icon%",
            "marginInlineEnd",
          ),
        }
      : placed;
  }
  if (type === "SideNavItemLink")
    return (
      rowPart("& > [role=gridcell] > .react-aria-SideNavItemLink") || undefined
    );
  if (type === "Text")
    return rowPart("& > [role=gridcell] > .react-aria-Text") || undefined;
  return undefined;
}

const CHEVRON = '& > [role=gridcell] > .react-aria-Button[slot="chevron"]';
/** A collapsed panel's value for a part (the SideNavPanel rule's `partStateStyles` — the DOM's too). */
function collapsedPart(selector: string, key: string): string {
  const states = (
    COMPONENT_RULES_TABLE.SideNavPanel as unknown as {
      partStateStyles: Record<string, Record<string, unknown>>;
    }
  ).partStateStyles[selector]?.[key];
  return String(evaluateConditionTree(states as never, { isCollapsed: true }));
}
/** The SideNavItem rule's row-part declarations (its DOM `rootSelectors`). */
const ROW_PARTS = (
  COMPONENT_RULES_TABLE.SideNavItem as unknown as {
    structure: {
      composition: {
        rootSelectors: Record<string, { styles: Record<string, string> }>;
      };
    };
  }
).structure.composition.rootSelectors;
/** CSS declarations as engine layout keys (a row part's box — `margin-inline-end` is ltr's right). */
function engineStyle(
  block: { styles: Record<string, string> } | undefined,
): Record<string, string | number> | undefined {
  if (!block) return undefined;
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(block.styles)) {
    const name =
      key === "margin-inline-end"
        ? "marginRight"
        : key.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    // (The engine's flex factors are numbers, lengths strings — `styleOf`'s contract.)
    if (ENGINE_KEYS.has(name))
      out[name] = name.startsWith("flex") ? Number(value) : value;
  }
  // (`all: unset` — the button's own box: no padding · border of the Button rule.)
  if (block.styles.all === "unset")
    Object.assign(out, {
      minWidth: "0px",
      minHeight: "0px",
      paddingTop: "0px",
      paddingRight: "0px",
      paddingBottom: "0px",
      paddingLeft: "0px",
    });
  return out;
}
const ENGINE_KEYS = new Set([
  "display",
  "alignItems",
  "justifyContent",
  "width",
  "height",
  "minWidth",
  "flexGrow",
  "flexShrink",
  "marginRight",
]);

/** A current row's weight (the SideNavItem rule's `isCurrent` weight — S2 bold). */
export function catalogSideNavCurrentWeight(): number | undefined {
  const weight = evaluateConditionTree(
    RULES.SideNavItem?.structure?.stateStyles?.fontWeight as never,
    { isCurrent: true },
  );
  return weight === undefined ? undefined : Number(weight);
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

/**
 * S2 `indicator` — the current-route bar of a Canvas row (its SideNavItemContent, derived
 * `_sideNavCurrent` · `_sideNavLevel`): the SideNavItem rule's `::before` box (its width · height ·
 * start `(level − 1) × --indent + N`) in its `isCurrent` color, centred on the row. Undefined when the
 * row is not current (the hovered bar is a DOM interaction).
 */
export function catalogSideNavIndicator(
  row: Pick<CatalogConsumerNode, "derivedProps">,
): { x: number; width: number; height: number; color: string } | undefined {
  const derived = row.derivedProps;
  if (derived?._sideNavCurrent !== true) return undefined;
  const rule = COMPONENT_RULES_TABLE.SideNavItem as unknown as {
    structure: {
      composition: {
        rootSelectors: Record<string, { styles: Record<string, string> }>;
      };
    };
    partStateStyles: Record<string, Record<string, unknown>>;
  };
  const box = rule.structure.composition.rootSelectors["&::before"]!.styles;
  const color = evaluateConditionTree(
    rule.partStateStyles["&%::before"]!.background as never,
    { isCurrent: true },
  );
  const start = /\+\s*(\d+(?:\.\d+)?)px\)$/.exec(
    box["inset-inline-start"] ?? "",
  );
  const indent = px(RULES.SideNav?.structure?.containerStyles?.["--indent"]);
  const level = Number(derived._sideNavLevel ?? 1);
  return {
    x: (level - 1) * indent + px(start?.[1]),
    width: px(box.width),
    height: px(box.height),
    color: String(color),
  };
}
