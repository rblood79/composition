/**
 * ADR-142 — leaf RAC primitive `PrimitiveBinding` barrel + type 조회.
 * family cutover(Phase 6) 진행 시 약 35개 binding 이 여기 누적된다.
 */
import type { PrimitiveBinding } from "../types";
import { avatarBinding } from "./Avatar.binding";
import { badgeBinding } from "./Badge.binding";
import { bodyBinding } from "./Body.binding";
import { breadcrumbsBinding } from "./Breadcrumbs.binding";
import { buttonBinding } from "./Button.binding";
import { calendarBinding } from "./Calendar.binding";
import { checkboxBinding } from "./Checkbox.binding";
import { checkboxGroupBinding } from "./CheckboxGroup.binding";
import { codeBinding } from "./Code.binding";
import { colorFieldBinding } from "./ColorField.binding";
import { comboBoxBinding } from "./ComboBox.binding";
import { dateFieldBinding } from "./DateField.binding";
import { datePickerBinding } from "./DatePicker.binding";
import { dateRangePickerBinding } from "./DateRangePicker.binding";
import { descriptionBinding } from "./Description.binding";
import { dialogBinding } from "./Dialog.binding";
import { disclosureHeaderBinding } from "./DisclosureHeader.binding";
import { dropZoneBinding } from "./DropZone.binding";
import { fieldErrorBinding } from "./FieldError.binding";
import { fileTriggerBinding } from "./FileTrigger.binding";
import { formBinding } from "./Form.binding";
import { gridListBinding } from "./GridList.binding";
import { headingBinding } from "./Heading.binding";
import { iconBinding } from "./Icon.binding";
import { illustratedMessageBinding } from "./IllustratedMessage.binding";
import { inlineAlertBinding } from "./InlineAlert.binding";
import { inputBinding } from "./Input.binding";
import { kbdBinding } from "./Kbd.binding";
import { labelBinding } from "./Label.binding";
import { linkBinding } from "./Link.binding";
import { listBoxBinding } from "./ListBox.binding";
import { menuBinding } from "./Menu.binding";
import { meterBinding } from "./Meter.binding";
import { meterTrackBinding } from "./MeterTrack.binding";
import { modalBinding } from "./Modal.binding";
import { navBinding } from "./Nav.binding";
import { numberFieldBinding } from "./NumberField.binding";
import { paragraphBinding } from "./Paragraph.binding";
import { popoverBinding } from "./Popover.binding";
import { progressBarBinding } from "./ProgressBar.binding";
import { progressBarTrackBinding } from "./ProgressBarTrack.binding";
import { progressCircleBinding } from "./ProgressCircle.binding";
import { radioBinding } from "./Radio.binding";
import { radioGroupBinding } from "./RadioGroup.binding";
import { rangeCalendarBinding } from "./RangeCalendar.binding";
import { searchFieldBinding } from "./SearchField.binding";
import { sectionBinding } from "./Section.binding";
import { selectBinding } from "./Select.binding";
import { separatorBinding } from "./Separator.binding";
import { skeletonBinding } from "./Skeleton.binding";
import { sliderBinding } from "./Slider.binding";
import { statusLightBinding } from "./StatusLight.binding";
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

export * from "./Avatar.binding";
export * from "./Badge.binding";
export * from "./Body.binding";
export * from "./Breadcrumbs.binding";
export * from "./Button.binding";
export * from "./Calendar.binding";
export * from "./Checkbox.binding";
export * from "./CheckboxGroup.binding";
export * from "./Code.binding";
export * from "./ColorField.binding";
export * from "./ComboBox.binding";
export * from "./DateField.binding";
export * from "./DatePicker.binding";
export * from "./DateRangePicker.binding";
export * from "./Description.binding";
export * from "./Dialog.binding";
export * from "./DisclosureHeader.binding";
export * from "./DropZone.binding";
export * from "./FieldError.binding";
export * from "./FileTrigger.binding";
export * from "./Form.binding";
export * from "./GridList.binding";
export * from "./Heading.binding";
export * from "./Icon.binding";
export * from "./IllustratedMessage.binding";
export * from "./InlineAlert.binding";
export * from "./Kbd.binding";
export * from "./Label.binding";
export * from "./Link.binding";
export * from "./ListBox.binding";
export * from "./Menu.binding";
export * from "./Meter.binding";
export * from "./MeterTrack.binding";
export * from "./Modal.binding";
export * from "./Nav.binding";
export * from "./NumberField.binding";
export * from "./Paragraph.binding";
export * from "./Popover.binding";
export * from "./ProgressBar.binding";
export * from "./ProgressBarTrack.binding";
export * from "./ProgressCircle.binding";
export * from "./Radio.binding";
export * from "./RadioGroup.binding";
export * from "./RangeCalendar.binding";
export * from "./SearchField.binding";
export * from "./Section.binding";
export * from "./Select.binding";
export * from "./Separator.binding";
export * from "./Skeleton.binding";
export * from "./Slider.binding";
export * from "./StatusLight.binding";
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
  Breadcrumbs: breadcrumbsBinding,
  Button: buttonBinding,
  Icon: iconBinding,
  IllustratedMessage: illustratedMessageBinding,
  Link: linkBinding,
  Separator: separatorBinding,
  // ADR-912 위험군 해소(선행-3/4): TEXT_LEAF 순수 텍스트 leaf (internal source, DOM generic, Skia box+text)
  Text: textBinding,
  Heading: headingBinding,
  Paragraph: paragraphBinding,
  // ADR-912 위험군 해소: TEXT_LEAF box형 mono (fontFamily generic 보강 후 등록)
  Code: codeBinding,
  Kbd: kbdBinding,
  // ADR-912 위험군 해소(선행-6): field/form 라벨 leaf (부모 의존 4단계 변형은 dispatch 직교)
  Label: labelBinding,
  // ADR-912 위험군 해소(선행-6): compound 보조 설명 leaf (TEXT_LEAF 동형, 부모 변형 0, weight 400)
  Description: descriptionBinding,
  // ADR-912 (B+icon): Disclosure 헤더 leaf (leading chevron + title, leading_icon append escape).
  //   DOM 은 부모 Disclosure self-compose(독립 노드 0), Skia generic box+text + leading_icon.
  DisclosureHeader: disclosureHeaderBinding,
  ToggleButton: toggleButtonBinding,
  ToggleButtonGroup: toggleButtonGroupBinding,
  Toolbar: toolbarBinding,
  // ADR-912 단계 5 선행-1: button-like RAC leaf (box+text generic)
  FileTrigger: fileTriggerBinding,
  // ADR-912 단계 5 선행-1: loading placeholder internal leaf (box generic, skeletonVariant 빌더 미노출)
  Skeleton: skeletonBinding,
  // ADR-912 진로 1번: 상태 표시 dot+label internal leaf (status_light escape, replace)
  StatusLight: statusLightBinding,
  // ADR-912 진로 1번: 사용자 아바타 circle+image internal leaf (avatar escape, replace — image 미generic)
  Avatar: avatarBinding,
  // ADR-912 container shell 3 (2026-06-04): box형 시맨틱 컨테이너 leaf (internal source, generic
  //   box 시각). spec.render.shapes Skia fallback 제거. SHELL_ONLY(Body/Section) 또는 자식 무관
  //   bg(Nav) → buildCatalogShapes box 만으로 spec parity. List 는 샘플 text 때문에 별도 보류.
  body: bodyBinding,
  Section: sectionBinding,
  Nav: navBinding,
  // ADR-912 internal 4 slice (2026-06-04): 인라인 알림 box leaf (internal source, generic box+border
  //   시각, staticAttrs role="alert"). render.shapes shell-only → buildCatalogShapes box+border parity.
  InlineAlert: inlineAlertBinding,
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
  // ADR-912 위험군 해소(선행-6): field/form validation 에러 메시지 leaf (TEXT_LEAF 동형, 부모 데이터
  //   의존 0, weight 400 negative 색, measure 는 부모 height 분기로 catalog 직교)
  FieldError: fieldErrorBinding,
  // ADR-912 위험군 해소(선행-6): field 입력 영역 자식 leaf (rac source — RAC <Input> 이 부모 TextField
  //   controller slot 소비, generic box+text 시각). createInput 단독 factory 없음(자식 sub-part 전용).
  Input: inputBinding,
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
  // ADR-912 진로 1번: 원형 진행률 internal leaf (value_fill_arc escape, replace — arc 미generic).
  //   leaf(children:[]) + value/size props → DOM=INTERNAL_RENDERERS["progresscircle"](SVG ring).
  ProgressCircle: progressCircleBinding,
  // ADR-912 진로 1번: 진행률 compound (factory 3자식) — DOM=rendererMap.renderProgressBar 위임
  //   (DELEGATING_INTERNAL_RENDERERS, Tabs 선례). Skia=shell-only + 자식 ProgressBarTrack value_fill_bar.
  ProgressBar: progressBarBinding,
  // ADR-912 진로 1번: 측정값 compound (factory 3자식, ProgressBar 동형) — DOM=rendererMap.renderMeter
  //   위임. Skia=shell-only + 자식 MeterTrack value_fill_bar(variant 4색). isIndeterminate 부재.
  Meter: meterBinding,
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
