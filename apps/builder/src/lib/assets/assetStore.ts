/**
 * ADR-235 자산 쓰기 · 참조 준비 (breakdown §3.1).
 *
 * 참조를 문서·history·폰트 등 root 에 공개하기 **전에** 이 모듈의 트랜잭션으로
 * 바이트 존재 확인 + 세션 pin + epoch 증가 + 후보 해제를 함께 확정한다. `assets` 와
 * `asset_gc` 를 함께 포함하는 readwrite 트랜잭션 하나라 GC 의 최종 삭제와 서로
 * 끼어들지 않는다. 성공은 transaction complete 로 판정한다.
 */
import type { AssetRef } from "@composition/shared";
import {
  extensionForMime,
  hashFromRef as assetHashFromRef,
  refFromHash as assetRefFromHash,
  sha256Hex,
} from "@composition/shared/assets";
import type { AssetGcRecord, AssetRecord } from "./assetSchema";
import { ASSET_GC_STORE, ASSETS_STORE } from "./assetSchema";
import { openAssetDb, requestResult, transactionDone } from "./assetDb";

/** 이 탭 (세션) 의 pin 소유자 id */
export const ASSET_SESSION_ID: string =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const ASSET_SESSION_LOCK_PREFIX = "composition-asset-session:";

let sessionLock: Promise<boolean> | null = null;

/**
 * 이 세션 (탭) 의 Web Lock — pin 을 처음 쓰기 전에 잡고 탭이 끝날 때까지 유지한다. GC 는 lock 이
 * 잡혀 있는 세션의 pin 을 끝난 것으로 보지 않는다 (소유권 종료 증명, §3.1-5). Web Locks 가 없으면
 * false — 그 경우 GC 는 다른 세션의 pin 을 정리하지 않는다.
 */
export function holdAssetSessionLock(
  sessionId: string = ASSET_SESSION_ID,
): Promise<boolean> {
  const locks = (
    globalThis.navigator as
      | (Navigator & {
          locks?: {
            request(name: string, callback: () => Promise<void>): Promise<void>;
          };
        })
      | undefined
  )?.locks;
  if (!locks?.request) return Promise.resolve(false);
  sessionLock ??= new Promise<boolean>((resolve) => {
    void locks.request(`${ASSET_SESSION_LOCK_PREFIX}${sessionId}`, () => {
      resolve(true);
      return new Promise<void>(() => {}); // 탭 수명 동안 유지
    });
  });
  return sessionLock;
}

export class AssetStoreUnavailableError extends Error {
  constructor() {
    super("자산 저장소를 열 수 없습니다 (IndexedDB assets store 없음)");
    this.name = "AssetStoreUnavailableError";
  }
}

export class AssetMissingError extends Error {
  constructor(readonly ref: string) {
    super(`자산 바이트가 없습니다: ${ref}`);
    this.name = "AssetMissingError";
  }
}

function pinRecord(
  existing: AssetGcRecord | undefined,
  hash: string,
  sessionId: string,
): AssetGcRecord {
  const record: AssetGcRecord = existing
    ? { ...existing, pins: [...existing.pins] }
    : { hash, referenceEpoch: 0, pins: [] };
  record.referenceEpoch += 1;
  if (!record.pins.includes(sessionId)) record.pins.push(sessionId);
  delete record.candidate;
  delete record.deletedAt;
  return record;
}

export interface StoreAssetInput {
  bytes: Uint8Array;
  mime: string;
  name?: string;
}

export interface StoredAsset {
  ref: AssetRef;
  hash: string;
  blob: Blob;
  mime: string;
  ext: string;
  bytes: number;
}

/**
 * 원본 바이트를 그대로 저장하고 (같은 해시면 재사용) 이 세션 pin 을 함께 확정한다.
 * 업로드 · 이관 · 가져오기의 writer 진입점.
 */
export async function storeAssetBytes(
  input: StoreAssetInput,
  sessionId: string = ASSET_SESSION_ID,
): Promise<StoredAsset> {
  const hash = await sha256Hex(input.bytes);
  const mime = input.mime || "application/octet-stream";
  const ext = extensionForMime(mime, input.name);
  const blob = new Blob([input.bytes as BlobPart], { type: mime });
  if (sessionId === ASSET_SESSION_ID) await holdAssetSessionLock();
  const db = await openAssetDb();
  if (!db) throw new AssetStoreUnavailableError();

  const tx = db.transaction([ASSETS_STORE, ASSET_GC_STORE], "readwrite");
  const assets = tx.objectStore(ASSETS_STORE);
  const gc = tx.objectStore(ASSET_GC_STORE);
  const existing = await requestResult(
    assets.get(hash) as IDBRequest<AssetRecord | undefined>,
  );
  if (!existing) {
    const record: AssetRecord = {
      hash,
      mime,
      bytes: input.bytes.byteLength,
      ext,
      ...(input.name ? { name: input.name } : {}),
      blob,
      createdAt: Date.now(),
    };
    assets.put(record);
  }
  const gcRecord = await requestResult(
    gc.get(hash) as IDBRequest<AssetGcRecord | undefined>,
  );
  gc.put(pinRecord(gcRecord, hash, sessionId));
  await transactionDone(tx);
  return {
    ref: assetRefFromHash(hash),
    hash,
    blob: existing?.blob ?? blob,
    mime: existing?.mime ?? mime,
    ext: existing?.ext ?? ext,
    bytes: existing?.bytes ?? input.bytes.byteLength,
  };
}

/**
 * 원본 바이트 없이 기존 `asset:` 을 root 에 공개하기 전 준비 (URL 편집 · 붙여넣기 ·
 * undo/redo · 가져오기 · hydration). 바이트가 없으면 `AssetMissingError` —
 * 호출자는 참조를 공개하지 않는다.
 */
export async function prepareAssetReferences(
  refs: Iterable<string>,
  sessionId: string = ASSET_SESSION_ID,
): Promise<void> {
  const hashes = [...new Set([...refs].map((ref) => assetHashFromRef(ref)))];
  if (hashes.some((hash) => hash === null)) {
    throw new AssetMissingError(String([...refs][hashes.indexOf(null)]));
  }
  if (hashes.length === 0) return;
  if (sessionId === ASSET_SESSION_ID) await holdAssetSessionLock();
  const db = await openAssetDb();
  if (!db) throw new AssetStoreUnavailableError();
  const tx = db.transaction([ASSETS_STORE, ASSET_GC_STORE], "readwrite");
  const assets = tx.objectStore(ASSETS_STORE);
  const gc = tx.objectStore(ASSET_GC_STORE);
  const done = transactionDone(tx);
  for (const hash of hashes as string[]) {
    const existing = await requestResult(
      assets.getKey(hash) as IDBRequest<IDBValidKey | undefined>,
    );
    if (existing === undefined) {
      tx.abort();
      await done.catch(() => {});
      throw new AssetMissingError(assetRefFromHash(hash));
    }
    const gcRecord = await requestResult(
      gc.get(hash) as IDBRequest<AssetGcRecord | undefined>,
    );
    gc.put(pinRecord(gcRecord, hash, sessionId));
  }
  await done;
}

export async function readAssetBlob(ref: string): Promise<Blob | null> {
  const hash = assetHashFromRef(ref);
  if (!hash) return null;
  const db = await openAssetDb();
  if (!db) return null;
  const tx = db.transaction(ASSETS_STORE, "readonly");
  const record = await requestResult(
    tx.objectStore(ASSETS_STORE).get(hash) as IDBRequest<
      AssetRecord | undefined
    >,
  );
  return record?.blob ?? null;
}
