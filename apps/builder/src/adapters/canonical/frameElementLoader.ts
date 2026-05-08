import type { Element } from "@/types/builder/unified.types";
import { matchesLegacyLayoutId } from "./legacyElementFields";
import { useCanonicalDocumentStore } from "@/builder/stores/canonical/canonicalDocumentStore";
import { canonicalDocumentToElements } from "@/builder/stores/canonical/canonicalElementsView";
import {
  canonicalDocumentToFrameElementScopes,
  isElementInCanonicalFrameScope,
  type CanonicalFrameElementScope,
} from "./frameElementScope";

export interface FrameElementLoaderDb {
  readonly legacyDbArgument?: never;
}

function isBodyElement(element: Element): boolean {
  return element.type.toLowerCase() === "body";
}

export function isFrameElementForFrame(
  element: Element,
  frameScope: CanonicalFrameElementScope,
): boolean {
  return isElementInCanonicalFrameScope(element, frameScope);
}

export function isLegacyFrameElementForFrame(
  element: Element,
  frameId: string,
): boolean {
  return (
    !element.deleted &&
    matchesLegacyLayoutId(element, frameId) &&
    element.page_id == null
  );
}

function hasFrameBody(elements: Element[], frameId: string): boolean {
  return elements.some(
    (element) =>
      !element.deleted &&
      isBodyElement(element) &&
      (matchesLegacyLayoutId(element, frameId) ||
        element.parent_id === frameId),
  );
}

export function hasHydratedFrameElements(
  elementsMap: ReadonlyMap<string, Element>,
  frameScope: CanonicalFrameElementScope,
): boolean {
  for (const element of elementsMap.values()) {
    if (isFrameElementForFrame(element, frameScope)) {
      return true;
    }
  }
  return false;
}

export function collectHydratedFrameElements(
  elementsMap: ReadonlyMap<string, Element>,
  frameScope: CanonicalFrameElementScope,
): Element[] {
  const frameElements: Element[] = [];
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

  const elements = canonicalDocumentToElements(doc) as Element[];
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
