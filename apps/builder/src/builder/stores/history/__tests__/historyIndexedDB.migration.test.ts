import { describe, expect, it } from "vitest";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { HistoryEntry } from "../../history";
import { isCanonicalHistoryEntry } from "../historyIndexedDB";

function makeEntry(
  partial: Omit<Partial<HistoryEntry>, "data"> & {
    data?: HistoryEntry["data"];
  },
): HistoryEntry {
  return {
    id: "entry-1",
    type: "update",
    elementId: "elem-1",
    timestamp: 1,
    data: {},
    ...partial,
  } as HistoryEntry;
}

describe("historyIndexedDB canonical-only persistence contract", () => {
  it("element history는 canonicalEvents가 있을 때만 저장·복원한다", () => {
    expect(
      isCanonicalHistoryEntry(
        makeEntry({
          data: {
            canonicalEvents: [
              {
                type: "update",
                nodeId: "elem-1",
                prevProps: { children: "before" },
                nextProps: { children: "after" },
              },
            ],
          },
        }),
      ),
    ).toBe(true);
    expect(isCanonicalHistoryEntry(makeEntry({ data: {} }))).toBe(false);
  });

  it("page/snapshot 축은 전용 canonical payload 계약으로 유지한다", () => {
    expect(
      isCanonicalHistoryEntry(
        makeEntry({
          type: "page-title",
          data: {
            pageTitleEvent: {
              pageId: "page-1",
              before: "Before",
              after: "After",
            },
          },
        }),
      ),
    ).toBe(true);
    expect(
      isCanonicalHistoryEntry(
        makeEntry({
          type: "snapshot-restore",
          data: {
            snapshotRestoreEvent: {
              beforeSnapshotId: "before",
              afterSnapshotId: "after",
              snapshotName: "Checkpoint",
            },
          },
        }),
      ),
    ).toBe(true);
    expect(
      isCanonicalHistoryEntry(makeEntry({ type: "page-title", data: {} })),
    ).toBe(false);
    expect(
      isCanonicalHistoryEntry(
        makeEntry({ type: "snapshot-restore", data: {} }),
      ),
    ).toBe(false);
  });

  it("v1 history만 초기화하고 migration adapter를 재도입하지 않는다", async () => {
    const source = await readFile(
      resolve(__dirname, "../historyIndexedDB.ts"),
      "utf-8",
    );
    const migrationPath = resolve(__dirname, "../historyEntryMigration.ts");

    expect(source).toMatch(/const DB_VERSION\s*=\s*4\b/);
    expect(source).toContain("if (oldVersion === 1)");
    expect(source).toContain("db.deleteObjectStore(STORE_ENTRIES)");
    expect(source).toContain("db.deleteObjectStore(STORE_META)");
    expect(source).not.toContain("migrateV1");
    await expect(access(migrationPath)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
