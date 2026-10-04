// @vitest-environment node
/**
 * ADR-235 Decision 4 후속 — 오래 닫힌 폴더 연결 프로젝트의 IndexedDB 내용 비우기.
 * 조건 (기간 · 도장 · 열림 · 폴더 세대) 각각이 하나라도 어긋나면 지우지 않는다.
 * ADR-248 이후 도장은 catalog 문서를 담지 않는다 (`documentRevision` 늘 null) — 아래 sweep 은 기록에
 * 도장을 직접 넣어 조건 순서만 확인한다. 제품에서는 저장 확인이 성립하지 않아 도장이 남지 않는다.
 */
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

/** 폴더 세대의 문서 part — 비우기 판정은 내용을 보지 않는다 */
const folderDocument = { format: "composition-catalog", entries: {} };

async function seedProject(id: string, data = true) {
  await adapter.projects.insert({
    id,
    name: id,
    created_at: "",
    updated_at: "",
  } as never);
  if (!data) return;
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
}

describe("clearProjectLocalContent", () => {
  it("도장은 catalog 문서를 담지 않는다 (documentRevision null)", async () => {
    await seedProject("a");
    expect((await readProjectLocalStamp("a"))?.documentRevision).toBeNull();
  });

  it("도장이 같으면 그 프로젝트 data 행만 지우고 projects 행 (요약) 은 남긴다", async () => {
    await seedProject("a");
    await seedProject("b");
    const stamp = (await readProjectLocalStamp("a"))!;

    expect(await clearProjectLocalContent("a", stamp)).toBe("cleared");

    expect(await adapter.collections.getByProject("a")).toEqual([]);
    expect(await adapter.variables.getByProject("a")).toEqual([]);
    expect(await adapter.projects.getById("a")).toMatchObject({ id: "a" });
    // 다른 프로젝트는 그대로
    expect(await adapter.collections.getByProject("b")).toHaveLength(1);
    expect(await adapter.variables.getByProject("b")).toHaveLength(1);
  });

  it("도장 뒤 DB 가 바뀌었으면 (collection) 아무것도 지우지 않는다", async () => {
    await seedProject("a");
    const stamp = (await readProjectLocalStamp("a"))!;
    await adapter.collections.insert({
      id: "a-c2",
      project_id: "a",
      name: "c2",
    } as never);
    expect(await clearProjectLocalContent("a", stamp)).toBe("changed");
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
    { project: { id: "a", name: "a" }, document: folderDocument },
    async () => null,
    { revision, previousRevision: null },
  );
  await writeV2Directory(dir, generation);
  return dir;
}

async function linkedStaleProject(
  overrides: Partial<TestRecord> = {},
  data = false,
) {
  await seedProject("a", data);
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
      expect((await getLink("a"))?.clearedAt ?? null).toBeNull();
    },
  );

  it("has-data — collections · API · 변수 행이 있으면 (export 투영이 필드를 버림) 지우지 않는다", async () => {
    await linkedStaleProject({}, true);
    expect(await sweep(await folderAt(3))).toEqual([
      { projectId: "a", result: "has-data" },
    ]);
    expect(await adapter.collections.getByProject("a")).toHaveLength(1);
  });

  it("open — 확인하는 동안 누가 열었으면 (기록 변경) 표식하지 않는다", async () => {
    await linkedStaleProject();
    const result = await sweep(await folderAt(3), {
      withClosedProject: async (_id: string, run: () => Promise<string>) => {
        const current = await getLink("a");
        await putLink({
          ...current!,
          lastOpenedAt: new Date(NOW).toISOString(),
        });
        return run();
      },
    });
    expect(result).toEqual([{ projectId: "a", result: "open" }]);
    expect((await getLink("a"))?.clearedAt ?? null).toBeNull();
  });

  it("folder-unreadable — 폴더 part 가 손상됐으면 지우지 않는다", async () => {
    await linkedStaleProject();
    const dir = await folderAt(3);
    for (const path of dir.files.keys())
      if (path.startsWith("parts/")) dir.files.set(path, new Uint8Array([1]));
    expect(await sweep(dir)).toEqual([
      { projectId: "a", result: "folder-unreadable" },
    ]);
  });

  it("changed — 마지막 폴더 저장 뒤 DB 가 바뀌었으면 지우지 않고 표식도 되돌린다", async () => {
    await linkedStaleProject();
    await adapter.collections.insert({
      id: "a-c2",
      project_id: "a",
      name: "c2",
    } as never);
    expect(await sweep(await folderAt(3))).toEqual([
      { projectId: "a", result: "changed" },
    ]);
    expect(await adapter.collections.getByProject("a")).toHaveLength(1);
  });
});

describe("비운 프로젝트 열기", () => {
  function stubWindow() {
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
  }

  it("resume → status cleared · 폴더에 쓰지 않는다 (빈 문서로 폴더를 덮지 않음)", async () => {
    stubWindow();
    const record = await linkedStaleProject({ clearedAt: OLD });
    expect(await clearProjectLocalContent("a", record.syncedStamp!)).toBe(
      "cleared",
    );
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

  it("문서 revision 이 없는 도장으로는 표식을 풀지 않는다 (폴더에서 불러오기 전까지 쓰지 않음)", async () => {
    stubWindow();
    await linkedStaleProject({ clearedAt: OLD });
    const { resumeProjectDirectoryLink, getDirectoryLink } =
      await import("../projectDirectoryLink");
    const state = await resumeProjectDirectoryLink("a", {
      collectContent: () => null,
    });
    expect(state?.status).toBe("cleared");
    expect((await getLink("a"))?.clearedAt).toBe(OLD);
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
