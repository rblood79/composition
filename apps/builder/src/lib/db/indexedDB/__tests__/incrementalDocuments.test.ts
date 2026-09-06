import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import {
  DOCUMENT_HEADS,
  DOCUMENT_PARTS,
  IncrementalDocuments,
  joinDocument,
  splitDocument,
} from "../incrementalDocuments";

let db: IDBDatabase;
let documents: IncrementalDocuments;
const doc = (count: number, width = 10): CompositionDocument =>
  ({
    version: "composition-1.0",
    children: Array.from({ length: count }, (_, i) => ({
      id: `n${i}`,
      type: "frame",
      width: i === 0 ? width : 10,
    })),
  }) as CompositionDocument;
beforeEach(async () => {
  const factory = new IDBFactory();
  db = await new Promise((resolve, reject) => {
    const req = factory.open("test", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("documents", { keyPath: "project_id" });
      req.result.createObjectStore(DOCUMENT_HEADS, { keyPath: "project_id" });
      req.result
        .createObjectStore(DOCUMENT_PARTS, { keyPath: ["project_id", "key"] })
        .createIndex("project_id", "project_id");
      req.result
        .createObjectStore("documents_backup", { keyPath: "backup_id" })
        .createIndex("project_id", "project_id");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  documents = new IncrementalDocuments(() => db);
});
afterEach(() => {
  db.close();
  vi.restoreAllMocks();
});

describe("incremental document persistence", () => {
  it("중첩 children, root collection, 빈 children을 손실 없이 복원한다", async () => {
    const value = {
      ...doc(2),
      children: [
        {
          ...doc(1).children[0],
          children: [{ id: "child", type: "frame", children: [] }],
        },
      ],
      events: [],
      pagePositions: { page: { desktop: { x: 1, y: 2 } } },
    } as unknown as CompositionDocument;
    expect(joinDocument(await splitDocument(value))).toEqual(value);
  });
  it("600 노드의 단일 props 수정은 노드 1개만 기록하며 새 adapter에서 복원된다", async () => {
    await documents.put("p", doc(600));
    await documents.put("p", doc(600, 11)); // 최초 백업 생성
    const writes = vi.spyOn(IDBObjectStore.prototype, "put");
    await documents.put("p", doc(600, 12));
    const partWrites = writes.mock.instances.filter(
      (store) => (store as IDBObjectStore).name === DOCUMENT_PARTS,
    );
    expect(partWrites).toHaveLength(1);
    expect(await new IncrementalDocuments(() => db).get("p")).toEqual(
      doc(600, 12),
    );
    expect(await documents.getAll()).toEqual([
      expect.objectContaining({ project_id: "p", document: doc(600, 12) }),
    ]);
  });
  it("급감은 차단하고 명시 삭제 및 Undo 증가는 저장한다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await documents.put("p", doc(100));
    await documents.put("p", doc(1));
    expect((await documents.get("p"))?.children).toHaveLength(100);
    await documents.put("p", doc(1), { allowShrink: true });
    expect((await documents.get("p"))?.children).toHaveLength(1);
    await documents.put("p", doc(100));
    expect((await documents.get("p"))?.children).toHaveLength(100);
  });
  it("호출 순서, 프로젝트 격리, 다른 adapter revision을 보존한다", async () => {
    await Promise.all([
      documents.put("p", doc(10, 11)),
      documents.put("p", doc(10, 12)),
      documents.put("q", doc(1)),
    ]);
    const other = new IncrementalDocuments(() => db);
    await other.put("p", doc(10, 13));
    expect(await documents.get("p")).toEqual(doc(10, 13));
    await documents.put("p", doc(10, 14));
    expect(await other.get("p")).toEqual(doc(10, 14));
    await documents.delete("p");
    expect(await other.get("p")).toBeNull();
    expect(await documents.get("q")).toEqual(doc(1));
  });
  it("구 전체 row는 첫 저장에서 백업하고 원자적으로 전환한다", async () => {
    await new Promise<void>((resolve) => {
      const tx = db.transaction("documents", "readwrite");
      tx.objectStore("documents").put({
        project_id: "p",
        document: doc(30),
        updated_at: "2026-01-01T00:00:00.000Z",
      });
      tx.oncomplete = () => resolve();
    });
    expect(await documents.get("p")).toEqual(doc(30));
    await documents.put("p", doc(30, 20));
    const backups = await new Promise<unknown[]>((resolve) => {
      const req = db
        .transaction("documents_backup")
        .objectStore("documents_backup")
        .getAll();
      req.onsuccess = () => resolve(req.result);
    });
    expect(backups).toEqual([expect.objectContaining({ document: doc(30) })]);
    expect(await new IncrementalDocuments(() => db).get("p")).toEqual(
      doc(30, 20),
    );
  });
  it("transaction 실패는 호출자에게 전달하고 기존 문서를 보존한다", async () => {
    await documents.put("p", doc(30));
    const original = IDBObjectStore.prototype.put;
    const spy = vi
      .spyOn(IDBObjectStore.prototype, "put")
      .mockImplementation(function (
        this: IDBObjectStore,
        ...args: Parameters<typeof original>
      ) {
        if (this.name === DOCUMENT_HEADS)
          throw new DOMException("Quota", "QuotaExceededError");
        return original.apply(this, args);
      });
    await expect(documents.put("p", doc(30, 50))).rejects.toThrow("Quota");
    spy.mockRestore();
    expect(await new IncrementalDocuments(() => db).get("p")).toEqual(doc(30));
    await documents.put("p", doc(30, 60));
    expect(await documents.get("p")).toEqual(doc(30, 60));
  });
  it("큰 준비 작업은 입력 처리를 허용하고 DB transaction은 나중에 연다", async () => {
    let ticks = 0;
    vi.spyOn(performance, "now").mockImplementation(() => ticks++ * 9);
    const transaction = vi.spyOn(db, "transaction");
    const saving = documents.put("p", doc(10));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(transaction).not.toHaveBeenCalled();
    await saving;
    expect(await documents.get("p")).toEqual(doc(10));
  });
});
