import type { CatalogConsumerNode } from "./compositionRoot";

/**
 * S2 `UnavailableMenuItemTrigger` (S2 체크리스트 §9.3, 2026-11-23) — an item it marks unavailable opens
 * a help popover in place of its action, and shows an info glyph in the submenu chevron's place
 * (S2 `Menu.tsx:938-941` `UnavailableIconWrapper`). The glyph is a node of the MenuItem origin
 * conditioned on `isUnavailable`; the Canvas (`presence.ts`) and the DOM (the item's state frame) read
 * the item's state here.
 */
export const CATALOG_UNAVAILABLE_MENU_TRIGGER = "UnavailableMenuItemTrigger";

type Lookup = (id: string) => CatalogConsumerNode | undefined;
type TypeOf = (node: CatalogConsumerNode) => string;

/** The trigger around a MenuItem, when it is an UnavailableMenuItemTrigger. */
function catalogUnavailableMenuTriggerOf(
  item: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode | undefined {
  const parent = get(item.parentId);
  return parent && typeOf(parent) === CATALOG_UNAVAILABLE_MENU_TRIGGER
    ? parent
    : undefined;
}

/** The MenuItem is currently unavailable (its trigger's S2 `isUnavailable`). */
export function catalogMenuItemUnavailable(
  item: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): boolean {
  if (typeOf(item) !== "MenuItem") return false;
  return (
    catalogUnavailableMenuTriggerOf(item, get, typeOf)?.props.isUnavailable ===
    true
  );
}

/** A node shown while its item is unavailable (the origin's info glyph). */
function catalogShownWhileUnavailable(
  node: CatalogConsumerNode,
): boolean {
  // (A plain or `{ key }` condition — not a negated one.)
  return !!node.showWhen?.all.some((item) =>
    typeof item === "string"
      ? item === "isUnavailable"
      : "key" in item && item.key === "isUnavailable",
  );
}

/** The unavailable MenuItem whose info glyph `icon` is (its direct child, conditioned on the state). */
export function catalogUnavailableGlyphItem(
  icon: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode | undefined {
  if (!catalogShownWhileUnavailable(icon)) return undefined;
  const item = get(icon.parentId);
  return item && catalogMenuItemUnavailable(item, get, typeOf)
    ? item
    : undefined;
}

/** The item's info glyph node, when the item has one. */
export function catalogUnavailableGlyphOf(
  item: CatalogConsumerNode,
  get: Lookup,
): CatalogConsumerNode | undefined {
  for (const id of item.children) {
    const child = get(id);
    if (child && catalogShownWhileUnavailable(child)) return child;
  }
  return undefined;
}

/** The glyph element's id — the item's `aria-describedby` (S2 `infoIconId`). */
export const catalogUnavailableGlyphDomId = (itemId: string): string =>
  `${itemId}--unavailable`;

/**
 * S2 1.8.2 `menu.unavailable` (`@react-spectrum/s2` intl) — the glyph's name, in the languages the
 * Builder ships; others take English.
 */
export const CATALOG_MENU_UNAVAILABLE_STRINGS: Readonly<
  Record<string, string>
> = {
  en: "Unavailable, expand for details",
  ko: "사용할 수 없음, 자세히 보려면 펼치기",
};
