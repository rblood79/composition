/**
 * ADR-142 — leaf RAC primitive `PrimitiveBinding` barrel + type 조회.
 * family cutover(Phase 6) 진행 시 약 35개 binding 이 여기 누적된다.
 */
import type { PrimitiveBinding } from "../types";
import { badgeBinding } from "./Badge.binding";
import { buttonBinding } from "./Button.binding";
import { calendarBinding } from "./Calendar.binding";
import { checkboxBinding } from "./Checkbox.binding";
import { checkboxGroupBinding } from "./CheckboxGroup.binding";
import { colorFieldBinding } from "./ColorField.binding";
import { comboBoxBinding } from "./ComboBox.binding";
import { dateFieldBinding } from "./DateField.binding";
import { datePickerBinding } from "./DatePicker.binding";
import { dateRangePickerBinding } from "./DateRangePicker.binding";
import { dialogBinding } from "./Dialog.binding";
import { dropZoneBinding } from "./DropZone.binding";
import { fileTriggerBinding } from "./FileTrigger.binding";
import { formBinding } from "./Form.binding";
import { gridListBinding } from "./GridList.binding";
import { iconBinding } from "./Icon.binding";
import { linkBinding } from "./Link.binding";
import { listBoxBinding } from "./ListBox.binding";
import { menuBinding } from "./Menu.binding";
import { meterTrackBinding } from "./MeterTrack.binding";
import { modalBinding } from "./Modal.binding";
import { numberFieldBinding } from "./NumberField.binding";
import { popoverBinding } from "./Popover.binding";
import { progressBarTrackBinding } from "./ProgressBarTrack.binding";
import { radioBinding } from "./Radio.binding";
import { radioGroupBinding } from "./RadioGroup.binding";
import { rangeCalendarBinding } from "./RangeCalendar.binding";
import { searchFieldBinding } from "./SearchField.binding";
import { selectBinding } from "./Select.binding";
import { separatorBinding } from "./Separator.binding";
import { skeletonBinding } from "./Skeleton.binding";
import { sliderBinding } from "./Slider.binding";
import { switchBinding } from "./Switch.binding";
import { tableBinding } from "./Table.binding";
import { tabsBinding } from "./Tabs.binding";
import { tagGroupBinding } from "./TagGroup.binding";
import { textAreaBinding } from "./TextArea.binding";
import { textBinding } from "./Text.binding";
import { textFieldBinding } from "./TextField.binding";
import { timeFieldBinding } from "./TimeField.binding";
import { toggleButtonBinding } from "./ToggleButton.binding";
import { toggleButtonGroupBinding } from "./ToggleButtonGroup.binding";
import { toolbarBinding } from "./Toolbar.binding";
import { tooltipBinding } from "./Tooltip.binding";
import { treeBinding } from "./Tree.binding";

export * from "./Badge.binding";
export * from "./Button.binding";
export * from "./Calendar.binding";
export * from "./Checkbox.binding";
export * from "./CheckboxGroup.binding";
export * from "./ColorField.binding";
export * from "./ComboBox.binding";
export * from "./DateField.binding";
export * from "./DatePicker.binding";
export * from "./DateRangePicker.binding";
export * from "./Dialog.binding";
export * from "./DropZone.binding";
export * from "./FileTrigger.binding";
export * from "./Form.binding";
export * from "./GridList.binding";
export * from "./Icon.binding";
export * from "./Link.binding";
export * from "./ListBox.binding";
export * from "./Menu.binding";
export * from "./MeterTrack.binding";
export * from "./Modal.binding";
export * from "./NumberField.binding";
export * from "./Popover.binding";
export * from "./ProgressBarTrack.binding";
export * from "./Radio.binding";
export * from "./RadioGroup.binding";
export * from "./RangeCalendar.binding";
export * from "./SearchField.binding";
export * from "./Select.binding";
export * from "./Separator.binding";
export * from "./Skeleton.binding";
export * from "./Slider.binding";
export * from "./Switch.binding";
export * from "./Table.binding";
export * from "./Tabs.binding";
export * from "./TagGroup.binding";
export * from "./TextArea.binding";
export * from "./Text.binding";
export * from "./TextField.binding";
export * from "./Tree.binding";
export * from "./TimeField.binding";
export * from "./ToggleButton.binding";
export * from "./ToggleButtonGroup.binding";
export * from "./Toolbar.binding";
export * from "./Tooltip.binding";

/**
 * component type → leaf PrimitiveBinding 조회.
 * Phase 2/4 의 `componentCatalog` 등록 전까지의 primitive lookup seed —
 * generic 렌더러가 "이 type 이 catalog primitive 인가" 를 판정하는 단일 진입점.
 */
const PRIMITIVE_BINDINGS: Readonly<Record<string, PrimitiveBinding>> = {
  // family ① primitives/actions
  Badge: badgeBinding,
  Button: buttonBinding,
  Icon: iconBinding,
  Link: linkBinding,
  Separator: separatorBinding,
  // ADR-912 위험군 해소(선행-3/4): TEXT_LEAF 순수 텍스트 leaf (internal source, DOM generic, Skia box+text)
  Text: textBinding,
  ToggleButton: toggleButtonBinding,
  ToggleButtonGroup: toggleButtonGroupBinding,
  Toolbar: toolbarBinding,
  // ADR-912 단계 5 선행-1: button-like RAC leaf (box+text generic)
  FileTrigger: fileTriggerBinding,
  // ADR-912 단계 5 선행-1: loading placeholder internal leaf (box generic, skeletonVariant 빌더 미노출)
  Skeleton: skeletonBinding,
  // family ② fields
  TextField: textFieldBinding,
  // ADR-912 단계 5 선행-1: multi-line field RAC leaf (box+text generic, _hasChildren shell)
  TextArea: textAreaBinding,
  NumberField: numberFieldBinding,
  SearchField: searchFieldBinding,
  DateField: dateFieldBinding,
  TimeField: timeFieldBinding,
  ColorField: colorFieldBinding,
  Form: formBinding,
  // family ③ selection
  Checkbox: checkboxBinding,
  CheckboxGroup: checkboxGroupBinding,
  Radio: radioBinding,
  RadioGroup: radioGroupBinding,
  Switch: switchBinding,
  Slider: sliderBinding,
  // ADR-912 선행-2: ProgressBar compound 의 value 채움 막대 (Skia-전용 sub-part, value_fill_bar escape)
  ProgressBarTrack: progressBarTrackBinding,
  // ADR-912 선행-2: Meter compound 의 value 채움 막대 (Skia-전용 sub-part, value_fill_bar escape, variant 4색)
  MeterTrack: meterTrackBinding,
  // family ④ collections (internal source — composition wrapper + useCollectionData)
  ListBox: listBoxBinding,
  Menu: menuBinding,
  Select: selectBinding,
  ComboBox: comboBoxBinding,
  Tabs: tabsBinding,
  TagGroup: tagGroupBinding,
  GridList: gridListBinding,
  // family ⑤ Tree·Table (internal source — composition wrapper + useCollectionData, 재귀/2D)
  Tree: treeBinding,
  Table: tableBinding,
  // family ⑥ overlays (internal source — composition wrapper, portal/overlay, skiaLegacy)
  Dialog: dialogBinding,
  Modal: modalBinding,
  Popover: popoverBinding,
  Tooltip: tooltipBinding,
  DropZone: dropZoneBinding,
  // family ⑦ date (internal source — composition wrapper, 날짜 grid/portal, skiaLegacy).
  // color(TailSwatch/ColorPicker 등)는 사용자 지시로 제외.
  Calendar: calendarBinding,
  RangeCalendar: rangeCalendarBinding,
  DatePicker: datePickerBinding,
  DateRangePicker: dateRangePickerBinding,
};

export function getPrimitiveBinding(
  type: string,
): PrimitiveBinding | undefined {
  return PRIMITIVE_BINDINGS[type];
}
