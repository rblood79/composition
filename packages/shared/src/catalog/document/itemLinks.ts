import { S2_PANEL_CLOSE_ON_SELECT_ACCEPTS } from "../bindings/s2RacProps";
import { RAC_SLOT_PROP } from "../bindings/accessibilityProps";
import { linkBinding } from "../bindings/Link.binding";
import { CATALOG_FRAME_INHERITED_PROP_CONTRACTS } from "../bindings/inheritedProps";
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
 * ADR-308 사용자 결정 2 — a selection · expansion item's RAC key (S2 `id`), the name its group's
 * selection uses (`home`): editable in Content. Kept apart from the HTML id (Accessibility 「ID」 —
 * `metadata.htmlId`), so it is 「Item ID」.
 */
export const ITEM_KEY_PROP_CONTRACT: PropContract = {
  kind: "string",
  label: "Item ID",
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

/** S2 `Image` `img` attributes (`Image.tsx` `ImageProps`) — `editorHidden`, read by `imageElementProps`. */
export const IMAGE_ELEMENT_PROP_CONTRACTS: Readonly<
  Record<string, PropContract>
> = {
  crossOrigin: {
    kind: "enum",
    label: "Cross origin",
    section: "content",
    editorHidden: true,
    options: [
      { value: "anonymous", label: "Anonymous" },
      { value: "use-credentials", label: "Use credentials" },
    ],
  },
  decoding: {
    kind: "enum",
    label: "Decoding",
    section: "content",
    editorHidden: true,
    options: [
      { value: "async", label: "Async" },
      { value: "auto", label: "Auto" },
      { value: "sync", label: "Sync" },
    ],
  },
  fetchPriority: {
    kind: "enum",
    label: "Fetch priority",
    section: "content",
    editorHidden: true,
    options: [
      { value: "high", label: "High" },
      { value: "low", label: "Low" },
      { value: "auto", label: "Auto" },
    ],
  },
  loading: {
    kind: "enum",
    label: "Loading",
    section: "content",
    editorHidden: true,
    options: [
      { value: "eager", label: "Eager" },
      { value: "lazy", label: "Lazy" },
    ],
  },
  referrerPolicy: {
    kind: "enum",
    label: "Referrer policy",
    section: "content",
    editorHidden: true,
    options: [
      "no-referrer",
      "no-referrer-when-downgrade",
      "origin",
      "origin-when-cross-origin",
      "same-origin",
      "strict-origin",
      "strict-origin-when-cross-origin",
      "unsafe-url",
    ].map((value) => ({ value, label: value })),
  },
  width: {
    kind: "number",
    label: "Intrinsic width",
    section: "content",
    editorHidden: true,
    min: 0,
  },
  height: {
    kind: "number",
    label: "Intrinsic height",
    section: "content",
    editorHidden: true,
    min: 0,
  },
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
    // ADR-295 Phase 3c-3c ③: the Menu's size (S2 Menu context — `CATALOG_SIZE_PROPAGATION.Menu`), never edited
    //   on the item.
    size: {
      kind: "size",
      label: "Size",
      section: "appearance",
      default: "M",
      editorHidden: true,
    },
    ...ITEM_LINK_PROP_CONTRACTS,
    hideLinkOutIcon: ITEM_HIDE_LINK_OUT_ICON_CONTRACT,
    id: ITEM_KEY_PROP_CONTRACT,
    // 2026-11-18 S2 · RAC `MenuItemProps.isDisabled` — also what its Menu's `disabledKeys` turns on
    //   (`catalogItemKeyDisabled`): the rule's disabled dimming reaches the Canvas through it.
    isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    // S2 체크리스트 §9.2 (2026-11-24): S2 · RAC `MenuItemProps.shouldCloseOnSelect` — RAC's.
    ...S2_PANEL_CLOSE_ON_SELECT_ACCEPTS,
  },
  // ADR-281 Decision 3 (user decision 1) — a frame passes these down like the page root; a keyed
  // binding (`useListData.getItem`) gives its descendants one item's fields (a detail view).
  frame: {
    ...CATALOG_FRAME_INHERITED_PROP_CONTRACTS,
    dataBinding: { kind: "binding", label: "Data", section: "content" },
  },
  // S2 `Image` `src` · `alt` (2026-10-24 — the picture it shows and its accessible text; the DOM
  //   `img` and the Canvas image shape read the same props).
  Image: {
    slot: RAC_SLOT_PROP,
    src: { kind: "string", label: "Image URL", section: "content" },
    alt: { kind: "string", label: "Alt Text", section: "content" },
    // S2 `ImageProps` — the `img`'s fetch attributes and intrinsic size (부록 D.2, 사용자 결정 2026-11-23).
    // Developer HTML attributes: not in the Design panel (사용자 결정 2026-11-11 속성 감사) — the code view ·
    // a rule's Do · AI write them; the DOM `img` takes them, the Canvas box is its layout's (the intrinsic
    // size only reserves the `img`'s ratio before it loads).
    ...IMAGE_ELEMENT_PROP_CONTRACTS,
    // S2 `ImageProps.group` (부록 D.2, 사용자 결정 2026-11-24): the ImageCoordinator group it is revealed
    //   with — S2's `createImageGroup()` context is a name here (the coordinator's `group` of the same name).
    group: { kind: "string", label: "Image group", section: "content" },
  },
};

/**
 * S2 draws the link-out glyph at an item's end when it opens a new tab (`href` and `target="_blank"`)
 * unless its owner hides it (`ListView.tsx` `isLinkOut && !hideLinkOutIcon` · `Menu.tsx` the same).
 */
export function catalogItemLinkOut(
  type: string,
  props: Readonly<Record<string, unknown>>,
): boolean {
  return opensNewTab(type, props) && props.hideLinkOutIcon !== true;
}

function opensNewTab(
  type: string,
  props: Readonly<Record<string, unknown>>,
): boolean {
  return (
    type in CATALOG_LINK_OUT_OWNERS &&
    typeof props.href === "string" &&
    props.href !== "" &&
    props.target === "_blank"
  );
}

/** The Lucide glyph standing for S2's `ui-icons/LinkOut` (the set every icon here comes from). */
export const CATALOG_LINK_OUT_ICON = "external-link";

/** The Lucide glyph standing for S2's `ui-icons/Chevron` (pointing to the end). */
export const CATALOG_CHILD_ITEMS_ICON = "chevron-right";

/**
 * The glyph S2 draws at an item's end, if any — its link-out glyph (`catalogItemLinkOut`), else a
 * ListView item's chevron while it has child items (`ListView.tsx` `hasChildItems && !isLinkOut` —
 * a new-tab link draws no chevron even when its glyph is hidden, 2026-11-18). Both glyphs share the
 * place and box (`catalogLinkOutGlyph`).
 */
export function catalogItemTrailingIcon(
  type: string,
  props: Readonly<Record<string, unknown>>,
): string | undefined {
  if (catalogItemLinkOut(type, props)) return CATALOG_LINK_OUT_ICON;
  if (
    type === "GridListItem" &&
    props.hasChildItems === true &&
    !opensNewTab(type, props)
  )
    return CATALOG_CHILD_ITEMS_ICON;
  return undefined;
}

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
 * A card item's glyph place: the glyph in the card's bottom padding, its end at the texts' end.
 * No item is a card now — a GridListItem is the S2 ListView row again (2026-10-25 사용자 「GridList 를
 * S2 ListView 처럼 목록 행으로」; the RAC reference card of 2026-10-13 had 16): its glyph sits at the
 * row's end, as S2's.
 */
const LINK_OUT_CARD_END_INSET: Readonly<Record<string, number>> = {};

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
