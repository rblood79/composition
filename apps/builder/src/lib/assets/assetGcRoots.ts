/**
 * ADR-235 Phase 3 — GC 영속 root 수집 (G0 (b) 보유처 전수).
 *
 * - `composition` DB: 살아 있는 프로젝트 (`projects`) 의 현행 문서 (`document_parts` · legacy
 *   `documents`) · 백업 ring (`documents_backup` — 살아 있는 프로젝트만) · `collections` · `variables`
 * - `composition-history` DB: `history-entries` 전부 (projectId 가 없어 프로젝트로 거르지 않는다 —
 *   `cleanupOldEntries` · `clearPageHistory` 로 정리될 때까지 root) · `snapshots` (살아 있는 프로젝트)
 * - localStorage: 폰트 레지스트리 · 이관 전 레지스트리 백업 참조 · legacy 폰트 키
 * - sessionStorage: 이 탭의 Preview 핸드오프 (`composition-preview-data`)
 *
 * 지운 프로젝트의 백업 · 스냅샷은 root 가 아니다 (고아 사본). 읽기만 한다 — DB 가 없으면 만들지
 * 않는다.
 */
import { openAssetDb, requestResult } from "./assetDb";

const HISTORY_DB = "composition-history";
const STORAGE_KEYS = [
  "composition.font-registry",
  "composition.font-registry.backup-ref",
  "composition.custom-fonts",
];
const SESSION_KEYS = ["composition-preview-data"];

function openExisting(name: string): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(name);
    request.onupgradeneeded = () => request.transaction?.abort();
    request.onerror = () => resolve(null);
    request.onsuccess = () => resolve(request.result);
  });
}

async function readAll(
  db: IDBDatabase,
  store: string,
): Promise<Record<string, unknown>[]> {
  if (!db.objectStoreNames.contains(store)) return [];
  const tx = db.transaction(store, "readonly");
  return requestResult(
    tx.objectStore(store).getAll() as IDBRequest<Record<string, unknown>[]>,
  );
}

export async function collectDurableAssetRoots(): Promise<unknown[]> {
  const roots: unknown[] = [];
  const main = await openAssetDb();
  if (main) {
    const projects = await readAll(main, "projects");
    const live = new Set(projects.map((project) => String(project.id)));
    roots.push(
      await readAll(main, "document_parts"),
      (await readAll(main, "documents")).filter((row) =>
        live.has(String(row.project_id)),
      ),
      (await readAll(main, "documents_backup")).filter((row) =>
        live.has(String(row.project_id)),
      ),
      await readAll(main, "collections"),
      await readAll(main, "variables"),
    );
    const history = await openExisting(HISTORY_DB);
    if (history) {
      roots.push(
        await readAll(history, "history-entries"),
        (await readAll(history, "snapshots")).filter((row) =>
          live.has(String(row.projectId)),
        ),
      );
      history.close();
    }
  }
  for (const key of STORAGE_KEYS) {
    roots.push(globalThis.localStorage?.getItem(key) ?? null);
  }
  for (const key of SESSION_KEYS) {
    roots.push(globalThis.sessionStorage?.getItem(key) ?? null);
  }
  return roots;
}
