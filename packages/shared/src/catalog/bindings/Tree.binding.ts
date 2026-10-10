/**
 * ADR-142 family ⑤(Tree·Table) — Tree primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. composition wrapper(`Tree.tsx`)가
 * useCollectionData(dataBinding → tree nodes, ADR-132)로 채우고 RAC Tree + TreeItem 재귀 합성
 * (internal source). 재귀 2D collection 렌더는 RAC 담당.
 *
 * **Skia generic 발효 (skiaLegacy 제거, 2026-06-01 G2(a))**: DOM/Inspector·Skia 모두 catalog
 * generic. Tree render.shapes 는 shell-only(자식 TreeItem 이 독립 Skia 노드로 행 렌더).
 */

import type { PrimitiveBinding } from "../types";

export const treeBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "tree",
  },
  props: {
    accepts: {
      dataBinding: { kind: "binding", label: "Data", section: "content" },
      // S2 강조 축 (2026-10-10 — design-data Tree view `isEmphasized`, S2 TreeView 에는 없는
      //   축): 선택 줄 강조. rule 의 emphasized 변형 (옛 accent) 은 resolver 가 파생하는 내부
      //   `variant` 운반 값 — 옛 variant prop 은 로드 시 1회 전환.
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
      selectionMode: {
        kind: "enum",
        label: "Selection Mode",
        section: "state",
        default: "single",
        options: [
          { value: "none", label: "None" },
          { value: "single", label: "Single" },
          { value: "multiple", label: "Multiple" },
        ],
      },
      // 컬렉션 전체 isDisabled 는 2026-09-10 제거 — RAC/RSP 컬렉션은 `disabledKeys`·항목별
      //   isDisabled 만 두고(D2), 이 값은 DOM(wrapper 미소비)·Skia(항목 투영에 부모 상태 없음)
      //   어느 쪽도 읽지 않던 dead surface 였다. 항목별 Disabled 는 항목 노드 자신의 isDisabled 다.
      // RSP TreeView `selectionStyle` (design-data 감사 §1-2 축②, 2026-08-21).
      //   기본이 GridList 와 다른 `highlight` 인 것은 옛 Preview renderer 가 오래 selectionBehavior:
      //   "replace" 를 넘겨 체크박스 없는 상태가 실질 기본이었기 때문 — 무지정 문서의 시각을
      //   보존한다(RSP 기본은 checkbox 지만 기존 문서를 조용히 바꾸지 않는다).
      selectionStyle: {
        kind: "enum",
        label: "Selection Style",
        section: "state",
        default: "highlight",
        options: [
          { value: "checkbox", label: "Checkbox" },
          { value: "highlight", label: "Highlight" },
        ],
      },
      // RAC 공식 prop — delegatedDom `tree` 가 shared Tree 에 넘긴다.
      disallowEmptySelection: {
        kind: "boolean",
        label: "Disallow Empty Selection",
        section: "state",
      },
    },
    toRacProps: "default",
  },
};
