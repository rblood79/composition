import {
  isEditorPageNode,
  type CompositionDocument,
} from "@composition/shared";

import { useCanonicalDocumentStore } from "./canonicalDocumentStore";

export function normalizePageTitleDraft(title: string): string | null {
  const normalized = title.trim();
  return normalized.length > 0 ? normalized : null;
}

export function renamePageTitleInDocument(
  document: CompositionDocument,
  pageId: string,
  title: string,
): { changed: boolean; document: CompositionDocument } {
  const pageIndex = document.children.findIndex(
    (node) => node.id === pageId && isEditorPageNode(node),
  );
  if (pageIndex < 0) return { changed: false, document };

  const pageNode = document.children[pageIndex];
  if (pageNode.name === title) return { changed: false, document };

  const children = [...document.children];
  children[pageIndex] = { ...pageNode, name: title };
  return {
    changed: true,
    document: { ...document, children },
  };
}

export function renameActiveCanonicalPageTitle(
  pageId: string,
  title: string,
): boolean {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  if (!projectId) return false;

  const document = canonical.documents.get(projectId);
  if (!document) return false;

  const result = renamePageTitleInDocument(document, pageId, title);
  if (!result.changed) return false;

  canonical.setDocument(projectId, result.document);
  return true;
}
