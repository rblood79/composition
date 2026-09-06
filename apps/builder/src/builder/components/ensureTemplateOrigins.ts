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

function stripOrigins(
  nodes: readonly CanonicalNode[],
  originIds: ReadonlySet<string>,
): CanonicalNode[] {
  return nodes
    .filter((node) => !originIds.has(node.id))
    .map((node) => {
      if (!node.children) return node;
      return {
        ...node,
        children: stripOrigins(node.children, originIds),
      };
    });
}

function withOriginsInComponentsBody(
  nodes: readonly CanonicalNode[],
  origins: CanonicalNode[],
): CanonicalNode[] {
  return nodes.map((node) => {
    if (node.id === COMPONENTS_SYSTEM_BODY_ID) {
      return {
        ...node,
        children: [...(node.children ?? []), ...origins],
      };
    }
    if (!node.children) return node;
    return {
      ...node,
      children: withOriginsInComponentsBody(node.children, origins),
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
  const strippedChildren = stripOrigins(withComponentsPage.children, originIds);
  const children = withOriginsInComponentsBody(strippedChildren, origins);
  const nextDocument = { ...withComponentsPage, children };
  return JSON.stringify(withComponentsPage) === JSON.stringify(nextDocument)
    ? withComponentsPage
    : nextDocument;
}
