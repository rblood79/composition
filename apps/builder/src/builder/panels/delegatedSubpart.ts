/**
 * ADR-923 Phase 5 후속 잔여 1 (2026-09-03, 판정 A) — **read-only sub-part** 판정.
 *
 * DOM (Preview·publish 공통 `@composition/shared/renderers` 의 `renderTextField` 등 field 5) 은 parent
 * props 만으로 self-compose 하고 canonical 자식 (Label/Input/FieldError) 을 읽지 않는다. 그중 FieldError
 * 는 parent rule 의 `.react-aria-FieldError` delegation 이 글자 크기를 정하는 sub-part 라, 자식에 준 인라인
 * style 은 어떤 채널로도 DOM 에 닿지 않는다. 자식은 canonical 에 남되 (Canvas 구조 정본 — DatePicker 선례,
 * Skia projection 우회 금지) 편집 surface 는 parent 로 귀속한다: Properties · Styles 패널은 이 술어가 참이면
 * 안내만 띄우고, Canvas read 경로 (fullTreeLayout · buildSpecNodeData) 는 같은 delegation 술어로 인라인을
 * 무시한다. Label/Input 은 같은 부류지만 factory 인라인 (Input width:100% · Label fontWeight 600) 이 Canvas
 * layout 입력이라 별도 판정으로 남긴다.
 */
import {
  FIELD_ERROR_CHILD_SELECTOR,
  hasDelegatedChild,
} from "@composition/shared";

import { useStore } from "../stores";

export function isDelegatedSubpart(
  type: string | null | undefined,
  parentType: string | null | undefined,
): boolean {
  if (type !== "FieldError" || !parentType) return false;
  return hasDelegatedChild(parentType, FIELD_ERROR_CHILD_SELECTOR);
}

/** 선택 요소의 parent type — 패널이 sub-part 판정에 쓴다. */
export function useSelectedParentType(
  elementId: string | null | undefined,
): string | null {
  return useStore((s) => {
    if (!elementId) return null;
    const el = s.elementsMap.get(elementId);
    const parent = el?.parent_id ? s.elementsMap.get(el.parent_id) : undefined;
    return parent?.type ?? null;
  });
}
