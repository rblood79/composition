import { useCanonicalDocumentStore } from "../../../builder/stores/canonical/canonicalDocumentStore";
import { visitCanonicalDocumentElements } from "../../../builder/stores/canonical/canonicalElementsView";
import { getStoreState } from "../../../builder/stores";
import type { Element } from "../../../types/builder/unified.types";

function getActiveCanonicalElementsForAiTools(): Element[] | null {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  if (!projectId) return null;

  const doc = canonical.documents.get(projectId);
  if (!doc) return null;

  const elements: Element[] = [];
  visitCanonicalDocumentElements(doc, (element) => {
    elements.push(element);
  });
  return elements;
}

export function getAiToolReadModel() {
  const state = getStoreState();
  const elements = getActiveCanonicalElementsForAiTools() ?? state.elements;
  const elementsById = new Map(
    elements.map((element) => [element.id, element]),
  );
  const childrenByParent = new Map<string, Element[]>();

  for (const element of elements) {
    if (element.deleted || !element.parent_id) continue;
    const siblings = childrenByParent.get(element.parent_id);
    if (siblings) {
      siblings.push(element);
    } else {
      childrenByParent.set(element.parent_id, [element]);
    }
  }

  return {
    childrenByParent,
    elements,
    elementsById,
    state,
  };
}
