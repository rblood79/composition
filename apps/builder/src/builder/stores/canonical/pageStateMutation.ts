/**
 * ADR-214 Phase 2 — 페이지 변수 정의 (`state`) 쓰기. 페이지는 canonical root 의 page 노드라
 * (별도 페이지 객체 없음) 요소와 같은 `CanonicalNode.state` 필드에 둔다. `pageTitleMutation`
 * 과 같은 경로 (canonical 먼저, `setDocument` 가 persist · preview 재송신).
 *
 * History 는 Phase 5 (Navigator 페이지 설정 표면) 가 `page-state` entry 로 붙인다 — 지금은
 * 런타임 (preview `enterPage` 리셋) 과 하니스가 쓰는 정의 쓰기 경로만 연다.
 */
import {
  isEditorPageNode,
  isVariableDefList,
  type CompositionDocument,
  type VariableDef,
} from "@composition/shared";

import { useCanonicalDocumentStore } from "./canonicalDocumentStore";

export function setPageStateInDocument(
  document: CompositionDocument,
  pageId: string,
  state: readonly VariableDef[],
): { changed: boolean; document: CompositionDocument } {
  const pageIndex = document.children.findIndex(
    (node) => node.id === pageId && isEditorPageNode(node),
  );
  if (pageIndex < 0) return { changed: false, document };
  const pageNode = document.children[pageIndex];
  const current = isVariableDefList(pageNode.state) ? pageNode.state : [];
  if (JSON.stringify(current) === JSON.stringify(state))
    return { changed: false, document };
  const children = [...document.children];
  const next = { ...pageNode };
  if (state.length === 0) delete next.state;
  else next.state = [...state];
  children[pageIndex] = next;
  return { changed: true, document: { ...document, children } };
}

export function setActiveCanonicalPageState(
  pageId: string,
  state: readonly VariableDef[],
): boolean {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  if (!projectId) return false;
  const document = canonical.documents.get(projectId);
  if (!document) return false;
  const result = setPageStateInDocument(document, pageId, state);
  if (!result.changed) return false;
  canonical.setDocument(projectId, result.document);
  return true;
}
