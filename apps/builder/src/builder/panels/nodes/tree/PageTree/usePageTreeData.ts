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
};

type PageNodeMetadata = Record<string, unknown> & {
  pageId?: unknown;
  parent_id?: unknown;
  slug?: unknown;
  type?: unknown;
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

    if ((page.parent_id ?? null) === (nextParentId ?? null)) {
      return page;
    }

    changed = true;
    return {
      ...page,
      ...(update.parentId !== undefined ? { parent_id: update.parentId } : {}),
    };
  });

  const orderedPages = mergePageTreeUpdateOrder(pages, nextPages, updates);

  const orderChanged =
    orderedPages.length !== pages.length ||
    orderedPages.some((page, index) => page.id !== pages[index]?.id);

  return changed || orderChanged ? orderedPages : pages;
}

function mergePageTreeUpdateOrder(
  sourcePages: Page[],
  pages: Page[],
  updates: PageTreeUpdate[],
): Page[] {
  if (updates.length === 0) return pages;

  const pageById = new Map(pages.map((page) => [page.id, page] as const));
  const sourceParentById = new Map(
    sourcePages.map((page) => [page.id, page.parent_id ?? null] as const),
  );
  const orderedIdsByParent = new Map<string | null, string[]>();

  for (const update of updates) {
    const page = pageById.get(update.id);
    if (!page) continue;
    const parentId = page.parent_id ?? null;
    const ids = orderedIdsByParent.get(parentId);
    if (ids) {
      ids.push(page.id);
    } else {
      orderedIdsByParent.set(parentId, [page.id]);
    }
  }

  if (orderedIdsByParent.size === 0) return pages;

  const hasSourceSlotByParent = new Map<string | null, boolean>();
  const sourceSlotCountByParent = new Map<string | null, number>();
  for (const sourcePage of sourcePages) {
    const parentId = sourcePage.parent_id ?? null;
    if (!orderedIdsByParent.has(parentId)) continue;
    sourceSlotCountByParent.set(
      parentId,
      (sourceSlotCountByParent.get(parentId) ?? 0) + 1,
    );
  }
  for (const [parentId, ids] of orderedIdsByParent) {
    hasSourceSlotByParent.set(
      parentId,
      ids.some((id) => sourceParentById.get(id) === parentId),
    );
  }

  const emittedParents = new Set<string | null>();
  const emittedPageIds = new Set<string>();
  const cursorByParent = new Map<string | null, number>();
  const result: Page[] = [];

  const emitNextInParentGroup = (parentId: string | null) => {
    const ids = orderedIdsByParent.get(parentId);
    if (!ids) return false;

    let cursor = cursorByParent.get(parentId) ?? 0;
    while (cursor < ids.length) {
      const id = ids[cursor];
      cursor += 1;
      cursorByParent.set(parentId, cursor);

      const page = pageById.get(id);
      if (!page || emittedPageIds.has(id)) continue;

      result.push(page);
      emittedPageIds.add(id);
      if (cursor >= ids.length) {
        emittedParents.add(parentId);
      }
      return true;
    }

    emittedParents.add(parentId);
    return false;
  };

  const emitRemainingParentGroup = (parentId: string | null) => {
    while (!emittedParents.has(parentId)) {
      if (!emitNextInParentGroup(parentId)) break;
    }
  };

  for (const sourcePage of sourcePages) {
    const sourceParentId = sourceParentById.get(sourcePage.id) ?? null;
    if (
      orderedIdsByParent.has(sourceParentId) &&
      hasSourceSlotByParent.get(sourceParentId)
    ) {
      emitNextInParentGroup(sourceParentId);
      const remainingSlots =
        (sourceSlotCountByParent.get(sourceParentId) ?? 1) - 1;
      sourceSlotCountByParent.set(sourceParentId, remainingSlots);
      if (remainingSlots <= 0) {
        emitRemainingParentGroup(sourceParentId);
      }
      continue;
    }

    const page = pageById.get(sourcePage.id);
    if (!page || emittedPageIds.has(page.id)) continue;

    const parentId = page.parent_id ?? null;
    if (orderedIdsByParent.has(parentId)) {
      continue;
    }

    result.push(page);
    emittedPageIds.add(page.id);

    const childGroupParentId = page.id;
    if (
      orderedIdsByParent.has(childGroupParentId) &&
      !hasSourceSlotByParent.get(childGroupParentId)
    ) {
      emitRemainingParentGroup(childGroupParentId);
    }
  }

  for (const parentId of orderedIdsByParent.keys()) {
    emitRemainingParentGroup(parentId);
  }

  for (const page of pages) {
    if (emittedPageIds.has(page.id)) continue;
    result.push(page);
  }

  return result;
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
    pages.map((page, index) => [page.id, index]),
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
      parent_id: page.parent_id ?? null,
    };
    delete nextMetadata.order_num;

    const metadataChanged =
      metadata?.type !== nextMetadata.type ||
      metadata?.pageId !== nextMetadata.pageId ||
      metadata?.slug !== nextMetadata.slug ||
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
