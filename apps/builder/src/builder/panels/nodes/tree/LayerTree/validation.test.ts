import { describe, expect, it } from "vitest";
import type { Element } from "../../../../../types/core/store.types";
import type { LayerTreeNode } from "./types";
import { isValidDrop } from "./validation";

function makeElement(id: string): Element {
  return {
    id,
    type: "Button",
    props: {},
    parent_id: null,
    page_id: "page-1",
    order_num: 0,
  } as Element;
}

function makeNode(overrides: Partial<LayerTreeNode> = {}): LayerTreeNode {
  const id = overrides.id ?? "node";
  return {
    id,
    name: id,
    type: "Button",
    parentId: null,
    orderNum: 0,
    depth: 1,
    hasChildren: false,
    isLeaf: true,
    element: makeElement(id),
    ...overrides,
  };
}

function makeTree(nodes: LayerTreeNode[]) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  return {
    getItem: (key: string | number) => {
      const node = nodesById.get(String(key));
      return node ? { value: node } : undefined;
    },
  };
}

describe("LayerTree drop validation", () => {
  it("rejects synthetic ref children as drag source or drop target", () => {
    const dragged = makeNode({ id: "dragged" });
    const target = makeNode({ id: "target", isSyntheticRefChild: true });
    const tree = makeTree([dragged, target]);

    expect(isValidDrop("dragged", "target", "on", tree)).toEqual({
      valid: false,
      reason: "synthetic-ref-child",
    });

    expect(
      isValidDrop(
        "target",
        "dragged",
        "on",
        makeTree([{ ...target, isSyntheticRefChild: true }, dragged]),
      ),
    ).toEqual({
      valid: false,
      reason: "synthetic-ref-child",
    });
  });
});
