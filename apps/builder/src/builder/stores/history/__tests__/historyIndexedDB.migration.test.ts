/**
 * ADR-124 history-v1 — IndexedDB upgrade path + migration strip 계약.
 *
 * fake-indexeddb 의존성 없이, HistoryIndexedDB 가 호출하는 동일 adapter
 * (`migrateV1EntriesToV2`) 로 v1 seed → v3 소비 shape 을 고정한다.
 * 실제 IDB onupgradeneeded 는 동일 함수를 cursor.update 에 넘긴다.
 */

import { describe, expect, it } from "vitest";

import type { HistoryEntry } from "../../history";
import { migrateV1EntriesToV2 } from "../historyEntryMigration";
import {
  getRawLegacyHistoryReadCount,
  recordRawLegacyHistoryRead,
  resetRawLegacyHistoryReadCount,
} from "../rawLegacyHistoryRead";

function makeV1Entry(partial: Partial<HistoryEntry>): HistoryEntry {
  return {
    id: "v1-1",
    type: "update",
    elementId: "elem-1",
    timestamp: 1,
    data: {},
    ...partial,
  } as HistoryEntry;
}

describe("historyIndexedDB v1→v3 migration adapter contract", () => {
  it("v1 seed batch (structural + props) → canonicalEvents (legacy payload kept until raw-read=0)", () => {
    const seeded: HistoryEntry[] = [
      makeV1Entry({
        id: "add-1",
        type: "add",
        elementId: "btn-1",
        data: {
          element: {
            id: "btn-1",
            type: "Button",
            props: { label: "New" },
            parent_id: "body-1",
          } as never,
        },
      }),
      makeV1Entry({
        id: "batch-1",
        type: "batch",
        data: {
          prevElements: [
            {
              id: "btn-1",
              type: "Button",
              props: { label: "New" },
              parent_id: "body-1",
            } as never,
          ],
          elements: [
            {
              id: "btn-1",
              type: "Button",
              props: { label: "Updated" },
              parent_id: "body-1",
            } as never,
          ],
        },
      }),
      makeV1Entry({
        id: "remove-1",
        type: "remove",
        elementId: "btn-1",
        data: {
          element: {
            id: "btn-1",
            type: "Button",
            props: { label: "Updated" },
            parent_id: "body-1",
          } as never,
        },
      }),
    ];

    const migrated = migrateV1EntriesToV2(seeded);

    expect(migrated).toHaveLength(3);
    for (const entry of migrated) {
      expect(entry.data.canonicalEvents?.length ?? 0).toBeGreaterThan(0);
    }

    expect(migrated[0]!.data.canonicalEvents![0]).toMatchObject({
      type: "insert",
    });
    expect(migrated[0]!.data.element).toMatchObject({ id: "btn-1" });
    expect(migrated[2]!.data.canonicalEvents![0]).toMatchObject({
      type: "remove",
    });
  });

  it("raw legacy read counter gates fallback removal", () => {
    resetRawLegacyHistoryReadCount();
    expect(getRawLegacyHistoryReadCount()).toBe(0);
    recordRawLegacyHistoryRead("test");
    expect(getRawLegacyHistoryReadCount()).toBe(1);
    resetRawLegacyHistoryReadCount();
    expect(getRawLegacyHistoryReadCount()).toBe(0);
  });
});
