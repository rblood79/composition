/**
 * **ADR-124 Phase 3 Gate G3 — `migrateV1EntryToV2` adapter 검증**.
 *
 * v1 entry (legacy snapshot field) → v2 canonical event 변환의 정확성과
 * graceful degradation (변환 불가 entry) 보장 검증.
 */

import { describe, expect, it } from "vitest";

import type { HistoryEntry } from "../../history";
import {
  extractPropsFromDiff,
  migrateV1EntriesToV2,
  migrateV1EntryToV2,
} from "../historyEntryMigration";

function makeEntry(partial: Partial<HistoryEntry>): HistoryEntry {
  return {
    id: "e1",
    type: "update",
    elementId: "elem-1",
    timestamp: Date.now(),
    data: {},
    ...partial,
  } as HistoryEntry;
}

describe("extractPropsFromDiff", () => {
  it("changed: prev/next 양쪽 추출", () => {
    const result = extractPropsFromDiff({
      elementId: "elem-1",
      props: {
        changed: [["label", { prev: "A", next: "B" }]],
        added: [],
        removed: [],
      },
    });
    expect(result.prevProps).toEqual({ label: "A" });
    expect(result.nextProps).toEqual({ label: "B" });
  });

  it("added: next 만, removed: prev 만", () => {
    const result = extractPropsFromDiff({
      elementId: "elem-1",
      props: {
        changed: [],
        added: [["newKey", "newVal"]],
        removed: [["oldKey", "oldVal"]],
      },
    });
    expect(result.prevProps).toEqual({ oldKey: "oldVal" });
    expect(result.nextProps).toEqual({ newKey: "newVal" });
  });

  it("props 없으면 빈 객체 반환", () => {
    const result = extractPropsFromDiff({ elementId: "elem-1" });
    expect(result.prevProps).toEqual({});
    expect(result.nextProps).toEqual({});
  });
});

describe("migrateV1EntryToV2", () => {
  it("identity preserve: 이미 canonicalEvents 보유한 entry", () => {
    const existingEvent = {
      type: "update" as const,
      nodeId: "elem-1",
      prevProps: { a: 1 },
      nextProps: { a: 2 },
    };
    const entry = makeEntry({
      data: { canonicalEvents: [existingEvent] },
    });
    const result = migrateV1EntryToV2(entry);
    expect(result).toBe(entry);
  });

  it("type=update + diff → CanonicalUpdateEvent 1개", () => {
    const entry = makeEntry({
      type: "update",
      elementId: "btn-1",
      data: {
        diff: {
          elementId: "btn-1",
          props: {
            changed: [["label", { prev: "Click", next: "Submit" }]],
            added: [],
            removed: [],
          },
        },
      },
    });
    const result = migrateV1EntryToV2(entry);
    expect(result.data.canonicalEvents).toHaveLength(1);
    expect(result.data.canonicalEvents![0]).toEqual({
      type: "update",
      nodeId: "btn-1",
      prevProps: { label: "Click" },
      nextProps: { label: "Submit" },
    });
  });

  it("type=update + legacy prevProps/props snapshot fallback", () => {
    const entry = makeEntry({
      type: "update",
      elementId: "btn-1",
      data: {
        prevProps: { label: "Click" },
        props: { label: "Submit" },
      },
    });
    const result = migrateV1EntryToV2(entry);
    expect(result.data.canonicalEvents).toHaveLength(1);
    expect(result.data.canonicalEvents![0]).toEqual({
      type: "update",
      nodeId: "btn-1",
      prevProps: { label: "Click" },
      nextProps: { label: "Submit" },
    });
  });

  it("type=batch + diffs → CanonicalUpdateEvent[]", () => {
    const entry = makeEntry({
      type: "batch",
      data: {
        diffs: [
          {
            elementId: "elem-1",
            props: {
              changed: [["x", { prev: 1, next: 2 }]],
              added: [],
              removed: [],
            },
          },
          {
            elementId: "elem-2",
            props: {
              changed: [["y", { prev: 3, next: 4 }]],
              added: [],
              removed: [],
            },
          },
        ],
      },
    });
    const result = migrateV1EntryToV2(entry);
    expect(result.data.canonicalEvents).toHaveLength(2);
    if (result.data.canonicalEvents![0].type !== "update") {
      throw new Error("expected update event");
    }
    expect(result.data.canonicalEvents![0].nodeId).toBe("elem-1");
    if (result.data.canonicalEvents![1].type !== "update") {
      throw new Error("expected update event");
    }
    expect(result.data.canonicalEvents![1].nodeId).toBe("elem-2");
  });

  it("type=batch + legacy batchUpdates snapshot fallback", () => {
    const entry = makeEntry({
      type: "batch",
      data: {
        batchUpdates: [
          {
            elementId: "elem-1",
            prevProps: { x: 1 },
            newProps: { x: 2 },
          },
          {
            elementId: "elem-2",
            prevProps: { y: 3 },
            newProps: { y: 4 },
          },
        ],
      },
    });
    const result = migrateV1EntryToV2(entry);
    expect(result.data.canonicalEvents).toHaveLength(2);
  });

  it("type=add + element snapshot → graceful degradation (canonicalEvents: [])", () => {
    const entry = makeEntry({
      type: "add",
      data: {
        element: {
          id: "btn-1",
          type: "Button",
          props: {},
        } as never,
      },
    });
    const result = migrateV1EntryToV2(entry);
    expect(result.data.canonicalEvents).toEqual([]);
  });

  it("type=remove + childElements → graceful degradation", () => {
    const entry = makeEntry({
      type: "remove",
      data: {
        childElements: [{ id: "child-1", type: "Button", props: {} } as never],
      },
    });
    const result = migrateV1EntryToV2(entry);
    expect(result.data.canonicalEvents).toEqual([]);
  });

  it("empty entry → graceful degradation", () => {
    const entry = makeEntry({ type: "update", data: {} });
    const result = migrateV1EntryToV2(entry);
    expect(result.data.canonicalEvents).toEqual([]);
  });

  it("preserves all other entry fields (id, elementId, timestamp, type)", () => {
    const entry = makeEntry({
      id: "preserve-id",
      type: "update",
      elementId: "preserve-elem",
      timestamp: 12345,
      data: {
        diff: {
          elementId: "preserve-elem",
          props: {
            changed: [["k", { prev: 1, next: 2 }]],
            added: [],
            removed: [],
          },
        },
      },
    });
    const result = migrateV1EntryToV2(entry);
    expect(result.id).toBe("preserve-id");
    expect(result.elementId).toBe("preserve-elem");
    expect(result.timestamp).toBe(12345);
    expect(result.type).toBe("update");
  });
});

describe("migrateV1EntriesToV2 (배치 변환)", () => {
  it("entries 배열 일괄 변환", () => {
    const entries: HistoryEntry[] = [
      makeEntry({
        type: "update",
        data: {
          canonicalEvents: [
            {
              type: "update",
              nodeId: "x",
              prevProps: { a: 1 },
              nextProps: { a: 2 },
            },
          ],
        },
      }),
      makeEntry({
        type: "update",
        elementId: "btn-2",
        data: {
          diff: {
            elementId: "btn-2",
            props: {
              changed: [["label", { prev: "A", next: "B" }]],
              added: [],
              removed: [],
            },
          },
        },
      }),
      makeEntry({ type: "add", data: { element: undefined } }),
    ];
    const result = migrateV1EntriesToV2(entries);
    expect(result).toHaveLength(3);
    expect(result[0].data.canonicalEvents).toHaveLength(1); // identity
    expect(result[1].data.canonicalEvents).toHaveLength(1); // diff 변환
    expect(result[2].data.canonicalEvents).toEqual([]); // graceful
  });
});
