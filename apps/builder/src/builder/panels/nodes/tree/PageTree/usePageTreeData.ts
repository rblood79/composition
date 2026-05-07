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

  const updateRankById = new Map(
    updates.map((update, index) => [update.id, index] as const),
  );

  return changed
    ? orderPagesForCanonicalTree(nextPages, updateRankById)
    : pages;
}

function orderPagesForCanonicalTree(
  pages: Page[],
  updateRankById?: Map<string, number>,
): Page[] {
  const sourceIndexById = new Map(
    pages.map((page, index) => [page.id, index] as const),
  );
  const childrenByParent = new Map<string | null, Page[]>();

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
      const aUpdateRank = updateRankById?.get(a.id);
      const bUpdateRank = updateRankById?.get(b.id);
      if (aUpdateRank !== undefined && bUpdateRank !== undefined) {
        return aUpdateRank - bUpdateRank;
      }
      return (
        (sourceIndexById.get(a.id) ?? 0) - (sourceIndexById.get(b.id) ?? 0)
      );
    });
  }

  const orderedPages: Page[] = [];
  const visited = new Set<string>();

  const visitChildren = (parentId: string | null) => {
    for (const page of childrenByParent.get(parentId) ?? []) {
      if (visited.has(page.id)) continue;
      visited.add(page.id);
      orderedPages.push(page);
      visitChildren(page.id);
    }
  };

  visitChildren(null);

  for (const page of pages) {
    if (visited.has(page.id)) continue;
    visited.add(page.id);
    orderedPages.push(page);
    visitChildren(page.id);
  }

  return orderedPages;
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
  const canonicalPageRankById = new Map(
    orderPagesForCanonicalTree(pages).map((page, index) => [page.id, index]),
  );
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

  const orderedChildrenResult = reorderCanonicalPageSlots(
    children,
    canonicalPageRankById,
  );
  if (orderedChildrenResult.changed) {
    changed = true;
  }

  return changed
    ? { ...document, children: orderedChildrenResult.children }
    : document;
}

function reorderCanonicalPageSlots(
  children: CompositionDocument["children"],
  canonicalPageRankById: ReadonlyMap<string, number>,
): { children: CompositionDocument["children"]; changed: boolean } {
  const pageSlots = children.flatMap((node, index) => {
    const metadata = readPageNodeMetadata(node);
    const pageId = getCanonicalPageId(node, metadata);
    const rank = pageId ? canonicalPageRankById.get(pageId) : undefined;
    return pageId && rank !== undefined ? [{ node, index, pageId, rank }] : [];
  });

  if (pageSlots.length <= 1) {
    return { children, changed: false };
  }

  const orderedPageSlots = [...pageSlots].sort((a, b) => {
    const rankDiff = a.rank - b.rank;
    return rankDiff !== 0 ? rankDiff : a.index - b.index;
  });
  let pageSlotIndex = 0;
  let changed = false;

  const nextChildren = children.map((node) => {
    const metadata = readPageNodeMetadata(node);
    const pageId = getCanonicalPageId(node, metadata);
    if (!pageId || !canonicalPageRankById.has(pageId)) {
      return node;
    }

    const nextNode = orderedPageSlots[pageSlotIndex]?.node ?? node;
    pageSlotIndex += 1;
    if (nextNode !== node) {
      changed = true;
    }
    return nextNode;
  });

  return changed
    ? { children: nextChildren, changed: true }
    : { children, changed: false };
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

  const rootPages = pages.filter((page) => (page.parent_id ?? null) === null);
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
