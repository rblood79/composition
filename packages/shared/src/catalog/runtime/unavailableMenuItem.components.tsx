import { cloneElement, type ReactElement } from "react";

import { CATALOG_MENU_MORE_ACTIONS_STRINGS } from "./actionMenu";
import { CATALOG_DIALOG_ALERT_STRINGS } from "./alertDialog";
import { useCatalogLocalized } from "./localizedStrings";
import { CATALOG_MENU_UNAVAILABLE_STRINGS } from "./unavailableMenuItem";

/**
 * S2 ActionMenu — an unnamed icon-only menu trigger's name (S2 `menu.moreActions`, §9.3).
 */
export function CatalogMoreActionsName({
  element,
}: {
  element: ReactElement;
}): ReactElement {
  const label = useCatalogLocalized(CATALOG_MENU_MORE_ACTIONS_STRINGS);
  return cloneElement(element as ReactElement<Record<string, unknown>>, {
    "aria-label": label,
  });
}

/**
 * S2 체크리스트 §9.3 — an unavailable item's info glyph (S2 `UnavailableIconWrapper`): the item's
 * description — its id, its name S2's `menu.unavailable` in the site's language.
 */
export function CatalogUnavailableGlyph({
  id,
  element,
}: {
  id: string;
  element: ReactElement;
}): ReactElement {
  const label = useCatalogLocalized(CATALOG_MENU_UNAVAILABLE_STRINGS);
  return cloneElement(element as ReactElement<Record<string, unknown>>, {
    id,
    "aria-label": label,
    role: "img",
    "aria-hidden": undefined,
  });
}

/**
 * S2 AlertDialog — its title glyph's name (S2 `dialog.alert`, §9.3): an image, not decoration.
 */
export function CatalogAlertGlyph({
  element,
}: {
  element: ReactElement;
}): ReactElement {
  const label = useCatalogLocalized(CATALOG_DIALOG_ALERT_STRINGS);
  return cloneElement(element as ReactElement<Record<string, unknown>>, {
    "aria-label": label,
    role: "img",
    "aria-hidden": undefined,
  });
}
