/**
 * Raw legacy history read instrumentation — ADR-124 Phase 5 gate.
 *
 * `historyActions` legacy fallback 진입 시마다 카운트한다.
 * migration + strip 이 완료되어 raw read 가 0 임을 실측하기 전에는
 * fallback / HistoryEntry.data deprecated field / migrate adapter 를 삭제하지 않는다.
 */

let rawLegacyHistoryReadCount = 0;

export function getRawLegacyHistoryReadCount(): number {
  return rawLegacyHistoryReadCount;
}

export function resetRawLegacyHistoryReadCount(): void {
  rawLegacyHistoryReadCount = 0;
}

export function recordRawLegacyHistoryRead(reason: string): void {
  rawLegacyHistoryReadCount += 1;
  if (import.meta.env?.DEV) {
    console.debug(
      `[history] raw legacy read (${reason}) → ${rawLegacyHistoryReadCount}`,
    );
  }
}
