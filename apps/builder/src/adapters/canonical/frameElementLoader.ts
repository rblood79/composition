import type { Element } from "@/types/builder/unified.types";
import { matchesLegacyLayoutId } from "./legacyElementFields";
import { useCanonicalDocumentStore } from "@/builder/stores/canonical/canonicalDocumentStore";
import { visitCanonicalDocumentElements } from "@/builder/stores/canonical/canonicalElementsView";
import {
  canonicalDocumentToFrameElementScopes,
  isElementInCanonicalFrameScope,
  type CanonicalFrameScopedNode,
  type CanonicalFrameElementScope,
} from "./frameElementScope";

export interface FrameElementLoaderDb {
  readonly legacyDbArgument?: never;
}

export interface FrameElementLike extends CanonicalFrameScopedNode {
  type: string;
  parent_id?: string | null;
  page_id?: string | null;
}

function isBodyElement(element: FrameElementLike): boolean {
  return element.type.toLowerCase() === "body";
}

function collectFrameLoaderElements(
  doc: Parameters<typeof visitCanonicalDocumentElements>[0],
): Element[] {
  const elements: Element[] = [];
  visitCanonicalDocumentElements(doc, (element) => {
    elements.push(element as Element);
  });
  return elements;
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
    matchesLegacyLayoutId(element, frameId) &&
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
      (matchesLegacyLayoutId(element, frameId) ||
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
): Promise<Element[]> {
  const frameId =
    typeof frameIdOrDb === "string" ? frameIdOrDb : (maybeFrameId ?? "");
  if (!frameId) return [];

  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  const doc = projectId ? canonical.documents.get(projectId) : null;
  if (!doc) return [];

  const elements = collectFrameLoaderElements(doc);
  const scope = canonicalDocumentToFrameElementScopes(doc).get(frameId);
  const frameElements = scope
    ? elements.filter((element) => isFrameElementForFrame(element, scope))
    : elements.filter((element) =>
        isLegacyFrameElementForFrame(element, frameId),
      );

  return hasFrameBody(frameElements, frameId)
    ? frameElements.filter((element) => !element.deleted)
    : frameElements;
}
