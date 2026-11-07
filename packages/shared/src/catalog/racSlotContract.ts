/** Actual controller context consumed by each catalog type. */
export const CATALOG_RAC_SLOT_CONSUMERS = {
  Text: "Text",
  Description: "Text",
  Heading: "Heading",
  Button: "Button",
  ActionButton: "Button",
  DateInput: "DateField",
  Checkbox: "Checkbox",
  SegmentedControl: "ToggleButtonGroup",
  SegmentedControlItem: "ToggleButton",
  SelectBoxGroup: "ListBox",
  Link: "Link",
  LinkButton: "Link",
  Slider: "Slider",
  RangeSlider: "Slider",
  ActionBar: "ActionBar",
  Keyboard: "Keyboard",
  Separator: "Separator",
  Badge: "Badge",
  ProgressBar: "ProgressBar",
  Meter: "Meter",
  Avatar: "Avatar",
  AvatarGroup: "AvatarGroup",
  StatusLight: "StatusLight",
  InlineAlert: "InlineAlert",
  ProgressCircle: "ProgressCircle",
  Image: "Image",
  Tabs: "Tabs",
  Breadcrumbs: "Breadcrumbs",
  SideNav: "NavigationTree",
  Menu: "Menu",
  Accordion: "Accordion",
  Disclosure: "Disclosure",
  CardView: "GridList",
  ActionButtonGroup: "Toolbar",
  ToggleButton: "ToggleButton",
  ToggleButtonGroup: "ToggleButtonGroup",
  Toolbar: "Toolbar",
  ButtonGroup: "ButtonGroup",
  TextField: "TextField",
  TextArea: "TextField",
  NumberField: "NumberField",
  SearchField: "SearchField",
  Autocomplete: "Autocomplete",
  ColorField: "ColorField",
  ColorArea: "ColorArea",
  ColorSlider: "ColorSlider",
  ColorWheel: "ColorWheel",
  ColorSwatch: "ColorSwatch",
  ColorSwatchPicker: "ColorSwatchPicker",
  CheckboxGroup: "CheckboxGroup",
  RadioGroup: "RadioGroup",
  Select: "Select",
  ComboBox: "ComboBox",
  Switch: "Switch",
  DropZone: "DropZone",
  Table: "Table",
  ListBox: "ListBox",
  GridList: "GridList",
  Tree: "Tree",
  TagGroup: "TagGroup",
  Calendar: "Calendar",
  DatePicker: "DatePicker",
  DateRangePicker: "DateRangePicker",
  DateField: "DateField",
  TimeField: "TimeField",
  RangeCalendar: "RangeCalendar",
  Dialog: "Dialog",
  Popover: "Popover",
} as const;

export type CatalogSlotContextKey =
  (typeof CATALOG_RAC_SLOT_CONSUMERS)[keyof typeof CATALOG_RAC_SLOT_CONSUMERS];

/** S2 controllers implemented by catalog elements instead of a RAC controller. */
export const CATALOG_LOCAL_SLOT_CONTEXTS = [
  "Badge",
  "Avatar",
  "AvatarGroup",
  "StatusLight",
  "InlineAlert",
  "ProgressCircle",
  "Image",
  "ButtonGroup",
  "Accordion",
] as const;

/** Sheet forwards its slot to DOM; RAC exposes no slotted Sheet context. */
export const CATALOG_DOM_SLOT_TYPES: ReadonlySet<string> = new Set(["Sheet"]);

/** Context names for both the runtime and the installed-RAC provider inventory. */
export const CATALOG_NATIVE_SLOT_CONTEXT_NAMES = Object.fromEntries(
  [...new Set(Object.values(CATALOG_RAC_SLOT_CONSUMERS))]
    .filter(
      (key) =>
        key !== "ActionBar" &&
        !(CATALOG_LOCAL_SLOT_CONTEXTS as readonly string[]).includes(key),
    )
    .map((key) => [
      key,
      key === "Checkbox" ? "CheckboxFieldContext" : `${key}Context`,
    ]),
) as Readonly<Record<string, string>>;

export function catalogHasSlotContract(type: string): boolean {
  return type in CATALOG_RAC_SLOT_CONSUMERS || CATALOG_DOM_SLOT_TYPES.has(type);
}
