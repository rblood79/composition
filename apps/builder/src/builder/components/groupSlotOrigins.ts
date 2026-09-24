/**
 * ADR-237 Phase 1 — 그룹 컨테이너 origin 9종의 `slot` (추천 항목) seed · repair.
 *
 * Components 페이지 body 의 그룹 origin (`catalogReusableOriginId(type)` · reusable) 에 slot 이 **없을 때만**
 * `GROUP_SLOT_HOSTS` 의 추천 목록을 싣는다 — 사용자가 편집했거나 끈 (`false`) slot 은 그대로 (234 Menu 이관과
 * 같은 조건). 새 문서와 기존 문서가 같은 함수를 지난다 (hydration). 바뀐 것이 없으면 같은 문서 객체.
 */
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import { catalogReusableOriginId } from "@composition/shared";

import { COMPONENTS_SYSTEM_BODY_ID } from "../pages/systemComponentsPage";
import { GROUP_SLOT_HOSTS } from "./slotHostPolicy";

export function ensureGroupSlots(
  document: CompositionDocument,
): CompositionDocument {
  let changed = false;
  const patchBody = (body: CanonicalNode): CanonicalNode => {
    const children = (body.children ?? []).map((node) => {
      const group = GROUP_SLOT_HOSTS.find((row) => row.type === node.type);
      if (!group || node.reusable !== true) return node;
      if (node.id !== catalogReusableOriginId(group.type)) return node;
      if ((node as { slot?: unknown }).slot !== undefined) return node;
      changed = true;
      return { ...node, slot: [...group.slot] } as CanonicalNode;
    });
    return changed ? { ...body, children } : body;
  };
  const visit = (nodes: readonly CanonicalNode[]): CanonicalNode[] =>
    nodes.map((node) => {
      if (node.id === COMPONENTS_SYSTEM_BODY_ID) return patchBody(node);
      if (!node.children) return node;
      const children = visit(node.children);
      return children.every((child, index) => child === node.children![index])
        ? node
        : { ...node, children };
    });
  const children = visit(document.children);
  return changed ? { ...document, children } : document;
}
