/**
 * ADR-142 family ③(selection) — Radio leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. RAC `<Radio>` 는 RadioGroup 안에서만 의미
 * (value 로 group 선택). leaf binding.
 *
 * D3: indicator(ring + dot)는 비-DOM-trivial → `skiaPrimitive: "radio"` draw module.
 *     label 은 자식 Label Element 담당.
 */

import type { PrimitiveBinding } from "../types";

export const radioBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "Radio",
  },
  rac: {
    primitive: "Radio",
    parts: ["radio", "indicator", "label"],
    slots: [],
    states: ["isSelected", "isDisabled"],
    renderProps: ["isSelected", "isDisabled"],
    dataAttributes: ["data-selected", "data-disabled"],
  },
  props: {
    accepts: {
      children: { kind: "string", label: "Label", section: "content" },
      // ADR-256 Phase 3: 레퍼런스 `RadioField` 의 도움말 (template 의 Description `{description}` 자리).
      description: {
        kind: "string",
        label: "Description",
        section: "content",
      },
      // RAC Radio 는 group 안에서 value 로 식별
      value: { kind: "string", label: "Value", section: "content" },
      // S2 1.8.0: Radio 의 강조는 그룹의 context 전용 값 (RadioGroup `isEmphasized` — resolver
      //   `applyOwnerEmphasis` 가 싣는다, 패널 미노출). 내부 `variant` 는 그 운반 값
      //   (`CATALOG_BOOLEAN_VARIANTS`) — 옛 per-Radio variant (accent · neutral · negative) 는
      //   S2 에 없어 로드 시 1회 전환이 지운다.
      isEmphasized: {
        kind: "boolean",
        label: "Emphasized",
        section: "appearance",
        editorHidden: true,
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
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): RAC Radio 공식 prop —
      //   generic toRacProps 경로로 RAC Radio 에 직접 전달.
      autoFocus: { kind: "boolean", label: "Auto Focus", section: "state" },
    },
    toRacProps: "default",
  },
  // ring + dot indicator — box+text 가 아님.
  skiaPrimitive: "radio",
};
