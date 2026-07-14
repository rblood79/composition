/**
 * @fileoverview adapter 테스트용 — system bootstrap 노드 필터.
 *
 * `legacyToCanonical` 은 Option B(anchor-less ListBox, `legacyListBoxTemplateMigration`)
 * 를 성립시키려고 **모든** document 에 시스템 Components 페이지와 ListBox template
 * origin 3종(+ 하위 slot 노드) 을 bootstrap 한다:
 *
 *   ensureComponentsSystemPage → `page-components` (metadata.systemOwned = true)
 *   ensureListBoxTemplateOrigins → 그 body 안에 origin 24 노드
 *
 * 편집 페이지가 하나도 없으면 fallback `page-home` 까지 만든다.
 *
 * adapter 테스트는 fixture 가 넣은 노드만 검증하려 하므로, 이 bootstrap 산출물을
 * 걷어내는 필터를 여기에 모아 둔다. 개별 테스트가 `doc.children[0]` 같은 위치
 * 가정을 두면 bootstrap 이 늘어날 때마다 전부 깨진다.
 */

import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import type { Element } from "@/types/builder/unified.types";
import { COMPONENTS_SYSTEM_PAGE_ID } from "@/builder/pages/systemComponentsPage";

export { COMPONENTS_SYSTEM_PAGE_ID };

/** fixture 가 편집 페이지를 하나도 안 넣었을 때 bootstrap 이 만드는 fallback 페이지. */
export const FALLBACK_HOME_PAGE_ID = "page-home";

/** 시스템이 소유한 bootstrap 페이지 노드 (Components 페이지) 인가. */
export function isSystemBootstrapNode(node: CanonicalNode): boolean {
  return (
    node.id === COMPONENTS_SYSTEM_PAGE_ID || node.metadata?.systemOwned === true
  );
}

/** document top-level children 에서 시스템 bootstrap 페이지를 제외한 것. */
export function userDocumentChildren(
  doc: CompositionDocument,
): CanonicalNode[] {
  return doc.children.filter((node) => !isSystemBootstrapNode(node));
}

/** fixture 가 넣은 첫 페이지 노드 (시스템 bootstrap 페이지 skip). */
export function firstUserPageNode(doc: CompositionDocument): CanonicalNode {
  const node = userDocumentChildren(doc)[0];
  if (!node) throw new Error("test fixture: no user page node in document");
  return node;
}

/** `exportLegacyDocument` 결과에서 bootstrap origin element 를 제외한 것. */
export function userExportedElements(elements: Element[]): Element[] {
  return elements.filter(
    (element) => element.page_id !== COMPONENTS_SYSTEM_PAGE_ID,
  );
}
