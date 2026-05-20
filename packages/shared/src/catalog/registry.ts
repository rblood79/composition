import type { PrimitiveBinding } from "./types";
import { buttonInspectorThemeValues } from "./primitives/button";
import { colorFieldInspectorThemeValues } from "./primitives/colorField";
import { dateFieldInspectorThemeValues } from "./primitives/dateField";
import { formInspectorThemeValues } from "./primitives/form";
import { linkInspectorThemeValues } from "./primitives/link";
import { numberFieldInspectorThemeValues } from "./primitives/numberField";
import { searchFieldInspectorThemeValues } from "./primitives/searchField";
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
  if (type === "Link") return linkInspectorThemeValues;
  if (type === "TextField") return textFieldInspectorThemeValues;
  if (type === "NumberField") return numberFieldInspectorThemeValues;
  if (type === "SearchField") return searchFieldInspectorThemeValues;
  if (type === "DateField") return dateFieldInspectorThemeValues;
  if (type === "TimeField") return timeFieldInspectorThemeValues;
  if (type === "ColorField") return colorFieldInspectorThemeValues;
  if (type === "Form") return formInspectorThemeValues;
  return {};
}

export const primitiveBindings = PRIMITIVE_BINDINGS;
