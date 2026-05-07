import { describe, expect, it } from "vitest";
import type {
  CanonicalNode,
  CompositionDocument,
  RefNode,
} from "../../types/composition-document.types";
import {
  appendDescendantChild,
  deriveLegacyOrderNum,
  getCanonicalChildren,
  insertCanonicalChild,
  moveCanonicalChild,
  moveDescendantChild,
  removeCanonicalChild,
} from "../compositionDocumentOrder";

function makeDoc(children: CanonicalNode[] = []): CompositionDocument {
  return {
    version: "composition-1.0",
    children,
  };
}

function makeNode(
  id: string,
  type: CanonicalNode["type"] = "frame",
  children?: CanonicalNode[],
): CanonicalNode {
  return {
    id,
    type,
    ...(children ? { children } : {}),
  };
}

function makeRefNode(
  id: string,
  descendants?: RefNode["descendants"],
): RefNode {
  return {
    id,
    type: "ref",
    ref: "master",
    ...(descendants ? { descendants } : {}),
  };
}

describe("composition document order helpers", () => {
  it("reads root and nested children without order_num", () => {
    const doc = makeDoc([
      makeNode("a"),
      makeNode("parent", "frame", [makeNode("child-1"), makeNode("child-2")]),
    ]);

    expect(getCanonicalChildren(doc, null)?.map((node) => node.id)).toEqual([
      "a",
      "parent",
    ]);
    expect(getCanonicalChildren(doc, "parent")?.map((node) => node.id)).toEqual(
      ["child-1", "child-2"],
    );
  });

  it("inserts, moves, and removes regular children by children[] index", () => {
    const doc = makeDoc([
      makeNode("target", "frame", [makeNode("a"), makeNode("b")]),
      makeNode("other", "frame"),
    ]);

    const inserted = insertCanonicalChild(doc, "target", makeNode("c"), 1);
    expect(
      getCanonicalChildren(inserted.document, "target")?.map((node) => node.id),
    ).toEqual(["a", "c", "b"]);

    const moved = moveCanonicalChild(inserted.document, "c", "other", 0);
    expect(
      getCanonicalChildren(moved.document, "target")?.map((node) => node.id),
    ).toEqual(["a", "b"]);
    expect(
      getCanonicalChildren(moved.document, "other")?.map((node) => node.id),
    ).toEqual(["c"]);

    const removed = removeCanonicalChild(moved.document, "a");
    expect(removed.removed?.id).toBe("a");
    expect(
      getCanonicalChildren(removed.document, "target")?.map((node) => node.id),
    ).toEqual(["b"]);
  });

  it("keeps duplicate ref slot fills when child ids are unique", () => {
    const doc = makeDoc([makeRefNode("instance")]);

    const first = appendDescendantChild(doc, "instance", "content", {
      id: "fill-1",
      type: "ref",
      ref: "card",
    } as RefNode);
    const second = appendDescendantChild(
      first.document,
      "instance",
      "content",
      {
        id: "fill-2",
        type: "ref",
        ref: "card",
      } as RefNode,
    );

    const instance = second.document.children[0] as RefNode;
    expect(
      (
        instance.descendants?.content as
          | { children: CanonicalNode[] }
          | undefined
      )?.children.map((node) => [node.id, (node as RefNode).ref]),
    ).toEqual([
      ["fill-1", "card"],
      ["fill-2", "card"],
    ]);
  });

  it("moves descendant children and derives legacy order mirror from index", () => {
    const doc = makeDoc([
      makeRefNode("instance", {
        content: {
          children: [makeNode("a"), makeNode("b"), makeNode("c")],
        },
      }),
    ]);

    const moved = moveDescendantChild(doc, "instance", "content", "b", 0);
    const instance = moved.document.children[0] as RefNode;
    const children = (
      instance.descendants?.content as { children: CanonicalNode[] }
    ).children;

    expect(children.map((node) => node.id)).toEqual(["b", "a", "c"]);
    expect(deriveLegacyOrderNum(children, "c")).toBe(2);
    expect(deriveLegacyOrderNum(children, "ghost")).toBeNull();
  });
});
