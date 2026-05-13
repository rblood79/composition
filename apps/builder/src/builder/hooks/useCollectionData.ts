import { useAsyncList } from "react-stately";
import { useMemo, useState, useCallback, useEffect } from "react";
import type { DataBinding } from "../../types/builder/unified.types";
import type { AsyncListLoadOptions } from "../../types/builder/stately.types";
import { useDataTableStore } from "../stores/datatable";
import { useCollections, useApiEndpoints, useDataStore } from "../stores/data";
import { useRuntimeStore } from "../../preview/store/runtimeStore";
import { collectionDataCache, createCacheKey } from "./useCollectionDataCache";
import { asPropertyBinding, normalizeApiResponse } from "@composition/shared";

/**
 * Collection 데이터 바인딩을 위한 공통 Hook
 *
 * ADR-132 Phase 1 — useAsyncList load callback 단일화.
 * PropertyDataBinding (source="api"/"dataTable") + Legacy collection 모두
 * `useAsyncList.load` 안에서 분기 처리. `collections.runtimeData` 가 단일 sink.
 *
 * DataTable Store 지원:
 * - datatableId가 있으면 DataTable Store에서 데이터를 가져옵니다.
 * - dataBinding이 있으면 직접 데이터를 로드합니다.
 * - 둘 다 있으면 datatableId가 우선합니다.
 */

export interface UseCollectionDataOptions {
  /** 데이터 바인딩 설정 */
  dataBinding?: DataBinding;
  /** 컴포넌트 이름 (디버깅용) */
  componentName: string;
  /** Mock API 실패 시 사용할 기본 데이터 */
  fallbackData?: Record<string, unknown>[];
  /** DataTable ID (dataBinding 대신 사용) */
  datatableId?: string;
  /** 컴포넌트 ID (DataTable consumer 등록용) */
  elementId?: string;
}

/** DataTable 스키마 필드 타입 */
export interface SchemaField {
  key: string;
  type: string;
  label?: string;
}

export interface UseCollectionDataResult {
  /** 가져온 데이터 배열 */
  data: Record<string, unknown>[];
  /** 로딩 상태 */
  loading: boolean;
  /** 에러 메시지 (없으면 null) */
  error: string | null;
  /** 데이터 재로드 */
  reload: () => void;
  /** 캐시 삭제 (이 바인딩의 캐시만 삭제) */
  clearCache: () => void;
  /** DataTable 스키마 정보 (Field 자동 생성용) */
  schema?: SchemaField[];
  /** 정렬 함수 */
  sort?: (descriptor: {
    column: string;
    direction: "ascending" | "descending";
  }) => void;
  /** 필터 텍스트 */
  filterText?: string;
  /** 필터 텍스트 설정 */
  setFilterText?: (text: string) => void;
  /** 더 많은 데이터 로드 (페이지네이션) */
  loadMore?: () => void;
  /** 더 로드할 데이터가 있는지 여부 */
  hasMore?: boolean;
}

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
      const { apiConfig } = await import("../../services/api");
      const mockFetch = apiConfig.MOCK_DATA;

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
  // DataTable Store 접근
  const datatableState = useDataTableStore((state) =>
    datatableId ? state.dataTableStates.get(datatableId) : undefined,
  );
  const addConsumer = useDataTableStore((state) => state.addConsumer);
  const removeConsumer = useDataTableStore((state) => state.removeConsumer);
  const loadDataTable = useDataTableStore((state) => state.loadDataTable);

  // Canvas 컨텍스트 감지 (iframe 내부인지 확인)
  const isCanvasContext = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.parent !== window;
  }, []);

  // DataTable Store 접근 (PropertyDataBinding 형식 지원)
  // Canvas에서는 runtime store, Builder에서는 builder store 사용
  const builderDataTables = useCollections();
  const canvasDataTables = useRuntimeStore((state) => state.collections);
  const collections = isCanvasContext ? canvasDataTables : builderDataTables;

  // ApiEndpoint Store 접근 (PropertyDataBinding 형식 지원)
  // Canvas에서는 runtime store, Builder에서는 builder store 사용
  const builderApiEndpoints = useApiEndpoints();
  const canvasApiEndpoints = useRuntimeStore((state) => state.apiEndpoints);
  const apiEndpoints = isCanvasContext
    ? canvasApiEndpoints
    : builderApiEndpoints;
  const executeApiEndpoint = useDataStore((state) => state.executeApiEndpoint);

  // collections Map reference — 변경 시 list.reload trigger 용 (R1/R3 — Map immutable update 시에만 새 reference)
  const dataTablesMap = useDataStore((state) => state.collections);

  // DataTable consumer 등록/해제
  useEffect(() => {
    if (datatableId && elementId) {
      addConsumer(datatableId, elementId);

      // DataTable이 아직 로드되지 않았으면 로드
      if (!datatableState || datatableState.status === "idle") {
        loadDataTable(datatableId);
      }

      return () => {
        removeConsumer(datatableId, elementId);
      };
    }
  }, [
    datatableId,
    elementId,
    addConsumer,
    removeConsumer,
    loadDataTable,
    datatableState,
  ]);

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
      const table = collections.find((dt) => dt.name === propertyBinding.name);
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
    return null;
  }, [propertyBinding, collections]);

  const list = useAsyncList<Record<string, unknown>>({
    async load({ signal }: AsyncListLoadOptions) {
      if (propertyBinding) {
        if (propertyBinding.source === "dataTable") {
          // sync useMemo (dataTableResult) 가 processedData 1번 tier 처리.
          return { items: [] };
        }

        if (propertyBinding.source === "api" && propertyBinding.name) {
          const endpoint = apiEndpoints.find(
            (ep) => ep.name === propertyBinding.name,
          );
          if (!endpoint) {
            throw new Error(
              `API Endpoint '${propertyBinding.name}'을 찾을 수 없습니다`,
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
            // Builder: executeApiEndpoint 호출 (collections.runtimeData sink)
            result = await executeApiEndpoint(endpoint.id);
          }

          const items = normalizeApiResponse(result);
          if (cacheKey) {
            collectionDataCache.set(cacheKey, items);
          }

          return { items };
        }

        return { items: [] };
      }

      // datatableId가 있으면 DataTable Store에서 데이터 사용 (useAsyncList 스킵)
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
          items = await loadApiData(dataBinding, fallbackData, signal);
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

  // R1/R3 대응 — collections 변경 시 api binding list.reload trigger
  const isApiBinding = propertyBinding?.source === "api";
  const isDataTableBinding = propertyBinding?.source === "dataTable";

  useEffect(() => {
    if (isApiBinding) {
      list.reload();
    }
    // list 는 stable instance, dependency 에서 제외 (eslint-disable)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataTablesMap, isApiBinding]);

  // 정렬 함수
  const sort = useCallback(
    (descriptor: { column: string; direction: "ascending" | "descending" }) => {
      setSortDescriptor(descriptor);
    },
    [],
  );

  // 필터링 및 정렬된 데이터
  const processedData = useMemo(() => {
    // 데이터 소스 우선순위: DataTable (sync) > AsyncList (api/legacy) > DataTable Store
    const dataTableData = dataTableResult?.data;
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
    dataTableResult,
  ]);

  // 페이지네이션 지원 (향후 구현)
  const loadMore = undefined;
  const hasMore = false;

  // reload 함수
  const reload = useCallback(() => {
    if (datatableId) {
      loadDataTable(datatableId);
      return;
    }
    if (
      propertyBinding &&
      propertyBinding.source === "api" &&
      propertyBinding.name
    ) {
      const cacheKey = createCacheKey(stableDataBinding);
      if (cacheKey) {
        collectionDataCache.invalidate(cacheKey);
      }
      list.reload();
      return;
    }
    list.reload();
  }, [datatableId, loadDataTable, list, propertyBinding, stableDataBinding]);

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
  }, [
    refreshMode,
    refreshInterval,
    propertyBindingFormat,
    stableDataBinding,
    reload,
    componentName,
  ]);

  const isDataTablePending = isDataTableBinding && collections.length === 0;

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
      : !dataTableResult && stableDataBinding && !isDataTablePending
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
    schema: dataTableResult?.schema,
    sort,
    filterText,
    setFilterText,
    loadMore,
    hasMore,
  };
}

// 캐시 인스턴스 및 유틸리티 export (전역 캐시 관리용)
export { collectionDataCache, createCacheKey };
