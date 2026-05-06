import { useMemo, useCallback } from "react";
import type { Page } from "../../../../../types/builder/unified.types";
import type { PageTreeNode } from "./types";
import { useStore } from "../../../../stores";

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
  const currentPages = useStore((state) => state.pages);

  // Store 동기화 (Optimistic Update)
  const syncToStore = useCallback(
    (
      updates: Array<{
        id: string;
        parentId?: string | null;
        orderNum?: number;
      }>,
    ) => {
      if (updates.length === 0) return;

      // 메모리 상태 즉시 반영
      const updatedPages = currentPages.map((page) => {
        const update = updates.find((u) => u.id === page.id);
        if (!update) return page;
        return {
          ...page,
          ...(update.parentId !== undefined && { parent_id: update.parentId }),
          ...(update.orderNum !== undefined && { order_num: update.orderNum }),
        };
      });
      setPages(updatedPages);

      // TODO: IndexedDB/Supabase 저장 구현 시 아래 코드 활성화
      // try {
      //   await db.pages.bulkPut(updates);
      // } catch (error) {
      //   console.warn('⚠️ 페이지 저장 실패:', error);
      //   showToast('error', '저장에 실패했습니다. Ctrl+Z로 되돌릴 수 있습니다.');
      // }
    },
    [currentPages, setPages],
  );

  return { tree, treeNodes, nodeMap, syncToStore };
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
