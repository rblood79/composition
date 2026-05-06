import type { Element } from "../../../types/core/store.types";
import { canonicalDocumentToElements } from "./canonicalElementsView";
import { useCanonicalDocumentStore } from "./canonicalDocumentStore";

export function getActiveCanonicalElementsSnapshot(): Element[] | null {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  if (!projectId) return null;

  const doc = canonical.documents.get(projectId);
  if (!doc) return null;

  return canonicalDocumentToElements(doc) as Element[];
}

export function getActiveCanonicalElementSnapshot(
  elementId: string,
): Element | null {
  const elements = getActiveCanonicalElementsSnapshot();
  return elements?.find((element) => element.id === elementId) ?? null;
}
