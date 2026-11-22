/**
 * ADR-142 family ①(primitives/actions) — FileTrigger RAC primitive 의 `PrimitiveBinding`.
 *
 * RAC `<FileTrigger>` 는 요소가 없는 파일 선택 trigger (숨은 `<input type=file>` + 자식 pressable).
 * S2 는 그것을 그대로 내보내고 S2 Button 을 자식으로 둔다 — 원본 = `FileTrigger > Button`
 * (S2 체크리스트 §4.1, 2026-11-22). 글자 · 크기 · 비활성은 Button 노드의 것이다.
 *
 * D1: RAC `FileTrigger` → 파일 입력 trigger. RAC 가 파일 선택/접근성 권위.
 * D2: RAC `FileTriggerProps` 그대로 — acceptedFileTypes/allowsMultiple/acceptDirectory/defaultCamera.
 * D3: 상자 없음 (rule `display: contents`) — 보이는 것은 자식 Button 의 rule.
 */

import type { PrimitiveBinding } from "../types";

export const fileTriggerBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "FileTrigger",
  },
  rac: {
    primitive: "FileTrigger",
    parts: ["button"],
    slots: [],
    states: ["isDisabled"],
    renderProps: ["isDisabled"],
    dataAttributes: ["data-disabled"],
  },
  props: {
    accepts: {
      // live consumer: delegatedDom `filetrigger` (`fileTypes`)
      acceptedFileTypes: {
        kind: "string",
        label: "Accepted File Types",
        section: "state",
      },
      allowsMultiple: {
        kind: "boolean",
        label: "Allow Multiple",
        section: "state",
      },
      acceptDirectory: {
        kind: "boolean",
        label: "Accept Directory",
        section: "state",
      },
      // live consumer: delegatedDom `filetrigger`
      defaultCamera: {
        kind: "enum",
        label: "Default Camera",
        section: "state",
        options: [
          { value: "user", label: "User (Front)" },
          { value: "environment", label: "Environment (Rear)" },
        ],
      },
    },
    toRacProps: "default",
  },
};
