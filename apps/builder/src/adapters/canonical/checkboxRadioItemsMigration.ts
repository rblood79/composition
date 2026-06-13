/**
 * @fileoverview CheckboxItems / RadioItems 중간 컨테이너 폐기 hydration migration
 *   (ADR-912 collection sub-part cutover, 2026-06-14).
 *
 * 배경: ADR-093/103 은 `CheckboxGroup > CheckboxItems > Checkbox` (RadioGroup 동형)
 *   3단 구조를 도입했다. CheckboxItems/RadioItems 는 RAC API 에 없는 composition 자체
 *   추상 중간 컨테이너였다. ADR-912 는 react-aria-starter 원본 구조(부모가 자식
 *   Checkbox/Radio 를 직접 보유, DOM wrapper `<div className="checkbox-items">` 는
 *   렌더러 self-compose)로 재정렬하여 중간 element 를 폐기했다.
 *
 * 본 migration 은 hydration 시점에 기존 직렬화 프로젝트의 CheckboxItems/RadioItems
 *   노드를 제거하고, 그 자식(Checkbox/Radio)을 조부모(CheckboxGroup/RadioGroup) 직속으로
 *   끌어올린다. 자식 순서는 보존하며, CheckboxItems/RadioItems 가 차지하던 위치에 자식을
 *   그대로 펼친다(flatMap). 멱등 — 중간 노드가 이미 없으면 동일 참조를 반환한다.
 *
 * 선례: `migrateLegacyListBoxTemplatesToOrigins` (DFS 멱등 strip 패턴).
 */

import type { CanonicalNode, CompositionDocument } from "@composition/shared";

/**
 * 폐기 대상 중간 컨테이너 type → 부모(조부모) type 매핑.
 * 부모 type 일치 시에만 자식을 끌어올린다 (오인 strip 방지 — 다른 곳의
 * 동명 노드가 있더라도 부모가 CheckboxGroup/RadioGroup 일 때만 적용).
 */
const INTERMEDIATE_BY_PARENT: Record<string, string> = {
  CheckboxGroup: "CheckboxItems",
  RadioGroup: "RadioItems",
};

/**
 * CheckboxItems / RadioItems 중간 컨테이너를 hydration 시점에 폐기하고
 * 자식을 조부모 직속으로 승격한다.
 *
 * @param document - canonical CompositionDocument
 * @returns 중간 노드가 있었으면 새 document, 없었으면 동일 참조 (멱등)
 */
export function migrateCheckboxRadioItemsStructure(
  document: CompositionDocument,
): CompositionDocument {
  function migrateNode(node: CanonicalNode): CanonicalNode {
    const migratedChildren = (node.children ?? []).map(migrateNode);

    const intermediateType = INTERMEDIATE_BY_PARENT[node.type];
    if (intermediateType) {
      let changed = false;
      const hoisted: CanonicalNode[] = [];
      for (const child of migratedChildren) {
        if (child.type === intermediateType) {
          // 중간 노드 제거 + 자식(Checkbox/Radio)을 같은 위치에 펼침.
          hoisted.push(...(child.children ?? []));
          changed = true;
        } else {
          hoisted.push(child);
        }
      }
      if (changed) {
        return { ...node, children: hoisted };
      }
    }

    return node.children ? { ...node, children: migratedChildren } : node;
  }

  const next: CompositionDocument = {
    ...document,
    children: document.children.map(migrateNode),
  };

  return JSON.stringify(document) === JSON.stringify(next) ? document : next;
}
