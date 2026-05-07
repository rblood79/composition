import type { Key } from "react-stately";
import { describe, expect, it } from "vitest";
import type { Page } from "../../../../../types/builder/unified.types";
import { buildPageTree } from "./usePageTreeData";
import { calculatePageMoveUpdates } from "./usePageTreeDnd";

function makePage(id: string, title: string, slug: string, orderNum: number) {
  return {
    id,
    title,
    slug,
    project_id: "project-1",
    parent_id: null,
    order_num: orderNum,
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
      makePage("page-home", "Home", "/", 0),
      makePage("page-one", "Page 1", "/page-1", 1),
      makePage("page-two", "Page 2", "/page-2", 2),
    ]);

    const updates = calculatePageMoveUpdates({
      tree,
      movedKeys: new Set<Key>(["page-two"]),
      targetKey: "page-one",
      dropPosition: "before",
    });

    expect(updates).toEqual([
      { id: "page-home", orderNum: 0 },
      { id: "page-two", parentId: null, orderNum: 1 },
      { id: "page-one", orderNum: 2 },
    ]);
  });

  it("emits reparent updates when a page is dropped on another page", () => {
    const tree = buildDndTree([
      makePage("page-home", "Home", "/", 0),
      makePage("page-one", "Page 1", "/page-1", 1),
      makePage("page-two", "Page 2", "/page-2", 2),
    ]);

    const updates = calculatePageMoveUpdates({
      tree,
      movedKeys: new Set<Key>(["page-two"]),
      targetKey: "page-one",
      dropPosition: "on",
    });

    expect(updates).toEqual([
      { id: "page-home", orderNum: 0 },
      { id: "page-one", orderNum: 1 },
      { id: "page-two", parentId: "page-one", orderNum: 0 },
    ]);
  });
});
