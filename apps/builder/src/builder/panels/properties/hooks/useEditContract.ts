/**
 * ADR-912 단계 2 — 편집 계약 단일 진입점 hook (HC#1/#2).
 *
 * 선택 노드의 `CanonicalNode` + 활성 `CompositionDocument` 를 구독하여
 * `resolveEditContract(node, doc)` 를 호출, 편집 가능한 필드 전부(`ResolvedField[]`)를
 * origin(semantic / style) 태그와 함께 산출한다.
 *
 * **단일 공급원(HC#1)**: Properties view 와 Style view 가 본 hook **하나**를 호출하고,
 * `field.origin`(semantic → Properties / style → Style)으로 필터해 두 뷰로 나눈다.
 * getEditor(per-type 동적 에디터) 다중 등록 대신 catalog entry + theme rule 단일 source 파생.
 *
 * **단계 2 scope (사용자 결정 2026-06-03 "Properties view만 단계 2")**: 본 hook 은 양쪽
 * origin 을 모두 산출하지만, 첫 소비처는 Properties view(origin:"semantic")다. Style view
 * 전면 전환(UNIVERSAL_STYLE_CONTRACTS 36키 확장 + unit/color/4-way kind)은 후속 단계.
 *
 * **canonical 우선 read**: `useCanonicalNode`(canonical store) + `useActiveCanonicalDocument`
 * 로 canonical SSOT 를 직접 읽는다. legacy elementsMap 미경유 — ADR-116/122 canonical-only
 * runtime 정합. node 미존재(미선택/canonical 미등록) 시 빈 계약 반환.
 */

import { useMemo } from "react";

import { resolveEditContract, type EditContract } from "@composition/shared";

import { useCanonicalNode } from "../../../stores/canonical/canonicalElementsBridge";
import { useActiveCanonicalDocument } from "../../../stores/canonical/canonicalElementsBridge";

const EMPTY_CONTRACT: EditContract = { type: "", fields: [] };

/**
 * 선택 노드 → 편집 계약 (semantic ∪ universal style).
 *
 * @param nodeId 선택 노드 id (null 이면 빈 계약).
 * @returns `EditContract` — `fields` 를 `origin` 으로 필터해 Properties/Style view 분리.
 */
export function useEditContract(nodeId: string | null): EditContract {
  const node = useCanonicalNode(nodeId);
  const doc = useActiveCanonicalDocument();

  return useMemo(() => {
    if (!node) return EMPTY_CONTRACT;
    return resolveEditContract(node, doc);
  }, [node, doc]);
}
