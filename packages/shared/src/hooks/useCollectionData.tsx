/**
 * Collection Data Hook
 *
 * ADR-132 Phase 1 — useAsyncList load callback 단일 진입점.
 * PropertyDataBinding (source="api"/"dataTable") + Legacy collection 모두
 * `useAsyncList.load` 안에서 분기 처리. `collections.runtimeData` 가 단일 sink.
 *
 * DI 패턴을 통해 Builder와 Publish에서 다른 서비스 구현을 사용할 수 있습니다.
 *
 * @since 2025-01-02
 */

import { resolveCollectionSnapshot } from "../collections/collectionSnapshot";
import { registerFieldIds } from "@composition/specs";
import { resolveBoundCollection } from "../collections/resolveBoundCollection";
import { normalizeDataBinding } from "../collections/normalizeDataBinding";
import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useAsyncList } from "react-stately";
import type {
  DataBinding,
  UseCollectionDataOptions,
  UseCollectionDataResult,
  SchemaField,
  AsyncListLoadOptions,
} from "../types";
import { useCollectionDataServices } from "./collectionDataContext";
import { collectionDataCache, createCacheKey } from "./useCollectionDataCache";

// ============================================
// Data Loading Functions
// ============================================

/**
 * Static 데이터 로드 함수
 */
async function loadStaticData(
  dataBinding: DataBinding,
): Promise<Record<string, unknown>[]> {
  const staticConfig = dataBinding.config as { data?: unknown[] };
  const staticData = staticConfig.data;

  if (staticData && Array.isArray(staticData)) {
    return staticData as Record<string, unknown>[];
  } else {
    throw new Error("Static data is not an array or is missing");
  }
}

/**
 * API 데이터 로드 함수
 */
async function loadApiData(
  dataBinding: DataBinding,
  fallbackData: Record<string, unknown>[],
  signal: AbortSignal,
  mockApiService?: {
    mockFetch?: (
      endpoint: string,
      params?: Record<string, unknown>,
    ) => Promise<unknown>;
  },
): Promise<Record<string, unknown>[]> {
  const config = dataBinding.config as {
    baseUrl?: string;
    customUrl?: string;
    endpoint?: string;
    method?: string;
    headers?: Record<string, string>;
    params?: Record<string, unknown>;
    dataMapping?: {
      resultPath?: string;
      idKey?: string;
      totalKey?: string;
    };
  };

  if (!config.baseUrl || !config.endpoint) {
    throw new Error("API configuration is incomplete");
  }

  // MOCK_DATA 특별 처리
  if (config.baseUrl === "MOCK_DATA") {
    try {
      const mockFetch = mockApiService?.mockFetch;

      if (mockFetch) {
        const responseData = await mockFetch(
          config.endpoint || "/data",
          config.params,
        );

        // resultPath가 있으면 해당 경로의 데이터 추출
        const resultData = config.dataMapping?.resultPath
          ? (responseData as Record<string, unknown>)[
              config.dataMapping.resultPath
            ]
          : responseData;

        const finalData = Array.isArray(resultData)
          ? (resultData as Record<string, unknown>[])
          : [];

        return finalData;
      } else {
        throw new Error("Mock API function not found");
      }
    } catch (err) {
      // Fallback 데이터 사용
      if (fallbackData.length > 0) {
        return fallbackData;
      }
      throw err;
    }
  }

  // Base URL 매핑 (APICollectionEditor와 동일한 매핑)
  let resolvedBaseUrl = config.baseUrl || "";
  switch (config.baseUrl) {
    case "JSONPLACEHOLDER":
      resolvedBaseUrl = "https://jsonplaceholder.typicode.com";
      break;
    case "DUMMYJSON":
      resolvedBaseUrl = "https://dummyjson.com";
      break;
    case "CUSTOM":
      resolvedBaseUrl = config.customUrl || "";
      break;
    // MOCK_DATA는 위에서 이미 처리됨
  }

  const fullUrl = `${resolvedBaseUrl}${config.endpoint}`;

  // 실제 REST API 호출
  const response = await fetch(fullUrl, {
    method: config.method || "GET",
    headers: {
      ...config.headers,
      "Content-Type": "application/json",
    },
    body: config.method !== "GET" ? JSON.stringify(config.params) : undefined,
    signal, // AbortController signal 전달
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const responseData = await response.json();

  // resultPath가 있으면 해당 경로의 데이터 추출
  const resultData = config.dataMapping?.resultPath
    ? responseData[config.dataMapping.resultPath]
    : responseData;

  const finalData = Array.isArray(resultData)
    ? (resultData as Record<string, unknown>[])
    : [];

  return finalData;
}

// ============================================
// PropertyDataBinding helpers (ADR-132 Phase 1 후속 simplify)
// ============================================

/** PropertyDataBinding 정규형 — Legacy `DataBinding ({ type: "collection" })` 와 disjoint */
export interface PropertyDataBindingShape {
  source: string;
  name: string;
  refreshMode?: string;
  refreshInterval?: number;
}

/** PropertyDataBinding 형식 type guard — `{ source, name }` (Legacy `{ type: "collection" }` 와 구분) */
export function isPropertyBinding(
  binding: unknown,
): binding is PropertyDataBindingShape {
  return (
    typeof binding === "object" &&
    binding !== null &&
    "source" in binding &&
    "name" in binding &&
    !("type" in binding)
  );
}

/** PropertyDataBinding 으로 cast 한 view 반환 (DataBinding union 과 충돌하는 source enum narrow 우회용) */
export function asPropertyBinding(
  binding: unknown,
): PropertyDataBindingShape | null {
  return isPropertyBinding(binding)
    ? (binding as unknown as PropertyDataBindingShape)
    : null;
}

/** API fetch 결과를 `Record<string, unknown>[]` 로 정규화. results/data/items 우선순위 fallback. */
export function normalizeApiResponse(
  result: unknown,
): Record<string, unknown>[] {
  if (Array.isArray(result)) {
    return result as Record<string, unknown>[];
  }
  if (result && typeof result === "object") {
    const obj = result as Record<string, unknown>;
    if (Array.isArray(obj.results))
      return obj.results as Record<string, unknown>[];
    if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
    if (Array.isArray(obj.items)) return obj.items as Record<string, unknown>[];
    return [obj];
  }
  return [];
}

// ============================================
// Hook
// ============================================

/**
 * Collection 데이터 바인딩 Hook
 *
 * ADR-132 Phase 1 — `useAsyncList.load` 단일 진입점.
 * Phase 3 에서 Canvas iframe 의 `isCanvasContext` 분기 통합 예정.
 */
export function useCollectionData({
  dataBinding,
  componentName,
  fallbackData = [],
}: UseCollectionDataOptions): UseCollectionDataResult {
  // DI 서비스 접근
  const services = useCollectionDataServices();
  const {
    dataTableService,
    apiEndpointService,
    mockApiService,
    isCanvasContext,
  } = services;

  // DataTable 목록 조회
  const collections = useMemo(
    () => dataTableService?.getDataTables() ?? [],
    [dataTableService],
  );

  // API Endpoint 목록 조회
  const apiEndpoints = useMemo(
    () => apiEndpointService?.getApiEndpoints() ?? [],
    [apiEndpointService],
  );

  // 정렬 상태
  const [sortDescriptor, setSortDescriptor] = useState<{
    column: string;
    direction: "ascending" | "descending";
  } | null>(null);

  // 필터 상태
  const [filterText, setFilterText] = useState<string>("");

  // dataBinding 안정화: 내용 기반으로 메모이제이션
  const dataBindingKey = useMemo(() => {
    if (!dataBinding) return "";
    try {
      return JSON.stringify(dataBinding);
    } catch {
      return String(dataBinding);
    }
  }, [dataBinding]);

  // ADR-152 Phase 5: legacy `{ type:"collection" }` 가 collection 을 가리키면 v2 로 올린다 —
  //   아래 propertyBinding 경로 (resolveBoundCollection) 하나로 읽는다. inline static/api 는 그대로.
  const stableDataBinding = useMemo(
    () => normalizeDataBinding(dataBinding) as typeof dataBinding,
    [dataBindingKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const propertyBinding = asPropertyBinding(stableDataBinding);
  const propertyBindingFormat = propertyBinding !== null;

  const refreshMode = propertyBinding?.refreshMode || "manual";
  const refreshInterval = propertyBinding?.refreshInterval || 5000;

  // DataTable 바인딩인 경우 mockData와 schema 직접 반환 (sync read)
  const dataTableResult = useMemo(() => {
    if (
      propertyBinding &&
      propertyBinding.source === "dataTable" &&
      propertyBinding.name
    ) {
      // ADR-152 v2: collectionId 우선 · name fallback — 단일 헬퍼 (rename-safe).
      const table = resolveBoundCollection(propertyBinding, collections);
      if (table) {
        // 렌더용 resolve 지점 — `{#id}` 템플릿 · 차트 `#id` 참조 색인 등록 (ADR-152 1b).
        registerFieldIds(table.schema);
        const snapshot = resolveCollectionSnapshot(table);
        const schema: SchemaField[] = (table.schema || []).map((field) => ({
          id: field.id,
          key: field.key,
          type: field.type,
          label: field.label,
        }));
        return { ...snapshot, schema };
      }
    }
    return null;
  }, [propertyBinding, collections]);

  // 이름이 같아도 endpoint 정의/id가 바뀌면 이전 source 캐시를 소비하지 않는다.
  const boundEndpoint =
    propertyBinding?.source === "api"
      ? (resolveBoundCollection(propertyBinding, apiEndpoints) ?? undefined)
      : undefined;
  const bindingCacheKey = `${createCacheKey(stableDataBinding)}${boundEndpoint ? `:${JSON.stringify(boundEndpoint)}` : ""}`;

  const list = useAsyncList<Record<string, unknown>>({
    async load({ signal }: AsyncListLoadOptions) {
      if (propertyBinding) {
        if (propertyBinding.source === "dataTable") {
          // sync useMemo (dataTableResult) 가 processedData 1번 tier 처리.
          return { items: [] };
        }

        if (propertyBinding.source === "api" && propertyBinding.name) {
          const endpoint = resolveBoundCollection(
            propertyBinding,
            apiEndpoints,
          );
          if (!endpoint) {
            throw new Error(
              `API Endpoint '${propertyBinding.name}'을 찾을 수 없습니다`,
            );
          }

          const cacheKey = bindingCacheKey;
          if (cacheKey) {
            const cachedData =
              collectionDataCache.get<Record<string, unknown>[]>(cacheKey);
            if (cachedData) {
              return { items: cachedData };
            }
          }

          let result: unknown;

          if (isCanvasContext) {
            // Canvas: proxy 직접 호출 (Phase 3 에서 통합 예정 — Canvas DI 미보장)
            const url = `${endpoint.baseUrl}${endpoint.path}`;
            const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;

            const headers: Record<string, string> = {};
            if (endpoint.headers) {
              if (Array.isArray(endpoint.headers)) {
                endpoint.headers.forEach((h) => {
                  if (h.enabled) headers[h.key] = h.value;
                });
              } else {
                Object.assign(headers, endpoint.headers);
              }
            }

            const response = await fetch(proxyUrl, {
              method: endpoint.method || "GET",
              headers,
              signal,
            });

            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }

            result = await response.json();
          } else if (apiEndpointService?.executeApiEndpoint) {
            result = await apiEndpointService.executeApiEndpoint(
              endpoint.id,
              signal,
            );
          } else {
            throw new Error("API 실행 서비스가 연결되지 않았습니다");
          }

          const items = normalizeApiResponse(result);
          if (cacheKey) {
            collectionDataCache.set(cacheKey, items);
          }

          return { items };
        }

        return { items: [] };
      }

      // Legacy collection 흐름 — inline static · api 만 (collection 참조는 위 normalize 가 v2 로
      //   올렸다. datatableId 경로는 Phase 5 에서 제거 — 소비처 0, G0).
      const legacyBinding = stableDataBinding;
      if (!legacyBinding || legacyBinding.type !== "collection") {
        return { items: [] };
      }

      try {
        let items: Record<string, unknown>[] = [];

        if (legacyBinding.source === "static") {
          items = await loadStaticData(legacyBinding);
        } else if (legacyBinding.source === "api") {
          items = await loadApiData(
            legacyBinding,
            fallbackData,
            signal,
            mockApiService,
          );
        } else {
          throw new Error(`Unknown data source: ${legacyBinding.source}`);
        }

        return { items };
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return { items: [] };
        }
        throw error;
      }
    },
    getKey: (item) => String(item.id || Math.random()),
  });

  // R1/R3 대응 — collections 변경 시 api binding list.reload trigger
  const isApiBinding = propertyBinding?.source === "api";
  const isDataTableBinding = propertyBinding?.source === "dataTable";

  const loadedSource = useRef({ key: dataBindingKey, apiEndpoints });
  useEffect(() => {
    const previous = loadedSource.current;
    loadedSource.current = { key: dataBindingKey, apiEndpoints };
    if (
      previous.key !== dataBindingKey ||
      (isApiBinding && previous.apiEndpoints !== apiEndpoints)
    )
      list.reload();
    // useAsyncList.load가 현재 signal을 취소하고 새 source를 로드한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataBindingKey, apiEndpoints, isApiBinding]);

  // 정렬 함수
  const sort = useCallback(
    (descriptor: { column: string; direction: "ascending" | "descending" }) => {
      setSortDescriptor(descriptor);
    },
    [],
  );

  // 필터링 및 정렬된 데이터
  const processedData = useMemo(() => {
    // 우선순위: DataTable (sync) > DataTable Store > AsyncList (api/legacy)
    const dataTableData = dataTableResult?.data;
    let sourceData: Record<string, unknown>[];

    if (dataTableData) {
      sourceData = dataTableData;
    } else {
      sourceData = list.items;
    }

    let result = [...sourceData];

    // 필터링 적용
    if (filterText.trim()) {
      const lowerFilterText = filterText.toLowerCase();
      result = result.filter((item) => {
        return Object.values(item).some((value) =>
          String(value).toLowerCase().includes(lowerFilterText),
        );
      });
    }

    // 정렬 적용
    if (sortDescriptor) {
      result.sort((a, b) => {
        const aVal = a[sortDescriptor.column] as string | number;
        const bVal = b[sortDescriptor.column] as string | number;

        let comparison = 0;
        if (aVal < bVal) {
          comparison = -1;
        } else if (aVal > bVal) {
          comparison = 1;
        }

        return sortDescriptor.direction === "descending"
          ? -comparison
          : comparison;
      });
    }

    return result;
  }, [list.items, filterText, sortDescriptor, dataTableResult]);

  // 페이지네이션 지원 (향후 구현)
  const loadMore = undefined;
  const hasMore = false;

  // reload 함수
  const reload = useCallback(() => {
    if (
      propertyBinding &&
      propertyBinding.source === "api" &&
      propertyBinding.name
    ) {
      const cacheKey = bindingCacheKey;
      if (cacheKey) {
        collectionDataCache.invalidate(cacheKey);
      }
      list.reload();
      return;
    }
    list.reload();
  }, [list, propertyBinding, stableDataBinding, bindingCacheKey]);

  // Auto-refresh 기능
  useEffect(() => {
    if (!isApiBinding) return;

    if (refreshMode === "interval" && refreshInterval > 0) {
      const intervalId = setInterval(() => {
        reload();
      }, refreshInterval);

      return () => {
        clearInterval(intervalId);
      };
    }
  }, [refreshMode, refreshInterval, isApiBinding, reload, componentName]);

  const isDataTablePending =
    isDataTableBinding &&
    (!dataTableService ||
      dataTableResult?.status === "loading" ||
      dataTableResult?.status === "idle");

  const loading = propertyBindingFormat
    ? isApiBinding
      ? list.isLoading
      : isDataTablePending
    : list.isLoading;

  const error = propertyBindingFormat
    ? isApiBinding
      ? list.loadingState === "error" && list.error
        ? list.error.message
        : null
      : dataTableResult?.status === "error"
        ? dataTableResult.error || "데이터를 불러오지 못했습니다"
        : !dataTableResult && stableDataBinding && !isDataTablePending
          ? `DataTable을 찾을 수 없습니다`
          : null
    : list.loadingState === "error" && list.error
        ? list.error.message
        : null;

  // 캐시 삭제 함수
  const clearCache = useCallback(() => {
    const cacheKey = bindingCacheKey;
    if (cacheKey) {
      collectionDataCache.invalidate(cacheKey);
    }
  }, [stableDataBinding, bindingCacheKey]);

  return {
    data: processedData,
    loading: loading ?? false,
    error,
    reload,
    clearCache,
    schema: dataTableResult?.schema,
    sort,
    filterText,
    setFilterText,
    loadMore,
    hasMore,
  };
}

// 캐시 인스턴스 및 유틸리티 export
export { collectionDataCache, createCacheKey };
