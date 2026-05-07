import { useMemo, useCallback } from "react";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import { getDB } from "../../../../../lib/db";
import type { Page } from "../../../../../types/builder/unified.types";
import type { PageTreeNode } from "./types";
import { useStore } from "../../../../stores";
import { useCanonicalDocumentStore } from "../../../../stores/canonical/canonicalDocumentStore";
import { enqueuePagePersistence } from "../../../../utils/pagePersistenceQueue";

export type PageTreeUpdate = {
  id: string;
  parentId?: string | null;
  orderNum?: number;
};

type PageNodeMetadata = Record<string, unknown> & {
  pageId?: unknown;
  parent_id?: unknown;
  slug?: unknown;
  type?: unknown;
  order_num?: unknown;
};

type DatabaseAdapter = Awaited<ReturnType<typeof getDB>>;

export function usePageTreeData(pages: Page[]) {
  const { treeNodes, nodeMap } = useMemo(() => buildPageTree(pages), [pages]);

  // useTreeData 대신 직접 tree 객체 생성
  // getItem은 nodeMap 기반으로 구현
  const tree = useMemo(
    () => ({
      getItem: (key: string | number) => {
        const node = nodeMap.get(String(key));
        return node ? { value: node } : undefined;
      },
    }),
    [nodeMap],
  );

  const setPages = useStore((state) => state.setPages);
  // Store + canonical + IndexedDB 동기화
  const syncToStore = useCallback(
    (updates: PageTreeUpdate[]) => {
      if (updates.length === 0) return;

      const latestPages = useStore.getState().pages;
      const updatedPages = applyPageTreeUpdates(latestPages, updates);
      if (updatedPages === latestPages) return;

      setPages(updatedPages);
      const projectId = syncActiveCanonicalPageTreeMetadata(updatedPages);
      const changedPageIds = new Set(updates.map((update) => update.id));
      const changedPages = updatedPages.filter((page) =>
        changedPageIds.has(page.id),
      );

      void enqueuePagePersistence(async () => {
        const db = await getDB();
        await Promise.all(
          changedPages.map((page) => persistPageTreeRecord(db, page)),
        );
        if (projectId) {
          const document = useCanonicalDocumentStore
            .getState()
            .documents.get(projectId);
          if (document) {
            await db.documents.put(projectId, document);
          }
        }
      }).catch((error) => {
        console.error("[PageTree] Failed to persist page drag/drop:", error);
      });
    },
    [setPages],
  );

  return { tree, treeNodes, nodeMap, syncToStore };
}

export function applyPageTreeUpdates(
  pages: Page[],
  updates: PageTreeUpdate[],
): Page[] {
  if (updates.length === 0) return pages;

  const updatesById = new Map(updates.map((update) => [update.id, update]));
  let changed = false;
  const nextPages = pages.map((page) => {
    const update = updatesById.get(page.id);
    if (!update) return page;

    const nextParentId =
      update.parentId !== undefined ? update.parentId : page.parent_id;
    const nextOrderNum =
      update.orderNum !== undefined ? update.orderNum : page.order_num;

    if (
      (page.parent_id ?? null) === (nextParentId ?? null) &&
      (page.order_num ?? 0) === (nextOrderNum ?? 0)
    ) {
      return page;
    }

    changed = true;
    return {
      ...page,
      ...(update.parentId !== undefined ? { parent_id: update.parentId } : {}),
      ...(update.orderNum !== undefined ? { order_num: update.orderNum } : {}),
    };
  });

  return changed ? nextPages : pages;
}

function syncActiveCanonicalPageTreeMetadata(pages: Page[]): string | null {
  const canonicalStore = useCanonicalDocumentStore.getState();
  const projectId =
    canonicalStore.currentProjectId ?? pages[0]?.project_id ?? null;
  if (!projectId) return null;

  const document = canonicalStore.documents.get(projectId);
  if (!document) return projectId;

  const nextDocument = syncCanonicalPageTreeMetadata(document, pages);
  if (nextDocument !== document) {
    canonicalStore.setDocument(projectId, nextDocument);
  }

  return projectId;
}

export function syncCanonicalPageTreeMetadata(
  document: CompositionDocument,
  pages: Page[],
): CompositionDocument {
  const pagesById = new Map(pages.map((page) => [page.id, page]));
  let changed = false;

  const children = document.children.map((node) => {
    const metadata = readPageNodeMetadata(node);
    const pageId = getCanonicalPageId(node, metadata);
    if (!pageId) return node;

    const page = pagesById.get(pageId);
    if (!page) return node;

    const nextMetadata: PageNodeMetadata = {
      ...(metadata ?? {}),
      type: metadata?.type === "page" ? "page" : "legacy-page",
      pageId: page.id,
      slug: page.slug ?? null,
      order_num: page.order_num ?? 0,
      parent_id: page.parent_id ?? null,
    };

    const metadataChanged =
      metadata?.type !== nextMetadata.type ||
      metadata?.pageId !== nextMetadata.pageId ||
      metadata?.slug !== nextMetadata.slug ||
      metadata?.order_num !== nextMetadata.order_num ||
      metadata?.parent_id !== nextMetadata.parent_id;
    const nameChanged = node.name !== page.title;

    if (!metadataChanged && !nameChanged) return node;

    changed = true;
    return {
      ...node,
      name: page.title,
      metadata: nextMetadata,
    };
  });

  return changed ? { ...document, children } : document;
}

function readPageNodeMetadata(
  node: CanonicalNode,
): PageNodeMetadata | undefined {
  const metadata = node.metadata;
  if (!metadata || Array.isArray(metadata)) return undefined;
  return metadata as PageNodeMetadata;
}

function getCanonicalPageId(
  node: CanonicalNode,
  metadata: PageNodeMetadata | undefined,
): string | null {
  if (metadata?.type === "legacy-page" || metadata?.type === "page") {
    return typeof metadata.pageId === "string" ? metadata.pageId : node.id;
  }

  if (node.type === "frame" && node.reusable !== true) {
    return node.id;
  }

  return null;
}

async function persistPageTreeRecord(
  db: DatabaseAdapter,
  page: Page,
): Promise<void> {
  try {
    await db.pages.update(page.id, {
      parent_id: page.parent_id ?? null,
      order_num: page.order_num ?? 0,
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Page not found:")) {
      await db.pages.insert(page);
      return;
    }
    throw error;
  }
}

function normalizeSlug(slug: string | null | undefined): string {
  if (!slug) return "";
  return slug.startsWith("/") ? slug : `/${slug}`;
}

function findHomePageId(pages: Page[]): string | null {
  const explicitHome = pages.find(
    (page) =>
      (page.parent_id ?? null) === null && normalizeSlug(page.slug) === "/",
  );
  if (explicitHome) return explicitHome.id;

  const rootPages = pages
    .filter((page) => (page.parent_id ?? null) === null)
    .sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0));
  return rootPages[0]?.id ?? null;
}

export function buildPageTree(pages: Page[]): {
  treeNodes: PageTreeNode[];
  nodeMap: Map<string, PageTreeNode>;
} {
  const childrenByParent = new Map<string | null, Page[]>();
  const homePageId = findHomePageId(pages);

  for (const page of pages) {
    const parentId = page.parent_id ?? null;
    const siblings = childrenByParent.get(parentId);
    if (siblings) {
      siblings.push(page);
    } else {
      childrenByParent.set(parentId, [page]);
    }
  }

  for (const siblings of childrenByParent.values()) {
    siblings.sort((a, b) => {
      const homeDiff =
        (a.id === homePageId ? 0 : 1) - (b.id === homePageId ? 0 : 1);
      return homeDiff || (a.order_num ?? 0) - (b.order_num ?? 0);
    });
  }

  const nodeMap = new Map<string, PageTreeNode>();

  const buildChildren = (
    parentId: string | null,
    depth: number,
  ): PageTreeNode[] => {
    const siblings = childrenByParent.get(parentId) ?? [];

    return siblings.map((page) => {
      const children = buildChildren(page.id, depth + 1);
      const isRoot = page.id === homePageId;

      const node: PageTreeNode = {
        id: page.id,
        name: page.title || "Untitled",
        slug: page.slug ?? null,
        parentId: page.parent_id ?? null,
        orderNum: page.order_num ?? 0,
        depth,
        hasChildren: children.length > 0,
        isLeaf: children.length === 0,
        children,
        page,
        isRoot,
        isDraggable: !isRoot,
        isDroppable: true,
      };

      nodeMap.set(node.id, node);
      return node;
    });
  };

  const treeNodes = buildChildren(null, 0);
  return { treeNodes, nodeMap };
}
