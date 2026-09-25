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

type LegacyLayerTreeNode = LayerTreeNode & { orderNum?: number };

function makeNode(overrides: Partial<LayerTreeNode> = {}): LayerTreeNode {
  const id = overrides.id ?? "node";
  const node: LegacyLayerTreeNode = {
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
  return node;
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

describe("LayerTree drop validation — 중첩 preflight (ADR-236 Phase 3, E7)", () => {
  // body > frame > instance (ref → Button origin) · 끌고 오는 Button.
  const nodes = new Map(
    [
      { id: "body", type: "body", props: {}, parent_id: null },
      { id: "frame", type: "frame", props: {}, parent_id: "body" },
      {
        id: "inst",
        type: "ref",
        ref: "origin-button",
        props: {},
        parent_id: "frame",
      },
      { id: "origin-button", type: "Button", props: {}, parent_id: null },
      { id: "dragged", type: "Button", props: {}, parent_id: "body" },
    ].map((n) => [n.id, n]),
  );
  const tree = makeTree([
    makeNode({ id: "dragged", parentId: "body" }),
    makeNode({ id: "inst", type: "ref", parentId: "frame" }),
    makeNode({ id: "frame", type: "frame", parentId: "body" }),
  ]);

  it("Button 을 Button instance 안에 떨어뜨리면 거부 — 전에는 store 가 드롭 뒤에 조용히 거부했다", () => {
    expect(isValidDrop("dragged", "inst", "on", tree, { nodes })).toEqual({
      valid: false,
      reason: "nesting",
    });
  });

  it("유효한 부모 (frame) 는 그대로 허용 (대조군)", () => {
    expect(isValidDrop("dragged", "frame", "on", tree, { nodes })).toEqual({
      valid: true,
    });
  });
});
