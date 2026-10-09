/**
 * ADR-142 family ④(collections) — Select primitive 의 `PrimitiveBinding`.
 *
 * composition wrapper(`Select.tsx`)가 useResolvedCollectionItems(dataBinding|items → rows)로 채우고
 * RAC Select + Label/Button/Popover/ListBox 합성(internal source). Skia generic 발효(skiaLegacy 제거, ADR-912 단계 4).
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
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): renderSelect 전부 기소비 —
      //   RAC Select / RSP Picker 공식 prop.
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
    // size 를 Select.tsx 가 React prop 으로 소비 (chevron/trigger/popover 크기 결정) + 자기
    //   `data-size` 를 재작성 → passthrough 없으면 default("md") 고정 + toRacProps 의 data-size
    //   를 덮어씀 (DateField.binding 과 동일 근거, 2026-07-14 전수 확장).
    propPassthrough: ["size"],
  },
};
