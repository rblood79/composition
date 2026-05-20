import { breadcrumbPrimitiveBinding } from "./primitives/breadcrumb";
import { breadcrumbsPrimitiveBinding } from "./primitives/breadcrumbs";
import { buttonPrimitiveBinding } from "./primitives/button";
import { checkboxGroupPrimitiveBinding } from "./primitives/checkboxGroup";
import { checkboxPrimitiveBinding } from "./primitives/checkbox";
import { colorFieldPrimitiveBinding } from "./primitives/colorField";
import { comboBoxPrimitiveBinding } from "./primitives/comboBox";
import { dateFieldPrimitiveBinding } from "./primitives/dateField";
import { dialogPrimitiveBinding } from "./primitives/dialog";
import { dropZonePrimitiveBinding } from "./primitives/dropZone";
import { fileTriggerPrimitiveBinding } from "./primitives/fileTrigger";
import { formPrimitiveBinding } from "./primitives/form";
import { gridListPrimitiveBinding } from "./primitives/gridList";
import { linkPrimitiveBinding } from "./primitives/link";
import { listBoxPrimitiveBinding } from "./primitives/listBox";
import { menuPrimitiveBinding } from "./primitives/menu";
import { numberFieldPrimitiveBinding } from "./primitives/numberField";
import { popoverPrimitiveBinding } from "./primitives/popover";
import { radioGroupPrimitiveBinding } from "./primitives/radioGroup";
import { radioPrimitiveBinding } from "./primitives/radio";
import { searchFieldPrimitiveBinding } from "./primitives/searchField";
import { selectPrimitiveBinding } from "./primitives/select";
import { separatorPrimitiveBinding } from "./primitives/separator";
import { sliderPrimitiveBinding } from "./primitives/slider";
import { switchPrimitiveBinding } from "./primitives/switch";
import {
  tablePrimitiveBinding,
  tableViewPrimitiveBinding,
} from "./primitives/table";
import { tabsPrimitiveBinding } from "./primitives/tabs";
import { tagGroupPrimitiveBinding } from "./primitives/tagGroup";
import { textFieldPrimitiveBinding } from "./primitives/textField";
import { timeFieldPrimitiveBinding } from "./primitives/timeField";
import { tooltipPrimitiveBinding } from "./primitives/tooltip";
import { toolbarPrimitiveBinding } from "./primitives/toolbar";
import { toggleButtonGroupPrimitiveBinding } from "./primitives/toggleButtonGroup";
import { toggleButtonPrimitiveBinding } from "./primitives/toggleButton";
import { treePrimitiveBinding } from "./primitives/tree";
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
    type: "DropZone",
    family: "overlays",
    cutover: "catalog",
    binding: dropZonePrimitiveBinding,
    panel: {
      category: "forms",
      label: "drop zone",
      icon: "Upload",
      placeable: true,
    },
  },
  {
    kind: "primitive",
    type: "Tooltip",
    family: "overlays",
    cutover: "catalog",
    binding: tooltipPrimitiveBinding,
    panel: {
      category: "overlays",
      label: "tooltip",
      icon: "MessageSquare",
      placeable: true,
    },
  },
  {
    kind: "primitive",
    type: "Dialog",
    family: "overlays",
    cutover: "catalog",
    binding: dialogPrimitiveBinding,
    panel: {
      category: "overlays",
      label: "dialog",
      icon: "AppWindowMac",
      placeable: true,
    },
  },
  {
    kind: "primitive",
    type: "Popover",
    family: "overlays",
    cutover: "catalog",
    binding: popoverPrimitiveBinding,
    panel: {
      category: "overlays",
      label: "popover",
      icon: "AppWindowMac",
      placeable: true,
    },
  },
  {
    kind: "primitive",
    type: "Checkbox",
    family: "selection",
    cutover: "catalog",
    binding: checkboxPrimitiveBinding,
    panel: {
      category: "forms",
      label: "checkbox",
      icon: "CheckSquare",
      placeable: true,
    },
  },
  {
    kind: "primitive",
    type: "CheckboxGroup",
    family: "selection",
    cutover: "catalog",
    binding: checkboxGroupPrimitiveBinding,
    panel: {
      category: "forms",
      label: "checkbox group",
      icon: "ListChecks",
      placeable: true,
    },
  },
  {
    kind: "primitive",
    type: "Radio",
    family: "selection",
    cutover: "catalog",
    binding: radioPrimitiveBinding,
    panel: {
      category: "forms",
      label: "radio",
      icon: "CircleDot",
      placeable: false,
    },
  },
  {
    kind: "primitive",
    type: "RadioGroup",
    family: "selection",
    cutover: "catalog",
    binding: radioGroupPrimitiveBinding,
    panel: {
      category: "forms",
      label: "radio group",
      icon: "GroupIcon",
      placeable: true,
    },
  },
  {
    kind: "primitive",
    type: "Slider",
    family: "selection",
    cutover: "catalog",
    binding: sliderPrimitiveBinding,
    panel: {
      category: "forms",
      label: "slider",
      icon: "SlidersHorizontal",
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
    kind: "primitive",
    type: "ListBox",
    family: "collections",
    cutover: "catalog",
    binding: listBoxPrimitiveBinding,
    panel: {
      category: "collections",
      label: "list box",
      icon: "ListIcon",
      placeable: true,
    },
  },
  {
    kind: "primitive",
    type: "GridList",
    family: "collections",
    cutover: "catalog",
    binding: gridListPrimitiveBinding,
    panel: {
      category: "collections",
      label: "grid list",
      icon: "Grid",
      placeable: true,
    },
  },
  {
    kind: "primitive",
    type: "TagGroup",
    family: "collections",
    cutover: "catalog",
    binding: tagGroupPrimitiveBinding,
    panel: {
      category: "collections",
      label: "tag group",
      icon: "Tags",
      placeable: true,
    },
  },
  {
    kind: "primitive",
    type: "Menu",
    family: "collections",
    cutover: "catalog",
    binding: menuPrimitiveBinding,
    panel: {
      category: "buttons",
      label: "menu",
      icon: "Menu",
      placeable: true,
    },
  },
  {
    kind: "primitive",
    type: "ComboBox",
    family: "collections",
    cutover: "catalog",
    binding: comboBoxPrimitiveBinding,
    panel: {
      category: "forms",
      label: "combo box",
      icon: "ChevronDown",
      placeable: true,
    },
  },
  {
    kind: "primitive",
    type: "Select",
    family: "collections",
    cutover: "catalog",
    binding: selectPrimitiveBinding,
    panel: {
      category: "forms",
      label: "select",
      icon: "ChevronDown",
      placeable: true,
    },
  },
  {
    kind: "primitive",
    type: "Tabs",
    family: "collections",
    cutover: "catalog",
    binding: tabsPrimitiveBinding,
    panel: {
      category: "collections",
      label: "tabs",
      icon: "Layers",
      placeable: true,
    },
  },
  {
    kind: "primitive",
    type: "Tree",
    family: "tree-table",
    cutover: "catalog",
    binding: treePrimitiveBinding,
    panel: {
      category: "collections",
      label: "tree",
      icon: "ListTree",
      placeable: true,
    },
  },
  {
    kind: "primitive",
    type: "Table",
    family: "tree-table",
    cutover: "catalog",
    binding: tablePrimitiveBinding,
    panel: {
      category: "collections",
      label: "table",
      icon: "TableProperties",
      placeable: true,
    },
  },
  {
    kind: "primitive",
    type: "TableView",
    family: "tree-table",
    cutover: "catalog",
    binding: tableViewPrimitiveBinding,
    panel: {
      category: "collections",
      label: "table view",
      icon: "TableProperties",
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
