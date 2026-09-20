import type { ComponentCreationContext, ComponentDefinition } from "./types";

// 컴포넌트 정의 임포트 — store 를 import 하지 않는 순수 definition 모듈만.
import {
  createTextFieldDefinition,
  createTextAreaDefinition,
  createToastDefinition,
  createNumberFieldDefinition,
  createSearchFieldDefinition,
  createSliderDefinition,
  createFileUploadDefinition,
} from "./definitions/FormComponents";
import {
  createSelectDefinition,
  createComboBoxDefinition,
  createListBoxDefinition,
  createGridListDefinition,
} from "./definitions/SelectionComponents";
import {
  createFrameLayoutDefinition,
  createToggleButtonGroupDefinition,
  createCheckboxGroupDefinition,
  createRadioGroupDefinition,
  createCheckboxDefinition,
  createRadioDefinition,
  createSwitchDefinition,
  createTagGroupDefinition,
  createBreadcrumbsDefinition,
} from "./definitions/GroupComponents";
import {
  createTabsDefinition,
  createTreeDefinition,
} from "./definitions/LayoutComponents";
import {
  createDialogDefinition,
  createPopoverDefinition,
  createTooltipDefinition,
} from "./definitions/OverlayComponents";
import {
  createMenuDefinition,
  createNavDefinition,
  createPaginationDefinition,
  createDisclosureDefinition,
  createDisclosureGroupDefinition,
} from "./definitions/NavigationComponents";
import { createTableDefinition } from "./definitions/TableDefinition";
import {
  createDataTableDefinition,
  createSlotDefinition,
} from "./definitions/DataComponents";
import {
  createDatePickerDefinition,
  createDateRangePickerDefinition,
  createCalendarDefinition,
  createColorPickerDefinition,
  createDateFieldDefinition,
  createTimeFieldDefinition,
  createColorFieldDefinition,
  createColorSwatchPickerDefinition,
} from "./definitions/DateColorComponents";
import {
  // ADR-914 Phase 4-B: createAvatarDefinition import 제거 — Avatar creator(creation.mode="none")
  //   진입점이 사라져 미사용. 정의 함수 자체는 DisplayComponents.ts 에 보존(factoryOwnership.test).
  createAvatarGroupDefinition,
  createStatusLightDefinition,
  createButtonGroupDefinition,
  createProgressBarDefinition,
  createMeterDefinition,
  createProgressCircleDefinition,
  createImageDefinition,
  createRangeCalendarDefinition,
  createIllustratedMessageDefinition,
  createCardViewDefinition,
  createChartDefinition,
  createTableViewDefinition,
} from "./definitions/DisplayComponents";

/**
 * ADR-228 (2026-09-21): type → **순수 definition creator** (side-effect 0). `ComponentFactory.creators`
 * 는 이 맵을 `createComponent(definition, context)` 로 감싸고, origin seed
 * (`components/catalogOrigins.ts`) 는 같은 함수를 직접 불러 factory 기본 자식 구조를 origin 문서로
 * 옮긴다 — store/DB mutation 0. Table 은 imperative `createTable` 과 별도로 `createTableDefinition`.
 *
 * ComponentFactory 와 분리한 이유: ComponentFactory → elementCreation → stores 순환. seed 는
 * 정규화 (store 로드 경로) 에서 불리므로 store 를 import 하는 모듈에 기대면 안 된다.
 */
export const COMPONENT_DEFINITIONS: Readonly<
  Record<string, (context: ComponentCreationContext) => ComponentDefinition>
> = {
  TextField: createTextFieldDefinition,
  TextArea: createTextAreaDefinition,
  Toast: createToastDefinition,
  NumberField: createNumberFieldDefinition,
  SearchField: createSearchFieldDefinition,
  frame: createFrameLayoutDefinition,
  ToggleButtonGroup: createToggleButtonGroupDefinition,
  CheckboxGroup: createCheckboxGroupDefinition,
  RadioGroup: createRadioGroupDefinition,
  Checkbox: createCheckboxDefinition,
  Radio: createRadioDefinition,
  Switch: createSwitchDefinition,
  Select: createSelectDefinition,
  ComboBox: createComboBoxDefinition,
  Slider: createSliderDefinition,
  FileUpload: createFileUploadDefinition,
  Tabs: createTabsDefinition,
  Tree: createTreeDefinition,
  TagGroup: createTagGroupDefinition,
  Breadcrumbs: createBreadcrumbsDefinition,
  ListBox: createListBoxDefinition,
  GridList: createGridListDefinition,
  Table: createTableDefinition,
  Menu: createMenuDefinition,
  Nav: createNavDefinition,
  Navigation: createNavDefinition,
  Pagination: createPaginationDefinition,
  Disclosure: createDisclosureDefinition,
  DisclosureGroup: createDisclosureGroupDefinition,
  Dialog: createDialogDefinition,
  Popover: createPopoverDefinition,
  Tooltip: createTooltipDefinition,
  DataTable: createDataTableDefinition,
  Slot: createSlotDefinition,
  DatePicker: createDatePickerDefinition,
  DateRangePicker: createDateRangePickerDefinition,
  Calendar: createCalendarDefinition,
  ColorPicker: createColorPickerDefinition,
  DateField: createDateFieldDefinition,
  TimeField: createTimeFieldDefinition,
  ColorField: createColorFieldDefinition,
  ColorSwatchPicker: createColorSwatchPickerDefinition,
  AvatarGroup: createAvatarGroupDefinition,
  StatusLight: createStatusLightDefinition,
  ButtonGroup: createButtonGroupDefinition,
  ProgressBar: createProgressBarDefinition,
  Meter: createMeterDefinition,
  ProgressCircle: createProgressCircleDefinition,
  Image: createImageDefinition,
  RangeCalendar: createRangeCalendarDefinition,
  IllustratedMessage: createIllustratedMessageDefinition,
  CardView: createCardViewDefinition,
  Chart: createChartDefinition,
  TableView: createTableViewDefinition,
};

/** type 의 순수 definition creator (없으면 undefined — leaf 또는 imperative 전용). */
export function getComponentDefinitionCreator(
  type: string,
): ((context: ComponentCreationContext) => ComponentDefinition) | undefined {
  return COMPONENT_DEFINITIONS[type];
}
