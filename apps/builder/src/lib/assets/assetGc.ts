/**
 * ADR-235 Phase 3 — 자산 GC (breakdown §3 Phase 3 · §3.1).
 *
 * mark: root 수집 **전에** 자산별 epoch 를 읽고, 수집 뒤 epoch 가 같고 pin 이 없는 미참조 자산만
 * 후보 `{ epoch, since }` 로 기록한다. sweep: 다음 GC 도 같은 순서로 수집하고, 최종 보호 트랜잭션
 * (`assets` · `asset_gc` readwrite 하나) 에서 `현재 epoch = 이번 수집 시작 epoch = 후보 epoch` ·
 * pin 없음 · 이번 수집에서 미참조 · 유예 경과를 모두 확인한 뒤에만 바이트 삭제 · 후보 해제 ·
 * epoch 증가를 함께 확정한다. 하나라도 다르면 취소. 레코드는 tombstone 으로 남는다.
 *
 * 참조 공개 (`storeAssetBytes` · `prepareAssetReferences`) 가 같은 store 쌍의 readwrite 트랜잭션으로
 * pin · epoch 를 올리므로, 공개가 먼저 확정되면 삭제가 취소되고 삭제가 먼저면 공개의 존재 확인이
 * 실패한다 (깨진 참조가 공개되지 않는다).
 *
 * pin 해제 (§3.1-3·5):
 * - 이 세션의 pin — 참조가 영속 root (IndexedDB 에서 읽은 문서 · history · 백업 …) 에 있으면 푼다.
 *   영속 root 를 IndexedDB 에서 읽었다는 것이 저장 트랜잭션 complete 의 증거다.
 * - 끝난 세션의 pin — Web Locks 로 그 세션의 lock 이 더 이상 잡혀 있지 않음을 확인할 때만 푼다
 *   (소유권 종료 증명). Web Locks 가 없으면 풀지 않는다 (공간 회수만 미룬다).
 *
 * lazy 전용 — root 원천은 호출부가 주입한다 (builder store · DB 를 값으로 import 하지 않는다).
 */
import type { AssetRef } from "@composition/shared";
import { refFromHash } from "@composition/shared/assets";
import type { AssetGcRecord } from "./assetSchema";
import { ASSET_GC_STORE, ASSETS_STORE } from "./assetSchema";
import { openAssetDb, requestResult, transactionDone } from "./assetDb";
import { ASSET_SESSION_ID, ASSET_SESSION_LOCK_PREFIX } from "./assetStore";
import { installIndexedDbAssetUrlResolver } from "./assetUrlResolver";

/** 기본 유예 — 후보가 된 뒤 이만큼 지나야 삭제 (두 번째 mark 조건과 별개) */
export const ASSET_GC_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export interface AssetGcRoots {
  /** 영속 root — IndexedDB · localStorage 에서 읽은 값 (저장 complete 된 것) */
  durable(): Promise<unknown[]>;
  /** 이 탭 메모리 root — canonical 문서 · history · 스냅샷 캐시 */
  memory(): unknown[];
}

export interface AssetGcOptions {
  roots: AssetGcRoots;
  now?: number;
  graceMs?: number;
  sessionId?: string;
  /** 살아 있는 세션 id — 없으면 Web Locks 조회, 조회 불가면 null (끝난 세션 pin 정리 안 함) */
  liveSessions?: () => Promise<Set<string> | null>;
  /** 두 번째 mark 와 최종 삭제 사이 삽입 지점 (G3 경쟁 반례 테스트용) */
  beforeSweep?: (hash: string) => Promise<void>;
}

export interface AssetGcReport {
  assets: number;
  referenced: number;
  released: number;
  candidates: number;
  deleted: string[];
  cancelled: string[];
}

function collectHashes(values: unknown[], into: Set<string>): void {
  const stack: unknown[] = [...values];
  while (stack.length > 0) {
    const current = stack.pop();
    if (typeof current === "string") {
      if (current.includes("asset:sha256-")) {
        for (const match of current.matchAll(/asset:sha256-([0-9a-f]{64})/g)) {
          into.add(match[1]);
        }
      }
    } else if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
    } else if (current && typeof current === "object") {
      for (const item of Object.values(current)) stack.push(item);
    }
  }
}

async function readGcRecords(
  db: IDBDatabase,
): Promise<{ records: Map<string, AssetGcRecord>; assetHashes: string[] }> {
  const tx = db.transaction([ASSETS_STORE, ASSET_GC_STORE], "readonly");
  const [records, keys] = await Promise.all([
    requestResult(
      tx.objectStore(ASSET_GC_STORE).getAll() as IDBRequest<AssetGcRecord[]>,
    ),
    requestResult(tx.objectStore(ASSETS_STORE).getAllKeys()),
  ]);
  return {
    records: new Map(records.map((record) => [record.hash, record])),
    assetHashes: keys.map(String),
  };
}

/** 세션 pin 해제 — 보호 트랜잭션에서 epoch 증가 · 후보 해제와 함께 (§3.1-3) */
export async function releaseAssetPins(
  hashes: Iterable<string>,
  sessionIds: ReadonlySet<string>,
): Promise<number> {
  const list = [...new Set(hashes)];
  if (list.length === 0 || sessionIds.size === 0) return 0;
  const db = await openAssetDb();
  if (!db) return 0;
  const tx = db.transaction([ASSETS_STORE, ASSET_GC_STORE], "readwrite");
  const gc = tx.objectStore(ASSET_GC_STORE);
  const done = transactionDone(tx);
  let released = 0;
  for (const hash of list) {
    const record = await requestResult(
      gc.get(hash) as IDBRequest<AssetGcRecord | undefined>,
    );
    if (!record) continue;
    const pins = record.pins.filter((pin) => !sessionIds.has(pin));
    if (pins.length === record.pins.length) continue;
    const next: AssetGcRecord = {
      ...record,
      pins,
      referenceEpoch: record.referenceEpoch + 1,
    };
    delete next.candidate;
    gc.put(next);
    released += 1;
  }
  await done;
  return released;
}

async function queryLiveSessions(): Promise<Set<string> | null> {
  const locks = (
    globalThis.navigator as Navigator & {
      locks?: { query(): Promise<{ held?: { name?: string }[] }> };
    }
  )?.locks;
  if (!locks?.query) return null;
  try {
    const snapshot = await locks.query();
    return new Set(
      (snapshot.held ?? [])
        .map((lock) => lock.name ?? "")
        .filter((name) => name.startsWith(ASSET_SESSION_LOCK_PREFIX))
        .map((name) => name.slice(ASSET_SESSION_LOCK_PREFIX.length)),
    );
  } catch {
    return null;
  }
}

/** 최종 삭제 — 한 자산씩 보호 트랜잭션 (§3.1-4) */
async function sweepOne(
  db: IDBDatabase,
  hash: string,
  startEpoch: number,
  now: number,
  graceMs: number,
): Promise<boolean> {
  const tx = db.transaction([ASSETS_STORE, ASSET_GC_STORE], "readwrite");
  const done = transactionDone(tx);
  const gc = tx.objectStore(ASSET_GC_STORE);
  const record = await requestResult(
    gc.get(hash) as IDBRequest<AssetGcRecord | undefined>,
  );
  const ok =
    record !== undefined &&
    record.referenceEpoch === startEpoch &&
    record.candidate?.epoch === startEpoch &&
    record.pins.length === 0 &&
    now - record.candidate.since >= graceMs;
  if (ok && record) {
    tx.objectStore(ASSETS_STORE).delete(hash);
    gc.put({
      hash,
      referenceEpoch: record.referenceEpoch + 1,
      pins: [],
      deletedAt: now,
    } satisfies AssetGcRecord);
  }
  await done;
  return ok;
}

/** mark + sweep 1회. 두 번 연속 미참조 + 유예가 지난 후보만 삭제 후보가 된다. */
export async function runAssetGc(
  options: AssetGcOptions,
): Promise<AssetGcReport> {
  const now = options.now ?? Date.now();
  const graceMs = options.graceMs ?? ASSET_GC_GRACE_MS;
  const sessionId = options.sessionId ?? ASSET_SESSION_ID;
  const report: AssetGcReport = {
    assets: 0,
    referenced: 0,
    released: 0,
    candidates: 0,
    deleted: [],
    cancelled: [],
  };
  const db = await openAssetDb();
  if (!db) return report;

  // 0) pin 해제 — 영속 root 에 들어간 이 세션의 참조 · 끝난 세션의 pin
  const durableBefore = new Set<string>();
  collectHashes(await options.roots.durable(), durableBefore);
  const before = await readGcRecords(db);
  const live = await (options.liveSessions ?? queryLiveSessions)();
  const ownDurable: string[] = [];
  const endedPins = new Map<string, Set<string>>();
  for (const record of before.records.values()) {
    for (const pin of record.pins) {
      if (pin === sessionId) {
        if (durableBefore.has(record.hash)) ownDurable.push(record.hash);
      } else if (live && !live.has(pin)) {
        const set = endedPins.get(record.hash) ?? new Set<string>();
        set.add(pin);
        endedPins.set(record.hash, set);
      }
    }
  }
  report.released += await releaseAssetPins(ownDurable, new Set([sessionId]));
  for (const [hash, pins] of endedPins) {
    report.released += await releaseAssetPins([hash], pins);
  }

  // 1) root 수집 전에 epoch 를 읽는다
  const start = await readGcRecords(db);
  report.assets = start.assetHashes.length;

  // 2) root 수집 — 영속 + 이 탭 메모리
  const referenced = new Set<string>();
  collectHashes(await options.roots.durable(), referenced);
  collectHashes(options.roots.memory(), referenced);

  // 3) 후보 기록 · 해제, 4) 두 번째 mark 를 통과한 후보 삭제
  const markTx = db.transaction([ASSETS_STORE, ASSET_GC_STORE], "readwrite");
  const markDone = transactionDone(markTx);
  const gc = markTx.objectStore(ASSET_GC_STORE);
  const sweepable: { hash: string; epoch: number }[] = [];
  for (const hash of start.assetHashes) {
    const observed = start.records.get(hash);
    const current = await requestResult(
      gc.get(hash) as IDBRequest<AssetGcRecord | undefined>,
    );
    const epoch = observed?.referenceEpoch ?? 0;
    if (referenced.has(hash)) {
      report.referenced += 1;
      if (current?.candidate) {
        const next = { ...current };
        delete next.candidate;
        gc.put(next);
      }
      continue;
    }
    // 수집 중 epoch 가 바뀌었거나 pin 이 있으면 이번엔 판정하지 않는다
    if (
      (current?.referenceEpoch ?? 0) !== epoch ||
      (current?.pins.length ?? 0) > 0
    ) {
      continue;
    }
    if (current?.candidate && current.candidate.epoch === epoch) {
      sweepable.push({ hash, epoch });
      continue;
    }
    gc.put({
      hash,
      referenceEpoch: epoch,
      pins: current?.pins ?? [],
      candidate: { epoch, since: now },
    } satisfies AssetGcRecord);
    report.candidates += 1;
  }
  await markDone;

  const resolver = installIndexedDbAssetUrlResolver();
  for (const { hash, epoch } of sweepable) {
    await options.beforeSweep?.(hash);
    if (await sweepOne(db, hash, epoch, now, graceMs)) {
      report.deleted.push(hash);
      resolver.revoke(refFromHash(hash) as AssetRef);
    } else {
      report.cancelled.push(hash);
    }
  }
  return report;
}
