import { breadcrumbPrimitiveBinding } from "./primitives/breadcrumb";
import { breadcrumbsPrimitiveBinding } from "./primitives/breadcrumbs";
import { buttonPrimitiveBinding } from "./primitives/button";
import { colorFieldPrimitiveBinding } from "./primitives/colorField";
import { dateFieldPrimitiveBinding } from "./primitives/dateField";
import { fileTriggerPrimitiveBinding } from "./primitives/fileTrigger";
import { formPrimitiveBinding } from "./primitives/form";
import { linkPrimitiveBinding } from "./primitives/link";
import { numberFieldPrimitiveBinding } from "./primitives/numberField";
import { searchFieldPrimitiveBinding } from "./primitives/searchField";
import { separatorPrimitiveBinding } from "./primitives/separator";
import { switchPrimitiveBinding } from "./primitives/switch";
import { textFieldPrimitiveBinding } from "./primitives/textField";
import { timeFieldPrimitiveBinding } from "./primitives/timeField";
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
    kind: "primitive",
    type: "TextField",
    family: "fields",
    cutover: "catalog",
    binding: textFieldPrimitiveBinding,
    panel: {
      category: "forms",
      label: "text field",
      icon: "RectangleEllipsis",
      placeable: true,
    },
  },
  {
    kind: "primitive",
    type: "NumberField",
    family: "fields",
    cutover: "catalog",
    binding: numberFieldPrimitiveBinding,
    panel: {
      category: "forms",
      label: "number field",
      icon: "Hash",
      placeable: true,
    },
  },
  {
    kind: "primitive",
    type: "SearchField",
    family: "fields",
    cutover: "catalog",
    binding: searchFieldPrimitiveBinding,
    panel: {
      category: "forms",
      label: "search field",
      icon: "Search",
      placeable: true,
    },
  },
  {
    kind: "primitive",
    type: "DateField",
    family: "fields",
    cutover: "catalog",
    binding: dateFieldPrimitiveBinding,
    panel: {
      category: "dateTime",
      label: "date field",
      icon: "CalendarCheck",
      placeable: true,
    },
  },
  {
    kind: "primitive",
    type: "TimeField",
    family: "fields",
    cutover: "catalog",
    binding: timeFieldPrimitiveBinding,
    panel: {
      category: "dateTime",
      label: "time field",
      icon: "ChevronDown",
      placeable: true,
    },
  },
  {
    kind: "primitive",
    type: "ColorField",
    family: "fields",
    cutover: "catalog",
    binding: colorFieldPrimitiveBinding,
    panel: {
      category: "forms",
      label: "color field",
      icon: "Palette",
      placeable: true,
    },
  },
  {
    kind: "primitive",
    type: "Form",
    family: "fields",
    cutover: "catalog",
    binding: formPrimitiveBinding,
    panel: {
      category: "forms",
      label: "form",
      icon: "GroupIcon",
      placeable: true,
    },
  },
  {
    kind: "primitive",
    type: "FileTrigger",
    family: "fields",
    cutover: "catalog",
    binding: fileTriggerPrimitiveBinding,
    panel: {
      category: "forms",
      label: "file trigger",
      icon: "Upload",
      placeable: true,
    },
  },
  {
    kind: "primitive",
    type: "Switch",
    family: "selection",
    cutover: "catalog",
    binding: switchPrimitiveBinding,
    panel: {
      category: "forms",
      label: "switch",
      icon: "ToggleLeft",
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
