/**
 * ADR-237 Phase 3 — Breadcrumbs 항목 origin (`component-breadcrumb-item-default`).
 *
 * 234 목록 모델 (항목 = origin 의 instance 자식 · slot = 추천 항목) 을 Breadcrumbs 에 적용한다. origin = 링크 모양
 * (가장 완성된 항목 — 구분자는 RAC/Skia 가 위치로 그린다), 현재 항목 모양은 상태 변형 `--current` (seed 는
 * `ensureStateVariantOrigins`). 현재 판정은 RAC 위치 규칙 (마지막 = current) 이 정본이다.
 *
 * 이관 전 projection 행 (`appendBreadcrumbRowProjection`) 의 crumb 과 같은 표시 입력: 라벨 = `children` · 폭
 * `fit-content` · 크기 = Breadcrumbs `size` 위임 (Skia `resolveParentDelegatedSize`).
 *
 * 위치: Components body 에 이미 있으면 그 자리에서 repair (사용자 편집 보존), 없으면 Breadcrumbs origin 바로 앞
 * (없으면 body 끝). 바뀐 것이 없으면 같은 문서 객체.
 */
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { COMPONENTS_SYSTEM_BODY_ID } from "../../pages/systemComponentsPage";

import { BREADCRUMB_ITEM_DEFAULT_ORIGIN_ID } from "../templateItemOriginIds";

export { BREADCRUMB_ITEM_DEFAULT_ORIGIN_ID };
export const BREADCRUMBS_ORIGIN_ID = "component-breadcrumbs";

export function createBreadcrumbItemOrigin(): CanonicalNode {
  return {
    id: BREADCRUMB_ITEM_DEFAULT_ORIGIN_ID,
    type: "Breadcrumb",
    name: "Breadcrumb/Default",
    reusable: true,
    props: {
      children: "Breadcrumb",
      href: "#",
      style: { width: "fit-content" },
    },
    metadata: {
      type: "breadcrumb-template-origin",
      systemOwned: true,
      componentFamily: "Breadcrumbs",
      variant: "default",
    },
  } as CanonicalNode;
}

function repairOrigin(existing: CanonicalNode): CanonicalNode {
  const base = createBreadcrumbItemOrigin();
  return {
    ...base,
    ...existing,
    props: existing.props ?? base.props,
    metadata: {
      ...base.metadata,
      ...(existing.metadata ?? {}),
      type: existing.metadata?.type ?? base.metadata?.type,
      systemOwned: true,
      componentFamily: "Breadcrumbs",
    },
  } as CanonicalNode;
}

export function ensureBreadcrumbsTemplateOrigins(
  document: CompositionDocument,
): CompositionDocument {
  let changed = false;
  const patchBody = (body: CanonicalNode): CanonicalNode => {
    const children = body.children ?? [];
    const index = children.findIndex(
      (node) => node.id === BREADCRUMB_ITEM_DEFAULT_ORIGIN_ID,
    );
    if (index >= 0) {
      const repaired = repairOrigin(children[index]!);
      if (JSON.stringify(repaired) === JSON.stringify(children[index])) {
        return body;
      }
      changed = true;
      const next = [...children];
      next[index] = repaired;
      return { ...body, children: next };
    }
    changed = true;
    const at = children.findIndex((node) => node.id === BREADCRUMBS_ORIGIN_ID);
    const next = [...children];
    next.splice(at >= 0 ? at : next.length, 0, createBreadcrumbItemOrigin());
    return { ...body, children: next };
  };
  const visit = (nodes: readonly CanonicalNode[]): CanonicalNode[] =>
    nodes.map((node) => {
      if (node.id === COMPONENTS_SYSTEM_BODY_ID) return patchBody(node);
      if (!node.children) return node;
      const children = visit(node.children);
      return children.every((child, i) => child === node.children![i])
        ? node
        : { ...node, children };
    });
  const children = visit(document.children);
  return changed ? { ...document, children } : document;
}
