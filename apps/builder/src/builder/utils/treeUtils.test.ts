import { describe, expect, it } from "vitest";

import type { Element } from "../../types/core/store.types";
import { buildTreeFromElements } from "./treeUtils";

function makeElement(
  id: string,
  parentId: string | null,
  orderNum: number,
): Element {
  return {
    id,
    type: "Box",
    parent_id: parentId,
    order_num: orderNum,
    props: {},
    page_id: "page-1",
  } as Element;
}

describe("buildTreeFromElements", () => {
  it("preserves canonical source order instead of sorting by legacy order_num", () => {
    const tree = buildTreeFromElements([
      makeElement("root-b", null, 2),
      makeElement("child-b", "root-b", 2),
      makeElement("child-a", "root-b", 0),
      makeElement("root-a", null, 0),
    ]);

    expect(tree.map((item) => item.id)).toEqual(["root-b", "root-a"]);
    expect(tree[0].children?.map((item) => item.id)).toEqual([
      "child-b",
      "child-a",
    ]);
  });
});
