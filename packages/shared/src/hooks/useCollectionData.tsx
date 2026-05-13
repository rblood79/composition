/**
 * Collection Data Hook
 *
 * ADR-132 Phase 1 — useAsyncList load callback 단일 진입점.
 * PropertyDataBinding (source="api"/"dataTable") + Legacy collection 모두
 * `useAsyncList.load` 안에서 분기 처리. `data_tables.runtimeData` 가 단일 sink.
 *
 * DI 패턴을 통해 Builder와 Publish에서 다른 서비스 구현을 사용할 수 있습니다.
 *
 * @since 2025-01-02
 */

import { useMemo, useState, useCallback, useEffect } from "react";
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
  datatableId,
  elementId,
}: UseCollectionDataOptions): UseCollectionDataResult {
  // DI 서비스 접근
  const services = useCollectionDataServices();
  const {
    dataTableService,
    apiEndpointService,
    mockApiService,
    isCanvasContext,
  } = services;

  // DataTable 상태 조회
  const datatableState = datatableId
    ? dataTableService?.getDataTableState(datatableId)
    : undefined;

  // DataTable 목록 조회
  const dataTables = useMemo(
    () => dataTableService?.getDataTables() ?? [],
    [dataTableService],
  );

  // API Endpoint 목록 조회
  const apiEndpoints = useMemo(
    () => apiEndpointService?.getApiEndpoints() ?? [],
    [apiEndpointService],
  );

  // DataTable consumer 등록/해제
  useEffect(() => {
    if (datatableId && elementId && dataTableService) {
      dataTableService.addConsumer?.(datatableId, elementId);

      // DataTable이 아직 로드되지 않았으면 로드
      if (!datatableState || datatableState.status === "idle") {
        dataTableService.loadDataTable?.(datatableId);
      }

      return () => {
        dataTableService.removeConsumer?.(datatableId, elementId);
      };
    }
  }, [datatableId, elementId, dataTableService, datatableState]);

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

  const stableDataBinding = useMemo(() => dataBinding, [dataBindingKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // PropertyDataBinding 형식 감지 (source: 'dataTable', name: 'xxx')
  const propertyBindingFormat =
    stableDataBinding &&
    "source" in stableDataBinding &&
    "name" in stableDataBinding &&
    !("type" in stableDataBinding);

  // Auto-refresh 설정 추출
  const refreshMode = useMemo(() => {
    if (propertyBindingFormat) {
      const binding = stableDataBinding as unknown as { refreshMode?: string };
      return binding.refreshMode || "manual";
    }
    return "manual";
  }, [propertyBindingFormat, stableDataBinding]);

  const refreshInterval = useMemo(() => {
    if (propertyBindingFormat) {
      const binding = stableDataBinding as unknown as {
        refreshInterval?: number;
      };
      return binding.refreshInterval || 5000;
    }
    return 5000;
  }, [propertyBindingFormat, stableDataBinding]);

  // DataTable 바인딩인 경우 mockData와 schema 직접 반환 (sync read)
  const dataTableResult = useMemo(() => {
    if (propertyBindingFormat) {
      const binding = stableDataBinding as unknown as {
        source: string;
        name: string;
      };
      if (binding.source === "dataTable" && binding.name) {
        const table = dataTables.find((dt) => dt.name === binding.name);
        if (table) {
          const hasRuntimeData =
            table.runtimeData && table.runtimeData.length > 0;
          const data = table.useMockData
            ? table.mockData
            : hasRuntimeData
              ? table.runtimeData
              : table.mockData;
          const schema: SchemaField[] = (table.schema || []).map((field) => ({
            key: field.key,
            type: field.type,
            label: field.label,
          }));
          return { data, schema };
        }
      }
    }
    return null;
  }, [propertyBindingFormat, dataTables, stableDataBinding]);

  const dataTableData = dataTableResult?.data || null;
  const dataTableSchema = dataTableResult?.schema;

  const list = useAsyncList<Record<string, unknown>>({
    async load({ signal }: AsyncListLoadOptions) {
      // PropertyDataBinding 형식 — source 별 분기
      if (propertyBindingFormat) {
        const binding = stableDataBinding as unknown as {
          source: string;
          name: string;
        };

        if (binding.source === "dataTable") {
          // sync useMemo (dataTableResult) 가 processedData 1번 tier 처리.
          return { items: [] };
        }

        if (binding.source === "api" && binding.name) {
          const endpoint = apiEndpoints.find((ep) => ep.name === binding.name);
          if (!endpoint) {
            throw new Error(
              `API Endpoint '${binding.name}'을 찾을 수 없습니다`,
            );
          }

          const cacheKey = createCacheKey(stableDataBinding);
          if (cacheKey) {
            const cachedData =
              collectionDataCache.get<Record<string, unknown>[]>(cacheKey);
            if (cachedData) {
              return { items: cachedData };
            }
          }

          let result: unknown;

          if (isCanvasContext) {
            // Canvas: proxy 직접 호출 (Phase 3 에서 통합 예정)
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
          } else {
            // Builder: apiEndpointService.executeApiEndpoint (data_tables.runtimeData sink)
            result = await apiEndpointService?.executeApiEndpoint?.(
              endpoint.id,
            );
          }

          // 결과 → items 배열 정규화
          let items: Record<string, unknown>[] = [];
          if (Array.isArray(result)) {
            items = result as Record<string, unknown>[];
          } else if (result && typeof result === "object") {
            const resultObj = result as Record<string, unknown>;
            if (Array.isArray(resultObj.results)) {
              items = resultObj.results as Record<string, unknown>[];
            } else if (Array.isArray(resultObj.data)) {
              items = resultObj.data as Record<string, unknown>[];
            } else if (Array.isArray(resultObj.items)) {
              items = resultObj.items as Record<string, unknown>[];
            } else {
              items = [resultObj];
            }
          }

          if (cacheKey) {
            collectionDataCache.set(cacheKey, items);
          }

          return { items };
        }

        return { items: [] };
      }

      // datatableId가 있으면 DataTable Store에서 데이터 사용
      if (datatableId) {
        return { items: [] };
      }

      // Legacy collection 흐름
      if (!dataBinding || dataBinding.type !== "collection") {
        return { items: [] };
      }

      try {
        let items: Record<string, unknown>[] = [];

        if (dataBinding.source === "static") {
          items = await loadStaticData(dataBinding);
        } else if (dataBinding.source === "api") {
          items = await loadApiData(
            dataBinding,
            fallbackData,
            signal,
            mockApiService,
          );
        } else if (dataBinding.source === "supabase") {
          throw new Error("Supabase data binding not yet implemented");
        } else {
          throw new Error(`Unknown data source: ${dataBinding.source}`);
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

  // R1/R3 대응 — dataTables 변경 시 api binding list.reload trigger
  useEffect(() => {
    const isApiBinding =
      propertyBindingFormat &&
      (stableDataBinding as unknown as { source: string }).source === "api";
    if (isApiBinding) {
      list.reload();
    }
    // list 는 stable instance, dependency 에서 제외 (eslint-disable)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataTables, propertyBindingFormat, stableDataBinding]);

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
    let sourceData: Record<string, unknown>[];

    if (dataTableData && dataTableData.length > 0) {
      sourceData = dataTableData;
    } else if (datatableId && datatableState) {
      sourceData = datatableState.data;
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
  }, [
    list.items,
    filterText,
    sortDescriptor,
    datatableId,
    datatableState,
    dataTableData,
  ]);

  // 페이지네이션 지원 (향후 구현)
  const loadMore = undefined;
  const hasMore = false;

  // reload 함수
  const reload = useCallback(() => {
    if (datatableId && dataTableService) {
      dataTableService.loadDataTable?.(datatableId);
      return;
    }
    if (propertyBindingFormat) {
      const binding = stableDataBinding as unknown as {
        source: string;
        name: string;
      };
      if (binding.source === "api" && binding.name) {
        const cacheKey = createCacheKey(stableDataBinding);
        if (cacheKey) {
          collectionDataCache.invalidate(cacheKey);
        }
        list.reload();
        return;
      }
    }
    list.reload();
  }, [
    datatableId,
    dataTableService,
    list,
    propertyBindingFormat,
    stableDataBinding,
  ]);

  // Auto-refresh 기능
  useEffect(() => {
    const isApiBinding =
      propertyBindingFormat &&
      (stableDataBinding as unknown as { source: string }).source === "api";

    if (!isApiBinding) return;

    if (refreshMode === "interval" && refreshInterval > 0) {
      const intervalId = setInterval(() => {
        reload();
      }, refreshInterval);

      return () => {
        clearInterval(intervalId);
      };
    }
  }, [
    refreshMode,
    refreshInterval,
    propertyBindingFormat,
    stableDataBinding,
    reload,
    componentName,
  ]);

  // 로딩/에러 상태
  const isApiBinding =
    propertyBindingFormat &&
    (stableDataBinding as unknown as { source: string }).source === "api";

  const isDataTableBinding =
    propertyBindingFormat &&
    (stableDataBinding as unknown as { source: string }).source === "dataTable";
  const isDataTablePending = isDataTableBinding && dataTables.length === 0;

  const loading = propertyBindingFormat
    ? isApiBinding
      ? list.isLoading
      : isDataTablePending
    : datatableId
      ? datatableState?.status === "loading"
      : list.isLoading;

  const error = propertyBindingFormat
    ? isApiBinding
      ? list.error
        ? list.error.message
        : null
      : dataTableData === null && stableDataBinding && !isDataTablePending
        ? `DataTable을 찾을 수 없습니다`
        : null
    : datatableId
      ? datatableState?.error || null
      : list.error
        ? list.error.message
        : null;

  // 캐시 삭제 함수
  const clearCache = useCallback(() => {
    const cacheKey = createCacheKey(stableDataBinding);
    if (cacheKey) {
      collectionDataCache.invalidate(cacheKey);
    }
  }, [stableDataBinding]);

  return {
    data: processedData,
    loading: loading ?? false,
    error,
    reload,
    clearCache,
    schema: dataTableSchema,
    sort,
    filterText,
    setFilterText,
    loadMore,
    hasMore,
  };
}

// 캐시 인스턴스 및 유틸리티 export
export { collectionDataCache, createCacheKey };
