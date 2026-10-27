/**
 * ADR-235 Phase 3 — GC 영속 root 수집 (G0 (b) 보유처 전수) 중 catalog DB 밖의 것.
 *
 * - (ADR-286: 데이터 정의는 catalog 문서 — 그 root 에 들어 있다)
 * - localStorage: 폰트 레지스트리 · 이관 전 레지스트리 백업 참조 · legacy 폰트 키
 * - sessionStorage: 이 탭의 Preview 핸드오프 (`composition-preview-data`)
 *
 * 문서 · 스냅샷 root 는 `catalogRuntime/assetGc.ts` 의 `collectCatalogDurableAssetRoots` 가 모은다.
 * 읽기만 한다 — DB 가 없으면 만들지 않는다.
 */

const STORAGE_KEYS = [
  "composition.font-registry",
  "composition.font-registry.backup-ref",
  "composition.custom-fonts",
];
const SESSION_KEYS = ["composition-preview-data"];

export async function collectDurableAssetRoots(): Promise<unknown[]> {
  // (ADR-286: collection rows · variable values are catalog document entries — the catalog
  //   roots hold them.)
  const roots: unknown[] = [];
  for (const key of STORAGE_KEYS) {
    roots.push(globalThis.localStorage?.getItem(key) ?? null);
  }
  for (const key of SESSION_KEYS) {
    roots.push(globalThis.sessionStorage?.getItem(key) ?? null);
  }
  return roots;
}

/**
 * GC 앞 — 오래 닫힌 폴더 연결 프로젝트의 IndexedDB 내용 비우기 (ADR-235 Decision 4). 비운 프로젝트의
 * data 행은 이번 수집부터 root 가 아니다. 던지지 않는다. 연결 모듈은 중첩 dynamic import 로만
 * 싣는다 — scheduler (initial) 에 import 지점을 더하면 preload 목록이 initial 에 붙는다 (HC2, 실측
 * +108 B).
 */
export async function evictStaleDirectoryProjectsIfLinked(): Promise<void> {
  try {
    const { evictStaleDirectoryProjectsIfLinked: run } =
      await import("./projectDirectoryLink");
    await run();
  } catch (error) {
    // 비우기 실패는 공간 회수만 미룬다 — GC 는 그대로 돈다
    console.warn("[directory-link] 연결 프로젝트 비우기 실패", error);
  }
}
