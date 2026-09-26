import type { CompositionDocument } from "@composition/shared";
import type {
  CanonicalDocumentRecord,
  CanonicalDocumentBackupRecord,
  DocumentPersistOptions,
} from "../types";
import {
  BACKUP_GENERATIONS,
  countCanonicalDocumentNodes,
  evaluateDocumentPersist,
  shouldWriteBackup,
} from "./documentPersistGuard";
import { yieldToMain } from "../../../builder/utils/scheduleTask";

export const DOCUMENT_PARTS = "document_parts";
export const DOCUMENT_HEADS = "document_heads";
const STORES = [
  "documents",
  "documents_backup",
  DOCUMENT_PARTS,
  DOCUMENT_HEADS,
];
type Head = {
  project_id: string;
  revision: string;
  updated_at: string;
  count: number;
  backupAt?: string;
};
type Part = { project_id: string; key: string; value: string };
type Snapshot = { revision: string; parts: Map<string, string> };

function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error);
  });
}
function completion(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(tx.error ?? new Error("Document transaction aborted"));
    tx.onerror = () => reject(tx.error);
  });
}

/** 노드를 독립 레코드로 직렬화한다. 양보는 DB transaction을 열기 전에만 한다. */
export async function splitDocument(
  document: CompositionDocument,
): Promise<Map<string, string>> {
  const parts = new Map<string, string>();
  const { children, ...header } = document;
  parts.set(
    "document",
    JSON.stringify({ ...header, children: children.map((node) => node.id) }),
  );
  const stack = [...children].reverse();
  let sliceStart = performance.now();
  while (stack.length) {
    const node = stack.pop()!;
    const { children: nested, ...properties } = node as typeof node & {
      children?: typeof children;
    };
    const key = `node:${node.id}`;
    if (parts.has(key)) throw new Error(`Duplicate canonical node: ${node.id}`);
    parts.set(
      key,
      JSON.stringify({
        ...properties,
        ...(nested ? { children: nested.map((child) => child.id) } : {}),
      }),
    );
    if (nested)
      for (let i = nested.length - 1; i >= 0; i--) stack.push(nested[i]);
    if (stack.length && performance.now() - sliceStart >= 8) {
      await yieldToMain();
      sliceStart = performance.now();
    }
  }
  return parts;
}

export function joinDocument(parts: Map<string, string>): CompositionDocument {
  const read = (key: string): Record<string, unknown> => {
    const value = parts.get(key);
    if (value === undefined)
      throw new Error(`Missing canonical document part: ${key}`);
    const result = JSON.parse(value);
    if (result.children)
      result.children = result.children.map((id: string) => read(`node:${id}`));
    return result;
  };
  return read("document") as unknown as CompositionDocument;
}

/** 같은 adapter의 호출 순서를 보존하고, 다른 탭의 쓰기는 IDB transaction으로 직렬화한다. */
export class IncrementalDocuments {
  private tail: Promise<unknown> = Promise.resolve();
  private snapshot: { projectId: string; value: Snapshot } | null = null;
  constructor(private database: () => IDBDatabase) {}

  private async readParts(
    tx: IDBTransaction,
    projectId: string,
    head: Head,
  ): Promise<Map<string, string>> {
    if (
      this.snapshot?.projectId === projectId &&
      this.snapshot.value.revision === head.revision
    )
      return this.snapshot.value.parts;
    const rows = (await request(
      tx.objectStore(DOCUMENT_PARTS).index("project_id").getAll(projectId),
    )) as Part[];
    return new Map(rows.map((row) => [row.key, row.value]));
  }

  put(
    projectId: string,
    document: CompositionDocument,
    options?: DocumentPersistOptions,
  ): Promise<CompositionDocument> {
    const work = this.tail.then(async () => {
      const parts = await splitDocument(document);
      const tx = this.database().transaction(STORES, "readwrite");
      const done = completion(tx);
      try {
        const heads = tx.objectStore(DOCUMENT_HEADS);
        const head = (await request(heads.get(projectId))) as Head | undefined;
        const legacy = head
          ? undefined
          : ((await request(tx.objectStore("documents").get(projectId))) as
              CanonicalDocumentRecord | undefined);
        const previous = head
          ? await this.readParts(tx, projectId, head)
          : null;
        const previousCount =
          head?.count ??
          (legacy ? countCanonicalDocumentNodes(legacy.document) : 0);
        const decision = evaluateDocumentPersist(
          previousCount,
          parts.size - 1,
          options,
        );
        if (!decision.allowed) {
          if (typeof window !== "undefined")
            window.dispatchEvent(
              new CustomEvent("composition:document-persist-blocked", {
                detail: {
                  projectId,
                  prevCount: decision.prevCount,
                  nextCount: decision.nextCount,
                  reason: options?.reason ?? null,
                },
              }),
            );
          console.error(
            "[IndexedDB] canonical document write BLOCKED",
            decision.blockReason,
          );
          await done;
          return document;
        }
        let backupAt = head?.backupAt;
        if ((head || legacy) && shouldWriteBackup(backupAt, Date.now())) {
          const store = tx.objectStore("documents_backup");
          const backups = (await request(
            store.index("project_id").getAll(projectId),
          )) as CanonicalDocumentBackupRecord[];
          backups.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
          backupAt = backups[0]?.updated_at;
          if (shouldWriteBackup(backupAt, Date.now())) {
            const updatedAt = head?.updated_at ?? legacy!.updated_at;
            const backup: CanonicalDocumentBackupRecord = {
              backup_id: `${projectId}::${updatedAt}`,
              project_id: projectId,
              updated_at: updatedAt,
              document: previous ? joinDocument(previous) : legacy!.document,
            };
            store.put(backup);
            for (const stale of backups
              .filter((item) => item.backup_id !== backup.backup_id)
              .slice(BACKUP_GENERATIONS - 1))
              store.delete(stale.backup_id);
            backupAt = updatedAt;
          }
        }
        const store = tx.objectStore(DOCUMENT_PARTS);
        for (const [key, value] of parts)
          if (previous?.get(key) !== value)
            store.put({ project_id: projectId, key, value } satisfies Part);
        if (previous)
          for (const key of previous.keys())
            if (!parts.has(key)) store.delete([projectId, key]);
        const next: Head = {
          project_id: projectId,
          revision: crypto.randomUUID(),
          updated_at: new Date().toISOString(),
          count: parts.size - 1,
          backupAt,
        };
        heads.put(next);
        if (legacy) tx.objectStore("documents").delete(projectId);
        await done;
        this.snapshot = {
          projectId,
          value: { revision: next.revision, parts },
        };
        // ADR-235 Phase 6 — 커밋된 저장만 알린다 (급감 가드로 막힌 쓰기는 알리지 않는다) —
        //   연결 폴더의 백그라운드 세대 쓰기가 이 신호 뒤에 돈다 (HC1 — DB 단계 뒤). revision = 이 탭이
        //   쓴 head — 연결 기록의 비우기 도장이 "DB 문서 = 이 탭의 저장" 을 확인한다.
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("composition:document-persisted", {
              detail: { projectId, revision: next.revision },
            }),
          );
        }
        return document;
      } catch (error) {
        try {
          tx.abort();
        } catch {
          /* 이미 종료된 transaction */
        }
        await done.catch(() => undefined);
        throw error;
      }
    });
    this.tail = work.catch(() => undefined);
    return work;
  }

  /**
   * 저장된 현재 문서를 시간 버킷과 무관하게 백업 ring 에 기록한다 (ADR-235 G2 — 인라인
   * dataURL 이관의 "치환 전 백업 강제"). 같은 세대가 이미 있으면 새로 쓰지 않는다.
   * @returns 백업이 존재하게 되면 true (저장된 문서가 없으면 false)
   */
  backupNow(projectId: string): Promise<boolean> {
    const work = this.tail.then(async () => {
      const tx = this.database().transaction(STORES, "readwrite");
      const done = completion(tx);
      const heads = tx.objectStore(DOCUMENT_HEADS);
      const head = (await request(heads.get(projectId))) as Head | undefined;
      const legacy = head
        ? undefined
        : ((await request(tx.objectStore("documents").get(projectId))) as
            CanonicalDocumentRecord | undefined);
      if (!head && !legacy) {
        await done;
        return false;
      }
      const updatedAt = head?.updated_at ?? legacy!.updated_at;
      const store = tx.objectStore("documents_backup");
      const backupId = `${projectId}::${updatedAt}`;
      const existing = await request(store.getKey(backupId));
      if (existing === undefined) {
        const document = head
          ? joinDocument(await this.readParts(tx, projectId, head))
          : legacy!.document;
        store.put({
          backup_id: backupId,
          project_id: projectId,
          updated_at: updatedAt,
          document,
        } satisfies CanonicalDocumentBackupRecord);
        const backups = (await request(
          store.index("project_id").getAll(projectId),
        )) as CanonicalDocumentBackupRecord[];
        backups.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
        for (const stale of backups
          .filter((item) => item.backup_id !== backupId)
          .slice(BACKUP_GENERATIONS - 1))
          store.delete(stale.backup_id);
        if (head) heads.put({ ...head, backupAt: updatedAt });
      }
      await done;
      return true;
    });
    this.tail = work.catch(() => undefined);
    return work;
  }

  async get(projectId: string): Promise<CompositionDocument | null> {
    await this.tail;
    const tx = this.database().transaction(STORES, "readonly");
    const head = (await request(
      tx.objectStore(DOCUMENT_HEADS).get(projectId),
    )) as Head | undefined;
    if (!head)
      return (
        (
          (await request(tx.objectStore("documents").get(projectId))) as
            CanonicalDocumentRecord | undefined
        )?.document ?? null
      );
    return joinDocument(await this.readParts(tx, projectId, head));
  }

  async getAll(): Promise<CanonicalDocumentRecord[]> {
    await this.tail;
    const tx = this.database().transaction(STORES, "readonly");
    const [legacy, heads, rows] = await Promise.all([
      request(tx.objectStore("documents").getAll()) as Promise<
        CanonicalDocumentRecord[]
      >,
      request(tx.objectStore(DOCUMENT_HEADS).getAll()) as Promise<Head[]>,
      request(tx.objectStore(DOCUMENT_PARTS).getAll()) as Promise<Part[]>,
    ]);
    const grouped = new Map<string, Map<string, string>>();
    for (const row of rows) {
      const parts = grouped.get(row.project_id) ?? new Map();
      parts.set(row.key, row.value);
      grouped.set(row.project_id, parts);
    }
    const ids = new Set(heads.map((head) => head.project_id));
    return [
      ...legacy.filter((row) => !ids.has(row.project_id)),
      ...heads.map((head) => ({
        project_id: head.project_id,
        updated_at: head.updated_at,
        document: joinDocument(grouped.get(head.project_id) ?? new Map()),
      })),
    ];
  }

  delete(projectId: string): Promise<void> {
    const work = this.tail.then(async () => {
      const tx = this.database().transaction(STORES, "readwrite");
      const done = completion(tx);
      const keys = await request(
        tx
          .objectStore(DOCUMENT_PARTS)
          .index("project_id")
          .getAllKeys(projectId),
      );
      for (const key of keys) tx.objectStore(DOCUMENT_PARTS).delete(key);
      tx.objectStore(DOCUMENT_HEADS).delete(projectId);
      tx.objectStore("documents").delete(projectId);
      await done;
      if (this.snapshot?.projectId === projectId) this.snapshot = null;
    });
    this.tail = work.catch(() => undefined);
    return work;
  }
}
