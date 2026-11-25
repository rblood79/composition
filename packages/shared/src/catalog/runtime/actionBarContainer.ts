import { resolveToken, type TokenRef } from "@composition/rendering";
import {
  CATALOG_ACTION_BAR_COLLECTIONS,
  CATALOG_ACTION_BAR_TYPE,
} from "../nesting/nestingRules";
import { catalogSelectionCountFits } from "../document/selectionCountValue";
import { catalogBoxModel } from "./boxModel";
import { catalogGroupSelection, type CatalogGroupKeys } from "./groupSelection";
import type { CatalogConsumerNode } from "./compositionRoot";
import { catalogLengthPx } from "./lengthPx";

/**
 * S2 `renderActionBar` (CardView · TableView · TreeView — S2 체크리스트 부록 D.3 2단계, 2026-11-23):
 * an ActionBar placed as one of these collections' direct children is their action bar
 * (`useActionBarContainer`). Its count is the collection's selection, its clear button empties it,
 * and it floats over the collection's bottom edge (`isInContainer` — absolute, 8 in from the start ·
 * end · bottom, at most 960 wide and centred) while the collection keeps room under its last item
 * (`paddingBottom` = the bar's height + 8 + the collection's edge space). The Canvas (derived props)
 * and the DOM (`CatalogActionBarHost`) read these functions.
 */
type Lookup = (id: string) => CatalogConsumerNode | undefined;
type TypeOf = (node: CatalogConsumerNode) => string;

/** S2 `actionBarStyles`: `insetStart` · `--insetEnd` 8, `bottom: 0` + `translateY: -8`. */
export const CATALOG_ACTION_BAR_INSET = 8;
/** S2 `actionBarStyles` `maxWidth: 960`. */
export const CATALOG_ACTION_BAR_MAX_WIDTH = 960;

/** The collection whose action bar `bar` is (its parent CardView · Table · Tree), if any. */
export function catalogActionBarCollectionOf(
  bar: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode | undefined {
  if (typeOf(bar) !== CATALOG_ACTION_BAR_TYPE) return undefined;
  const parent = get(bar.parentId);
  return parent && CATALOG_ACTION_BAR_COLLECTIONS.has(typeOf(parent))
    ? parent
    : undefined;
}

/** A CardView's · Table's · Tree's action bar: its first direct ActionBar child. */
export function catalogLinkedActionBarOf(
  collection: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode | undefined {
  if (!CATALOG_ACTION_BAR_COLLECTIONS.has(typeOf(collection))) return undefined;
  for (const id of collection.children) {
    const child = get(id);
    if (child && typeOf(child) === CATALOG_ACTION_BAR_TYPE) return child;
  }
  return undefined;
}

/** S2 `useActionBarContainer` `selectedItemCount`: `"all"`, else the number of keys. */
export function catalogSelectionCountOf(
  keys: CatalogGroupKeys,
): number | "all" {
  return keys === "all" ? "all" : new Set(keys).size;
}

/**
 * The count an ActionBar shows: its collection's selection when it is one's action bar (the Canvas
 * reads the collection's stored selection — ADR-308), else its own `selectedItemCount`.
 */
export function catalogActionBarCount(
  bar: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): number | "all" {
  const collection = catalogActionBarCollectionOf(bar, get, typeOf);
  if (collection)
    return catalogSelectionCountOf(
      catalogGroupSelection(collection, get, typeOf),
    );
  const own = bar.props.selectedItemCount ?? 0;
  return catalogSelectionCountFits(own) ? own : 0;
}

/**
 * The bar's height: S2 `actionBarStyles` `paddingY: 12` around its size-M controls (the
 * ActionButtonGroup · CloseButton — `{size.height.M}`, the device's).
 */
function catalogActionBarHeight(): number {
  const control = resolveToken("{size.height.M}" as TokenRef);
  return 12 * 2 + (typeof control === "number" ? control : 32);
}

/** S2 CardView `layoutOptions[size].regular.minSpace.height` (its edge space). */
const CARD_VIEW_MIN_SPACE: Readonly<Record<string, number>> = {
  XS: 8,
  S: 12,
  M: 16,
  L: 20,
  XL: 24,
};

/**
 * The room a collection keeps under its last item while its action bar shows: S2
 * `actionBarHeight` (the bar's height + 8) + 8 (TableView · TreeView) or + the CardView's
 * `minSpace.height`.
 */
export function catalogActionBarSpace(
  collectionType: string,
  props: Readonly<Record<string, unknown>>,
): number {
  const edge =
    collectionType === "CardView"
      ? (CARD_VIEW_MIN_SPACE[String(props.size ?? "M")] ?? 16)
      : 8;
  return catalogActionBarHeight() + 8 + edge;
}

/**
 * Whether a collection's action bar shows (S2: `selectedItemCount !== 0`), and the room it keeps —
 * undefined when it has none or it is hidden.
 */
export function catalogActionBarSpaceOf(
  collection: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): number | undefined {
  const bar = catalogLinkedActionBarOf(collection, get, typeOf);
  if (!bar) return undefined;
  const count = catalogSelectionCountOf(
    catalogGroupSelection(collection, get, typeOf),
  );
  return count === 0
    ? undefined
    : catalogActionBarSpace(typeOf(collection), collection.props);
}

/**
 * Where an action bar sits (S2 `actionBarStyles` `isInContainer`): absolute in its collection, 8 in
 * from the start · end · bottom (S2 `bottom: 0` + `translateY: -8`), as wide as that leaves, at most
 * 960 and centred (`marginX: auto`). Lengths as px strings (the engine's · CSS's). The engine
 * places an absolute box in its parent's padding box — inside the collection's border — while S2's
 * (the DOM's) containing block is the wrapper around it: the Canvas passes that border (`border`)
 * so both sit 8 in from the collection's outer edge.
 */
export function catalogActionBarPlacement(border = 0): {
  position: "absolute";
  insetLeft: string;
  insetRight: string;
  insetBottom: string;
  width: string;
  maxWidth: string;
  marginLeft: string;
  marginRight: string;
} {
  const inset = `${CATALOG_ACTION_BAR_INSET - border}px`;
  return {
    position: "absolute",
    insetLeft: inset,
    insetRight: inset,
    insetBottom: inset,
    width: "auto",
    maxWidth: `${CATALOG_ACTION_BAR_MAX_WIDTH}px`,
    marginLeft: "auto",
    marginRight: "auto",
  };
}

/** The collection's border width the Canvas placement steps back over (`catalogActionBarPlacement`). */
export function catalogActionBarBorder(
  collection: CatalogConsumerNode,
): number {
  const width = catalogBoxModel(collection).borderWidth;
  return Math.max(catalogLengthPx(width), 0);
}
