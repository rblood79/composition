/**
 * ADR-142 family ③(selection) — RadioGroup leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. RAC `<RadioGroup>` 가 자식 Radio + Label
 * slot 을 담는 **컨테이너**(SHELL_ONLY). leaf binding.
 *
 * D3: container 는 theme/tokens. 자식 Radio/Label 은 canonical children → Skia `_hasChildren`
 *     빈 box shell. skiaPrimitive 불필요.
 */

import type { PrimitiveBinding } from "../types";

export const radioGroupBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "RadioGroup",
  },
  rac: {
    primitive: "RadioGroup",
    parts: ["group", "label", "description"],
    slots: ["description", "errorMessage"],
    states: ["isDisabled", "isInvalid", "isRequired"],
    renderProps: ["isDisabled", "isInvalid", "isRequired"],
    dataAttributes: ["data-disabled", "data-invalid", "data-required"],
  },
  props: {
    accepts: {
      label: { kind: "string", label: "Label", section: "content" },
      description: {
        kind: "string",
        label: "Description",
        section: "content",
      },
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "default",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      orientation: {
        kind: "enum",
        label: "Orientation",
        section: "appearance",
        default: "vertical",
        options: [
          { value: "vertical", label: "Vertical" },
          { value: "horizontal", label: "Horizontal" },
        ],
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
      // form binding props
      // value = "어느 Radio 가 선택됐는가" — RAC value(string)는 자식 <Radio value> 집합으로
      //   제약(reference). 자유입력 시 오타로 선택 깨짐 → 자식 Radio value 기반 select.
      //   options 는 정적 배열로 표현 불가(자식 트리 의존) → resolveEditContract.deriveOptions
      //   의 RadioGroup 전용 분기가 node.children 에서 동적 파생. 2026-06-30 전수조사.
      value: { kind: "enum", label: "Value", section: "content" },
      name: { kind: "string", label: "Name", section: "content" },
      isRequired: { kind: "boolean", label: "Required", section: "state" },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      isInvalid: { kind: "boolean", label: "Invalid", section: "state" },
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): isReadOnly/necessityIndicator 는
      //   renderRadioGroup 기소비, errorMessage 는 배선 동반 (RadioGroup.tsx FieldError).
      isReadOnly: { kind: "boolean", label: "Read Only", section: "state" },
      necessityIndicator: {
        kind: "enum",
        label: "Necessity Indicator",
        section: "appearance",
        options: [
          { value: "icon", label: "Icon" },
          { value: "label", label: "Label" },
        ],
      },
      errorMessage: {
        kind: "string",
        label: "Error Message",
        section: "state",
      },
    },
    toRacProps: "default",
  },
};
