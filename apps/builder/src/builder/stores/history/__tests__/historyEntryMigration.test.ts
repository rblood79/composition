/**
 * **ADR-124 Phase 3 Gate G3 — `migrateV1EntryToV2` adapter 검증**.
 *
 * v1 entry (legacy snapshot field) → v2 canonical event 변환의 정확성과
 * graceful degradation (변환 불가 entry) 보장 검증.
 */

import { describe, expect, it } from "vitest";

import type { HistoryEntry } from "../../history";
import {
  expandDiffToFullProps,
  extractPropsFromDiff,
  keepConvertibleHistoryEntries,
  migrateV1EntriesToV2,
  migrateV1EntryToV2,
  type LegacyV1SnapshotData,
} from "../historyEntryMigration";

function legacyRead(entry: HistoryEntry): LegacyV1SnapshotData {
  return entry.data as LegacyV1SnapshotData;
}

function makeEntry(
  partial: Omit<Partial<HistoryEntry>, "data"> & {
    data?: HistoryEntry["data"] & LegacyV1SnapshotData;
  },
): HistoryEntry {
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
  it("identity preserve: 이미 canonicalEvents 보유한 entry (legacy 없으면 same ref)", () => {
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

  it("이미 canonicalEvents 보유 + legacy snapshot → strip", () => {
    const existingEvent = {
      type: "update" as const,
      nodeId: "elem-1",
      prevProps: { a: 1 },
      nextProps: { a: 2 },
    };
    const entry = makeEntry({
      data: {
        canonicalEvents: [existingEvent],
        prevProps: { a: 1 },
        props: { a: 2 },
      },
    });
    const result = migrateV1EntryToV2(entry);
    expect(result.data.canonicalEvents).toEqual([existingEvent]);
    expect(legacyRead(result).prevProps).toBeUndefined();
    expect(legacyRead(result).props).toBeUndefined();
  });

  it("type=update + diff without context → canonicalEvents 빈 배열 (partial update 금지)", () => {
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
    expect(result.data.canonicalEvents).toEqual([]);
    expect(result.data.diff).toBeDefined();
  });

  it("type=update + diff + context → full-props CanonicalUpdateEvent", () => {
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
    const result = migrateV1EntryToV2(entry, {
      direction: "undo",
      elements: [
        {
          id: "btn-1",
          type: "Button",
          props: { label: "Submit", color: "blue" },
        } as never,
      ],
    });
    expect(result.data.canonicalEvents).toHaveLength(1);
    expect(result.data.canonicalEvents![0]).toEqual({
      type: "update",
      nodeId: "btn-1",
      prevProps: { label: "Click", color: "blue" },
      nextProps: { label: "Submit", color: "blue" },
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

  it("type=batch + diffs without context → empty; with context → full props", () => {
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
    expect(migrateV1EntryToV2(entry).data.canonicalEvents).toEqual([]);

    const result = migrateV1EntryToV2(entry, {
      direction: "redo",
      elements: [
        { id: "elem-1", type: "Box", props: { x: 1, keep: true } } as never,
        { id: "elem-2", type: "Box", props: { y: 3, keep: true } } as never,
      ],
    });
    expect(result.data.canonicalEvents).toHaveLength(2);
    if (result.data.canonicalEvents![0].type !== "update") {
      throw new Error("expected update event");
    }
    expect(result.data.canonicalEvents![0].nextProps).toEqual({
      x: 2,
      keep: true,
    });
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

  it("type=add + element snapshot → insert canonicalEvents + strip legacy", () => {
    const entry = makeEntry({
      type: "add",
      elementId: "btn-1",
      data: {
        element: {
          id: "btn-1",
          type: "Button",
          props: { label: "Go" },
          parent_id: "body-1",
        } as never,
      },
    });
    const result = migrateV1EntryToV2(entry);
    expect(result.data.canonicalEvents).toHaveLength(1);
    expect(result.data.canonicalEvents![0]).toMatchObject({
      type: "insert",
      parentId: "body-1",
      node: expect.objectContaining({ id: "btn-1", type: "Button" }),
    });
    expect(legacyRead(result).element).toBeUndefined();
  });

  it("type=remove + element/childElements → remove canonicalEvents + strip", () => {
    const entry = makeEntry({
      type: "remove",
      elementId: "frame-1",
      data: {
        element: {
          id: "frame-1",
          type: "frame",
          props: {},
          parent_id: "body-1",
        } as never,
        childElements: [
          {
            id: "child-1",
            type: "Button",
            props: {},
            parent_id: "frame-1",
          } as never,
        ],
      },
    });
    const result = migrateV1EntryToV2(entry);
    expect(result.data.canonicalEvents!.length).toBeGreaterThan(0);
    expect(
      result.data.canonicalEvents!.every((event) => event.type === "remove"),
    ).toBe(true);
    expect(legacyRead(result).element).toBeUndefined();
    expect(legacyRead(result).childElements).toBeUndefined();
  });

  it("type=batch + prevElements/elements props-only → update events + strip", () => {
    const entry = makeEntry({
      type: "batch",
      data: {
        prevElements: [
          {
            id: "btn-1",
            type: "Button",
            props: { label: "A" },
            parent_id: "body-1",
          } as never,
        ],
        elements: [
          {
            id: "btn-1",
            type: "Button",
            props: { label: "B" },
            parent_id: "body-1",
          } as never,
        ],
      },
    });
    const result = migrateV1EntryToV2(entry);
    expect(result.data.canonicalEvents).toHaveLength(1);
    expect(result.data.canonicalEvents![0]).toMatchObject({
      type: "update",
      nodeId: "btn-1",
    });
    expect(legacyRead(result).prevElements).toBeUndefined();
    expect(legacyRead(result).elements).toBeUndefined();
  });

  it("type=batch + prevElements/elements fills 변경 → replace events", () => {
    const entry = makeEntry({
      type: "batch",
      data: {
        prevElements: [
          {
            id: "btn-1",
            type: "Button",
            props: { label: "A" },
            parent_id: "body-1",
            fills: [{ id: "f1", type: "solid", color: "#000" }],
          } as never,
        ],
        elements: [
          {
            id: "btn-1",
            type: "Button",
            props: { label: "A" },
            parent_id: "body-1",
            fills: [{ id: "f1", type: "solid", color: "#fff" }],
          } as never,
        ],
      },
    });
    const result = migrateV1EntryToV2(entry);
    expect(result.data.canonicalEvents!.length).toBe(2);
    const removeEvent = result.data.canonicalEvents!.find(
      (event) => event.type === "remove",
    );
    const insertEvent = result.data.canonicalEvents!.find(
      (event) => event.type === "insert",
    );
    expect(removeEvent).toMatchObject({ type: "remove" });
    expect(insertEvent).toMatchObject({ type: "insert" });
    if (removeEvent?.type === "remove" && insertEvent?.type === "insert") {
      expect(removeEvent.node).toMatchObject({
        id: "btn-1",
        fills: [{ id: "f1", type: "solid", color: "#000" }],
      });
      expect(insertEvent.node).toMatchObject({
        id: "btn-1",
        fills: [{ id: "f1", type: "solid", color: "#fff" }],
      });
    }
  });

  it("type=group + element/elements → group canonicalEvents", () => {
    const entry = makeEntry({
      type: "group",
      elementId: "group-1",
      data: {
        element: {
          id: "group-1",
          type: "Group",
          props: {},
          parent_id: "body-1",
        } as never,
        elements: [
          {
            id: "child-1",
            type: "Button",
            props: {},
            parent_id: "body-1",
          } as never,
        ],
      },
    });
    const result = migrateV1EntryToV2(entry);
    expect(result.data.canonicalEvents!.length).toBeGreaterThan(0);
    expect(result.data.canonicalEvents![0]).toMatchObject({ type: "insert" });
    expect(legacyRead(result).element).toBeUndefined();
  });

  it("type=ungroup + element/elements → ungroup canonicalEvents", () => {
    const entry = makeEntry({
      type: "ungroup",
      elementId: "group-1",
      data: {
        element: {
          id: "group-1",
          type: "Group",
          props: {},
          parent_id: "body-1",
        } as never,
        elements: [
          {
            id: "child-1",
            type: "Button",
            props: {},
            parent_id: "body-1",
          } as never,
        ],
      },
    });
    const result = migrateV1EntryToV2(entry);
    expect(result.data.canonicalEvents!.length).toBeGreaterThan(0);
    expect(
      result.data.canonicalEvents!.some((event) => event.type === "remove"),
    ).toBe(true);
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
        prevProps: { k: 1 },
        props: { k: 2 },
      },
    });
    const result = migrateV1EntryToV2(entry);
    expect(result.id).toBe("preserve-id");
    expect(result.elementId).toBe("preserve-elem");
    expect(result.timestamp).toBe(12345);
    expect(result.type).toBe("update");
  });
});

describe("expandDiffToFullProps", () => {
  it("undo: current=after 기준으로 prev 를 reverse patch", () => {
    const result = expandDiffToFullProps(
      { label: "Submit", color: "blue" },
      {
        elementId: "btn-1",
        props: {
          changed: [["label", { prev: "Click", next: "Submit" }]],
          added: [],
          removed: [],
        },
      },
      "undo",
    );
    expect(result.nextProps).toEqual({ label: "Submit", color: "blue" });
    expect(result.prevProps).toEqual({ label: "Click", color: "blue" });
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
          prevProps: { label: "A" },
          props: { label: "B" },
        },
      }),
      makeEntry({ type: "add", data: { element: undefined } }),
    ];
    const result = migrateV1EntriesToV2(entries);
    expect(result).toHaveLength(3);
    expect(result[0].data.canonicalEvents).toHaveLength(1); // identity
    expect(result[1].data.canonicalEvents).toHaveLength(1); // prevProps 변환
    expect(result[2].data.canonicalEvents).toEqual([]); // graceful
  });
});

describe("keepConvertibleHistoryEntries", () => {
  it("diff-only element entry 는 drop, page-guide 는 유지", () => {
    const diffOnly = migrateV1EntryToV2(
      makeEntry({
        type: "update",
        data: {
          diff: {
            elementId: "btn-1",
            props: {
              changed: [["label", { prev: "A", next: "B" }]],
              added: [],
              removed: [],
            },
          },
        },
      }),
    );
    const pageGuide = makeEntry({
      type: "page-guide",
      data: {
        pageGuideEvent: { entries: [] },
        canonicalEvents: [],
      },
    });
    const kept = keepConvertibleHistoryEntries([diffOnly, pageGuide]);
    expect(kept).toHaveLength(1);
    expect(kept[0]!.type).toBe("page-guide");
  });
});
