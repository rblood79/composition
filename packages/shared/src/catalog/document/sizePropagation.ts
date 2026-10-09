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
 * Fields whose control is a RAC `Group` around part instances (ADR-256 Phase 6b): the Group takes
 * no size — the field's reaches the parts in it (the resolver passes the field's control Group,
 * `FIELD_CONTROL_GROUP_HOSTS`). (`Text`: a range picker's separator between its pair.)
 */
const WRAPPED_FIELD_PARTS = [
  ...FIELD_PARTS,
  "Input",
  "DateInput",
  "Button",
  "Text",
] as const;

export const CATALOG_SIZE_PROPAGATION: Readonly<
  Record<string, readonly string[]>
> = {
  ToggleButtonGroup: ["ToggleButton"],
  // ADR-251: group → items wrapper (internal `size`, never edited) → item.
  RadioGroup: ["RadioItems", ...FIELD_PARTS],
  RadioItems: ["Radio"],
  CheckboxGroup: ["CheckboxItems", ...FIELD_PARTS],
  CheckboxItems: ["Checkbox"],
  // ADR-256 Phase 3: Radio = RadioField > RadioButton (indicator + 글자 Label) + Description.
  Radio: ["RadioButton", "Description"],
  RadioButton: ["Label"],
  // ADR-256 Phase 3: Checkbox = CheckboxField > CheckboxButton (indicator + 글자 Label) + Description +
  //   FieldError — size 는 누르는 자리 (내부 운반 값) 를 지나 글자까지.
  Checkbox: ["CheckboxButton", "Description", "FieldError"],
  CheckboxButton: ["Label"],
  // ADR-256 Phase 3: the Switch's hint parts (its text takes the Switch sheet's size font —
  //   `manualBoxRules` Switch).
  Switch: ["Description", "FieldError"],
  Slider: ["SliderTrack", "Label"],
  // TagGroup → TagList (the chip wrapper) → Tag: the chips take the group size. (ADR-256 Phase 5d:
  //   its hint parts — the reference's `Text[description]` · `Text[errorMessage]`.)
  TagGroup: ["TagList", "Label", "Description", "FieldError"],
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
  Meter: ["Label"],
  ProgressBar: ["Label"],
  // ADR-254: an InlineAlert's title and description are instances of the Heading · Description
  //   origins, sized by their own rules at the alert's size (`CATALOG_SIZE_STEP` maps the step).
  InlineAlert: ["Heading", "Description"],
  // 2026-10-09: an S2 IllustratedMessage sizes its picture, heading and content (its contexts).
  IllustratedMessage: ["Illustration", "Heading", "Description"],
};

/**
 * A toggle's group (RAC's group state context — set only by the group, reaching every toggle below
 * it): the nearest ancestor of this type is the toggle's group — for its values (`presence.ts`
 * `catalogToggleGroupOf`) and its size, so a toggle anywhere in the group takes the group's size
 * like every item — one the palette puts straight in a CheckboxGroup · RadioGroup (not its items box)
 * too (Codex Round 21, 2026-10-09 — 사용자 「사용자에게 일관된 경험」).
 */
export const CATALOG_TOGGLE_GROUP_OF: Readonly<Record<string, string>> = {
  Checkbox: "CheckboxGroup",
  Radio: "RadioGroup",
  ToggleButton: "ToggleButtonGroup",
};

/**
 * Layout containers an owner's size reaches through (Codex Round 21, 2026-10-09): RAC's contexts
 * pass a RAC `Group` and a frame, so an item the author wraps in one keeps its group's size (and a
 * field's control Group — ADR-256 Phase 6b — is one of them). Neither type takes a size itself.
 */
export const CATALOG_SIZE_PASS_THROUGH: ReadonlySet<string> = new Set([
  "Group",
  "frame",
]);

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
  // S2 IllustratedMessage (`@react-spectrum/s2/src/IllustratedMessage.tsx`): the picture is M for
  //   S · M and L for L (96 · 96 · 160); the heading `title` · `title-xl` · `title-2xl` (16 · 20 ·
  //   22 — the Heading's 16 · 20 · 24); the content `body-xs` · `body-sm` · `body-sm` (12 · 14 · 14).
  IllustratedMessage: {
    Illustration: { sm: "md", md: "md", lg: "lg" },
    Heading: { sm: "md", md: "xl", lg: "2xl" },
    Description: { sm: "md", md: "lg", lg: "lg" },
  },
};
