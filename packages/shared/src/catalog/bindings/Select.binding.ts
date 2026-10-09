/**
 * ADR-142 family ④(collections) — Select primitive 의 `PrimitiveBinding`.
 *
 * DOM 은 `delegatedDom.tsx` `select` 가 RAC Select 안에 노드 트리 (`Label + Button(SelectValue + Icon) +
 * Text[description] + FieldError + Popover > ListBox`) 를 그린다 (ADR-256 Phase 6c). Canvas 시각은
 * catalog rule (`COMPONENT_RULES_TABLE.Select`).
 */

import type { PrimitiveBinding } from "../types";

export const selectBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "select",
  },
  props: {
    accepts: {
      dataBinding: { kind: "binding", label: "Data", section: "content" },
      // 항목은 slot (자식 노드 — RAC 정적 collection) 또는 dataBinding (collection 행 + 항목 노드
      //   template — RAC 동적 collection) 이다. 옛 items-manager (`props.items` 인라인 배열) 는
      //   2026-10-09 삭제 — ADR-256 노드 트리 전환 뒤 어느 renderer 도 읽지 않았다 (contract 32).
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
        default: "M",
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
      //   `text-align: var(--form-label-align)`, Canvas 는 같은 블록을 Label part rule 로 읽는다
      //   (`rulePartRules.ts` `LABEL_ALIGN_AXIS`). DOM 은 자신 값이 없으면 Form 조상 값을 쓴다
      //   (`delegatedDom.tsx` `inheritedForm`).
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
        // RSP: labelAlign 은 labelPosition="side" 에서만 의미 (2026-09-15)
        visibleWhen: { key: "labelPosition", equals: "side" },
      },
      selectionMode: {
        kind: "enum",
        label: "Selection Mode",
        section: "state",
        default: "single",
        options: [
          { value: "single", label: "Single" },
          { value: "multiple", label: "Multiple" },
        ],
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): RAC Select / RSP Picker 공식 prop —
      //   `delegatedDom.tsx` `select` (`fieldBase`) 가 RAC Select 로 전달.
      isRequired: { kind: "boolean", label: "Required", section: "state" },
      isInvalid: { kind: "boolean", label: "Invalid", section: "state" },
      isQuiet: { kind: "boolean", label: "Quiet", section: "appearance" },
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
        // RSP/RAC 기본 표시는 icon (`*`) — seg 가 선택 없이 시작하지 않도록 (2026-09-16 사용자 결정)
        default: "icon",
        options: [
          { value: "icon", label: "Icon" },
          { value: "label", label: "Label" },
        ],
      },
    },
    toRacProps: "default",
    // size 를 data-attr 가 아니라 prop 그대로 통과 (DateField.binding 과 동일 근거, 2026-07-14
    //   전수 확장). 지금 Select DOM 은 `delegatedDom.tsx` `select` 가 `data-size` 를 직접 쓴다.
    propPassthrough: ["size"],
  },
};
