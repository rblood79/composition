/**
 * ADR-142 family ②(fields) — TextArea leaf RAC primitive 의 `PrimitiveBinding`.
 * (ADR-912 단계 5 선행-1: catalog 미등록 leaf 등록 — RAC source, generic box+text 커버.)
 *
 * inventory(§D)는 TextArea 를 RAC-controller-backed **primitive** 로 분류한다 — RAC
 * `<TextArea>`(field 계열)가 Label/textarea/description/FieldError 를 합성하는 것은 RAC
 * primitive 자체의 D1 동작이지 사용자 조합(reusable)이 아니다. TextField 와 동형 leaf binding.
 *
 * D1: RAC `TextArea` → multi-line `<textarea>` + Label/Text slot. RAC 가 ARIA/포커스 권위.
 * D2: label/description/placeholder/rows + size/labelPosition/isQuiet + state(disabled/readonly/invalid/required).
 * D3: 시각(배경/테두리/폰트)은 input box — TextArea 자체는 box+text generic(buildCatalogShapes)
 *     으로 커버(value-dependent 시각 없음 → skiaPrimitive 불필요). size/labelPosition/isQuiet 는
 *     data-* 라우팅(theme 가 시각 적용).
 */

import type { PrimitiveBinding } from "../types";

export const textAreaBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "TextField",
  },
  rac: {
    primitive: "TextField",
    parts: ["label", "textarea", "description", "fieldError"],
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
      rows: { kind: "number", label: "Rows", section: "appearance" },
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
      isRequired: { kind: "boolean", label: "Required", section: "state" },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      isReadOnly: { kind: "boolean", label: "Read Only", section: "state" },
      isInvalid: { kind: "boolean", label: "Invalid", section: "state" },
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): RAC TextField 공식 prop —
      //   generic toRacProps 경로로 RAC TextField 에 직접 전달 (TextField parity).
      name: { kind: "string", label: "Name", section: "content" },
      maxLength: { kind: "number", label: "Max Length", section: "state" },
      minLength: { kind: "number", label: "Min Length", section: "state" },
      autoFocus: { kind: "boolean", label: "Auto Focus", section: "state" },
      // design-data 감사 §1-3 (2026-08-22) — TextField 와의 형제 비대칭 해소.
      //   아래 7개는 **이미 소비되고 있었는데 편집 표면만 없었다**:
      //     errorMessage / necessityIndicator → `renderTextArea` 가 그대로 shared
      //       TextArea 에 넘기고 있었다 (FieldError / renderNecessityIndicator).
      //     입력 힌트 5종 → ADR-915 P1.5-b 가 TextField/SearchField 에만 채택했던 것.
      //       `renderTextArea` 에 `resolveInputHintProps` 전개를 같이 추가했다.
      //   `value` 는 여기 없다 — 표시 채널이 따로 필요해 별도 단계에서 다룬다.
      errorMessage: {
        kind: "string",
        label: "Error Message",
        section: "state",
      },
      // RSP 표준 required 표시 방식 (icon "*" / label "(required)").
      //   캔버스 경로도 준비돼 있다 — `NECESSITY_INDICATOR_TAGS` 에 textarea 가 이미 있어
      //   Label children 에 접미사가 붙는다 (D3 대칭).
      necessityIndicator: {
        kind: "enum",
        label: "Necessity Indicator",
        section: "appearance",
        options: [
          { value: "icon", label: "Icon" },
          { value: "label", label: "Label" },
        ],
      },
      // 텍스트 HTML 입력 힌트 attr — RAC TextField 공식 prop 이라 `<textarea>` 로 전달된다
      //   (RAC 가 TextAreaContext 로 inputProps 를 내려준다). controlled-value 와 직교.
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
    },
    toRacProps: "default",
  },
};
