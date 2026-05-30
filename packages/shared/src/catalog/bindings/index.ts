/**
 * ADR-142 — leaf RAC primitive `PrimitiveBinding` barrel + type 조회.
 * family cutover(Phase 6) 진행 시 약 35개 binding 이 여기 누적된다.
 */
import type { PrimitiveBinding } from "../types";
import { badgeBinding } from "./Badge.binding";
import { buttonBinding } from "./Button.binding";
import { checkboxBinding } from "./Checkbox.binding";
import { checkboxGroupBinding } from "./CheckboxGroup.binding";
import { colorFieldBinding } from "./ColorField.binding";
import { comboBoxBinding } from "./ComboBox.binding";
import { dateFieldBinding } from "./DateField.binding";
import { formBinding } from "./Form.binding";
import { gridListBinding } from "./GridList.binding";
import { iconBinding } from "./Icon.binding";
import { linkBinding } from "./Link.binding";
import { listBoxBinding } from "./ListBox.binding";
import { menuBinding } from "./Menu.binding";
import { numberFieldBinding } from "./NumberField.binding";
import { radioBinding } from "./Radio.binding";
import { radioGroupBinding } from "./RadioGroup.binding";
import { searchFieldBinding } from "./SearchField.binding";
import { selectBinding } from "./Select.binding";
import { separatorBinding } from "./Separator.binding";
import { sliderBinding } from "./Slider.binding";
import { switchBinding } from "./Switch.binding";
import { tableBinding } from "./Table.binding";
import { tabsBinding } from "./Tabs.binding";
import { tagGroupBinding } from "./TagGroup.binding";
import { textFieldBinding } from "./TextField.binding";
import { treeBinding } from "./Tree.binding";
import { timeFieldBinding } from "./TimeField.binding";
import { toggleButtonBinding } from "./ToggleButton.binding";
import { toggleButtonGroupBinding } from "./ToggleButtonGroup.binding";
import { toolbarBinding } from "./Toolbar.binding";

export * from "./Badge.binding";
export * from "./Button.binding";
export * from "./Checkbox.binding";
export * from "./CheckboxGroup.binding";
export * from "./ColorField.binding";
export * from "./ComboBox.binding";
export * from "./DateField.binding";
export * from "./Form.binding";
export * from "./GridList.binding";
export * from "./Icon.binding";
export * from "./Link.binding";
export * from "./ListBox.binding";
export * from "./Menu.binding";
export * from "./NumberField.binding";
export * from "./Radio.binding";
export * from "./RadioGroup.binding";
export * from "./SearchField.binding";
export * from "./Select.binding";
export * from "./Separator.binding";
export * from "./Slider.binding";
export * from "./Switch.binding";
export * from "./Table.binding";
export * from "./Tabs.binding";
export * from "./TagGroup.binding";
export * from "./TextField.binding";
export * from "./Tree.binding";
export * from "./TimeField.binding";
export * from "./ToggleButton.binding";
export * from "./ToggleButtonGroup.binding";
export * from "./Toolbar.binding";

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
  ToggleButton: toggleButtonBinding,
  ToggleButtonGroup: toggleButtonGroupBinding,
  Toolbar: toolbarBinding,
  // family ② fields
  TextField: textFieldBinding,
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
};

export function getPrimitiveBinding(
  type: string,
): PrimitiveBinding | undefined {
  return PRIMITIVE_BINDINGS[type];
}
