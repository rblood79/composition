import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import {
  COMPONENTS_SYSTEM_BODY_ID,
  ensureComponentsSystemPage,
} from "../pages/systemComponentsPage";

function collectOrigins(
  nodes: readonly CanonicalNode[],
  originIds: ReadonlySet<string>,
  out = new Map<string, CanonicalNode>(),
): Map<string, CanonicalNode> {
  for (const node of nodes) {
    if (originIds.has(node.id)) {
      out.set(node.id, node);
    }
    collectOrigins(node.children ?? [], originIds, out);
  }
  return out;
}

/**
 * origin 을 문서에 다시 놓는다.
 * - Components body **안**에 있는 origin 은 제자리에서 보정본으로 바꾼다 — 사용자가 Components
 *   페이지에서 바꾼 순서·위치 (frame 안 등) 를 유지한다. 같은 id 가 두 번이면 첫 것만 남긴다.
 * - Components body **밖** (다른 페이지·문서 루트) 의 origin 은 떼어낸다 — 아래에서 body 끝에 보충.
 *
 * ADR-228 codex round 3 h2 (2026-09-21): 이전 구현은 origin 을 전부 떼어 고정 seed 순서로
 * body 끝에 다시 붙여, 사용자가 바꾼 순서가 매 hydration 마다 되돌아갔다 (G3 보존 위반).
 */
function placeOrigins(
  nodes: readonly CanonicalNode[],
  repairedById: ReadonlyMap<string, CanonicalNode>,
  originIds: ReadonlySet<string>,
  consumed: Set<string>,
  insideComponentsBody: boolean,
): CanonicalNode[] {
  const out: CanonicalNode[] = [];
  for (const node of nodes) {
    if (originIds.has(node.id)) {
      if (!insideComponentsBody || consumed.has(node.id)) continue;
      consumed.add(node.id);
      out.push(repairedById.get(node.id) ?? node);
      continue;
    }
    if (!node.children) {
      out.push(node);
      continue;
    }
    out.push({
      ...node,
      children: placeOrigins(
        node.children,
        repairedById,
        originIds,
        consumed,
        insideComponentsBody || node.id === COMPONENTS_SYSTEM_BODY_ID,
      ),
    });
  }
  return out;
}

function appendToComponentsBody(
  nodes: readonly CanonicalNode[],
  missing: readonly CanonicalNode[],
): CanonicalNode[] {
  if (missing.length === 0) return [...nodes];
  return nodes.map((node) => {
    if (node.id === COMPONENTS_SYSTEM_BODY_ID) {
      return {
        ...node,
        children: [...(node.children ?? []), ...missing],
      };
    }
    if (!node.children) return node;
    return {
      ...node,
      children: appendToComponentsBody(node.children, missing),
    };
  });
}

/** family별 보정은 호출자가 소유하고, origin 위치와 멱등성은 공통 경로에서 보장한다. */
export function ensureTemplateOrigins(
  document: CompositionDocument,
  originIds: ReadonlySet<string>,
  repairOrigins: (
    existing: ReadonlyMap<string, CanonicalNode>,
  ) => CanonicalNode[],
): CompositionDocument {
  const withComponentsPage = ensureComponentsSystemPage(document);
  const existingOrigins = collectOrigins(
    withComponentsPage.children,
    originIds,
  );
  const origins = repairOrigins(existingOrigins);
  const repairedById = new Map(origins.map((origin) => [origin.id, origin]));
  const consumed = new Set<string>();
  const placed = placeOrigins(
    withComponentsPage.children,
    repairedById,
    originIds,
    consumed,
    false,
  );
  // Components body 안에 없던 origin 만 seed 순서대로 body 끝에 보충한다.
  const missing = origins.filter((origin) => !consumed.has(origin.id));
  const children = appendToComponentsBody(placed, missing);
  const nextDocument = { ...withComponentsPage, children };
  return JSON.stringify(withComponentsPage) === JSON.stringify(nextDocument)
    ? withComponentsPage
    : nextDocument;
}
