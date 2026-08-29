import type { Key } from "react-stately";
import { describe, expect, it } from "vitest";
import type { Page } from "../../../../../types/builder/unified.types";
import { buildPageTree } from "./usePageTreeData";
import { calculatePageMoveUpdates } from "./usePageTreeDnd";

function makePage(
  id: string,
  title: string,
  slug: string,
  parentId: string | null = null,
) {
  return {
    id,
    title,
    slug,
    project_id: "project-1",
    parent_id: parentId,
  } as Page;
}

function buildDndTree(pages: Page[]) {
  const { treeNodes, nodeMap } = buildPageTree(pages);
  return {
    items: treeNodes,
    getItem: (key: Key | string) => {
      const node = nodeMap.get(String(key));
      return node ? { value: node } : undefined;
    },
  };
}

describe("calculatePageMoveUpdates", () => {
  it("emits root reorder updates for Pages tree drag/drop", () => {
    const tree = buildDndTree([
      makePage("page-home", "Home", "/"),
      makePage("page-one", "Page 1", "/page-1"),
      makePage("page-two", "Page 2", "/page-2"),
    ]);

    const updates = calculatePageMoveUpdates({
      tree,
      movedKeys: new Set<Key>(["page-two"]),
      targetKey: "page-one",
      dropPosition: "before",
    });

    expect(updates).toEqual([
      { id: "page-home" },
      { id: "page-two", parentId: null },
      { id: "page-one" },
    ]);
  });

  it("emits reparent updates when a page is dropped on another page", () => {
    const tree = buildDndTree([
      makePage("page-home", "Home", "/"),
      makePage("page-one", "Page 1", "/page-1"),
      makePage("page-two", "Page 2", "/page-2"),
    ]);

    const updates = calculatePageMoveUpdates({
      tree,
      movedKeys: new Set<Key>(["page-two"]),
      targetKey: "page-one",
      dropPosition: "on",
    });

    expect(updates).toEqual([
      { id: "page-home" },
      { id: "page-one" },
      { id: "page-two", parentId: "page-one" },
    ]);
  });

  it("emits nested sibling reorder by ordered ids without orderNum mirrors", () => {
    const tree = buildDndTree([
      makePage("page-home", "Home", "/"),
      makePage("page-one", "Page 1", "/page-1"),
      makePage("child-one", "Child 1", "/child-1", "page-one"),
      makePage("child-two", "Child 2", "/child-2", "page-one"),
    ]);

    const updates = calculatePageMoveUpdates({
      tree,
      movedKeys: new Set<Key>(["child-two"]),
      targetKey: "child-one",
      dropPosition: "before",
    });

    expect(updates).toEqual([
      { id: "child-two", parentId: "page-one" },
      { id: "child-one" },
    ]);
  });
});
