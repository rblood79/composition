/**
 * Owner type → the child types its `size` sets (ADR-248 4e-11, 사용자 결정 2026-09-30 — RSP
 * propagates): a RAC group's size reaches its items through context, an item's its label. The
 * child is a structural child (collapsed composite instances skipped). Read by the catalog
 * resolver, so the Canvas rule box and the DOM `data-size` take one resolved value.
 *
 * The old Builder's `propagationRegistry` (`override: true` rules) copied the same sizes on write.
 */
/**
 * ADR-253: a field's parts are instances of the part origins, each sized by its own rule at the
 * field's size (the fields' rules declare no part font).
 */
const FIELD_PARTS = ["Label", "Description", "FieldError"] as const;
/** Fields whose control is an instance of the Input origin: the Input rule sizes it at their size. */
const INPUT_FIELD_PARTS = [...FIELD_PARTS, "Input"] as const;
/** Date fields whose control is an instance of the DateInput origin (the DateInput rule sizes it). */
const DATE_FIELD_PARTS = [...FIELD_PARTS, "DateInput"] as const;

/**
 * Fields whose control is a wrapper (`SelectTrigger` — the field's Group) around part instances:
 * the field's size reaches the wrapper, and the wrapper's its parts (`SelectTrigger` below).
 */
const WRAPPED_FIELD_PARTS = [...FIELD_PARTS, "SelectTrigger"] as const;

export const CATALOG_SIZE_PROPAGATION: Readonly<
  Record<string, readonly string[]>
> = {
  ToggleButtonGroup: ["ToggleButton"],
  // ADR-251: group → items wrapper (internal `size`, never edited) → item.
  RadioGroup: ["RadioItems", ...FIELD_PARTS],
  RadioItems: ["Radio"],
  CheckboxGroup: ["CheckboxItems", ...FIELD_PARTS],
  CheckboxItems: ["Checkbox"],
  Radio: ["Label"],
  Checkbox: ["Label"],
  Slider: ["SliderTrack", "Label"],
  // TagGroup → TagList (the chip wrapper) → Tag: the chips take the group size.
  TagGroup: ["TagList", "Label"],
  TagList: ["Tag"],
  // S2 groups size their members (`AvatarGroup` · `ButtonGroup` `size` = the size of the avatars /
  // buttons inside).
  AvatarGroup: ["Avatar"],
  ButtonGroup: ["Button"],
  // A calendar composes its header and month grid at its own size (the DOM draws both from the
  // calendar's `data-size`): the typed children are painted at it too.
  Calendar: ["CalendarHeader", "CalendarGrid"],
  RangeCalendar: ["CalendarHeader", "CalendarGrid"],
  // ADR-253: a field's parts (`FIELD_PARTS`).
  TextField: INPUT_FIELD_PARTS,
  TextArea: INPUT_FIELD_PARTS,
  NumberField: WRAPPED_FIELD_PARTS,
  SearchField: WRAPPED_FIELD_PARTS,
  ColorField: INPUT_FIELD_PARTS,
  // (A Select's trigger is a Button instance — ADR-253.)
  Select: [...FIELD_PARTS, "Button"],
  ComboBox: WRAPPED_FIELD_PARTS,
  DateField: DATE_FIELD_PARTS,
  TimeField: DATE_FIELD_PARTS,
  DatePicker: WRAPPED_FIELD_PARTS,
  DateRangePicker: WRAPPED_FIELD_PARTS,
  // (`Text`: a range picker's separator between its pair.)
  SelectTrigger: ["Input", "DateInput", "Button", "Text"],
  Meter: ["Label"],
  ProgressBar: ["Label"],
  // ADR-254: an InlineAlert's title and description are instances of the Heading · Description
  //   origins, sized by their own rules at the alert's size (`CATALOG_SIZE_STEP` maps the step).
  InlineAlert: ["Heading", "Description"],
};

/**
 * Owner type → child type → the child's size for each owner size, where the child's rule names
 * the same look one step apart (ADR-254): an InlineAlert's description is one step above its own
 * size (sm/md/lg → Description md/lg/xl = 12/14/16px — the values the alert's rule declared). An
 * owner size missing here passes as is.
 */
export const CATALOG_SIZE_STEP: Readonly<
  Record<string, Readonly<Record<string, Readonly<Record<string, string>>>>>
> = {
  InlineAlert: { Description: { sm: "md", md: "lg", lg: "xl" } },
};
