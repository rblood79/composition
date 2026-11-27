import type { CatalogConsumerNode } from "./compositionRoot";

/**
 * S2 ActionMenu (S2 체크리스트 §9.3, 2026-11-23) — an icon-only ActionButton opening a Menu
 * (`MenuTrigger > ActionButton + Popover > Menu`, the origin `component-actionmenu`). S2 names its
 * button 「More actions」 when the author gives no name (`ActionMenu.tsx` — `menu.moreActions`); the
 * DOM gives an unnamed icon-only menu trigger that name.
 */
type Lookup = (id: string) => CatalogConsumerNode | undefined;
type TypeOf = (node: CatalogConsumerNode) => string;

/**
 * The node is a MenuTrigger's icon-only ActionButton with no name of its own (no label, no
 * `aria-label` · `aria-labelledby`).
 */
export function catalogMoreActionsTrigger(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): boolean {
  if (node.derivedProps?._actionIconOnly !== true) return false;
  if (node.props["aria-label"] || node.props["aria-labelledby"]) return false;
  const parent = get(node.parentId);
  return (
    !!parent &&
    typeOf(parent) === "MenuTrigger" &&
    parent.children[0] === node.id
  );
}

/**
 * S2 1.8.2 `menu.moreActions` (`@react-spectrum/s2` intl) — in the languages the Builder ships;
 * others take English.
 */
export const CATALOG_MENU_MORE_ACTIONS_STRINGS: Readonly<
  Record<string, string>
> = {
  en: "More actions",
  ko: "기타 액션",
};
