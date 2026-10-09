/**
 * ADR-142 family ④(collections) — ListBox primitive 의 `PrimitiveBinding`.
 *
 * DOM 은 delegatedDom `listbox` 가 그린다 — 단독 목록은 composition wrapper(`ListBox.tsx`, RAC
 * ListBox) 로, picker (Select · ComboBox) 안 목록은 RAC `ListBox` 그대로 (이름 · 선택 · focus 는
 * picker 의 RAC context 소유, ADR-253 Phase 4) 그리고, 그 안에 ListBoxItem / ListBoxSection 자식
 * 노드를 담는다. 따라서 `source.kind: "internal"`(RAC raw 우회).
 *
 * **Canvas (skiaLegacy 미설정, ADR-912 선행 2026-06-03)**: rule (componentRulesTable ListBox) 의
 * variant fill + border 로 container shell 만 그리고, 항목은 자식 ListBoxItem 노드가 각자 그린다.
 */

import type { PrimitiveBinding } from "../types";

export const listBoxBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "listbox",
  },
  props: {
    accepts: {
      // collection 행 데이터 바인딩.
      dataBinding: { kind: "binding", label: "Data", section: "content" },
      // 항목은 slot (자식 노드 — RAC 정적 collection) 또는 dataBinding (collection 행 + 항목 노드
      //   template — RAC 동적 collection) 이다. 옛 items-manager (`props.items` 인라인 배열) 는
      //   2026-10-09 삭제 — ADR-256 노드 트리 전환 뒤 어느 renderer 도 읽지 않았다 (contract 32).
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "default",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      // ADR-923 r24m1 — 기본값 "single" 은 어느 표면에도 없던 값이었다. RAC 기본은 "none",
      //   delegatedDom `listbox` 도 `props.selectionMode ?? "none"` 로 렌더한다 (delegating 렌더러라
      //   toRacProps 를 거치지 않아 이 default 가 Preview 에 도달하지 않았다). Inspector 만
      //   contract.default 를 "현재값" 으로 보여 주어 패널 "Single" ↔ DOM none 이 갈렸다.
      selectionMode: {
        kind: "enum",
        label: "Selection Mode",
        section: "state",
        default: "none",
        options: [
          { value: "none", label: "None" },
          { value: "single", label: "Single" },
          { value: "multiple", label: "Multiple" },
        ],
      },
      // 컬렉션 전체 isDisabled 는 2026-09-10 제거 — RAC/RSP 컬렉션은 `disabledKeys`·항목별
      //   isDisabled 만 두고(D2), 이 값은 DOM(wrapper 미소비)·Skia(항목 투영에 부모 상태 없음)
      //   어느 쪽도 읽지 않던 dead surface 였다. 항목별 Disabled 는 항목 노드 자신의 isDisabled 다.
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): RAC 공식 prop — delegatedDom `listbox` 가 넘긴다.
      disallowEmptySelection: {
        kind: "boolean",
        label: "Disallow Empty Selection",
        section: "state",
      },
    },
    toRacProps: "default",
  },
  // shell 은 Canvas rule, 항목은 자식 ListBoxItem 노드(ADR-912 선행).
};
