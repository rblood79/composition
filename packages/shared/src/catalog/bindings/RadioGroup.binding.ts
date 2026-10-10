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
      // S2 1.8.0 `isEmphasized` (2026-10-10): 그룹 안 모든 Radio 의 선택 고리가 accent 가
      //   된다 — S2 는 RadioGroup 이 context 로 내려보낸다 (resolver `applyOwnerEmphasis`).
      //   옛 variant (default · accent) 는 로드 시 1회 전환.
      isEmphasized: {
        kind: "boolean",
        label: "Emphasized",
        section: "appearance",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
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
      // S2 1.8.0 labelAlign (start · end — S2 `Alignment`) — the side label column's text alignment,
      //   as the fields take it: DOM `data-label-align` → the rule's `label-align` block
      //   (`--form-label-align`), the Canvas reads the same block (`rulePartRules.ts` `LABEL_ALIGN_AXIS`).
      labelAlign: {
        kind: "enum",
        label: "Label Align",
        section: "appearance",
        default: "start",
        options: [
          { value: "start", label: "Start" },
          { value: "end", label: "End" },
        ],
        visibleWhen: { key: "labelPosition", equals: "side" },
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
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): isReadOnly 는 delegatedDom `radiogroup` 이
      //   RAC RadioGroup 에 넘기고, necessityIndicator 는 Label 노드에 덧붙는다
      //   (`catalogFieldNecessityIndicator`). errorMessage 는 FieldError 노드의 `{errorMessage}` 바인딩.
      isReadOnly: { kind: "boolean", label: "Read Only", section: "state" },
      necessityIndicator: {
        kind: "enum",
        label: "Necessity Indicator",
        section: "appearance",
        // RSP/RAC 기본 표시는 icon (`*`) — seg 가 선택 없이 시작하지 않도록 (2026-09-16 사용자 결정)
        default: "icon",
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
