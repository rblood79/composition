import type { CompositionDocument } from "@composition/shared";
import { useCanonicalDocumentStore } from "@/builder/stores/canonical/canonicalDocumentStore";
import {
  canonicalNodeToElement,
  getCanonicalDocumentElementsView,
} from "@/builder/stores/canonical/canonicalElementsView";
import { getProjectableNodeLookups } from "@/builder/stores/canonical/canonicalTraversalHelpers";
import {
  canonicalDocumentToFrameElementScopes,
  isElementInCanonicalFrameScope,
  type CanonicalFrameScopedNode,
  type CanonicalFrameElementScope,
  type CanonicalFrameElementScopeMap,
} from "./frameElementScope";
import { getFrameElementMirrorId } from "./frameMirror";

export interface FrameElementLoaderDb {
  readonly legacyDbArgument?: never;
}

export interface FrameElementLike extends CanonicalFrameScopedNode {
  type: string;
  props?: Record<string, unknown>;
  parent_id?: string | null;
  page_id?: string | null;
  layout_id?: string | null;
}

export interface FrameElementNode extends FrameElementLike {
  id: string;
  props: Record<string, unknown>;
}

const frameElementsByDocumentCache = new WeakMap<
  CompositionDocument,
  ReadonlyMap<string, readonly FrameElementNode[]>
>();

/**
 * active document traversal cache의 occurrence 순서와 layout scope를 함께 사용해
 * frame별 projection을 한 번만 만든다. global byId를 사용하지 않으므로 다른
 * frame의 duplicate id가 현재 frame 요소를 덮어쓰지 않는다.
 */
function getCanonicalFrameElementsById(
  doc: CompositionDocument,
  scopes: CanonicalFrameElementScopeMap,
): ReadonlyMap<string, readonly FrameElementNode[]> {
  const cached = frameElementsByDocumentCache.get(doc);
  if (cached) return cached;

  const frameElementsById = new Map<string, FrameElementNode[]>();
  for (const frameId of scopes.keys()) {
    frameElementsById.set(frameId, []);
  }

  for (const lookup of getProjectableNodeLookups()) {
    const frameId = lookup.layoutId;
    if (!frameId) continue;
    const scope = scopes.get(frameId);
    if (!scope || !scope.elementIds.has(lookup.node.id)) continue;

    const element = canonicalNodeToElement(lookup.node, lookup.parentId, {
      pageId: lookup.pageId,
      layoutId: lookup.layoutId,
    }) as FrameElementNode | null;
    if (element && !element.deleted) {
      frameElementsById.get(frameId)?.push(element);
    }
  }

  frameElementsByDocumentCache.set(doc, frameElementsById);
  return frameElementsById;
}

function isBodyElement(element: FrameElementLike): boolean {
  return element.type.toLowerCase() === "body";
}

export function isFrameElementForFrame<T extends FrameElementLike>(
  element: T,
  frameScope: CanonicalFrameElementScope,
): boolean {
  return isElementInCanonicalFrameScope(element, frameScope);
}

export function isLegacyFrameElementForFrame<T extends FrameElementLike>(
  element: T,
  frameId: string,
): boolean {
  return (
    !element.deleted &&
    getFrameElementMirrorId(element) === frameId &&
    element.page_id == null
  );
}

function hasFrameBody<T extends FrameElementLike>(
  elements: readonly T[],
  frameId: string,
): boolean {
  return elements.some(
    (element) =>
      !element.deleted &&
      isBodyElement(element) &&
      (getFrameElementMirrorId(element) === frameId ||
        element.parent_id === frameId),
  );
}

export function hasHydratedFrameElements<T extends FrameElementLike>(
  elementsMap: ReadonlyMap<string, T>,
  frameScope: CanonicalFrameElementScope,
): boolean {
  for (const element of elementsMap.values()) {
    if (isFrameElementForFrame(element, frameScope)) {
      return true;
    }
  }
  return false;
}

export function collectHydratedFrameElements<T extends FrameElementLike>(
  elementsMap: ReadonlyMap<string, T>,
  frameScope: CanonicalFrameElementScope,
): T[] {
  const frameElements: T[] = [];
  for (const element of elementsMap.values()) {
    if (isFrameElementForFrame(element, frameScope)) {
      frameElements.push(element);
    }
  }
  return frameElements;
}

export async function loadFrameElements(
  frameIdOrDb: string | FrameElementLoaderDb,
  maybeFrameId?: string,
): Promise<FrameElementNode[]> {
  const frameId =
    typeof frameIdOrDb === "string" ? frameIdOrDb : (maybeFrameId ?? "");
  if (!frameId) return [];

  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  const doc = projectId ? canonical.documents.get(projectId) : null;
  if (!doc) return [];

  const scopes = canonicalDocumentToFrameElementScopes(doc);
  const scope = scopes.get(frameId);
  const frameElements: FrameElementNode[] = [];
  if (scope) {
    frameElements.push(
      ...(getCanonicalFrameElementsById(doc, scopes).get(frameId) ?? []),
    );
  } else {
    const elementsView = getCanonicalDocumentElementsView(doc);
    for (const element of elementsView.elements as readonly FrameElementNode[]) {
      if (isLegacyFrameElementForFrame(element, frameId)) {
        frameElements.push(element);
      }
    }
  }

  return hasFrameBody(frameElements, frameId)
    ? frameElements.filter((element) => !element.deleted)
    : frameElements;
}
