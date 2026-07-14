/**
 * ADR-142 family ②(fields) — TextField leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1)는 TextField 를 RAC-controller-backed **primitive** 로 분류한다 — RAC
 * `<TextField>` 가 `<Label>/<Input>/<Text slot="description">/<FieldError>` 를 합성하는 것은
 * RAC primitive 자체의 D1 동작이지 사용자 조합(reusable)이 아니다. 따라서 leaf binding.
 *
 * D1: RAC `TextField` → `<div role="group">` + Label/Input slot. RAC 가 ARIA/포커스 권위.
 * D2: label/description/placeholder/type + size/labelPosition/isQuiet + state(disabled/readonly/invalid).
 * D3: 시각(배경/테두리/폰트)은 자식 Input 이 담당 — TextField 자체는 빈 box(`_hasChildren`).
 *     size/labelPosition/isQuiet 는 data-* 라우팅(theme 가 시각 적용). skiaPrimitive 불필요
 *     (자식 Input 이 배경 box, 부모는 보편 box+text frame 의 빈 shell 로 흡수).
 */

import type { PrimitiveBinding } from "../types";

export const textFieldBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "TextField",
  },
  rac: {
    primitive: "TextField",
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
      placeholder: {
        kind: "string",
        label: "Placeholder",
        section: "content",
      },
      // 시각 차원 → data-size (theme 가 값 집합 제공)
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
      isQuiet: { kind: "boolean", label: "Quiet", section: "appearance" },
      // RAC TextField props
      type: {
        kind: "enum",
        label: "Input Type",
        section: "content",
        default: "text",
        options: [
          { value: "text", label: "Text" },
          { value: "email", label: "Email" },
          { value: "password", label: "Password" },
          { value: "search", label: "Search" },
          { value: "tel", label: "Tel" },
          { value: "url", label: "URL" },
          { value: "number", label: "Number" },
        ],
      },
      // form binding props
      value: { kind: "string", label: "Value", section: "content" },
      name: { kind: "string", label: "Name", section: "content" },
      errorMessage: {
        kind: "string",
        label: "Error Message",
        section: "state",
      },
      // ADR-915 P1.5-b: 텍스트 HTML 입력 힌트 attr (RAC TextField 공식 prop, `<input>` 전달).
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
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): 길이/패턴 검증 + 포커스 —
      //   RAC TextField 공식 prop. renderTextField 가 shared TextField(AriaTextFieldProps
      //   extends)로 전달.
      maxLength: { kind: "number", label: "Max Length", section: "state" },
      minLength: { kind: "number", label: "Min Length", section: "state" },
      pattern: { kind: "string", label: "Pattern", section: "state" },
      autoFocus: { kind: "boolean", label: "Auto Focus", section: "state" },
      // RSP 표준 required 표시 방식 — renderTextField 기소비 (icon "*" / label "(required)")
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
  },
};
