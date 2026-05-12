import { useEffect, useRef } from "react";
import type { DataBinding, PreviewElement, RenderContext } from "../types";
import { getElementDataBinding } from "../utils/compositionExtensionFields";

/**
 * 데이터 로드 함수 (DataTable Store의 로직 재사용)
 */
async function fetchDataTableData(
  dataBinding: DataBinding,
  signal?: AbortSignal,
): Promise<Record<string, unknown>[]> {
  if (!dataBinding || dataBinding.type !== "collection") {
    return [];
  }

  // Static Collection 처리
  if (dataBinding.source === "static") {
    const staticConfig = dataBinding.config as { data?: unknown[] };
    const staticData = staticConfig.data;

    if (staticData && Array.isArray(staticData)) {
      return staticData as Record<string, unknown>[];
    }
    throw new Error("Static data is not an array or is missing");
  }

  // API Collection 처리
  if (dataBinding.source === "api") {
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

    // MOCK_DATA는 개발 전용 - shared 패키지에서는 지원하지 않음
    if (config.baseUrl === "MOCK_DATA") {
      console.warn(
        "[DataTable] MOCK_DATA is not supported in shared package. Use static data instead.",
      );
      return [];
    }

    // 실제 REST API 호출
    const response = await fetch(
      `${config.baseUrl}${config.customUrl || config.endpoint}`,
      {
        method: config.method || "GET",
        headers: {
          ...config.headers,
          "Content-Type": "application/json",
        },
        body:
          config.method !== "GET" ? JSON.stringify(config.params) : undefined,
        signal,
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    const resultData = config.dataMapping?.resultPath
      ? responseData[config.dataMapping.resultPath]
      : responseData;

    return Array.isArray(resultData)
      ? (resultData as Record<string, unknown>[])
      : [];
  }

  throw new Error(`Unknown data source: ${dataBinding.source}`);
}

/**
 * DataTable 컴포넌트 Props
 */
interface DataTableComponentProps {
  element: PreviewElement;
  setDataState?: RenderContext["setDataState"];
}

/**
 * DataTable 컴포넌트 (비시각적)
 *
 * 데이터를 로드하고 Runtime Store에 저장합니다.
 * 다른 컴포넌트는 dataTableId를 통해 이 데이터를 참조할 수 있습니다.
 */
export function DataTableComponent({
  element,
  setDataState,
}: DataTableComponentProps) {
  // setDataState가 없으면 no-op
  const abortControllerRef = useRef<AbortController | null>(null);

  const props = element.props as {
    id?: string;
    name?: string;
    autoLoad?: boolean;
    refreshInterval?: number;
  };

  const dataTableId = props.id || element.id;
  const autoLoad = props.autoLoad !== false;
  const refreshInterval = props.refreshInterval;
  const dataBinding = getElementDataBinding(element, "legacy-only");

  // 데이터 로드
  useEffect(() => {
    if (!dataBinding || !autoLoad) {
      return;
    }

    // 이전 요청 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // 로딩 상태 설정
    setDataState?.(dataTableId, {
      loading: true,
      data: null,
      error: null,
    });

    console.log(`📊 [Canvas] DataTable loading: ${dataTableId}`);

    fetchDataTableData(dataBinding, abortController.signal)
      .then((data) => {
        if (!abortController.signal.aborted) {
          setDataState?.(dataTableId, {
            loading: false,
            data,
            error: null,
          });
          console.log(
            `✅ [Canvas] DataTable loaded: ${dataTableId} (${data.length} items)`,
          );
        }
      })
      .catch((error) => {
        if (!abortController.signal.aborted) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          setDataState?.(dataTableId, {
            loading: false,
            data: null,
            error: errorMessage,
          });
          console.error(
            `❌ [Canvas] DataTable error: ${dataTableId}`,
            errorMessage,
          );
        }
      });

    return () => {
      abortController.abort();
    };
  }, [dataTableId, dataBinding, autoLoad, setDataState]);

  // 자동 새로고침
  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0 || !dataBinding || !autoLoad) {
      return;
    }

    console.log(
      `⏱️ [Canvas] DataTable auto-refresh: ${dataTableId} every ${refreshInterval}ms`,
    );

    const intervalId = setInterval(() => {
      // 이전 요청 취소
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      fetchDataTableData(dataBinding, abortController.signal)
        .then((data) => {
          if (!abortController.signal.aborted) {
            setDataState?.(dataTableId, {
              loading: false,
              data,
              error: null,
            });
          }
        })
        .catch((error) => {
          if (!abortController.signal.aborted) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";
            setDataState?.(dataTableId, {
              loading: false,
              data: null,
              error: errorMessage,
            });
          }
        });
    }, refreshInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [dataTableId, dataBinding, autoLoad, refreshInterval, setDataState]);

  // 비시각적 컴포넌트 - UI 렌더링 없음
  return null;
}
