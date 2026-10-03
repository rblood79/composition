import type { Key } from "react-stately";
import { describe, expect, it } from "vitest";
import type { PageTreeNode, PageTreePage } from "./types";
import { isValidPageDrop } from "./validation";

/** ADR-248 4e-9 C: the drop rule over a page tree's nodes (the old store's tree builder went with it). */
function node(
  id: string,
  flags: { isRoot?: boolean; isSystemPage?: boolean; parentId?: string } = {},
): PageTreeNode<PageTreePage> {
  return {
    id,
    name: id,
    slug: null,
    parentId: flags.parentId ?? null,
    depth: flags.parentId ? 1 : 0,
    hasChildren: false,
    isLeaf: true,
    page: { id } as PageTreePage,
    ...(flags.isRoot ? { isRoot: true } : {}),
    ...(flags.isSystemPage ? { isSystemPage: true } : {}),
  } as PageTreeNode<PageTreePage>;
}

function treeOf(nodes: PageTreeNode<PageTreePage>[]) {
  const map = new Map(nodes.map((item) => [item.id, item]));
  return {
    getItem: (key: Key | string) => {
      const value = map.get(String(key));
      return value ? { value } : undefined;
    },
  };
}

describe("isValidPageDrop", () => {
  const tree = treeOf([
    node("page-components", { isSystemPage: true }),
    node("page-home", { isRoot: true }),
    node("page-one"),
    node("page-child", { parentId: "page-one" }),
  ]);

  it("blocks drag/drop mutations that would move the Components system page", () => {
    expect(
      isValidPageDrop("page-components", "page-one", "after", tree),
    ).toEqual({ valid: false, reason: "system-page-immutable" });
    expect(
      isValidPageDrop("page-one", "page-components", "after", tree),
    ).toEqual({ valid: false, reason: "system-page-immutable" });
  });

  it("keeps Home first and refuses dropping a page into its own descendant", () => {
    expect(isValidPageDrop("page-home", "page-one", "after", tree)).toEqual({
      valid: false,
      reason: "home-immutable",
    });
    expect(isValidPageDrop("page-one", "page-home", "before", tree)).toEqual({
      valid: false,
      reason: "before-home-denied",
    });
    expect(isValidPageDrop("page-one", "page-child", "on", tree)).toEqual({
      valid: false,
      reason: "descendant-drop",
    });
    expect(isValidPageDrop("page-child", "page-home", "after", tree)).toEqual({
      valid: true,
    });
  });
});
