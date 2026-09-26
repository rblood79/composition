// @vitest-environment node
/**
 * ADR-235 Decision 4 후속 — 오래 닫힌 폴더 연결 프로젝트의 IndexedDB 내용 비우기.
 * 조건 (기간 · 도장 · 열림 · 폴더 세대) 각각이 하나라도 어긋나면 지우지 않는다.
 */
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import {
  buildV2Generation,
  memoryV2Directory,
  writeV2Directory,
} from "@composition/shared/assets";
import { IndexedDBAdapter } from "../../db/indexedDB/adapter";
import { closeAssetDb } from "../assetDb";
import {
  clearProjectLocalContent,
  readProjectLocalStamp,
  type ProjectLocalStamp,
} from "../projectLocalEviction";

let adapter: IndexedDBAdapter;
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-12-01T00:00:00Z");
const OLD = new Date(NOW - 40 * DAY).toISOString();

beforeEach(async () => {
  (globalThis as { indexedDB?: IDBFactory }).indexedDB = new IDBFactory();
  adapter = new IndexedDBAdapter();
  await adapter.init();
});
afterEach(async () => {
  await closeAssetDb();
  await adapter.close();
  vi.unstubAllGlobals();
});

const doc = (pageId: string) =>
  ({
    version: "composition-1.0",
    children: [{ id: pageId, type: "page", children: [] }],
  }) as unknown as CompositionDocument;

async function seedProject(id: string) {
  await adapter.projects.insert({
    id,
    name: id,
    created_at: "",
    updated_at: "",
  } as never);
  await adapter.documents.put(id, doc(`${id}-page`));
  await adapter.documents.backupNow(id);
  await adapter.collections.insert({
    id: `${id}-c`,
    project_id: id,
    name: "c",
  } as never);
  await adapter.variables.insert({
    id: `${id}-v`,
    project_id: id,
    name: "v",
  } as never);
  await adapter.events.insert({ id: `${id}-e`, project_id: id } as never);
}

async function seedHistory(projectId: string, pageId: string) {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open("composition-history", 4);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("history-entries", {
        keyPath: "id",
      }).createIndex("pageId", "pageId");
      db.createObjectStore("page-meta", { keyPath: "pageId" });
      db.createObjectStore("snapshots", { keyPath: "id" }).createIndex(
        "projectId",
        "projectId",
      );
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction(
        ["history-entries", "page-meta", "snapshots"],
        "readwrite",
      );
      tx.objectStore("history-entries").put({ id: `${pageId}-h`, pageId });
      tx.objectStore("page-meta").put({ pageId });
      tx.objectStore("snapshots").put({ id: `${projectId}-s`, projectId });
      tx.oncomplete = () => {
        req.result.close();
        resolve();
      };
    };
  });
}

async function historyCounts() {
  return new Promise<Record<string, number>>((resolve) => {
    const req = indexedDB.open("composition-history");
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(
        ["history-entries", "page-meta", "snapshots"],
        "readonly",
      );
      const out: Record<string, number> = {};
      for (const name of ["history-entries", "page-meta", "snapshots"]) {
        const r = tx.objectStore(name).count();
        r.onsuccess = () => (out[name] = r.result);
      }
      tx.oncomplete = () => {
        db.close();
        resolve(out);
      };
    };
  });
}

describe("clearProjectLocalContent", () => {
  it("도장이 같으면 그 프로젝트 내용만 지우고 projects 행 (요약) 은 남긴다", async () => {
    await seedProject("a");
    await seedProject("b");
    await seedHistory("a", "a-page");
    await seedHistory("b", "b-page");
    const stamp = (await readProjectLocalStamp("a"))!;
    expect(stamp.documentRevision).toBeTruthy();

    expect(await clearProjectLocalContent("a", stamp)).toBe("cleared");

    expect(await adapter.documents.get("a")).toBeNull();
    expect(await adapter.collections.getByProject("a")).toEqual([]);
    expect(await adapter.variables.getByProject("a")).toEqual([]);
    expect(await adapter.events.getByProject("a")).toEqual([]);
    expect(await adapter.projects.getById("a")).toMatchObject({ id: "a" });
    // 다른 프로젝트는 그대로
    expect(await adapter.documents.get("b")).not.toBeNull();
    expect(await adapter.collections.getByProject("b")).toHaveLength(1);
    expect(await historyCounts()).toEqual({
      "history-entries": 1,
      "page-meta": 1,
      snapshots: 1,
    });
    // 백업 ring 도 비었다 — 다시 비우면 도장 (문서 없음) 이 달라 아무것도 안 지운다
    const after = (await readProjectLocalStamp("a"))!;
    expect(after.documentRevision).toBeNull();
  });

  it("도장 뒤 DB 가 바뀌었으면 (문서 · collection) 아무것도 지우지 않는다", async () => {
    await seedProject("a");
    const stamp = (await readProjectLocalStamp("a"))!;
    await adapter.documents.put("a", doc("a-page-2"));
    expect(await clearProjectLocalContent("a", stamp)).toBe("changed");
    expect(await adapter.documents.get("a")).not.toBeNull();

    const stamp2 = (await readProjectLocalStamp("a"))!;
    await adapter.collections.insert({
      id: "a-c2",
      project_id: "a",
      name: "c2",
    } as never);
    expect(await clearProjectLocalContent("a", stamp2)).toBe("changed");
    expect(await adapter.collections.getByProject("a")).toHaveLength(2);
  });
});

// ============================================
// sweep
// ============================================

interface TestRecord {
  projectId: string;
  handle: { name: string };
  lastRevision: number | null;
  lastModified: number | null;
  linkedAt: string;
  syncedStamp?: ProjectLocalStamp | null;
  syncedAt?: string | null;
  lastOpenedAt?: string | null;
  clearedAt?: string | null;
}

async function putLink(record: TestRecord) {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open("composition-links", 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("links", { keyPath: "projectId" });
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction("links", "readwrite");
      tx.objectStore("links").put(record);
      tx.oncomplete = () => {
        req.result.close();
        resolve();
      };
    };
  });
}

async function getLink(projectId: string): Promise<TestRecord | undefined> {
  return new Promise((resolve) => {
    const req = indexedDB.open("composition-links", 1);
    req.onsuccess = () => {
      const r = req.result
        .transaction("links", "readonly")
        .objectStore("links")
        .get(projectId);
      r.onsuccess = () => {
        req.result.close();
        resolve(r.result as TestRecord | undefined);
      };
    };
  });
}

async function folderAt(revision: number) {
  const dir = memoryV2Directory();
  const generation = await buildV2Generation(
    { project: { id: "a", name: "a" }, document: doc("a-page") },
    async () => null,
    { revision, previousRevision: null },
  );
  await writeV2Directory(dir, generation);
  return dir;
}

async function linkedStaleProject(overrides: Partial<TestRecord> = {}) {
  await seedProject("a");
  const record: TestRecord = {
    projectId: "a",
    handle: { name: "folder" },
    lastRevision: 3,
    lastModified: null,
    linkedAt: OLD,
    syncedAt: OLD,
    lastOpenedAt: OLD,
    syncedStamp: await readProjectLocalStamp("a"),
    ...overrides,
  };
  await putLink(record);
  return record;
}

async function sweep(
  dir: ReturnType<typeof memoryV2Directory>,
  extra: Record<string, unknown> = {},
) {
  const { evictStaleDirectoryProjects } =
    await import("../projectDirectoryLink");
  return evictStaleDirectoryProjects({
    now: NOW,
    targetFor: () => dir,
    canRead: async () => true,
    withClosedProject: (_id, run) => run(),
    ...extra,
  });
}

describe("evictStaleDirectoryProjects", () => {
  it("조건을 모두 만족하면 비우고 연결 기록에 clearedAt 을 남긴다", async () => {
    await linkedStaleProject();
    expect(await sweep(await folderAt(3))).toEqual([
      { projectId: "a", result: "cleared" },
    ]);
    expect(await adapter.documents.get("a")).toBeNull();
    expect((await getLink("a"))?.clearedAt).toBe(new Date(NOW).toISOString());
    // 이미 비운 프로젝트는 다시 보지 않는다
    expect(await sweep(await folderAt(3))).toEqual([]);
  });

  it.each([
    ["recent", { lastOpenedAt: new Date(NOW - 5 * DAY).toISOString() }, 3, {}],
    ["unsynced", { syncedStamp: null }, 3, {}],
    ["folder-changed", {}, 4, {}],
    ["no-permission", {}, 3, { canRead: async () => false }],
    ["open", {}, 3, { withClosedProject: async () => "open" }],
  ] as const)(
    "%s — 지우지 않는다",
    async (expected, overrides, folderRevision, extra) => {
      await linkedStaleProject(overrides);
      expect(await sweep(await folderAt(folderRevision), extra)).toEqual([
        { projectId: "a", result: expected },
      ]);
      expect(await adapter.documents.get("a")).not.toBeNull();
      expect((await getLink("a"))?.clearedAt ?? null).toBeNull();
    },
  );

  it("folder-unreadable — 폴더 part 가 손상됐으면 지우지 않는다", async () => {
    await linkedStaleProject();
    const dir = await folderAt(3);
    for (const path of dir.files.keys())
      if (path.startsWith("parts/")) dir.files.set(path, new Uint8Array([1]));
    expect(await sweep(dir)).toEqual([
      { projectId: "a", result: "folder-unreadable" },
    ]);
    expect(await adapter.documents.get("a")).not.toBeNull();
  });

  it("changed — 마지막 폴더 저장 뒤 DB 가 바뀌었으면 지우지 않고 표식도 되돌린다", async () => {
    await linkedStaleProject();
    await adapter.documents.put("a", doc("a-page-edited"));
    expect(await sweep(await folderAt(3))).toEqual([
      { projectId: "a", result: "changed" },
    ]);
    expect(await adapter.documents.get("a")).not.toBeNull();
    expect((await getLink("a"))?.clearedAt ?? null).toBeNull();
  });
});

describe("비운 프로젝트 열기", () => {
  it("resume → status cleared · 폴더에 쓰지 않는다 (빈 문서로 폴더를 덮지 않음)", async () => {
    const storage = new Map<string, string>([["composition.dir-link.a", "1"]]);
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
      removeItem: (k: string) => void storage.delete(k),
    });
    const events: unknown[] = [];
    vi.stubGlobal("window", {
      dispatchEvent: (e: { detail: unknown }) => events.push(e.detail),
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    vi.stubGlobal(
      "CustomEvent",
      class extends Event {
        detail: unknown;
        constructor(type: string, init?: { detail?: unknown }) {
          super(type);
          this.detail = init?.detail;
        }
      },
    );
    await linkedStaleProject({ clearedAt: OLD });
    const { resumeProjectDirectoryLink, getDirectoryLink } =
      await import("../projectDirectoryLink");
    const collectContent = vi.fn(() => null);
    const state = await resumeProjectDirectoryLink("a", { collectContent });
    expect(state?.status).toBe("cleared");
    await getDirectoryLink("a")!.write(true);
    expect(collectContent).not.toHaveBeenCalled();
    expect(getDirectoryLink("a")!.state.status).toBe("cleared");
    // 열었다는 기록
    expect((await getLink("a"))?.lastOpenedAt).not.toBe(OLD);
    getDirectoryLink("a")!.dispose();
  });
});

describe("evictStaleDirectoryProjectsIfLinked — crash sentinel", () => {
  /** 저장 키 = 자기 속성 (Object.keys(localStorage) 와 같게) */
  function stubStorage(entries: Record<string, string>) {
    const store = Object.create({
      getItem(this: Record<string, string>, k: string) {
        return Object.hasOwn(this, k) ? this[k] : null;
      },
      setItem(this: Record<string, string>, k: string, v: string) {
        this[k] = String(v);
      },
      removeItem(this: Record<string, string>, k: string) {
        delete this[k];
      },
    }) as Record<string, string>;
    Object.assign(store, entries);
    vi.stubGlobal("localStorage", store);
    return store;
  }

  it("연결 표식이 없으면 연결 DB 를 열지 않는다", async () => {
    stubStorage({});
    const { evictStaleDirectoryProjectsIfLinked } =
      await import("../projectDirectoryLink");
    expect(await evictStaleDirectoryProjectsIfLinked()).toEqual([]);
  });

  it("최근 sentinel = 다른 탭이 도는 중 → 이번만 건너뛴다 · 오래된 sentinel = 끝나지 못한 실행 → 끈다", async () => {
    const { evictStaleDirectoryProjectsIfLinked } =
      await import("../projectDirectoryLink");
    const recent = stubStorage({
      "composition.dir-link.a": "1",
      "composition.dir-link.evicting": String(Date.now()),
    });
    expect(await evictStaleDirectoryProjectsIfLinked()).toEqual([]);
    expect(recent["composition.dir-link.evict-disabled"]).toBeUndefined();

    const stale = stubStorage({
      "composition.dir-link.a": "1",
      "composition.dir-link.evicting": String(Date.now() - 60 * 60 * 1000),
    });
    expect(await evictStaleDirectoryProjectsIfLinked()).toEqual([]);
    expect(stale["composition.dir-link.evict-disabled"]).toBe("1");
    expect(stale["composition.dir-link.evicting"]).toBeUndefined();
  });

  it("정상 실행은 sentinel 을 지운다", async () => {
    const store = stubStorage({ "composition.dir-link.a": "1" });
    const { evictStaleDirectoryProjectsIfLinked } =
      await import("../projectDirectoryLink");
    expect(await evictStaleDirectoryProjectsIfLinked()).toEqual([]);
    expect(store["composition.dir-link.evicting"]).toBeUndefined();
    expect(store["composition.dir-link.evict-disabled"]).toBeUndefined();
  });
});
