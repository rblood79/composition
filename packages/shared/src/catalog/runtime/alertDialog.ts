import type { CatalogConsumerNode } from "./compositionRoot";

/**
 * S2 AlertDialog (S2 체크리스트 §9.3, 사용자 결정 2026-11-23 「노드 + 2 필드」) — a Dialog with
 * `role="alertdialog"` (the origin `component-alertdialog`). Its title's glyph (error · warning —
 * the origin's `bindingMaps`) is named S2's `dialog.alert` (`AlertDialog.tsx` — `aria-label` on the
 * icon); the DOM gives that name.
 */
type Lookup = (id: string) => CatalogConsumerNode | undefined;
type TypeOf = (node: CatalogConsumerNode) => string;

/** The node is a glyph in an alert dialog's title Heading. */
export function catalogAlertDialogGlyph(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): boolean {
  if (typeOf(node) !== "Icon") return false;
  const heading = get(node.parentId);
  if (!heading || typeOf(heading) !== "Heading") return false;
  if (heading.props.slot !== "title") return false;
  const dialog = get(heading.parentId);
  return (
    !!dialog &&
    typeOf(dialog) === "Dialog" &&
    dialog.props.role === "alertdialog"
  );
}

/**
 * S2 1.8.2 `dialog.alert` (`@react-spectrum/s2` intl) — in the languages the Builder ships; others
 * take English.
 */
export const CATALOG_DIALOG_ALERT_STRINGS: Readonly<Record<string, string>> = {
  en: "Alert",
  ko: "경고",
};
