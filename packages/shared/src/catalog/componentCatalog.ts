import { buttonPrimitiveBinding } from "./primitives/button";
import { separatorPrimitiveBinding } from "./primitives/separator";
import type { ComponentCatalogEntry } from "./types";
import {
  getReusableCatalogDocument,
  getReusableCatalogPropsSchema,
  getReusableCatalogRoot,
} from "./library";

export const componentCatalog = [
  {
    kind: "primitive",
    type: "Button",
    family: "primitives/actions",
    cutover: "catalog",
    binding: buttonPrimitiveBinding,
    panel: {
      category: "buttons",
      label: "button",
      icon: "MousePointer",
      placeable: true,
    },
  },
  {
    kind: "primitive",
    type: "Separator",
    family: "primitives/actions",
    cutover: "catalog",
    binding: separatorPrimitiveBinding,
    panel: {
      category: "content",
      label: "separator",
      icon: "SeparatorHorizontal",
      placeable: true,
    },
  },
  {
    kind: "reusable",
    type: "Card",
    family: "composition-native",
    cutover: "legacy",
    reusableId: "catalog-reusable-card",
    panel: {
      category: "layout",
      label: "card",
      icon: "AppWindowMac",
      placeable: true,
    },
  },
  {
    kind: "reusable",
    type: "Section",
    family: "composition-native",
    cutover: "legacy",
    reusableId: "catalog-reusable-section",
    panel: {
      category: "collections",
      label: "section",
      icon: "Square",
      placeable: true,
    },
  },
] as const satisfies readonly ComponentCatalogEntry[];

export function listComponentCatalogEntries(): ComponentCatalogEntry[] {
  return [...componentCatalog];
}

export function getComponentCatalogEntry(
  type: string,
): ComponentCatalogEntry | undefined {
  return componentCatalog.find((entry) => entry.type === type);
}

export function listPlaceableCatalogEntries(): ComponentCatalogEntry[] {
  return componentCatalog.filter(
    (entry) => entry.panel.placeable && entry.cutover === "catalog",
  );
}

export function getCatalogDefaultProps(
  type: string,
): Record<string, unknown> | undefined {
  const entry = getComponentCatalogEntry(type);
  if (entry?.kind !== "primitive" || entry.cutover !== "catalog") {
    return undefined;
  }
  return { ...entry.binding.defaultProps };
}

export {
  getReusableCatalogDocument,
  getReusableCatalogPropsSchema,
  getReusableCatalogRoot,
};
