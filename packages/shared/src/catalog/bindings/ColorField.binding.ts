/**
 * ADR-142 family ②(fields) — ColorField leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. RAC `<ColorField>` 가 Label/Input slot
 * 합성(D1). leaf binding — TextField 와 동형(색상 hex/rgb 입력).
 *
 * D2: label/description + size/labelPosition/labelAlign/isQuiet + state. channel/colorSpace 는
 *     RAC ColorField 가 직접 받지 않음(ColorArea/Slider 용) — 미노출.
 * D3: 자식 Input 이 배경, 부모는 빈 box shell(`_hasChildren`). swatch 시각은 자식 Element 가
 *     담당 — 부모 binding 은 skiaPrimitive 불필요(보편 box+text frame 흡수).
 */

import type { PrimitiveBinding } from "../types";

export const colorFieldBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "ColorField",
  },
  rac: {
    primitive: "ColorField",
    parts: ["label", "input", "description", "fieldError"],
    slots: ["description", "errorMessage"],
    states: ["isDisabled", "isInvalid", "isReadOnly", "isRequired"],
    renderProps: ["isDisabled", "isInvalid", "isReadOnly", "isRequired"],
    dataAttributes: [
      "data-disabled",
      "data-invalid",
      "data-readonly",
      "data-required",
    ],
  },
  props: {
    accepts: {
      label: { kind: "string", label: "Label", section: "content" },
      description: {
        kind: "string",
        label: "Description",
        section: "content",
      },
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
      labelAlign: {
        kind: "enum",
        label: "Label Align",
        section: "appearance",
        default: "start",
        options: [
          { value: "start", label: "Start" },
          { value: "center", label: "Center" },
          { value: "end", label: "End" },
        ],
      },
      isQuiet: { kind: "boolean", label: "Quiet", section: "appearance" },
      isRequired: { kind: "boolean", label: "Required", section: "state" },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      isReadOnly: { kind: "boolean", label: "Read Only", section: "state" },
      isInvalid: { kind: "boolean", label: "Invalid", section: "state" },
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): renderColorField 기소비 —
      //   RAC ColorField 공식 prop (channel/colorSpace 는 hex 외 채널 편집 모드).
      errorMessage: {
        kind: "string",
        label: "Error Message",
        section: "state",
      },
      name: { kind: "string", label: "Name", section: "content" },
      autoFocus: { kind: "boolean", label: "Auto Focus", section: "state" },
      channel: {
        kind: "enum",
        label: "Channel",
        section: "content",
        options: [
          { value: "hue", label: "Hue" },
          { value: "saturation", label: "Saturation" },
          { value: "brightness", label: "Brightness" },
          { value: "lightness", label: "Lightness" },
          { value: "red", label: "Red" },
          { value: "green", label: "Green" },
          { value: "blue", label: "Blue" },
          { value: "alpha", label: "Alpha" },
        ],
      },
      colorSpace: {
        kind: "enum",
        label: "Color Space",
        section: "content",
        options: [
          { value: "rgb", label: "RGB" },
          { value: "hsl", label: "HSL" },
          { value: "hsb", label: "HSB" },
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
      necessityIndicator: {
        kind: "enum",
        label: "Necessity Indicator",
        section: "appearance",
        options: [
          { value: "icon", label: "Icon" },
          { value: "label", label: "Label" },
        ],
      },
      // RAC 공식 — 스크롤 휠 값 변경 차단 (renderColorField 배선 동반 추가)
      isWheelDisabled: {
        kind: "boolean",
        label: "Wheel Disabled",
        section: "state",
      },
    },
    toRacProps: "default",
  },
};
