/**
 * ADR-142 family ④(collections) — ComboBox primitive 의 `PrimitiveBinding`.
 *
 * Preview 는 노드 트리 — RAC ComboBox 안에서 자식 (Label · Group > Input + Button · Description ·
 * FieldError · Popover > ListBox) 을 순서대로 그린다 (`delegatedDom` `combobox`, ADR-256 Phase 6d —
 * 옛 공용 `ComboBox.tsx` 는 삭제). Skia generic 전환(skiaLegacy 제거, ADR-912 단계 4).
 */

import type { PrimitiveBinding } from "../types";

export const comboBoxBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "combobox",
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
      iconName: { kind: "icon", label: "Icon", section: "content" },
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
      //   `text-align: var(--form-label-align)`, Canvas 는 rulePartRules.ts 가 같은 `label-align`
      //   블록을 Label part rule 의 textAlign 으로 컴파일해 읽는다. Form 조상 값은 조상 walk 로
      //   상속하고 자신이 지정하면 자신이 우선 (nearest-wins).
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
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): CATALOG_DELEGATED_DOM.combobox 가 소비 —
      //   RAC/RSP ComboBox 공식 prop. menuTrigger 는 popover 열림 시점 제어.
      isRequired: { kind: "boolean", label: "Required", section: "state" },
      isReadOnly: { kind: "boolean", label: "Read Only", section: "state" },
      isInvalid: { kind: "boolean", label: "Invalid", section: "state" },
      isQuiet: { kind: "boolean", label: "Quiet", section: "appearance" },
      allowsCustomValue: {
        kind: "boolean",
        label: "Allow Custom Value",
        section: "state",
      },
      menuTrigger: {
        kind: "enum",
        label: "Menu Trigger",
        section: "state",
        default: "input",
        options: [
          { value: "input", label: "Input" },
          { value: "focus", label: "Focus" },
          { value: "manual", label: "Manual" },
        ],
      },
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
      validationBehavior: {
        kind: "enum",
        label: "Validation",
        section: "state",
        options: [
          { value: "native", label: "Native" },
          { value: "aria", label: "ARIA" },
        ],
        // RAC Form 이 FormContext 로 자식 field 에 전파 — Form 하나만 편집 (2026-09-15)
        editorHidden: true,
      },
    },
    toRacProps: "default",
    // size 는 노드 트리 root 의 `data-size` (`nodeTreeField`) — 부품에는 Group 을 건너 전파된다
    //   (ADR-256 Phase 6b · 6d).
    propPassthrough: ["size"],
  },
};
