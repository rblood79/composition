/**
 * ADR-142 family ④(collections) — ComboBox primitive 의 `PrimitiveBinding`.
 *
 * composition wrapper(`ComboBox.tsx`)가 useResolvedCollectionItems(dataBinding|items → rows)로 채우고
 * RAC ComboBox + Label/Input/Button/Popover/ListBox 합성(internal source). Skia generic 발효(skiaLegacy 제거, ADR-912 단계 4).
 */

import type { PrimitiveBinding } from "../types";

export const comboBoxBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "combobox",
  },
  props: {
    accepts: {
      dataBinding: { kind: "binding", label: "Data", section: "content" },
      // ADR-912 영역 B Task 7: 정적 items[](StoredComboBoxItem[]).
      //   toRacProps 가 props.items pass-through 를 보장(미선언 시 정적 옵션 소실).
      //   kind:"items-manager" 는 비-DATA_ATTR_KIND → out[key]=value 통과 유지 +
      //   Inspector 정적 옵션 추가/제거 UI(ItemsManager) 렌더(RSP Dynamic collections).
      items: {
        kind: "items-manager",
        label: "Options",
        section: "content",
        itemsManager: {
          itemsKey: "items",
          itemTypeName: "Option",
          defaultItem: { id: "", label: "Option", value: "" },
          itemSchema: [
            { key: "label", type: "string", label: "Label" },
            { key: "value", type: "string", label: "Value" },
            { key: "textValue", type: "string", label: "Text Value" },
            { key: "description", type: "string", label: "Description" },
            { key: "icon", type: "icon", label: "Icon" },
            { key: "isDisabled", type: "boolean", label: "Disabled" },
            { key: "onActionId", type: "event-id", label: "On Action" },
          ],
          labelKey: "label",
        },
      },
      label: { kind: "string", label: "Label", section: "content" },
      description: {
        kind: "string",
        label: "Description",
        section: "content",
      },
      placeholder: {
        kind: "string",
        label: "Placeholder",
        section: "content",
      },
      iconName: { kind: "icon", label: "Icon", section: "content" },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      labelPosition: {
        kind: "enum",
        label: "Label Position",
        section: "appearance",
        default: "top",
        options: [
          { value: "top", label: "Top" },
          { value: "side", label: "Side" },
        ],
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): renderComboBox 전부 기소비 —
      //   RAC/RSP ComboBox 공식 prop. menuTrigger 는 popover 열림 시점 제어.
      isRequired: { kind: "boolean", label: "Required", section: "state" },
      isReadOnly: { kind: "boolean", label: "Read Only", section: "state" },
      isInvalid: { kind: "boolean", label: "Invalid", section: "state" },
      isQuiet: { kind: "boolean", label: "Quiet", section: "appearance" },
      allowsCustomValue: {
        kind: "boolean",
        label: "Allow Custom Value",
        section: "state",
      },
      menuTrigger: {
        kind: "enum",
        label: "Menu Trigger",
        section: "state",
        default: "input",
        options: [
          { value: "input", label: "Input" },
          { value: "focus", label: "Focus" },
          { value: "manual", label: "Manual" },
        ],
      },
      name: { kind: "string", label: "Name", section: "content" },
      errorMessage: {
        kind: "string",
        label: "Error Message",
        section: "state",
      },
      autoFocus: { kind: "boolean", label: "Auto Focus", section: "state" },
      necessityIndicator: {
        kind: "enum",
        label: "Necessity Indicator",
        section: "appearance",
        options: [
          { value: "icon", label: "Icon" },
          { value: "label", label: "Label" },
        ],
      },
      validationBehavior: {
        kind: "enum",
        label: "Validation",
        section: "state",
        options: [
          { value: "native", label: "Native" },
          { value: "aria", label: "ARIA" },
        ],
      },
    },
    toRacProps: "default",
    // size 를 ComboBox.tsx 가 React prop 으로 소비 + 자기 `data-size` 를 재작성
    //   → passthrough 없으면 default("md") 고정 + toRacProps 의 data-size 를 덮어씀
    //   (DateField.binding 과 동일 근거, 2026-07-14 전수 확장).
    propPassthrough: ["size"],
  },
};
