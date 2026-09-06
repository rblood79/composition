import { afterEach, describe, expect, it, vi } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import type { DatabaseAdapter } from "../../../lib/db";
import { useCanonicalDocumentStore } from "./canonicalDocumentStore";
import { persistActiveCanonicalDocument } from "./persistActiveCanonicalDocument";

function setup() {
  const document: CompositionDocument = {
    version: "composition-1.0",
    children: [],
  };
  const put = vi.fn().mockResolvedValue(undefined);
  const db = { documents: { put } } as unknown as DatabaseAdapter;
  const store = useCanonicalDocumentStore.getState();
  store.setDocument("persist-a", document);
  store.setCurrentProject("persist-a");
  return {
    db,
    put,
    document: useCanonicalDocumentStore.getState().documents.get("persist-a")!,
  };
}

afterEach(() => {
  useCanonicalDocumentStore.getState().setCurrentProject(null);
});

describe("persistActiveCanonicalDocument", () => {
  it("DB 대기 중 프로젝트가 바뀌어도 원래 문서를 저장하고 후속 저장에 반환한다", async () => {
    const { db, put, document } = setup();
    let resolveDb!: (db: DatabaseAdapter) => void;
    const getDB = vi.fn(
      () =>
        new Promise<DatabaseAdapter>((resolve) => {
          resolveDb = resolve;
        }),
    );
    const pending = persistActiveCanonicalDocument(getDB);
    useCanonicalDocumentStore
      .getState()
      .setDocument("persist-b", { version: "composition-1.0", children: [] });
    useCanonicalDocumentStore.getState().setCurrentProject("persist-b");
    resolveDb(db);
    const persisted = await pending;
    expect(put).toHaveBeenCalledExactlyOnceWith("persist-a", document);
    expect(persisted?.projectId).toBe("persist-a");
    expect(persisted?.document).toBe(document);
  });

  it.each([
    { reason: "history-undo-redo", expectedShrinkNodeCount: 3 },
    { reason: "element-removal", allowShrink: true },
  ])("감소량 검증 옵션을 변경하지 않고 전달한다: %j", async (options) => {
    const { db, put, document } = setup();
    await persistActiveCanonicalDocument(db, options);
    expect(put).toHaveBeenCalledExactlyOnceWith("persist-a", document, options);
  });

  it("활성 프로젝트나 문서가 없으면 DB를 열지 않는다", async () => {
    const getDB = vi.fn();
    useCanonicalDocumentStore.getState().setCurrentProject(null);
    expect(await persistActiveCanonicalDocument(getDB)).toBeNull();
    useCanonicalDocumentStore
      .getState()
      .setCurrentProject("missing-persist-document");
    expect(await persistActiveCanonicalDocument(getDB)).toBeNull();
    expect(getDB).not.toHaveBeenCalled();
  });

  it("저장이 끝나기 전에 완료되지 않고 오류를 호출자에게 전달한다", async () => {
    const { db, put } = setup();
    let rejectPut!: (error: Error) => void;
    put.mockImplementation(
      () =>
        new Promise<void>((_, reject) => {
          rejectPut = reject;
        }),
    );
    const finished = vi.fn();
    const pending = persistActiveCanonicalDocument(db);
    void pending.then(finished, () => undefined);
    await Promise.resolve();
    expect(finished).not.toHaveBeenCalled();
    const error = new Error("storage failure");
    rejectPut(error);
    await expect(pending).rejects.toBe(error);
    expect(finished).not.toHaveBeenCalled();
  });
});
