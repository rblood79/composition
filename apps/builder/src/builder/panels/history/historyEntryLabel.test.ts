/**
 * `getHistoryEntryLabel` — canonicalEvents 우선 label 해석 검증.
 *
 * - v2 canonical entry: event node / 현재 doc 조회로 이름 표시 (UUID 노출 금지)
 * - v1 legacy entry: deprecated snapshot fallback 유지
 * - sentinel elementId (`batch_diff`/`drag-reorder`) 원시 노출 금지
 * - 삭제된 노드: truncated id + "(삭제됨)"
 */

import { describe, expect, it } from "vitest";

import type { CompositionDocument } from "@composition/shared";

import type { Element } from "@/types/core/store.types";
import type { HistoryEntry } from "../../stores/history";
import { getHistoryEntryLabel } from "./historyEntryLabel";

const NODE_ID = "3f2a9b1c-dead-beef-0000-111122223333";

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
            id: NODE_ID,
            type: "Button",
            props: { label: "확인" },
            metadata: { customId: "submit_button" },
          },
        ],
      },
    ],
  } as unknown as CompositionDocument;
}

function makeEntry(partial: Partial<HistoryEntry>): HistoryEntry {
  return {
    id: "entry-1",
    type: "update",
    elementId: NODE_ID,
    data: {},
    timestamp: 0,
    ...partial,
  } as HistoryEntry;
}

describe("getHistoryEntryLabel", () => {
  it("v2 insert entry: event node 의 customId 표시 (UUID 노출 없음)", () => {
    const entry = makeEntry({
      type: "add",
      data: {
        canonicalEvents: [
          {
            type: "insert",
            node: {
              id: NODE_ID,
              type: "Button",
              props: {},
              metadata: { customId: "submit_button" },
            },
            parentId: "page-1",
            index: 0,
          },
        ],
      },
    } as unknown as Partial<HistoryEntry>);

    const label = getHistoryEntryLabel(entry, null);
    expect(label).toBe("추가 submit_button");
    expect(label).not.toContain(NODE_ID);
  });

  it("v2 update entry: 현재 doc 조회로 이름 해석", () => {
    const entry = makeEntry({
      type: "update",
      data: {
        canonicalEvents: [
          {
            type: "update",
            nodeId: NODE_ID,
            prevProps: { label: "a" },
            nextProps: { label: "b" },
          },
        ],
      },
    } as unknown as Partial<HistoryEntry>);

    expect(getHistoryEntryLabel(entry, makeDoc())).toBe("수정 submit_button");
  });

  it("v2 update entry + 삭제된 노드: truncated id + (삭제됨)", () => {
    const entry = makeEntry({
      type: "update",
      data: {
        canonicalEvents: [
          {
            type: "update",
            nodeId: NODE_ID,
            prevProps: {},
            nextProps: {},
          },
        ],
      },
    } as unknown as Partial<HistoryEntry>);

    const emptyDoc = {
      version: "composition-1.0",
      children: [],
    } as unknown as CompositionDocument;
    const label = getHistoryEntryLabel(entry, emptyDoc);
    expect(label).toBe("수정 3f2a9b1c… (삭제됨)");
  });

  it("v1 legacy entry: deprecated snapshot fallback 으로 이름 표시", () => {
    const entry = makeEntry({
      type: "update",
      data: {
        prevElement: {
          id: NODE_ID,
          type: "Text",
          customId: "hero_title",
          props: {},
        } as unknown as Element,
      },
    });

    expect(getHistoryEntryLabel(entry, null)).toBe("수정 hero_title");
  });

  it("sentinel elementId 는 원시 노출하지 않는다", () => {
    const dragEntry = makeEntry({
      type: "move",
      elementId: "drag-reorder",
      data: {},
    });
    expect(getHistoryEntryLabel(dragEntry, null)).toBe("이동");

    const batchEntry = makeEntry({
      type: "batch",
      elementId: "batch_diff",
      elementIds: ["a", "b", "c"],
      data: {},
    });
    expect(getHistoryEntryLabel(batchEntry, null)).toBe("일괄 수정 (3)");
  });

  it("page-position entry: 페이지 이동 라벨 + 다중 페이지 카운트", () => {
    const single = makeEntry({
      type: "page-position",
      elementId: "page-1",
      data: {
        pagePositionEvent: {
          entries: [
            {
              pageId: "page-1",
              breakpoint: "desktop",
              before: { x: 0, y: 0 },
              after: { x: 10, y: 20 },
            },
          ],
        },
      },
    } as unknown as Partial<HistoryEntry>);
    expect(getHistoryEntryLabel(single, null)).toBe("페이지 이동");

    const multi = makeEntry({
      type: "page-position",
      elementId: "page-1",
      data: {
        pagePositionEvent: {
          entries: [
            {
              pageId: "page-1",
              breakpoint: "desktop",
              before: { x: 0, y: 0 },
              after: { x: 10, y: 20 },
            },
            {
              pageId: "page-2",
              breakpoint: "desktop",
              before: { x: 5, y: 5 },
              after: { x: 15, y: 25 },
            },
          ],
        },
      },
    } as unknown as Partial<HistoryEntry>);
    expect(getHistoryEntryLabel(multi, null)).toBe("페이지 이동 (2)");
  });

  it("snapshot-restore entry: 스냅샷 이름 사본으로 라벨 (스냅샷 삭제와 무관)", () => {
    const entry = makeEntry({
      type: "snapshot-restore",
      elementId: "page-1",
      data: {
        snapshotRestoreEvent: {
          beforeSnapshotId: "snapshot_before",
          afterSnapshotId: "snapshot_after",
          snapshotName: "로그인 화면 v1",
        },
      },
    } as unknown as Partial<HistoryEntry>);
    expect(getHistoryEntryLabel(entry, null)).toBe(
      "스냅샷 복원 — 로그인 화면 v1",
    );

    const withoutEvent = makeEntry({
      type: "snapshot-restore",
      elementId: "page-1",
      data: {},
    });
    expect(getHistoryEntryLabel(withoutEvent, null)).toBe("스냅샷 복원");
  });

  it("batch entry: canonicalEvents 의 고유 노드 수로 카운트", () => {
    const entry = makeEntry({
      type: "batch",
      elementId: "batch_diff",
      data: {
        canonicalEvents: [
          { type: "update", nodeId: "n1", prevProps: {}, nextProps: {} },
          { type: "update", nodeId: "n2", prevProps: {}, nextProps: {} },
          {
            type: "move",
            nodeId: "n1",
            fromParentId: "p",
            fromIndex: 0,
            toParentId: "q",
            toIndex: 0,
          },
        ],
      },
    } as unknown as Partial<HistoryEntry>);

    expect(getHistoryEntryLabel(entry, null)).toBe("일괄 수정 (2)");
  });
});
