import { cloneElement, type ReactElement } from "react";
import { useLocale } from "react-aria-components/I18nProvider";

import { CATALOG_MENU_UNAVAILABLE_STRINGS } from "./unavailableMenuItem";

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
  const { locale } = useLocale();
  const label =
    CATALOG_MENU_UNAVAILABLE_STRINGS[locale.split("-")[0] ?? "en"] ??
    CATALOG_MENU_UNAVAILABLE_STRINGS.en!;
  return cloneElement(element as ReactElement<Record<string, unknown>>, {
    id,
    "aria-label": label,
    role: "img",
    "aria-hidden": undefined,
  });
}
