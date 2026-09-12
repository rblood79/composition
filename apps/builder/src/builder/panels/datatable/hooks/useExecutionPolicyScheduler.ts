/**
 * ADR-218 Phase 3 — 실행 정책 런타임 (interval).
 *
 * `executionPolicy.mode === "interval"` collection 을 대상으로 **자기 재예약** setTimeout 을
 * 건다 (고정 setInterval + 매 tick abort 금지, h2/HC6): 한 번 실행이 끝난 뒤에야 다음 tick 을
 * N초 뒤로 예약하고(응답시간 > 주기여도 성공 응답 기회 보장), 진행 중이면 skip(coalesce).
 * 정리 훅으로 타이머 leak 0 (R6).
 *
 * effect dep 은 **정책 시그니처**(collection·주기·endpoint) 다 — runtimeData 갱신 같은 데이터
 * 변경으로는 재스케줄하지 않는다(타이머 리셋 방지). auto/manual 은 이 훅 대상이 아니다.
 */
import { useEffect, useMemo } from "react";
import { useDataStore } from "../../../stores/data";
import type { ApiEndpoint } from "../../../../types/builder/data.types";

function findLinkedEndpoint(
  endpoints: ApiEndpoint[],
  collectionId: string,
  collectionName: string,
): ApiEndpoint | undefined {
  return endpoints.find(
    (e) =>
      e.targetCollectionId === collectionId ||
      (!e.targetCollectionId && e.targetCollection === collectionName),
  );
}

export function useExecutionPolicyScheduler(): void {
  const collections = useDataStore((s) => s.collections);
  const apiEndpoints = useDataStore((s) => s.apiEndpoints);
  const executeApiEndpoint = useDataStore((s) => s.executeApiEndpoint);

  // 정책 시그니처 — interval collection 의 (id·주기·endpoint id) 만. 데이터 변경엔 불변.
  const scheduleSignature = useMemo(() => {
    const endpoints = Array.from(apiEndpoints.values());
    const parts: string[] = [];
    for (const c of collections.values()) {
      if (c.executionPolicy?.mode !== "interval") continue;
      const ep = findLinkedEndpoint(endpoints, c.id, c.name);
      const sec = c.executionPolicy.intervalSec ?? 30;
      if (ep && sec > 0) parts.push(`${c.id}:${sec}:${ep.id}`);
    }
    return parts.sort().join("|");
  }, [collections, apiEndpoints]);

  useEffect(() => {
    if (scheduleSignature === "") return;
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    let cancelled = false;

    const scheduleNext = (
      collectionId: string,
      endpointId: string,
      sec: number,
    ) => {
      const timer = setTimeout(async () => {
        if (cancelled) return;
        // coalesce — 진행 중이면 이번 tick 은 건너뛴다 (abort 하지 않는다).
        const inFlight = useDataStore.getState().loadingApis.has(endpointId);
        if (!inFlight) {
          try {
            await executeApiEndpoint(endpointId);
          } catch {
            // 실행 실패는 다음 tick 에서 재시도 (스케줄 유지).
          }
        }
        if (cancelled) return;
        // 완료 후에야 다음 tick 재예약 (겹치지 않음).
        scheduleNext(collectionId, endpointId, sec);
      }, sec * 1000);
      timers.set(collectionId, timer);
    };

    // 시그니처 파싱 — "id:sec:endpointId" 조합
    for (const part of scheduleSignature.split("|")) {
      const [collectionId, secStr, endpointId] = part.split(":");
      const sec = Number(secStr);
      if (collectionId && endpointId && sec > 0)
        scheduleNext(collectionId, endpointId, sec);
    }

    return () => {
      cancelled = true;
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, [scheduleSignature, executeApiEndpoint]);
}
