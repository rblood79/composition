/**
 * ADR-923 Phase 5 후속 잔여 1 (2026-09-03, 판정 A) — **read-only sub-part** 판정.
 *
 * DOM (Preview·publish 공통 `@composition/shared/renderers` 의 `renderTextField` 등 field 5) 은 parent
 * props 만으로 self-compose 하고 canonical 자식 (Label/Input/FieldError) 을 읽지 않는다. parent rule 의
 * delegation 이 그 자식의 class 토큰 (FieldError · Label · Input · DateInput) 을 가지면 read-only sub-part 다 —
 * 자식에 준 인라인 style 은 어떤 채널로도 DOM 에 닿지 않는다 (2026-09-03 판정 A × 2). 자식은 canonical 에 남되 (Canvas 구조 정본 — DatePicker 선례,
 * Skia projection 우회 금지) 편집 surface 는 parent 로 귀속한다: Properties · Styles 패널은 이 술어가 참이면
 * 안내만 띄우고, Canvas read 경로 (fullTreeLayout · buildSpecNodeData) 는 같은 delegation 술어로 인라인을
 * 무시한다.
 */
import { isDelegatedSubpartChild } from "@composition/shared";

import { useStore } from "../stores";

/** FieldError · Label · Input · DateInput (parent rule delegation 보유 시) — 정본은 shared 의 토큰 표. */
export function isDelegatedSubpart(
  type: string | null | undefined,
  parentType: string | null | undefined,
): boolean {
  return isDelegatedSubpartChild(type, parentType);
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
