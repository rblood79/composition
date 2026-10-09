/**
 * ADR-142 family ③(selection) — Switch leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. RAC `<Switch>` 가 track+thumb indicator +
 * label slot 합성(D1). leaf binding.
 *
 * D3: indicator(track + thumb)는 비-DOM-trivial → `skiaPrimitive: "switch_toggle"` draw module.
 *     label 은 자식 Label Element 담당.
 */

import type { PrimitiveBinding } from "../types";

export const switchBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "Switch",
  },
  rac: {
    primitive: "Switch",
    parts: ["switch", "indicator", "label"],
    slots: [],
    states: ["isSelected", "isDisabled", "isInvalid", "isRequired"],
    renderProps: ["isSelected", "isDisabled", "isInvalid", "isRequired"],
    dataAttributes: [
      "data-selected",
      "data-disabled",
      "data-invalid",
      "data-required",
    ],
  },
  props: {
    accepts: {
      children: { kind: "string", label: "Label", section: "content" },
      // ADR-256 Phase 3: 레퍼런스 `SwitchField` 의 도움말 · 오류 문구 (template 의 Description `{description}` ·
      //   FieldError `{errorMessage}` 자리 — 오류는 RAC 검증이 실패할 때 보인다).
      description: {
        kind: "string",
        label: "Description",
        section: "content",
      },
      errorMessage: {
        kind: "string",
        label: "Error Message",
        section: "state",
      },
      // S2 1.8.0 `isEmphasized` (2026-10-10 — 조사 §4.2 B): 켜진 track 이 accent 가 된다. rule 의
      //   emphasized 변형이 그 모양이고, 내부 `variant` 는 resolver 가 파생하는 운반 값
      //   (`CATALOG_BOOLEAN_VARIANTS`) — 옛 variant prop 은 로드 시 1회 전환.
      isEmphasized: {
        kind: "boolean",
        label: "Emphasized",
        section: "appearance",
      },
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "default",
        editorHidden: true,
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      isSelected: { kind: "boolean", label: "Selected", section: "state" },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): RAC Switch 공식 prop —
      //   `delegatedDom.tsx` `switch` 가 isReadOnly/name/value/autoFocus 를 RAC SwitchField 로 전달.
      isReadOnly: { kind: "boolean", label: "Read Only", section: "state" },
      // S2 1.8.0 Switch `isRequired` · `isInvalid` (RAC `SwitchField`, 2026-10-09): invalid shows the
      //   FieldError (S2 leaves the track as it is), required is the input's (RAC form validation).
      isRequired: { kind: "boolean", label: "Required", section: "state" },
      isInvalid: { kind: "boolean", label: "Invalid", section: "state" },
      name: { kind: "string", label: "Name", section: "content" },
      value: { kind: "string", label: "Value", section: "content" },
      autoFocus: { kind: "boolean", label: "Auto Focus", section: "state" },
    },
    toRacProps: "default",
  },
  // track + thumb indicator — box+text 가 아님.
  skiaPrimitive: "switch_toggle",
};
