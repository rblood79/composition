/**
 * ADR-256 Decision 5 — the parts RAC needs for the owner to work. Measured on the installed RAC
 * 1.21.0 (G0 ⑨ `missing` — the owner rendered without the part keeps no error but loses its role:
 * a Select without its Button has no trigger, a field without its Input no textbox …). The
 * contract is **existence and context**: such a part cannot be deleted or moved out of its owner;
 * reordering inside the owner, wrapping it in a Group · Frame, or swapping it for another origin of
 * the same type stays allowed. Collection items are not here — RAC allows an empty collection; an
 * item's tie to its collection is the nesting owners check (`RAC_SUBPART_OWNER_TYPES`).
 *
 * Keys are catalog types as the document holds them today (a family not converted yet keeps its own
 * shape — a Select's ListBox sits in the Select, not in a Popover node).
 */
export const RAC_REQUIRED_PARTS: Readonly<
  Record<string, readonly (readonly string[])[]>
> = {
  Select: [["Button"], ["ListBox"]],
  ComboBox: [["Input"], ["ListBox"]],
  TextField: [["Input"]],
  TextArea: [["Input"]],
  NumberField: [["Input"]],
  SearchField: [["Input"]],
  ColorField: [["Input"]],
  DateField: [["DateInput"]],
  TimeField: [["DateInput"]],
  DatePicker: [["DateInput"]],
  DateRangePicker: [["DateInput"]],
  Slider: [["SliderTrack"], ["SliderThumb"]],
  Calendar: [["CalendarGrid"]],
  RangeCalendar: [["CalendarGrid"]],
  Disclosure: [["DisclosureHeader"]],
  Tabs: [["TabList"]],
  TagGroup: [["TagList"]],
  // ADR-256 Phase 3 (G0 ⑨): CheckboxField without its CheckboxButton has no checkbox input.
  Checkbox: [["CheckboxButton"]],
  DialogTrigger: [["Button"], ["Dialog", "Popover", "Modal"]],
  TooltipTrigger: [["Button"], ["Tooltip"]],
  Table: [["TableHeader"]],
  TableView: [["TableHeader"]],
};

/** Every part type some owner needs (a subtree without one needs no ancestor read). */
export const RAC_REQUIRED_PART_TYPES: ReadonlySet<string> = new Set(
  Object.values(RAC_REQUIRED_PARTS).flatMap((parts) => parts.flat()),
);

/**
 * The nearest owner (in `ancestorTypes`, nearest first) that needs a part of `type`, if any. The
 * search stops at the first ancestor that needs it — a Button inside a Select's ListBox item is not
 * the Select's trigger, but RAC reads the nearest one the same way.
 */
export function requiredPartOwner(
  type: string,
  ancestorTypes: readonly string[],
): string | undefined {
  for (const ancestor of ancestorTypes) {
    const parts = RAC_REQUIRED_PARTS[ancestor];
    if (parts?.some((alternatives) => alternatives.includes(type)))
      return ancestor;
  }
  return undefined;
}
