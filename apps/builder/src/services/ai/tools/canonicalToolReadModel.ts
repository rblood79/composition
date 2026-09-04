import { useCanonicalDocumentStore } from "../../../builder/stores/canonical/canonicalDocumentStore";
import { canonicalNodeToElement } from "../../../builder/stores/canonical/canonicalElementsView";
import { getProjectableNodeLookups } from "../../../builder/stores/canonical/canonicalTraversalHelpers";
import { getStoreState } from "../../../builder/stores";
import type { CompositionDocument } from "@composition/shared";
import type { Element } from "../../../types/builder/unified.types";

interface AiToolElementProjection {
  readonly childrenByParent: Map<string, Element[]>;
  readonly elements: Element[];
  readonly elementsById: Map<string, Element>;
}

const canonicalProjectionCache = new WeakMap<
  CompositionDocument,
  AiToolElementProjection
>();
const legacyProjectionCache = new WeakMap<Element[], AiToolElementProjection>();

function buildAiToolElementProjection(
  elements: Element[],
): AiToolElementProjection {
  const elementsById = new Map<string, Element>();
  const childrenByParent = new Map<string, Element[]>();

  for (const element of elements) {
    elementsById.set(element.id, element);
    if (element.deleted || !element.parent_id) continue;
    const siblings = childrenByParent.get(element.parent_id);
    if (siblings) {
      siblings.push(element);
    } else {
      childrenByParent.set(element.parent_id, [element]);
    }
  }

  return { childrenByParent, elements, elementsById };
}

function getActiveCanonicalProjectionForAiTools(): AiToolElementProjection | null {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  if (!projectId) return null;

  const doc = canonical.documents.get(projectId);
  if (!doc) return null;

  const cached = canonicalProjectionCache.get(doc);
  if (cached) return cached;

  const elements: Element[] = [];
  for (const lookup of getProjectableNodeLookups()) {
    const element = canonicalNodeToElement(lookup.node, lookup.parentId, {
      pageId: lookup.pageId,
      layoutId: lookup.layoutId,
    });
    if (element) elements.push(element);
  }
  const projection = buildAiToolElementProjection(elements);
  canonicalProjectionCache.set(doc, projection);
  return projection;
}

export function getAiToolReadModel() {
  const state = getStoreState();
  const canonicalProjection = getActiveCanonicalProjectionForAiTools();
  if (canonicalProjection) {
    return { ...canonicalProjection, state };
  }

  const cachedLegacyProjection = legacyProjectionCache.get(state.elements);
  const projection =
    cachedLegacyProjection ?? buildAiToolElementProjection(state.elements);
  if (!cachedLegacyProjection) {
    legacyProjectionCache.set(state.elements, projection);
  }
  return { ...projection, state };
}
