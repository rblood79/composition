/**
 * ADR-235 Phase 3 — 자산 GC 실행 시점 · root 원천 배선.
 *
 * builder 부팅 뒤 idle 에 하루 한 번 (`composition.asset-gc.last-run`). GC 구현 · 영속 root 수집은
 * lazy 모듈이고, 이 탭의 메모리 root (canonical 문서 · history · 스냅샷 캐시) 만 여기서 넘긴다.
 * GC 앞에서 오래 닫힌 폴더 연결 프로젝트의 IndexedDB 내용을 비운다 (ADR-235 Decision 4 — 비운
 * 프로젝트의 자산은 이 GC 부터 root 가 아니다).
 */
import { useCanonicalDocumentStore } from "./canonical/canonicalDocumentStore";
import { historyManager } from "./history";
import { snapshotManager } from "./history/snapshots";

const LAST_RUN_KEY = "composition.asset-gc.last-run";
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;

function collectMemoryAssetRoots(): unknown[] {
  return [
    [...useCanonicalDocumentStore.getState().documents.values()],
    historyManager.getAssetRootPayloads(),
    snapshotManager.getAssetRootPayloads(),
  ];
}

export async function runAssetGcNow(options: { graceMs?: number } = {}) {
  const [
    { runAssetGc },
    { collectDurableAssetRoots, evictStaleDirectoryProjectsIfLinked },
  ] = await Promise.all([
    import("../../lib/assets/assetGc"),
    import("../../lib/assets/assetGcRoots"),
  ]);
  await evictStaleDirectoryProjectsIfLinked();
  const report = await runAssetGc({
    roots: {
      durable: collectDurableAssetRoots,
      memory: collectMemoryAssetRoots,
    },
    graceMs: options.graceMs,
  });
  try {
    localStorage.setItem(LAST_RUN_KEY, String(Date.now()));
  } catch {
    /* 기록 실패는 다음 부팅에서 다시 돈다 */
  }
  if (report.deleted.length > 0 || report.candidates > 0) {
    console.info("[assets] GC", report);
  }
  return report;
}

export function scheduleAssetGc(): void {
  let last = 0;
  try {
    last = Number(localStorage.getItem(LAST_RUN_KEY) ?? 0);
  } catch {
    return;
  }
  if (Date.now() - last < RUN_INTERVAL_MS) return;
  const run = () =>
    void runAssetGcNow().catch((error) => {
      console.warn("[assets] GC 실패 — 공간 회수만 미룬다", error);
    });
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run, { timeout: 10_000 });
  } else {
    setTimeout(run, 5_000);
  }
}

if (import.meta.env.DEV && typeof window !== "undefined") {
  (
    window as unknown as { __composition_ASSET_GC__?: typeof runAssetGcNow }
  ).__composition_ASSET_GC__ = runAssetGcNow;
}
