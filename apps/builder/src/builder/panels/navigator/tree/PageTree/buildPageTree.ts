import { isComponentsPage } from "@composition/shared";
import type { PageTreeNode, PageTreePage } from "./types";

function normalizeSlug(slug: string | null | undefined): string {
  if (!slug) return "";
  return slug.startsWith("/") ? slug : `/${slug}`;
}

function findHomePageId(pages: readonly PageTreePage[]): string | null {
  const explicitHome = pages.find(
    (page) =>
      (page.parent_id ?? null) === null && normalizeSlug(page.slug) === "/",
  );
  if (explicitHome) return explicitHome.id;

  const rootPages = pages.filter((page) => (page.parent_id ?? null) === null);
  return rootPages[0]?.id ?? null;
}

export function buildPageTree<P extends PageTreePage>(
  pages: readonly P[],
): {
  treeNodes: PageTreeNode<P>[];
  nodeMap: Map<string, PageTreeNode<P>>;
} {
  const childrenByParent = new Map<string | null, P[]>();
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

  const nodeMap = new Map<string, PageTreeNode<P>>();

  const buildChildren = (
    parentId: string | null,
    depth: number,
  ): PageTreeNode<P>[] => {
    const siblings = childrenByParent.get(parentId) ?? [];

    return siblings.map((page) => {
      const children = buildChildren(page.id, depth + 1);
      const isRoot = page.id === homePageId;
      const isSystemPage = isComponentsPage(page);

      const node: PageTreeNode<P> = {
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
        isSystemPage,
        isDraggable: !isRoot && !isSystemPage,
        isDroppable: true,
      };

      nodeMap.set(node.id, node);
      return node;
    });
  };

  const treeNodes = buildChildren(null, 0);
  return { treeNodes, nodeMap };
}
