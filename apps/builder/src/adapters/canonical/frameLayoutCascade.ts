import type {
  CanonicalNode,
  CompositionDocument,
  FrameNode,
  RefNode,
} from "@composition/shared";
import { deriveProjectRenderModelFromDocument } from "@composition/shared";
import type { Element, Page } from "@/types/builder/unified.types";
import { getDefaultProps } from "../../types/builder/unified.types";
import type { Layout } from "@/types/builder/layout.types";
import { getDB } from "../../lib/db";
import { useCanonicalDocumentStore } from "../../builder/stores/canonical/canonicalDocumentStore";
import { exportLegacyDocument } from "./exportLegacyDocument";
import { mergeElementsCanonicalPrimary } from "./canonicalMutations";
import {
  getLegacyLayoutId,
  matchesLegacyLayoutId,
  withLegacyLayoutId,
} from "./legacyElementFields";

interface ElementsStateForFrameLayoutCascade {
  pages: Page[];
  elementsMap: Map<string, Element>;
}

interface ApplyDeleteReusableFrameInput {
  frameId: string;
  layouts: Layout[];
  getElementsState: () => ElementsStateForFrameLayoutCascade;
  setPages: (pages: Page[]) => void;
  setElements: (elements: Element[]) => void;
}

export interface DeleteReusableFrameResult {
  clearedPageIds: string[];
  deletedElementIds: string[];
  frameExisted: boolean;
}

interface DuplicateReusableFrameElementsInput {
  sourceFrameId: string;
  targetFrameId: string;
}

function frameMatchesLayoutId(frame: FrameNode, frameId: string): boolean {
  const metadata = frame.metadata as { layoutId?: string } | undefined;
  return (
    frame.id === frameId ||
    frame.id === `layout-${frameId}` ||
    metadata?.layoutId === frameId
  );
}

function findReusableFrame(
  doc: CompositionDocument,
  frameId: string,
): FrameNode | null {
  return (
    doc.children.find(
      (node): node is FrameNode =>
        node.type === "frame" &&
        node.reusable === true &&
        frameMatchesLayoutId(node, frameId),
    ) ?? null
  );
}

function getProjectId(pages: Page[], layouts: Layout[]): string | null {
  return (
    pages.find((page) => page.project_id)?.project_id ??
    layouts.find((layout) => layout.project_id)?.project_id ??
    null
  );
}

function getCurrentCanonicalDocument(
  pages: Page[],
  layouts: Layout[],
): CompositionDocument {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId ?? getProjectId(pages, layouts);
  return (
    (projectId ? canonical.getDocument(projectId) : null) ?? {
      version: "composition-1.0",
      children: [],
    }
  );
}

function setCanonicalDocument(
  doc: CompositionDocument,
  pages: Page[],
  layouts: Layout[],
): void {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId ?? getProjectId(pages, layouts);

  if (!projectId) return;

  if (canonical.currentProjectId !== projectId) {
    canonical.setCurrentProject(projectId);
  }
  canonical.setDocument(projectId, doc);
}

function clearFramePageBindings(
  pages: Page[],
  frameId: string,
): { pages: Page[]; clearedPageIds: string[] } {
  const clearedPageIds: string[] = [];
  const nextPages = pages.map((page) => {
    if (getLegacyLayoutId(page) !== frameId) {
      return page;
    }
    clearedPageIds.push(page.id);
    return withLegacyLayoutId(page, null);
  });

  return { pages: nextPages, clearedPageIds };
}

function getLegacyPageMetadata(
  node: CanonicalNode,
): { type?: unknown; pageId?: unknown; layoutId?: unknown } | undefined {
  return node.metadata as
    | { type?: unknown; pageId?: unknown; layoutId?: unknown }
    | undefined;
}

function isLegacyPageNode(node: CanonicalNode): boolean {
  return getLegacyPageMetadata(node)?.type === "legacy-page";
}

function pageNodeReferencesFrame(
  node: CanonicalNode,
  frameId: string,
  clearedPageIds: Set<string>,
): boolean {
  const metadata = getLegacyPageMetadata(node);
  const metadataPageId =
    typeof metadata?.pageId === "string" ? metadata.pageId : node.id;
  return (
    isLegacyPageNode(node) &&
    (clearedPageIds.has(metadataPageId) ||
      metadata?.layoutId === frameId ||
      (node.type === "ref" && (node as RefNode).ref === `layout-${frameId}`))
  );
}

function removeLayoutIdFromMetadata(
  node: CanonicalNode,
): CanonicalNode["metadata"] {
  const metadata = {
    ...(node.metadata ?? { type: "legacy-page" }),
    type: "legacy-page",
  } as CanonicalNode["metadata"] & { layoutId?: unknown };
  delete metadata.layoutId;
  return metadata;
}

function childrenFromRefDescendants(refNode: RefNode): CanonicalNode[] {
  const children: CanonicalNode[] = [];
  const descendants = refNode.descendants ?? {};

  for (const override of Object.values(descendants)) {
    if (
      override &&
      typeof override === "object" &&
      "children" in override &&
      Array.isArray(override.children)
    ) {
      children.push(...override.children);
    } else if (
      override &&
      typeof override === "object" &&
      "type" in override &&
      typeof override.type === "string"
    ) {
      children.push(override as CanonicalNode);
    }
  }

  return children;
}

function clearPageFrameBindingNode(node: CanonicalNode): FrameNode {
  const children =
    node.type === "ref"
      ? childrenFromRefDescendants(node as RefNode)
      : (node.children ?? []);
  return {
    id: node.id,
    type: "frame",
    ...(node.name ? { name: node.name } : {}),
    ...(node.props ? { props: node.props } : {}),
    metadata: removeLayoutIdFromMetadata(node),
    ...(node.slot !== undefined ? { slot: node.slot } : {}),
    ...(node.theme ? { theme: node.theme } : {}),
    ...(children.length > 0 ? { children } : {}),
  };
}

function removeReusableFrameFromDocument(
  doc: CompositionDocument,
  frameId: string,
  clearedPageIds: string[],
): CompositionDocument {
  const clearedPageIdSet = new Set(clearedPageIds);
  return {
    ...doc,
    children: doc.children.flatMap((node) => {
      if (
        node.type === "frame" &&
        node.reusable === true &&
        frameMatchesLayoutId(node as FrameNode, frameId)
      ) {
        return [];
      }
      if (pageNodeReferencesFrame(node, frameId, clearedPageIdSet)) {
        return [clearPageFrameBindingNode(node)];
      }
      return [node];
    }),
  };
}

function collectRemovedElementIds(
  previousElements: Iterable<Element>,
  nextElements: Element[],
): string[] {
  const nextIds = new Set(nextElements.map((element) => element.id));
  const removedIds: string[] = [];

  for (const element of previousElements) {
    if (!nextIds.has(element.id)) {
      removedIds.push(element.id);
    }
  }

  return removedIds;
}

async function persistDeleteReusableFrameMirror(
  _frameId: string,
  _clearedPageIds: string[],
  _deletedElementIds: string[],
): Promise<void> {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  const doc = projectId ? canonical.documents.get(projectId) : null;
  if (!projectId || !doc) return;
  const db = await getDB();
  await db.documents.put(projectId, doc);
}

export function createFrameBodyElement(frameId: string): Element {
  return withLegacyLayoutId(
    {
      id: crypto.randomUUID(),
      type: "body",
      props: getDefaultProps("body") as Element["props"],
      parent_id: null,
      page_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    frameId,
  );
}

export async function applyDeleteReusableFrameCanonicalPrimary({
  frameId,
  layouts,
  getElementsState,
  setPages,
  setElements,
}: ApplyDeleteReusableFrameInput): Promise<DeleteReusableFrameResult> {
  const state = getElementsState();
  const { pages: nextPages, clearedPageIds } = clearFramePageBindings(
    state.pages,
    frameId,
  );
  const nextLayouts = layouts.filter((layout) => layout.id !== frameId);
  const currentDoc = getCurrentCanonicalDocument(state.pages, layouts);
  const frameExisted = findReusableFrame(currentDoc, frameId) !== null;
  const nextDoc = removeReusableFrameFromDocument(
    currentDoc,
    frameId,
    clearedPageIds,
  );

  setCanonicalDocument(nextDoc, nextPages, nextLayouts);

  let deletedElementIds: string[] = [];
  if (frameExisted) {
    const legacyMirror = exportLegacyDocument(nextDoc);
    deletedElementIds = collectRemovedElementIds(
      state.elementsMap.values(),
      legacyMirror,
    );
    setElements(legacyMirror);
  }

  if (clearedPageIds.length > 0) {
    setPages(nextPages);
  }

  await persistDeleteReusableFrameMirror(
    frameId,
    clearedPageIds,
    deletedElementIds,
  );

  return {
    clearedPageIds,
    deletedElementIds,
    frameExisted,
  };
}

export async function duplicateReusableFrameElementsCanonicalPrimary({
  sourceFrameId,
  targetFrameId,
}: DuplicateReusableFrameElementsInput): Promise<Element[]> {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  const doc = projectId ? canonical.documents.get(projectId) : null;
  if (!doc) return [];

  const allElements = exportLegacyDocument(doc) as Element[];
  const originalElements = allElements.filter((element) =>
    matchesLegacyLayoutId(element, sourceFrameId),
  );

  if (originalElements.length === 0) {
    return [];
  }

  const idMap = new Map<string, string>();
  originalElements.forEach((element) => {
    idMap.set(element.id, crypto.randomUUID());
  });

  const newElements = originalElements.map((element) =>
    withLegacyLayoutId(
      {
        ...element,
        id: idMap.get(element.id)!,
        parent_id: element.parent_id
          ? (idMap.get(element.parent_id) ?? null)
          : null,
        page_id: null,
      },
      targetFrameId,
    ),
  );

  mergeElementsCanonicalPrimary(newElements);
  const nextDoc = projectId
    ? useCanonicalDocumentStore.getState().documents.get(projectId)
    : null;
  if (projectId && nextDoc) {
    const db = await getDB();
    await db.documents.put(projectId, nextDoc);
  }

  return newElements;
}

export async function getPageIdsUsingFrameMirror(
  frameId: string,
): Promise<string[]> {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  const doc = projectId ? canonical.documents.get(projectId) : null;
  if (!projectId || !doc) return [];

  return deriveProjectRenderModelFromDocument(doc, projectId)
    .pages.filter((page) => getLegacyLayoutId(page) === frameId)
    .map((page) => page.id);
}
