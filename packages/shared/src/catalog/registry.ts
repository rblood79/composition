import type { PrimitiveBinding } from "./types";
import { buttonInspectorThemeValues } from "./primitives/button";
import { checkboxGroupInspectorThemeValues } from "./primitives/checkboxGroup";
import { checkboxInspectorThemeValues } from "./primitives/checkbox";
import { colorFieldInspectorThemeValues } from "./primitives/colorField";
import { dateFieldInspectorThemeValues } from "./primitives/dateField";
import { formInspectorThemeValues } from "./primitives/form";
import { gridListInspectorThemeValues } from "./primitives/gridList";
import { linkInspectorThemeValues } from "./primitives/link";
import { listBoxInspectorThemeValues } from "./primitives/listBox";
import { menuInspectorThemeValues } from "./primitives/menu";
import { numberFieldInspectorThemeValues } from "./primitives/numberField";
import { radioGroupInspectorThemeValues } from "./primitives/radioGroup";
import { radioInspectorThemeValues } from "./primitives/radio";
import { searchFieldInspectorThemeValues } from "./primitives/searchField";
import { sliderInspectorThemeValues } from "./primitives/slider";
import { switchInspectorThemeValues } from "./primitives/switch";
import { tagGroupInspectorThemeValues } from "./primitives/tagGroup";
import { textFieldInspectorThemeValues } from "./primitives/textField";
import { timeFieldInspectorThemeValues } from "./primitives/timeField";
import type { InspectorThemeLookup } from "./outputs/inspectorFields";
import { componentCatalog } from "./componentCatalog";

const PRIMITIVE_BINDINGS = Object.fromEntries(
  componentCatalog
    .filter((entry) => entry.kind === "primitive")
    .map((entry) => [entry.type, entry.binding as PrimitiveBinding]),
) as Record<string, PrimitiveBinding>;

export function getPrimitiveBinding(
  type: string,
): PrimitiveBinding | undefined {
  return PRIMITIVE_BINDINGS[type];
}

export function isPrimitiveBindingType(type: string): boolean {
  return getPrimitiveBinding(type) !== undefined;
}

export function getPrimitiveInspectorThemeValues(
  type: string,
): InspectorThemeLookup {
  if (type === "Button") return buttonInspectorThemeValues;
  if (type === "Checkbox") return checkboxInspectorThemeValues;
  if (type === "CheckboxGroup") return checkboxGroupInspectorThemeValues;
  if (type === "Link") return linkInspectorThemeValues;
  if (type === "GridList") return gridListInspectorThemeValues;
  if (type === "ListBox") return listBoxInspectorThemeValues;
  if (type === "TagGroup") return tagGroupInspectorThemeValues;
  if (type === "Menu") return menuInspectorThemeValues;
  if (type === "TextField") return textFieldInspectorThemeValues;
  if (type === "NumberField") return numberFieldInspectorThemeValues;
  if (type === "SearchField") return searchFieldInspectorThemeValues;
  if (type === "Radio") return radioInspectorThemeValues;
  if (type === "RadioGroup") return radioGroupInspectorThemeValues;
  if (type === "Slider") return sliderInspectorThemeValues;
  if (type === "Switch") return switchInspectorThemeValues;
  if (type === "DateField") return dateFieldInspectorThemeValues;
  if (type === "TimeField") return timeFieldInspectorThemeValues;
  if (type === "ColorField") return colorFieldInspectorThemeValues;
  if (type === "Form") return formInspectorThemeValues;
  return {};
}

export const primitiveBindings = PRIMITIVE_BINDINGS;
