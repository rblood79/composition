import { linkBinding } from "../bindings/Link.binding";
import { CATALOG_INHERITED_PROP_CONTRACTS } from "../bindings/inheritedProps";
import type { PropContract } from "../types";

/**
 * ADR-259 Phase 1 — collection item links (S2 1.8.0 · RAC `LinkDOMProps`). An item with an `href`
 * is a link: RAC draws ListBoxItem · Tab · MenuItem as `<a>` and GridListItem · TreeItem · Tag ·
 * Row as their own element with `data-href` (RAC `useSyntheticLinkProps`) — the binding passes the
 * three keys to RAC unchanged (D1).
 */
export const CATALOG_LINK_ITEM_TYPES: ReadonlySet<string> = new Set([
  "ListBoxItem",
  "Tab",
  "Tag",
  "TreeItem",
  "GridListItem",
  "Row",
  "MenuItem",
]);

const linkAccepts = linkBinding.props.accepts;

/** The Link's `href` · `target` · `rel` contracts (one edit surface for every link). */
export const ITEM_LINK_PROP_CONTRACTS: Readonly<Record<string, PropContract>> =
  {
    href: linkAccepts.href!,
    target: linkAccepts.target!,
    rel: linkAccepts.rel!,
  };

/**
 * A collection item's Selected (2026-10-13 — composition extension, as the Tag's `isSelected`): RAC
 * items take no selection prop of their own — the item's collection hands RAC the keys of its items
 * set Selected (`defaultSelectedKeys`, `catalogCollectionSelectedKeys`) while it selects, and the
 * Canvas paints the same (`catalogItemStartsSelected`). A Tabs selects the first one.
 *
 * Content, not Behavior (사용자 2026-10-13 「선택 값이 radio는 content 에있고, tabs는 behavior에 있고
 * 일관성이 없다」 · 「checkbox 는 또 behavior에 있다」): a selection is a value — every control's
 * Selected (Checkbox · Switch · ToggleButton · Radio · an item) sits with a RadioGroup's Value and a
 * Tabs' Selected Tab. Disabled · Read Only · Required stay Behavior.
 */
export const ITEM_SELECTED_PROP_CONTRACT: PropContract = {
  kind: "boolean",
  label: "Selected",
  section: "content",
};

/** S2 ListView · Menu `hideLinkOutIcon` — the owner's (its items take it — `CATALOG_LINK_OUT_OWNERS`). */
export const HIDE_LINK_OUT_ICON_CONTRACT: PropContract = {
  kind: "boolean",
  label: "Hide Link Out Icon",
  section: "appearance",
};

/** The item's copy of its owner's `hideLinkOutIcon` (resolver-carried, no editor). */
export const ITEM_HIDE_LINK_OUT_ICON_CONTRACT: PropContract = {
  ...HIDE_LINK_OUT_ICON_CONTRACT,
  editorHidden: true,
};

/**
 * The owner whose `hideLinkOutIcon` reaches an item type (S2 ListView · Menu context — the item has
 * no prop of its own). Read by the resolver (`applyOwnerHideLinkOut`).
 */
export const CATALOG_LINK_OUT_OWNERS: Readonly<Record<string, string>> = {
  GridListItem: "GridList",
  MenuItem: "Menu",
};

/**
 * Props a rule-only type (no primitive binding) accepts and edits: a MenuItem is RAC's collection
 * item drawn from its rule, so its link contracts live here (the Design panel and the definition's
 * accepts read the same table).
 */
export const RULE_TYPE_PROP_CONTRACTS: Readonly<
  Record<string, Readonly<Record<string, PropContract>>>
> = {
  MenuItem: {
    ...ITEM_LINK_PROP_CONTRACTS,
    hideLinkOutIcon: ITEM_HIDE_LINK_OUT_ICON_CONTRACT,
    isSelected: ITEM_SELECTED_PROP_CONTRACT,
  },
  // ADR-281 Decision 3 (user decision 1) — a frame passes these down like the page root.
  frame: CATALOG_INHERITED_PROP_CONTRACTS,
};

/**
 * S2 draws the link-out glyph at an item's end when it opens a new tab (`href` and `target="_blank"`)
 * unless its owner hides it (`ListView.tsx` `isLinkOut && !hideLinkOutIcon` · `Menu.tsx` the same).
 */
export function catalogItemLinkOut(
  type: string,
  props: Readonly<Record<string, unknown>>,
): boolean {
  return (
    type in CATALOG_LINK_OUT_OWNERS &&
    typeof props.href === "string" &&
    props.href !== "" &&
    props.target === "_blank" &&
    props.hideLinkOutIcon !== true
  );
}

/** The Lucide glyph standing for S2's `ui-icons/LinkOut` (the set every icon here comes from). */
export const CATALOG_LINK_OUT_ICON = "external-link";

/**
 * S2 link-out glyph box per item size: the S2 UI icon (`LinkOut` M · L · XL = 10 · 12 · 14 px —
 * `S2_LinkOutSize100/200/300` viewBox) and its gap before it. ListView: size M, `marginStart:
 * 'text-to-visual'` (6 at its 14 px text — `ListView.tsx:807-814, 987-1003`). Menu: `linkIconSize`
 * S → M, M → L, L · XL → XL, `marginStart: 8` (`Menu.tsx:440-448, 788-793, 925-937`).
 */
const LINK_OUT_GLYPH: Readonly<
  Record<string, Readonly<Record<string, { size: number; gap: number }>>>
> = {
  GridListItem: { M: { size: 10, gap: 6 } },
  MenuItem: {
    S: { size: 10, gap: 8 },
    M: { size: 12, gap: 8 },
    L: { size: 14, gap: 8 },
    XL: { size: 14, gap: 8 },
  },
};

/**
 * A link-out item's glyph box at its end: the glyph square sits in the item's end padding (its own
 * right padding stays outside it), and the item's right padding grows by the glyph and its gap so
 * its content stops before it. Both consumers read this — the Rust input (`styleFor`), the Canvas
 * glyph (`ruleShapes`) and the DOM (`domBinding` inline style + the glyph element).
 */
export function catalogLinkOutGlyph(
  type: string,
  size: unknown,
): { size: number; gap: number } {
  const sizes = LINK_OUT_GLYPH[type] ?? LINK_OUT_GLYPH.GridListItem;
  return sizes[String(size)] ?? sizes.M ?? Object.values(sizes)[0];
}

/**
 * A card item's glyph place (GridListItem — the RAC reference card, 2026-10-13): its photo spans
 * the card and a Canvas node paints under its children, so the glyph sits in the card's bottom
 * padding (centred there), its end at the texts' end (their 16 inset — `manualBoxRules`
 * GridListItem). The card's padding stays — its photo keeps the card's width.
 */
const LINK_OUT_CARD_END_INSET: Readonly<Record<string, number>> = {
  GridListItem: 16,
};

/** The glyph's end inset when the item is a card (no row end padding grows), else undefined. */
export function catalogLinkOutCardEndInset(type: string): number | undefined {
  return LINK_OUT_CARD_END_INSET[type];
}

/** A link-out item's right padding: its own (the glyph's end inset) + the glyph + its gap. */
export function catalogLinkOutPaddingRight(
  type: string,
  size: unknown,
  ownPaddingRight: number,
): number {
  const glyph = catalogLinkOutGlyph(type, size);
  return ownPaddingRight + glyph.size + glyph.gap;
}

/** An item's authored link as RAC props (empty values dropped — RAC makes any `href` a link). */
export function catalogItemLinkProps(
  props: Readonly<Record<string, unknown>>,
): { href?: string; target?: string; rel?: string } {
  const out: { href?: string; target?: string; rel?: string } = {};
  for (const key of ["href", "target", "rel"] as const) {
    const value = props[key];
    if (typeof value === "string" && value !== "") out[key] = value;
  }
  return out;
}
