/**
 * ADR-142 — leaf RAC primitive `PrimitiveBinding` barrel + type 조회.
 * family cutover(Phase 6) 진행 시 약 35개 binding 이 여기 누적된다.
 */
import type { PrimitiveBinding } from "../types";
import { badgeBinding } from "./Badge.binding";
import { buttonBinding } from "./Button.binding";
import { colorFieldBinding } from "./ColorField.binding";
import { dateFieldBinding } from "./DateField.binding";
import { formBinding } from "./Form.binding";
import { iconBinding } from "./Icon.binding";
import { linkBinding } from "./Link.binding";
import { numberFieldBinding } from "./NumberField.binding";
import { searchFieldBinding } from "./SearchField.binding";
import { separatorBinding } from "./Separator.binding";
import { textFieldBinding } from "./TextField.binding";
import { timeFieldBinding } from "./TimeField.binding";
import { toggleButtonBinding } from "./ToggleButton.binding";
import { toggleButtonGroupBinding } from "./ToggleButtonGroup.binding";
import { toolbarBinding } from "./Toolbar.binding";

export * from "./Badge.binding";
export * from "./Button.binding";
export * from "./ColorField.binding";
export * from "./DateField.binding";
export * from "./Form.binding";
export * from "./Icon.binding";
export * from "./Link.binding";
export * from "./NumberField.binding";
export * from "./SearchField.binding";
export * from "./Separator.binding";
export * from "./TextField.binding";
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
};

export function getPrimitiveBinding(
  type: string,
): PrimitiveBinding | undefined {
  return PRIMITIVE_BINDINGS[type];
}
