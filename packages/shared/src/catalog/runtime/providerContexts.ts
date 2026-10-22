import type { Context } from "react";
import {
  ButtonContext,
  CalendarContext,
  CheckboxContext,
  CheckboxGroupContext,
  ColorAreaContext,
  ColorFieldContext,
  ColorSliderContext,
  ColorWheelContext,
  ComboBoxContext,
  DateFieldContext,
  DatePickerContext,
  DateRangePickerContext,
  DisclosureContext,
  LinkContext,
  NumberFieldContext,
  RadioGroupContext,
  RangeCalendarContext,
  SearchFieldContext,
  SelectContext,
  SliderContext,
  SwitchContext,
  TabsContext,
  TextFieldContext,
  TimeFieldContext,
  ToggleButtonContext,
  ToggleButtonGroupContext,
  type ContextValue,
} from "react-aria-components";

/**
 * ADR-281 Decision 3 — the RAC contexts a page root's · frame's `Provider` fills, and which of the
 * inherited props each takes. Each row is checked against the installed RAC: `reaches` accepts a
 * prop only if the context's props type declares it (`RAC_PROVIDER_CHECK` — a prop RAC does not
 * take there is a compile error). RAC's own rules then apply inside (Phase 0 probe): a component's
 * own value wins (P4); a context RAC supplies inside wins (a Select's trigger Button P1, a Dialog's
 * Button P3); a CheckboxGroup's Checkbox still reads the outer one (P2).
 */
export type CatalogInheritedFlag = "isDisabled" | "isReadOnly" | "isRequired";

type PropsOf<C> = C extends Context<ContextValue<infer P, infer _E>> ? P : never;

/** One row: the catalog type a context is for, the context, and the inherited props it takes. */
export interface CatalogProviderRow {
  type: string;
  context: Context<unknown>;
  props: readonly CatalogInheritedFlag[];
}

function reaches<C extends Context<ContextValue<any, any>>>(
  type: string,
  context: C,
  props: readonly Extract<keyof PropsOf<C>, CatalogInheritedFlag>[],
): CatalogProviderRow {
  return { type, context: context as unknown as Context<unknown>, props };
}

const ALL = ["isDisabled", "isReadOnly", "isRequired"] as const;
const EDITABLE = ["isDisabled", "isReadOnly"] as const;

export const RAC_PROVIDER_CHECK = [
  reaches("Button", ButtonContext, ["isDisabled"]),
  reaches("ToggleButton", ToggleButtonContext, ["isDisabled"]),
  reaches("ToggleButtonGroup", ToggleButtonGroupContext, ["isDisabled"]),
  reaches("Link", LinkContext, ["isDisabled"]),
  reaches("Checkbox", CheckboxContext, ALL),
  reaches("CheckboxGroup", CheckboxGroupContext, ALL),
  reaches("Switch", SwitchContext, EDITABLE),
  reaches("RadioGroup", RadioGroupContext, ALL),
  reaches("TextField", TextFieldContext, ALL),
  reaches("NumberField", NumberFieldContext, ALL),
  reaches("SearchField", SearchFieldContext, ALL),
  reaches("Select", SelectContext, ["isDisabled", "isRequired"]),
  reaches("ComboBox", ComboBoxContext, ALL),
  reaches("Slider", SliderContext, ["isDisabled"]),
  reaches("DateField", DateFieldContext, ALL),
  reaches("TimeField", TimeFieldContext, ALL),
  reaches("DatePicker", DatePickerContext, ALL),
  reaches("DateRangePicker", DateRangePickerContext, ALL),
  reaches("Calendar", CalendarContext, EDITABLE),
  reaches("RangeCalendar", RangeCalendarContext, EDITABLE),
  reaches("ColorField", ColorFieldContext, ALL),
  reaches("ColorArea", ColorAreaContext, ["isDisabled"]),
  reaches("ColorSlider", ColorSliderContext, ["isDisabled"]),
  reaches("ColorWheel", ColorWheelContext, ["isDisabled"]),
  reaches("Tabs", TabsContext, ["isDisabled"]),
  reaches("Disclosure", DisclosureContext, ["isDisabled"]),
] as const satisfies readonly CatalogProviderRow[];

/** Per catalog type: the inherited props its RAC context takes (Canvas · dispatcher read it). */
export const CATALOG_INHERITED_RECEIVERS: ReadonlyMap<
  string,
  readonly CatalogInheritedFlag[]
> = new Map(RAC_PROVIDER_CHECK.map((row) => [row.type, row.props]));

/** The `Provider` values for the inherited flags in force (only the contexts that take one). */
export function catalogProviderValues(
  flags: Readonly<Partial<Record<CatalogInheritedFlag, boolean>>>,
): [Context<unknown>, Record<string, boolean>][] {
  const out: [Context<unknown>, Record<string, boolean>][] = [];
  for (const { context, props } of RAC_PROVIDER_CHECK) {
    const value: Record<string, boolean> = {};
    for (const prop of props)
      if (flags[prop] !== undefined) value[prop] = flags[prop]!;
    if (Object.keys(value).length) out.push([context, value]);
  }
  return out;
}
