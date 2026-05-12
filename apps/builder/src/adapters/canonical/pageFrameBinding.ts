import type {
  CanonicalNode,
  CompositionDocument,
  FrameNode,
  RefNode,
} from "@composition/shared";
import type { Element, Page } from "@/types/builder/unified.types";
import { getDefaultProps } from "@/types/builder/unified.types";
import { getDB } from "../../lib/db";
import { useCanonicalDocumentStore } from "../../builder/stores/canonical/canonicalDocumentStore";
import { visitCanonicalDocumentElements } from "../../builder/stores/canonical/canonicalElementsView";
import { enqueuePagePersistence } from "../../builder/utils/pagePersistenceQueue";
import {
  getPageFrameBindingId,
  getReusableFrameMirrorId,
  withPageFrameBinding,
} from "./frameMirror";

export { getPageFrameBindingId } from "./frameMirror";

interface ElementsStateForPageBinding {
  pages: Page[];
  elementsMap?: ReadonlyMap<string, Element>;
}

export interface ApplyPageFrameBindingInput {
  pageId: string;
  frameId: string | null;
  getElementsState: () => ElementsStateForPageBinding;
  setPages: (pages: Page[]) => void;
}

function isPageNode(node: CanonicalNode, pageId: string): boolean {
  const metadata = node.metadata as
    | { type?: unknown; pageId?: unknown }
    | undefined;
  return (
    node.id === pageId &&
    metadata?.type === "legacy-page" &&
    metadata.pageId === pageId
  );
}

function isReusableFrameNode(node: CanonicalNode): node is FrameNode {
  return node.type === "frame" && (node as FrameNode).reusable === true;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function reusableFrameMatchesBindingId(
  frame: FrameNode,
  frameId: string,
): boolean {
  if (frame.id === frameId) return true;
  if (getReusableFrameMirrorId(frame) === frameId) return true;
  if (frame.name === frameId) return true;

  const metadata = frame.metadata as
    | {
        componentName?: unknown;
        customId?: unknown;
        layoutId?: unknown;
      }
    | undefined;

  return (
    metadata?.layoutId === frameId ||
    (isNonEmptyString(metadata?.customId) && metadata.customId === frameId) ||
    (isNonEmptyString(metadata?.componentName) &&
      metadata.componentName === frameId)
  );
}

function toLegacyFrameRefId(frameId: string): string {
  return frameId.startsWith("layout-") ? frameId : `layout-${frameId}`;
}

function resolvePageFrameRefId(
  doc: CompositionDocument,
  frameId: string,
): string {
  const frame = doc.children.find(
    (node): node is FrameNode =>
      isReusableFrameNode(node) && reusableFrameMatchesBindingId(node, frameId),
  );

  return frame?.id ?? toLegacyFrameRefId(frameId);
}

function buildPageMetadata(
  updatedPage: Page,
  frameId: string | null,
  existingNode?: CanonicalNode,
): CanonicalNode["metadata"] {
  const existingMetadata = existingNode?.metadata ?? { type: "legacy-page" };
  const metadata = {
    ...existingMetadata,
    type: "legacy-page",
    pageId: updatedPage.id,
    slug: updatedPage.slug ?? null,
    parent_id: updatedPage.parent_id ?? null,
  };
  delete (metadata as Record<string, unknown>).order_num;

  if (frameId) {
    return {
      ...metadata,
      layoutId: frameId,
    };
  }

  const withoutLayoutId = {
    ...metadata,
  } as typeof metadata & { layoutId?: unknown };
  delete withoutLayoutId.layoutId;
  return withoutLayoutId;
}

function getChildrenFromDescendants(refNode: RefNode): CanonicalNode[] {
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

function isBodyElementNode(node: CanonicalNode): boolean {
  return node.type.toLowerCase() === "body";
}

function isBodyElement(element: Element): boolean {
  return element.type.toLowerCase() === "body";
}

function findPageOwnedBodyElement(
  elementsMap: ReadonlyMap<string, Element> | undefined,
  pageId: string,
): Element | null {
  if (!elementsMap) return null;
  for (const element of elementsMap.values()) {
    if (
      element.page_id === pageId &&
      element.layout_id == null &&
      !element.deleted &&
      isBodyElement(element)
    ) {
      return element;
    }
  }
  return null;
}

function getPageBindingElementsMap(
  fallbackElementsMap?: ReadonlyMap<string, Element>,
): ReadonlyMap<string, Element> | undefined {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  const doc = projectId ? canonical.getDocument(projectId) : null;
  if (!doc) return fallbackElementsMap;

  const elementsMap = new Map<string, Element>();
  visitCanonicalDocumentElements(doc, (element) => {
    elementsMap.set(element.id, element);
  });
  fallbackElementsMap?.forEach((element, elementId) => {
    if (!elementsMap.has(elementId)) {
      elementsMap.set(elementId, element);
    }
  });
  return elementsMap;
}

function makeBodyNodeFromElement(element: Element): CanonicalNode {
  return {
    id: element.id,
    type: "body",
    props: element.props ?? {},
    children: [],
  };
}

function makeDefaultPageBodyNode(pageId: string): CanonicalNode {
  return {
    id: `${pageId}-body`,
    type: "body",
    props: getDefaultProps("body") as Record<string, unknown>,
    children: [],
  };
}

function ensurePageBodyChild(
  children: CanonicalNode[],
  updatedPage: Page,
  elementsMap?: ReadonlyMap<string, Element>,
): CanonicalNode[] {
  if (children.some(isBodyElementNode)) return children;

  const bodyElement = findPageOwnedBodyElement(elementsMap, updatedPage.id);
  const bodyNode = bodyElement
    ? makeBodyNodeFromElement(bodyElement)
    : makeDefaultPageBodyNode(updatedPage.id);

  return [bodyNode, ...children];
}

function buildPageNode(
  updatedPage: Page,
  frameId: string | null,
  frameRefId: string | null,
  existingNode?: CanonicalNode,
  elementsMap?: ReadonlyMap<string, Element>,
): CanonicalNode {
  if (frameId) {
    const descendants =
      existingNode?.type === "ref"
        ? (existingNode as RefNode).descendants
        : undefined;
    const directChildren =
      existingNode?.type === "frame" ? existingNode.children : undefined;
    const nextNode: RefNode = {
      id: updatedPage.id,
      type: "ref",
      ref: frameRefId ?? toLegacyFrameRefId(frameId),
      name: updatedPage.title,
      metadata: buildPageMetadata(updatedPage, frameId, existingNode),
      ...(descendants && Object.keys(descendants).length > 0
        ? { descendants }
        : directChildren && directChildren.length > 0
          ? { descendants: { content: { children: directChildren } } }
          : {}),
    };
    return nextNode;
  }

  const children =
    existingNode?.type === "ref"
      ? getChildrenFromDescendants(existingNode as RefNode)
      : (existingNode?.children ?? []);
  const childrenWithBody = ensurePageBodyChild(
    children,
    updatedPage,
    elementsMap,
  );

  const nextNode: FrameNode = {
    id: updatedPage.id,
    type: "frame",
    name: updatedPage.title,
    metadata: buildPageMetadata(updatedPage, null, existingNode),
    children: childrenWithBody,
  };
  return nextNode;
}

function setCanonicalDocumentFromPageBinding(
  updatedPage: Page,
  elementsMap?: ReadonlyMap<string, Element>,
): CompositionDocument {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId =
    canonical.currentProjectId ?? updatedPage.project_id ?? null;
  const currentDoc = (projectId ? canonical.getDocument(projectId) : null) ??
    (canonical.currentProjectId
      ? canonical.getDocument(canonical.currentProjectId)
      : null) ?? { version: "composition-1.0", children: [] };
  const pageIndex = currentDoc.children.findIndex((node) =>
    isPageNode(node, updatedPage.id),
  );
  const existingPageNode =
    pageIndex >= 0 ? currentDoc.children[pageIndex] : undefined;
  const frameId = getPageFrameBindingId(updatedPage) || null;
  const nextPageNode = buildPageNode(
    updatedPage,
    frameId,
    frameId ? resolvePageFrameRefId(currentDoc, frameId) : null,
    existingPageNode,
    elementsMap,
  );
  const nextChildren = [...currentDoc.children];
  if (pageIndex >= 0) {
    nextChildren[pageIndex] = nextPageNode;
  } else {
    nextChildren.push(nextPageNode);
  }
  const doc: CompositionDocument = {
    ...currentDoc,
    children: nextChildren,
  };

  if (projectId) {
    if (canonical.currentProjectId !== projectId) {
      canonical.setCurrentProject(projectId);
    }
    canonical.setDocument(projectId, doc);
  }

  return doc;
}

async function persistPageFrameBindingMirror(
  _pageId: string,
  _frameId: string | null,
  updatedPage: Page,
): Promise<void> {
  await enqueuePagePersistence(async () => {
    const canonical = useCanonicalDocumentStore.getState();
    const projectId = canonical.currentProjectId ?? updatedPage.project_id;
    const doc = projectId ? canonical.getDocument(projectId) : null;
    if (!projectId || !doc) return;
    const persistenceDb = await getDB();
    await persistenceDb.documents.put(projectId, doc);
  });
}

export async function applyPageFrameBindingCanonicalPrimary({
  pageId,
  frameId,
  getElementsState,
  setPages,
}: ApplyPageFrameBindingInput): Promise<void> {
  const state = getElementsState();
  const { elementsMap: legacyElementsMap } = state;
  const updatedPages = state.pages.map((page) =>
    page.id === pageId ? withPageFrameBinding(page, frameId) : page,
  );
  const updatedPage = updatedPages.find((page) => page.id === pageId);

  if (!updatedPage) {
    throw new Error(`Page not found: ${pageId}`);
  }

  setCanonicalDocumentFromPageBinding(
    updatedPage,
    getPageBindingElementsMap(legacyElementsMap),
  );
  setPages(updatedPages);
  await persistPageFrameBindingMirror(pageId, frameId, updatedPage);
}
