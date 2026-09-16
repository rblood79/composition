/**
 * RAC reference의 주요 기능을 추천 순서로만 사용한다 (허용 prop/value 정본 아님).
 * 근거: .claude/skills/react-aria/references/components/<reference>.md의 해당 API/기능 절.
 * 실제 노출·값·실행 가능 여부는 resolveEditContract + compiler validator가 결정한다.
 */
export interface RacSuggestionFeatures {
  reference: string;
  fields: readonly string[];
}
const feature = (
  reference: string,
  ...fields: string[]
): RacSuggestionFeatures => ({ reference, fields });
export const racSuggestionFeatures: Readonly<
  Record<string, RacSuggestionFeatures>
> = {
  Button: feature("Button", "isPending", "type"),
  ToggleButton: feature("ToggleButton", "isSelected"),
  ToggleButtonGroup: feature(
    "ToggleButtonGroup",
    "selectionMode",
    "disallowEmptySelection",
    "orientation",
  ),
  Checkbox: feature(
    "Checkbox",
    "isIndeterminate",
    "isSelected",
    "isRequired",
    "isReadOnly",
  ),
  CheckboxGroup: feature(
    "CheckboxGroup",
    "isRequired",
    "orientation",
    "isReadOnly",
  ),
  Switch: feature("Switch", "isSelected", "isReadOnly"),
  RadioGroup: feature("RadioGroup", "orientation", "isRequired", "isReadOnly"),
  Select: feature("Select", "selectionMode", "isRequired", "isInvalid"),
  ComboBox: feature(
    "ComboBox",
    "allowsCustomValue",
    "menuTrigger",
    "isRequired",
    "isReadOnly",
  ),
  TextField: feature(
    "TextField",
    "type",
    "isRequired",
    "isReadOnly",
    "inputMode",
  ),
  SearchField: feature("SearchField", "isRequired", "isReadOnly", "inputMode"),
  NumberField: feature(
    "NumberField",
    "step",
    "isWheelDisabled",
    "isReadOnly",
    "isRequired",
  ),
  Slider: feature("Slider", "step", "value"),
  ProgressBar: feature("ProgressBar", "isIndeterminate", "value"),
  Meter: feature("Meter", "value"),
  ListBox: feature("ListBox", "selectionMode", "disallowEmptySelection"),
  GridList: feature("GridList", "selectionMode", "disallowEmptySelection"),
  Table: feature("Table", "selectionMode"),
  Tree: feature("Tree", "selectionMode", "disallowEmptySelection"),
  TagGroup: feature("TagGroup", "selectionMode", "disallowEmptySelection"),
  Menu: feature("Menu", "selectionMode"),
  Tabs: feature("Tabs", "orientation"),
  Disclosure: feature("Disclosure", "isExpanded"),
  DisclosureGroup: feature("DisclosureGroup", "allowsMultipleExpanded"),
  Calendar: feature("Calendar", "pageBehavior", "isReadOnly"),
  RangeCalendar: feature("RangeCalendar", "pageBehavior", "isReadOnly"),
  DateField: feature(
    "DateField",
    "granularity",
    "hourCycle",
    "hideTimeZone",
    "shouldForceLeadingZeros",
  ),
  DatePicker: feature(
    "DatePicker",
    "granularity",
    "hideTimeZone",
    "isReadOnly",
  ),
  DateRangePicker: feature(
    "DateRangePicker",
    "granularity",
    "hourCycle",
    "hideTimeZone",
  ),
  TimeField: feature(
    "TimeField",
    "hourCycle",
    "granularity",
    "shouldForceLeadingZeros",
    "hideTimeZone",
  ),
  Modal: feature("Modal", "isOpen"),
  Popover: feature("Popover", "placement"),
  Tooltip: feature("Tooltip", "placement"),
  ColorField: feature("ColorField", "channel", "isReadOnly"),
  ColorSlider: feature("ColorSlider", "orientation"),
  FileTrigger: feature("FileTrigger", "allowsMultiple", "acceptDirectory"),
  Form: feature("Form", "validationBehavior", "method"),
  Link: feature("Link", "target"),
  Toolbar: feature("Toolbar", "orientation"),
  Separator: feature("Separator", "orientation"),
};
