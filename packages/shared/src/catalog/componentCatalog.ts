import { breadcrumbPrimitiveBinding } from "./primitives/breadcrumb";
import { breadcrumbsPrimitiveBinding } from "./primitives/breadcrumbs";
import { buttonPrimitiveBinding } from "./primitives/button";
import { linkPrimitiveBinding } from "./primitives/link";
import { separatorPrimitiveBinding } from "./primitives/separator";
import { toolbarPrimitiveBinding } from "./primitives/toolbar";
import { toggleButtonGroupPrimitiveBinding } from "./primitives/toggleButtonGroup";
import { toggleButtonPrimitiveBinding } from "./primitives/toggleButton";
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
    type: "Breadcrumb",
    family: "primitives/actions",
    cutover: "catalog",
    binding: breadcrumbPrimitiveBinding,
    panel: {
      category: "layout",
      label: "breadcrumb",
      icon: "ChevronRight",
      placeable: false,
    },
  },
  {
    kind: "primitive",
    type: "Breadcrumbs",
    family: "primitives/actions",
    cutover: "catalog",
    binding: breadcrumbsPrimitiveBinding,
    panel: {
      category: "layout",
      label: "breadcrumbs",
      icon: "ChevronRight",
      placeable: true,
    },
  },
  {
    kind: "primitive",
    type: "ToggleButton",
    family: "primitives/actions",
    cutover: "catalog",
    binding: toggleButtonPrimitiveBinding,
    panel: {
      category: "buttons",
      label: "toggle button",
      icon: "ToggleLeft",
      placeable: true,
    },
  },
  {
    kind: "primitive",
    type: "ToggleButtonGroup",
    family: "primitives/actions",
    cutover: "catalog",
    binding: toggleButtonGroupPrimitiveBinding,
    panel: {
      category: "buttons",
      label: "toggle button group",
      icon: "GroupIcon",
      placeable: true,
    },
  },
  {
    kind: "primitive",
    type: "Toolbar",
    family: "primitives/actions",
    cutover: "catalog",
    binding: toolbarPrimitiveBinding,
    panel: {
      category: "buttons",
      label: "toolbar",
      icon: "Settings",
      placeable: true,
    },
  },
  {
    kind: "primitive",
    type: "Link",
    family: "primitives/actions",
    cutover: "catalog",
    binding: linkPrimitiveBinding,
    panel: {
      category: "layout",
      label: "link",
      icon: "Link",
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
