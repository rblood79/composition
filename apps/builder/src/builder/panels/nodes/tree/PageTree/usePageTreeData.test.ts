import { describe, expect, it } from "vitest";
import type { Page } from "../../../../../types/builder/unified.types";
import { buildPageTree } from "./usePageTreeData";

function makePage(
  id: string,
  title: string,
  slug: string,
  orderNum: number,
): Page {
  return {
    id,
    title,
    slug,
    project_id: "project-1",
    parent_id: null,
    order_num: orderNum,
  } as Page;
}

describe("buildPageTree", () => {
  it("renders pages in ascending order_num while keeping Home first", () => {
    const { treeNodes } = buildPageTree([
      makePage("page-three", "Page 3", "/page-3", 2),
      makePage("page-home", "Home", "/", 0),
      makePage("page-two", "Page 2", "/page-2", 1),
    ]);

    expect(treeNodes.map((node) => node.id)).toEqual([
      "page-home",
      "page-two",
      "page-three",
    ]);
  });

  it("marks the slash slug Home page as non-deletable even when another page has order 0", () => {
    const { nodeMap } = buildPageTree([
      makePage("page-latest", "Page 3", "/page-3", 0),
      makePage("page-home", "Home", "/", 1),
    ]);

    expect(nodeMap.get("page-home")?.isRoot).toBe(true);
    expect(nodeMap.get("page-home")?.isDraggable).toBe(false);
    expect(nodeMap.get("page-latest")?.isRoot).toBe(false);
    expect(nodeMap.get("page-latest")?.isDraggable).toBe(true);
  });
});
