/**
 * 제거된 기능이 남긴 localStorage 키 정리.
 *
 * 저장소는 코드를 지워도 사용자 브라우저에 남는다 — 쓰는 쪽이 사라지면 읽는 쪽도
 * 없으므로 기능상 무해하지만, 되살아난 키를 나중에 "쓰이는 설정"으로 잘못 읽게 된다.
 * 앱 시작 시 한 번 지운다.
 *
 * 새 항목을 추가할 때는 **왜 죽었는지와 언제인지**를 같이 적는다. 근거 없는 키가
 * 쌓이면 살아 있는 키를 지우는 사고로 이어진다.
 */

/** 지울 키 목록. `removeItem` 은 없는 키에 무해하므로 별도 기록이 필요 없다. */
export const REMOVED_STORAGE_KEYS = [
  // 2026-08-26 — 대시보드 설정 모달 + settingsStore 제거.
  // 담고 있던 syncMode / projectCreation / autoSyncInterval / autoDownloadOnOpen 는
  // ADR-128(Supabase backend decommission)로 cloud 경로가 사라진 뒤 소비처가 0건이었다.
  "composition-settings",
] as const;

/**
 * @returns 실제로 지운 키 (없었으면 빈 배열)
 */
export function cleanupLegacyStorage(
  keys: readonly string[] = REMOVED_STORAGE_KEYS,
): string[] {
  const removed: string[] = [];

  for (const key of keys) {
    // 사생활 보호 모드·저장소 차단 환경에서는 접근 자체가 throw 한다.
    // 정리는 부가 작업이므로 앱 시작을 막지 않는다.
    try {
      if (localStorage.getItem(key) === null) continue;
      localStorage.removeItem(key);
      removed.push(key);
    } catch {
      return removed;
    }
  }

  return removed;
}
