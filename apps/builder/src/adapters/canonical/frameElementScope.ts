import type {
  CanonicalNode,
  CompositionDocument,
  FrameNode,
} from "@composition/shared";
import { getReusableFrameMirrorId } from "./frameMirror";

export interface CanonicalFrameScopedNode {
  id: string;
  deleted?: boolean;
}

export interface CanonicalFrameElementScope {
  bodyElementId: string | null;
  elementIds: ReadonlySet<string>;
  frameId: string;
}

export type CanonicalFrameElementScopeMap = ReadonlyMap<
  string,
  CanonicalFrameElementScope
>;

const frameElementScopesCache = new WeakMap<
  CompositionDocument,
  CanonicalFrameElementScopeMap
>();

function isReusableFrameNode(node: CanonicalNode): node is FrameNode {
  return node.type === "frame" && (node as FrameNode).reusable === true;
}

function isBodyNode(node: CanonicalNode): boolean {
  return node.type.toLowerCase() === "body";
}

function isLegacySlotHoistedNode(node: CanonicalNode): boolean {
  return (
    (node.metadata as { type?: unknown } | undefined)?.type ===
    "legacy-slot-hoisted"
  );
}

function isSlotHostNode(node: CanonicalNode): boolean {
  return (
    node.type === "Slot" ||
    Array.isArray((node as CanonicalNode & { slot?: unknown }).slot) ||
    isLegacySlotHoistedNode(node)
  );
}

function isPagePlaceholderNode(node: CanonicalNode): boolean {
  const metadataType = (node.metadata as { type?: unknown } | undefined)?.type;
  return metadataType === "page" || metadataType === "legacy-page";
}

/**
 * `type: "ref"` 인스턴스 노드 중 page placeholder 가 아닌 것 — renderable ref.
 * `canonicalElementsView.ts::canonicalNodeToElement` 의 `isRenderableRef` 조건과 동기화.
 */
function isRenderableRefNode(node: CanonicalNode): boolean {
  return (
    node.type === "ref" &&
    typeof (node as CanonicalNode & { ref?: unknown }).ref === "string" &&
    !isPagePlaceholderNode(node)
  );
}

function collectElementScopeIds(
  node: CanonicalNode,
  elementIds: Set<string>,
  currentBodyElementId: string | null,
): string | null {
  let bodyElementId = currentBodyElementId;

  if (
    node.props ||
    isSlotHostNode(node) ||
    isLegacySlotHoistedNode(node) ||
    isRenderableRefNode(node)
  ) {
    elementIds.add(node.id);
    if (!bodyElementId && isBodyNode(node)) {
      bodyElementId = node.id;
    }
  }

  for (const child of node.children ?? []) {
    bodyElementId = collectElementScopeIds(child, elementIds, bodyElementId);
  }

  return bodyElementId;
}

export function canonicalDocumentToFrameElementScopes(
  doc: CompositionDocument,
): CanonicalFrameElementScopeMap {
  const cached = frameElementScopesCache.get(doc);
  if (cached) return cached;

  const scopes = new Map<string, CanonicalFrameElementScope>();

  for (const child of doc.children) {
    if (!isReusableFrameNode(child)) continue;

    const frameId = getReusableFrameMirrorId(child);
    const elementIds = new Set<string>();
    let bodyElementId: string | null = null;

    for (const frameChild of child.children ?? []) {
      bodyElementId = collectElementScopeIds(
        frameChild,
        elementIds,
        bodyElementId,
      );
    }

    scopes.set(frameId, {
      bodyElementId,
      elementIds,
      frameId,
    });
  }

  frameElementScopesCache.set(doc, scopes);
  return scopes;
}

export function isElementInCanonicalFrameScope<
  T extends CanonicalFrameScopedNode,
>(element: T, scope: CanonicalFrameElementScope): boolean {
  return !element.deleted && scope.elementIds.has(element.id);
}
