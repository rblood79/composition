/**
 * `buildCanonicalMoveEvents` + move event apply round-trip 검증.
 *
 * - cross-parent move: undo 가 원 부모 + 원 index 로 복원
 * - 같은 부모 reorder: undo 가 원 순서 복원
 * - to 해석 불가 / no-op move 는 event 미생성
 */

import { afterEach, describe, expect, it } from "vitest";

import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { useCanonicalDocumentStore } from "../../canonical/canonicalDocumentStore";
import {
  applyCanonicalHistoryEventsToDocument,
  buildCanonicalMoveEvents,
  captureCanonicalNodeLocations,
} from "../canonicalHistoryEvents";

const PROJECT_ID = "proj-move-test";

function makeDoc(): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page-1",
        type: "frame",
        props: { layoutType: "page" },
        children: [
          {
            id: "container-a",
            type: "frame",
            props: {},
            children: [
              { id: "btn-1", type: "Button", props: { label: "1" } },
              { id: "btn-2", type: "Button", props: { label: "2" } },
              { id: "btn-3", type: "Button", props: { label: "3" } },
            ],
          },
          {
            id: "container-b",
            type: "frame",
            props: {},
            children: [],
          },
        ],
      },
    ],
  } as unknown as CompositionDocument;
}

function childIds(doc: CompositionDocument, containerId: string): string[] {
  const findNode = (nodes: CanonicalNode[]): CanonicalNode | null => {
    for (const node of nodes) {
      if (node.id === containerId) return node;
      const found = findNode(node.children ?? []);
      if (found) return found;
    }
    return null;
  };
  const container = findNode(doc.children);
  return (container?.children ?? []).map((child) => child.id);
}

function seedStore(doc: CompositionDocument): void {
  const store = useCanonicalDocumentStore.getState();
  store.setCurrentProject(PROJECT_ID);
  store.setDocument(PROJECT_ID, doc);
}

afterEach(() => {
  useCanonicalDocumentStore.getState().setCurrentProject(null);
});

describe("move event apply round-trip", () => {
  it("cross-parent move: redo moves node, undo restores original parent+index", () => {
    const initial = makeDoc();
    const event = {
      type: "move" as const,
      nodeId: "btn-1",
      fromParentId: "container-a",
      fromIndex: 0,
      toParentId: "container-b",
      toIndex: 0,
    };

    const afterRedo = applyCanonicalHistoryEventsToDocument(
      initial,
      [event],
      "redo",
    );
    expect(childIds(afterRedo, "container-a")).toEqual(["btn-2", "btn-3"]);
    expect(childIds(afterRedo, "container-b")).toEqual(["btn-1"]);

    const afterUndo = applyCanonicalHistoryEventsToDocument(
      afterRedo,
      [event],
      "undo",
    );
    expect(childIds(afterUndo, "container-a")).toEqual([
      "btn-1",
      "btn-2",
      "btn-3",
    ]);
    expect(childIds(afterUndo, "container-b")).toEqual([]);
  });

  it("same-parent reorder: undo restores original order", () => {
    const initial = makeDoc();
    const event = {
      type: "move" as const,
      nodeId: "btn-1",
      fromParentId: "container-a",
      fromIndex: 0,
      toParentId: "container-a",
      toIndex: 2,
    };

    const afterRedo = applyCanonicalHistoryEventsToDocument(
      initial,
      [event],
      "redo",
    );
    expect(childIds(afterRedo, "container-a")).toEqual([
      "btn-2",
      "btn-3",
      "btn-1",
    ]);

    const afterUndo = applyCanonicalHistoryEventsToDocument(
      afterRedo,
      [event],
      "undo",
    );
    expect(childIds(afterUndo, "container-a")).toEqual([
      "btn-1",
      "btn-2",
      "btn-3",
    ]);
  });
});

describe("captureCanonicalNodeLocations + buildCanonicalMoveEvents", () => {
  it("capture(pre) → mutate → build(to from post doc) → undo restores pre doc", () => {
    const preDoc = makeDoc();
    seedStore(preDoc);

    const captured = captureCanonicalNodeLocations(["btn-2"]);
    expect(captured.get("btn-2")).toEqual({
      parentId: "container-a",
      index: 1,
    });

    // mutation: btn-2 를 container-b 로 이동한 post doc 을 store 에 반영
    const postDoc = applyCanonicalHistoryEventsToDocument(
      preDoc,
      [
        {
          type: "move",
          nodeId: "btn-2",
          fromParentId: "container-a",
          fromIndex: 1,
          toParentId: "container-b",
          toIndex: 0,
        },
      ],
      "redo",
    );
    seedStore(postDoc);

    const events = buildCanonicalMoveEvents([
      { nodeId: "btn-2", from: captured.get("btn-2")! },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "move",
      nodeId: "btn-2",
      fromParentId: "container-a",
      fromIndex: 1,
      toParentId: "container-b",
      toIndex: 0,
    });

    const restored = applyCanonicalHistoryEventsToDocument(
      postDoc,
      events,
      "undo",
    );
    expect(restored).toEqual(preDoc);
  });

  it("no-op move (from === to) 는 event 를 생성하지 않는다", () => {
    seedStore(makeDoc());
    const events = buildCanonicalMoveEvents([
      {
        nodeId: "btn-1",
        from: { parentId: "container-a", index: 0 },
        to: { parentId: "container-a", index: 0 },
      },
    ]);
    expect(events).toEqual([]);
  });

  it("to 해석 불가 (doc 에 없는 nodeId, to 미지정) 는 event 를 생성하지 않는다", () => {
    seedStore(makeDoc());
    const events = buildCanonicalMoveEvents([
      { nodeId: "missing-id", from: { parentId: "container-a", index: 0 } },
    ]);
    expect(events).toEqual([]);
  });
});
