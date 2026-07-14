/**
 * `buildCanonicalReplaceEvents` — 같은 id 노드의 props 외 필드
 * (ref `descendants` 등 mirror field) 변경 round-trip 검증.
 *
 * replace = `[remove@loc, insert@loc]` 쌍. 기존 apply 기계 재사용
 * (`insertNode` 가 same-id 선제거 후 삽입).
 */

import { afterEach, describe, expect, it } from "vitest";

import type {
  CanonicalNode,
  CompositionDocument,
  RefNode,
} from "@composition/shared";

import type { Element } from "@/types/core/store.types";
import { useCanonicalDocumentStore } from "../../canonical/canonicalDocumentStore";
import {
  applyCanonicalHistoryEventsToDocument,
  buildCanonicalReplaceEvents,
  captureCanonicalReplaceSources,
  findLocation,
} from "../canonicalHistoryEvents";

const PROJECT_ID = "proj-replace-test";

function makeRefNode(label: string): RefNode {
  return {
    id: "inst-1",
    type: "ref",
    ref: "master-1",
    props: {},
    descendants: {
      "0": {
        children: [
          {
            id: "inner-1",
            type: "Button",
            props: { label },
          } as CanonicalNode,
        ],
      },
    },
  } as RefNode;
}

function makeDoc(instanceNode: CanonicalNode): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page-1",
        type: "frame",
        props: { layoutType: "page" },
        children: [
          { id: "sibling-1", type: "Button", props: { label: "s" } },
          instanceNode,
        ],
      },
    ],
  } as unknown as CompositionDocument;
}

function elementStub(id: string): Element {
  return { id, type: "Button", props: {} } as unknown as Element;
}

function seedStore(doc: CompositionDocument): void {
  const store = useCanonicalDocumentStore.getState();
  store.setCurrentProject(PROJECT_ID);
  store.setDocument(PROJECT_ID, doc);
}

afterEach(() => {
  useCanonicalDocumentStore.getState().setCurrentProject(null);
});

describe("buildCanonicalReplaceEvents (post-mutation 모드)", () => {
  it("capture(pre) → mutate → build → undo 가 descendants 를 deep-equal 복원", () => {
    const prevNode = makeRefNode("before");
    const nextNode = makeRefNode("after");
    const preDoc = makeDoc(prevNode);
    seedStore(preDoc);

    const captures = captureCanonicalReplaceSources(["inst-1"]);
    expect(captures.get("inst-1")?.location).toEqual({
      parentId: "page-1",
      index: 1,
    });

    const postDoc = makeDoc(nextNode);
    seedStore(postDoc);

    const events = buildCanonicalReplaceEvents(
      [elementStub("inst-1")],
      [elementStub("inst-1")],
      captures,
    );
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("remove");
    expect(events[1].type).toBe("insert");

    // redo 방향 재적용: post doc 재현
    const reApplied = applyCanonicalHistoryEventsToDocument(
      preDoc,
      events,
      "redo",
    );
    expect(findLocation(reApplied, "inst-1")?.node).toEqual(nextNode);
    expect(findLocation(reApplied, "inst-1")?.index).toBe(1);

    // undo: pre doc 복원 (descendants 포함 deep-equal)
    const restored = applyCanonicalHistoryEventsToDocument(
      postDoc,
      events,
      "undo",
    );
    expect(restored).toEqual(preDoc);
  });

  it("prev 에 없는 next id 는 event 를 생성하지 않는다", () => {
    seedStore(makeDoc(makeRefNode("x")));
    const events = buildCanonicalReplaceEvents(
      [elementStub("inst-1")],
      [elementStub("other-id")],
      captureCanonicalReplaceSources(["inst-1"]),
    );
    expect(events).toEqual([]);
  });

  it("replace 후 위치 보존: 형제 순서가 바뀌지 않는다", () => {
    const preDoc = makeDoc(makeRefNode("before"));
    seedStore(preDoc);
    const captures = captureCanonicalReplaceSources(["inst-1"]);
    const postDoc = makeDoc(makeRefNode("after"));
    seedStore(postDoc);

    const events = buildCanonicalReplaceEvents(
      [elementStub("inst-1")],
      [elementStub("inst-1")],
      captures,
    );
    const restored = applyCanonicalHistoryEventsToDocument(
      postDoc,
      events,
      "undo",
    );
    const page = restored.children[0];
    expect((page.children ?? []).map((child) => child.id)).toEqual([
      "sibling-1",
      "inst-1",
    ]);
  });
});
