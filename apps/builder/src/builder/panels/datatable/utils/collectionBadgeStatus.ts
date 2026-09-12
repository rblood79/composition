/**
 * collectionBadgeStatus — collection 의 표시 상태(행 수 · normal/empty/error)를 한 곳에서 계산.
 *
 * 목록 배지(DataTableList) · 편집기 상단 · 캔버스 바인딩 배지(ADR-212 Phase 6) 가 **같은 값**을
 * 쓰도록 하는 SSOT. 순수 함수 — store 를 모른다 (collections/apiEndpoints/apiRuns 를 인자로 받음).
 */
import type {
  ApiEndpoint,
  ApiRunRecord,
  DataTable,
} from "../../../../types/builder/data.types";

/** DataTable 에 연결된 API Endpoint — id 우선 (ADR-152 v2.1) · 이름 fallback */
export function findLinkedApi(
  table: Pick<DataTable, "id" | "name">,
  apiEndpoints: readonly ApiEndpoint[],
): ApiEndpoint | undefined {
  return (
    apiEndpoints.find((api) => api.targetCollectionId === table.id) ??
    apiEndpoints.find(
      (api) => !api.targetCollectionId && api.targetCollection === table.name,
    )
  );
}

export type CollectionBadgeState = "normal" | "empty" | "error";

export interface CollectionBadgeStatus {
  /** 표시 행 수 — mock 모드는 mockData, 아니면 runtimeData ?? mockData */
  rows: number;
  state: CollectionBadgeState;
  /** 연결된 API 의 마지막 실행 상태 코드 (error 일 때) */
  errorStatus?: number | string;
  /** 연결된 API endpoint id (있으면) */
  linkedApiId?: string;
}

/**
 * 목록 배지와 동일한 규칙:
 * - rows = useMockData ? mockData.length : (runtimeData ?? mockData).length
 * - error = 연결 API 의 마지막 실행이 실패(!ok)
 * - empty = rows === 0 (error 아닐 때)
 * error 가 empty 보다 우선한다.
 */
export function resolveCollectionBadgeStatus(
  table: DataTable,
  apiEndpoints: readonly ApiEndpoint[],
  apiRuns: ReadonlyMap<string, ApiRunRecord>,
): CollectionBadgeStatus {
  const linkedApi = findLinkedApi(table, apiEndpoints);
  const lastRun = linkedApi ? apiRuns.get(linkedApi.id) : undefined;
  const rows = table.useMockData
    ? (table.mockData?.length ?? 0)
    : (table.runtimeData?.length ?? table.mockData?.length ?? 0);
  const failed = !!lastRun && !lastRun.ok;
  const state: CollectionBadgeState = failed
    ? "error"
    : rows === 0
      ? "empty"
      : "normal";
  return {
    rows,
    state,
    ...(failed ? { errorStatus: lastRun.response?.status ?? "—" } : {}),
    ...(linkedApi ? { linkedApiId: linkedApi.id } : {}),
  };
}
