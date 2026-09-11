import { createCollectionEndpointExecutor } from "./executeCollectionEndpoint";
import type {
  ApiEndpointDefinition,
  CollectionDataServices,
  CollectionState,
  DataTableDefinition,
} from "../types/collection.types";

/** 런타임 값의 존재와 빈 성공을 구분한다. 이 정책은 Canvas와 모든 DOM collection이 공유한다. */
export function resolveCollectionSnapshot(
  table: Pick<
    DataTableDefinition,
    "mockData" | "runtimeData" | "useMockData" | "status" | "error"
  >,
): CollectionState {
  if (table.useMockData === true)
    return { data: table.mockData ?? [], status: "success" };
  if (table.status === "loading" || table.status === "error") {
    return { data: [], status: table.status, error: table.error };
  }
  return {
    data: table.runtimeData ?? table.mockData ?? [],
    status: table.status ?? "success",
    error: table.error,
  };
}

/**
 * ADR-152 Phase 6 — publish/export data snapshot 의 collection 형. 정의 (`schema` — `id` 포함,
 * `{#id}` · fieldMap · 차트 `#id` 참조가 publish 에서도 풀리도록) + `mockData` + `useMockData` 만.
 * `runtimeData` (빌더 세션의 API 응답, 메모리 전용) · 저장소 메타 (project_id · created_at …) 는
 * 싣지 않는다 — publish 는 API 를 스스로 실행하고 (`createCollectionEndpointExecutor`) 그 전에는
 * `resolveCollectionSnapshot` 이 mockData 로 폴백한다.
 */
export function toRuntimeCollection(
  table: DataTableDefinition,
): DataTableDefinition {
  const { id, name, schema, mockData, useMockData } = table;
  return {
    id,
    name,
    ...(schema !== undefined ? { schema } : {}),
    ...(mockData !== undefined ? { mockData } : {}),
    ...(useMockData !== undefined ? { useMockData } : {}),
  };
}

/** 저장소의 관리 메타데이터/서버 비밀 매핑은 runtime envelope에 복사하지 않는다. */
export function toRuntimeApiEndpoint(endpoint: ApiEndpointDefinition): ApiEndpointDefinition {
  const {id, name, baseUrl, path, method, headers, queryParams, bodyType, bodyTemplate,
    responseMapping, executionMode, timeout} = endpoint;
  return {id, name, baseUrl, path, method, headers, queryParams, bodyType, bodyTemplate,
    responseMapping, executionMode, timeout};
}

/** Preview/Publish의 기존 CollectionDataProvider에 제공하는 동일 snapshot adapter. */
export function createCollectionSnapshotServices(
  tables: DataTableDefinition[],
  endpoints: ApiEndpointDefinition[] = [],
): CollectionDataServices {
  return {
    dataTableService: {
      getDataTables: () => tables,
      getDataTableState: (id) => {
        const table = tables.find((item) => item.id === id || item.name === id);
        return table ? resolveCollectionSnapshot(table) : undefined;
      },
    },
    apiEndpointService: { getApiEndpoints: () => endpoints, executeApiEndpoint: createCollectionEndpointExecutor(endpoints) },
  };
}
