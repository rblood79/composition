/**
 * ADR-142 family ②(fields) — SearchField leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. RAC `<SearchField>` 가 Label/Input/clear
 * Button slot 합성(D1). leaf binding — TextField 와 동형(검색 clear 는 RAC 내장).
 *
 * D3: 자식 Input 이 배경, 부모는 빈 box shell(`_hasChildren`). skiaPrimitive 불필요.
 */

import type { PrimitiveBinding } from "../types";

export const searchFieldBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "SearchField",
  },
  rac: {
    primitive: "SearchField",
    parts: ["label", "input", "description", "fieldError"],
    slots: ["description", "errorMessage"],
    states: ["isDisabled", "isInvalid", "isReadOnly", "isRequired", "isEmpty"],
    renderProps: [
      "isDisabled",
      "isInvalid",
      "isReadOnly",
      "isRequired",
      "isEmpty",
    ],
    dataAttributes: [
      "data-disabled",
      "data-invalid",
      "data-readonly",
      "data-required",
      "data-empty",
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
      placeholder: {
        kind: "string",
        label: "Placeholder",
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
      // RSP labelAlign (2026-08-21, design-data 감사 §1-2 축①) — side 라벨 컬럼 안에서의
      //   라벨 텍스트 정렬. DOM 은 `data-label-align` → catalog nested rule 의
      //   `text-align: var(--form-label-align)`, Skia 는 buildSpecNodeData.resolveLabelAlignment
      //   (start|center|end → left|center|right 매핑). Form 조상 값은 renderer/조상 walk 로 상속하고
      //   자신이 지정하면 자신이 우선 (nearest-wins, 양 경로 동일).
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
      // form binding props
      value: { kind: "string", label: "Value", section: "content" },
      name: { kind: "string", label: "Name", section: "content" },
      errorMessage: {
        kind: "string",
        label: "Error Message",
        section: "state",
      },
      // ADR-915 P1.5-b: 텍스트 HTML 입력 힌트 attr (RAC SearchField 공식 prop, `<input>` 전달).
      //   controlled-value(value/defaultValue)와 직교 — 순수 입력 힌트라 회귀 위험 0.
      autoComplete: {
        kind: "string",
        label: "Auto Complete",
        section: "content",
      },
      autoCorrect: {
        kind: "enum",
        label: "Auto Correct",
        section: "content",
        options: [
          { value: "on", label: "On" },
          { value: "off", label: "Off" },
        ],
      },
      inputMode: {
        kind: "enum",
        label: "Input Mode",
        section: "content",
        options: [
          { value: "text", label: "Text" },
          { value: "numeric", label: "Numeric" },
          { value: "decimal", label: "Decimal" },
          { value: "tel", label: "Tel" },
          { value: "url", label: "URL" },
          { value: "email", label: "Email" },
          { value: "search", label: "Search" },
          { value: "none", label: "None" },
        ],
      },
      enterKeyHint: {
        kind: "enum",
        label: "Enter Key Hint",
        section: "content",
        options: [
          { value: "enter", label: "Enter" },
          { value: "done", label: "Done" },
          { value: "go", label: "Go" },
          { value: "next", label: "Next" },
          { value: "previous", label: "Previous" },
          { value: "search", label: "Search" },
          { value: "send", label: "Send" },
        ],
      },
      spellCheck: {
        kind: "enum",
        label: "Spell Check",
        section: "content",
        options: [
          { value: "true", label: "On" },
          { value: "false", label: "Off" },
        ],
      },
      isRequired: { kind: "boolean", label: "Required", section: "state" },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      isReadOnly: { kind: "boolean", label: "Read Only", section: "state" },
      isInvalid: { kind: "boolean", label: "Invalid", section: "state" },
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): RAC SearchField 공식 prop —
      //   renderSearchField 가 shared SearchField(AriaSearchFieldProps extends)로 전달.
      maxLength: { kind: "number", label: "Max Length", section: "state" },
      minLength: { kind: "number", label: "Min Length", section: "state" },
      pattern: { kind: "string", label: "Pattern", section: "state" },
      autoFocus: { kind: "boolean", label: "Auto Focus", section: "state" },
      // RSP 표준 required 표시 방식 — renderSearchField 기소비
      necessityIndicator: {
        kind: "enum",
        label: "Necessity Indicator",
        section: "appearance",
        options: [
          { value: "icon", label: "Icon" },
          { value: "label", label: "Label" },
        ],
      },
    },
    toRacProps: "default",
    // size 를 SearchField.tsx 가 React prop 으로 소비 (search/clear 아이콘 + 입력 크기 결정) +
    //   자기 `data-size` 를 재작성 → passthrough 없으면 default("md") 고정 + toRacProps 의
    //   data-size 를 덮어씀 (DateField.binding 과 동일 근거, 2026-07-14 전수 확장).
    propPassthrough: ["size"],
  },
};
