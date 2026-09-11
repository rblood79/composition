/**
 * Data Store Actions - Factory Pattern
 *
 * DataTable, ApiEndpoint, Variable의
 * CRUD 및 실행 액션을 독립적인 팩토리 함수로 분리
 *
 * ✅ IndexedDB 사용 (Supabase 대신)
 *
 * @see docs/features/DATA_PANEL_SYSTEM.md
 */

import type { StateCreator } from "zustand";
import { resolveResponseData } from "../../../utils/data/responseData";
import {
  normalizeCollection,
  normalizeCollectionMap,
} from "../../../utils/data/normalizeCollection";
import {
  resolveBoundCollection,
  resolveCollectionByName,
} from "@composition/shared";
import { getDB } from "../../../lib/db";
import type {
  DataTable,
  DataTableCreate,
  DataTableUpdate,
  ApiEndpoint,
  ApiEndpointCreate,
  ApiEndpointUpdate,
  Variable,
  VariableCreate,
  VariableUpdate,
  DataStoreState,
  DataStoreActions,
} from "../../../types/builder/data.types";
// 🚀 Phase 11: Feature Flags for WebGL-only mode
import {
  isWebGLCanvas,
  isCanvasCompareMode,
} from "../../../utils/featureFlags";

// Type aliases for set/get
type DataStore = DataStoreState & DataStoreActions;
type SetState = Parameters<StateCreator<DataStore>>[0];
type GetState = Parameters<StateCreator<DataStore>>[1];

// ============================================
// Canvas Sync Helper
// ============================================

/**
 * DataTables를 Canvas iframe에 동기화
 * UPDATE_DATA_TABLES 메시지를 통해 전체 DataTables 전송
 *
 * 🚀 Phase 11: WebGL-only 모드에서는 postMessage 스킵
 */
function syncCollectionsToCanvas(collections: Map<string, DataTable>): void {
  // 🚀 Phase 11: WebGL-only 모드에서는 iframe 통신 불필요
  const isWebGLOnly = isWebGLCanvas() && !isCanvasCompareMode();
  if (isWebGLOnly) return;

  try {
    // previewFrame ID로 Canvas iframe 찾기
    const iframe = document.getElementById("previewFrame") as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      const dataTablesArray = Array.from(collections.values()).map((dt) => ({
        id: dt.id,
        name: dt.name,
        schema: dt.schema,
        mockData: dt.mockData,
        runtimeData: dt.runtimeData,
        useMockData: dt.useMockData,
      }));

      iframe.contentWindow.postMessage(
        {
          type: "UPDATE_DATA_TABLES",
          collections: dataTablesArray,
        },
        "*",
      );
    }
  } catch (error) {
    console.warn("⚠️ Canvas 동기화 실패:", error);
  }
}

type CollectionsDB = {
  collections?: {
    update: (id: string, updates: DataTableUpdate) => Promise<DataTable>;
  };
};

/**
 * `DataField.id` 가 새로 부여된 collection 의 schema 를 IndexedDB 에 되쓴다 (ADR-152 R8).
 * 프로젝트당 id 없는 collection N건 · 1회, 이후 로드는 0건. 개별 실패는 로드를
 * 막지 않는다 — 다음 로드에서 다시 부여·재시도된다 (같은 창에서는 메모리 id 로 동작).
 */
export async function writeBackAssignedFieldIds(
  db: unknown,
  assigned: readonly DataTable[],
): Promise<number> {
  const store = (db as CollectionsDB).collections;
  if (!store || assigned.length === 0) return 0;
  let written = 0;
  for (const dt of assigned) {
    try {
      await store.update(dt.id, { schema: dt.schema });
      written += 1;
    } catch (error) {
      console.warn(`⚠️ DataField.id write-back 실패 (${dt.name}):`, error);
    }
  }
  return written;
}

// ============================================
// DataTable Actions
// ============================================

/**
 * 프로젝트의 모든 DataTable을 가져오는 액션
 */
export const createFetchDataTablesAction =
  (set: SetState) =>
  async (projectId: string): Promise<void> => {
    set({ isLoading: true });

    try {
      const db = await getDB();
      const data =
        (await (
          db as unknown as {
            collections: {
              getByProject: (projectId: string) => Promise<DataTable[]>;
            };
          }
        ).collections?.getByProject(projectId)) || [];

      // ADR-152 HC7/HC8: 진입 경계 정규화 (DataField.id 부여) + **id 키** Map.
      const { collections: dataTablesMap, assigned } = normalizeCollectionMap(
        data || [],
      );

      set((state) => ({
        collections: dataTablesMap,
        isLoading: false,
        errors: new Map(state.errors),
      }));

      // 🆕 Canvas에 동기화 (기존 DataTable도 Canvas에 전송)
      syncCollectionsToCanvas(dataTablesMap);

      // id 가 새로 부여된 collection 만 hydrate 직후 1회 write-back (R8) — 참조 (문서)
      // 가 먼저 저장돼도 정의의 id 가 재생성되지 않게. 실패해도 로드는 유효하다 (경고만).
      await writeBackAssignedFieldIds(db, assigned);
    } catch (error) {
      console.error("❌ DataTable 목록 조회 실패:", error);
      set((state) => {
        const newErrors = new Map(state.errors);
        newErrors.set("fetchCollections", error as Error);
        return { errors: newErrors, isLoading: false };
      });
    }
  };

/**
 * 새 DataTable을 생성하는 액션
 */
export const createCreateDataTableAction =
  (set: SetState, get: GetState) =>
  async (data: DataTableCreate): Promise<DataTable> => {
    set({ isLoading: true });

    try {
      const db = await getDB();
      const newDataTable: DataTable = normalizeCollection({
        id: crypto.randomUUID(),
        name: data.name,
        project_id: data.project_id,
        schema: data.schema || [],
        mockData: data.mockData || [],
        useMockData: data.useMockData ?? true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).collection;

      await (
        db as unknown as {
          collections: { insert: (dt: DataTable) => Promise<DataTable> };
        }
      ).collections?.insert(newDataTable);

      // 메모리 상태 업데이트
      const { collections } = get();
      const newMap = new Map(collections);
      newMap.set(newDataTable.id, newDataTable);

      set({ collections: newMap, isLoading: false });

      // 🆕 Canvas에 동기화 (UPDATE_DATA_TABLES)
      syncCollectionsToCanvas(newMap);

      return newDataTable;
    } catch (error) {
      console.error("❌ DataTable 생성 실패:", error);
      set((state) => {
        const newErrors = new Map(state.errors);
        newErrors.set("createDataTable", error as Error);
        return { errors: newErrors, isLoading: false };
      });
      throw error;
    }
  };

/**
 * DataTable을 업데이트하는 액션
 *
 * ⚡ 개별 업데이트는 isLoading 표시 안함 (빠른 작업이므로)
 */
export const createUpdateDataTableAction =
  (set: SetState, get: GetState) =>
  async (id: string, updates: DataTableUpdate): Promise<void> => {
    try {
      const db = await getDB();
      // 새 필드 (편집기 "필드 추가") 는 id 없이 온다 — DB 에 쓰기 전에 부여 (HC7).
      const normalizedUpdates: DataTableUpdate = updates.schema
        ? {
            ...updates,
            schema: normalizeCollection({
              ...(get().collections.get(id) ?? ({} as DataTable)),
              schema: updates.schema,
            }).collection.schema,
          }
        : updates;
      await (
        db as unknown as {
          collections: {
            update: (
              id: string,
              updates: DataTableUpdate,
            ) => Promise<DataTable>;
          };
        }
      ).collections?.update(id, normalizedUpdates);

      // 메모리 상태 업데이트 — id 키라 rename 시 re-key 없음 (HC8)
      const { collections } = get();
      const existing = collections.get(id);
      if (existing) {
        const newMap = new Map(collections);
        newMap.set(id, {
          ...existing,
          ...normalizedUpdates,
          updated_at: new Date().toISOString(),
        });
        set({ collections: newMap });
        // 🆕 Canvas에 동기화
        syncCollectionsToCanvas(newMap);
      }
    } catch (error) {
      console.error("❌ DataTable 업데이트 실패:", error);
      set((state) => {
        const newErrors = new Map(state.errors);
        newErrors.set("updateCollection", error as Error);
        return { errors: newErrors };
      });
      throw error;
    }
  };

/**
 * DataTable을 삭제하는 액션
 */
export const createDeleteDataTableAction =
  (set: SetState, get: GetState) =>
  async (id: string): Promise<void> => {
    set({ isLoading: true });

    try {
      const db = await getDB();

      // ⚠️ Optional chaining 제거하고 명시적 호출
      const dataTablesStore = (
        db as unknown as {
          collections: { delete: (id: string) => Promise<void> };
        }
      ).collections;

      if (!dataTablesStore) {
        throw new Error("collections store not found in database");
      }

      await dataTablesStore.delete(id);

      // 메모리 상태 업데이트
      const { collections } = get();
      const newMap = new Map(collections);
      newMap.delete(id);

      set({ collections: newMap, isLoading: false });

      // 🆕 Canvas에도 동기화 (삭제된 상태 반영)
      syncCollectionsToCanvas(newMap);
    } catch (error) {
      console.error("❌ DataTable 삭제 실패:", error);
      set((state) => {
        const newErrors = new Map(state.errors);
        newErrors.set("deleteCollection", error as Error);
        return { errors: newErrors, isLoading: false };
      });
      throw error;
    }
  };

/**
 * DataTable의 데이터를 가져오는 액션 (Mock 또는 Runtime)
 */
export const createGetDataTableDataAction =
  (get: GetState) =>
  (name: string): Record<string, unknown>[] => {
    const { collections } = get();
    // 이름 (또는 id) 으로 — 공개 시그니처는 name 유지, resolve 는 단일 헬퍼 (R11).
    const dataTable = resolveCollectionByName(
      name,
      Array.from(collections.values()),
    );

    if (!dataTable) {
      console.warn(`⚠️ DataTable "${name}" not found`);
      return [];
    }

    // useMockData가 true면 mockData 반환, 아니면 runtimeData 반환
    if (dataTable.useMockData) {
      return dataTable.mockData || [];
    }

    return dataTable.runtimeData || [];
  };

/**
 * DataTable의 런타임 데이터를 설정하는 액션
 */
export const createSetRuntimeDataAction =
  (set: SetState, get: GetState) =>
  (name: string, data: Record<string, unknown>[]): void => {
    const { collections } = get();
    const dataTable = resolveCollectionByName(
      name,
      Array.from(collections.values()),
    );

    if (!dataTable) {
      console.warn(`⚠️ DataTable "${name}" not found`);
      return;
    }

    const newMap = new Map(collections);
    newMap.set(dataTable.id, { ...dataTable, runtimeData: data });

    set({ collections: newMap });

    // 🆕 Canvas에 동기화
    syncCollectionsToCanvas(newMap);
  };

// ============================================
// ApiEndpoint Actions
// ============================================

/**
 * 프로젝트의 모든 ApiEndpoint을 가져오는 액션
 */
export const createFetchApiEndpointsAction =
  (set: SetState) =>
  async (projectId: string): Promise<void> => {
    set({ isLoading: true });

    try {
      const db = await getDB();
      const data =
        (await (
          db as unknown as {
            api_endpoints: {
              getByProject: (projectId: string) => Promise<ApiEndpoint[]>;
            };
          }
        ).api_endpoints?.getByProject(projectId)) || [];

      const apiEndpointsMap = new Map<string, ApiEndpoint>();
      (data || []).forEach((ep) => {
        apiEndpointsMap.set(ep.name, ep);
      });

      set((state) => ({
        apiEndpoints: apiEndpointsMap,
        isLoading: false,
        errors: new Map(state.errors),
      }));
    } catch (error) {
      console.error("❌ ApiEndpoint 목록 조회 실패:", error);
      set((state) => {
        const newErrors = new Map(state.errors);
        newErrors.set("fetchApiEndpoints", error as Error);
        return { errors: newErrors, isLoading: false };
      });
    }
  };

/**
 * 새 ApiEndpoint을 생성하는 액션
 */
export const createCreateApiEndpointAction =
  (set: SetState, get: GetState) =>
  async (data: ApiEndpointCreate): Promise<ApiEndpoint> => {
    set({ isLoading: true });

    try {
      const db = await getDB();
      const newApiEndpoint: ApiEndpoint = {
        id: crypto.randomUUID(),
        name: data.name,
        project_id: data.project_id,
        method: data.method,
        baseUrl: data.baseUrl,
        path: data.path,
        headers: data.headers || [],
        queryParams: data.queryParams || [],
        bodyType: data.bodyType || "none",
        bodyTemplate: data.bodyTemplate,
        // 빈 경로 = 응답 전체 (실행기가 배열을 자동 감지한다 — utils/data/responseData.ts)
        responseMapping: data.responseMapping || { dataPath: "" },
        targetCollection: data.targetCollection,
        executionMode: data.executionMode || "client",
        serverConfig: data.serverConfig,
        timeout: data.timeout || 30000,
        retryCount: data.retryCount || 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await (
        db as unknown as {
          api_endpoints: { insert: (ep: ApiEndpoint) => Promise<ApiEndpoint> };
        }
      ).api_endpoints?.insert(newApiEndpoint);

      // 메모리 상태 업데이트
      const { apiEndpoints } = get();
      const newMap = new Map(apiEndpoints);
      newMap.set(newApiEndpoint.name, newApiEndpoint);

      set({ apiEndpoints: newMap, isLoading: false });

      return newApiEndpoint;
    } catch (error) {
      console.error("❌ ApiEndpoint 생성 실패:", error);
      set((state) => {
        const newErrors = new Map(state.errors);
        newErrors.set("createApiEndpoint", error as Error);
        return { errors: newErrors, isLoading: false };
      });
      throw error;
    }
  };

/**
 * ApiEndpoint을 업데이트하는 액션
 *
 * ⚡ 개별 업데이트는 isLoading 표시 안함 (빠른 작업이므로)
 */
export const createUpdateApiEndpointAction =
  (set: SetState, get: GetState) =>
  async (id: string, updates: ApiEndpointUpdate): Promise<void> => {
    try {
      const db = await getDB();
      await (
        db as unknown as {
          api_endpoints: {
            update: (
              id: string,
              updates: ApiEndpointUpdate,
            ) => Promise<ApiEndpoint>;
          };
        }
      ).api_endpoints?.update(id, updates);

      // 메모리 상태 업데이트
      const { apiEndpoints } = get();
      const newMap = new Map(apiEndpoints);

      // ID로 ApiEndpoint 찾기
      let foundKey: string | undefined;
      apiEndpoints.forEach((ep, key) => {
        if (ep.id === id) foundKey = key;
      });

      if (foundKey) {
        const existing = newMap.get(foundKey)!;
        const updated = {
          ...existing,
          ...updates,
          updated_at: new Date().toISOString(),
        };

        // 이름이 변경된 경우 키도 업데이트
        if (updates.name && updates.name !== foundKey) {
          newMap.delete(foundKey);
          newMap.set(updates.name, updated);
        } else {
          newMap.set(foundKey, updated);
        }
      }

      set({ apiEndpoints: newMap });
    } catch (error) {
      console.error("❌ ApiEndpoint 업데이트 실패:", error);
      set((state) => {
        const newErrors = new Map(state.errors);
        newErrors.set("updateApiEndpoint", error as Error);
        return { errors: newErrors };
      });
      throw error;
    }
  };

/**
 * ApiEndpoint을 삭제하는 액션
 */
export const createDeleteApiEndpointAction =
  (set: SetState, get: GetState) =>
  async (id: string): Promise<void> => {
    set({ isLoading: true });

    try {
      const db = await getDB();
      await (
        db as unknown as {
          api_endpoints: { delete: (id: string) => Promise<void> };
        }
      ).api_endpoints?.delete(id);

      // 메모리 상태 업데이트
      const { apiEndpoints } = get();
      const newMap = new Map(apiEndpoints);

      // ID로 ApiEndpoint 찾아서 삭제
      apiEndpoints.forEach((ep, key) => {
        if (ep.id === id) newMap.delete(key);
      });

      set({ apiEndpoints: newMap, isLoading: false });
    } catch (error) {
      console.error("❌ ApiEndpoint 삭제 실패:", error);
      set((state) => {
        const newErrors = new Map(state.errors);
        newErrors.set("deleteApiEndpoint", error as Error);
        return { errors: newErrors, isLoading: false };
      });
      throw error;
    }
  };

/**
 * ApiEndpoint을 실행하는 액션
 */
export const createExecuteApiEndpointAction =
  (set: SetState, get: GetState) =>
  async (id: string, params?: Record<string, unknown>): Promise<unknown> => {
    const { apiEndpoints, loadingApis } = get();

    // ID로 ApiEndpoint 찾기
    let endpoint: ApiEndpoint | undefined;
    apiEndpoints.forEach((ep) => {
      if (ep.id === id) endpoint = ep;
    });

    if (!endpoint) {
      throw new Error(`ApiEndpoint not found: ${id}`);
    }

    // 로딩 상태 설정
    const newLoadingApis = new Set(loadingApis);
    newLoadingApis.add(id);
    set({ loadingApis: newLoadingApis });

    try {
      // URL 구성
      let url = `${endpoint.baseUrl}${endpoint.path}`;

      // Path 변수 치환 (예: /users/{{userId}})
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          url = url.replace(`{{${key}}}`, String(value));
        });
      }

      // Query Parameters 추가
      if (endpoint.queryParams.length > 0) {
        const searchParams = new URLSearchParams();
        endpoint.queryParams.forEach((qp) => {
          if (qp.key) {
            let value = qp.value;
            // 변수 치환
            if (params) {
              Object.entries(params).forEach(([key, val]) => {
                value = value.replace(`{{${key}}}`, String(val));
              });
            }
            searchParams.append(qp.key, value);
          }
        });
        const queryString = searchParams.toString();
        if (queryString) {
          url += `?${queryString}`;
        }
      }

      // Headers 구성
      const headers: Record<string, string> = {};
      endpoint.headers.forEach((h) => {
        if (h.enabled && h.key) {
          let value = h.value;
          // 변수 치환
          if (params) {
            Object.entries(params).forEach(([key, val]) => {
              value = value.replace(`{{${key}}}`, String(val));
            });
          }
          headers[h.key] = value;
        }
      });

      // Body 구성
      let body: string | undefined;
      if (endpoint.bodyType !== "none" && endpoint.bodyTemplate) {
        body = endpoint.bodyTemplate;
        // 변수 치환
        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            body = body!.replace(`{{${key}}}`, JSON.stringify(value));
          });
        }
      }

      // 개발 환경에서 외부 API 호출 시 프록시 사용 (CORS 우회)
      let fetchUrl = url;
      const isExternalUrl =
        url.startsWith("http://") || url.startsWith("https://");
      const isDevelopment = import.meta.env.DEV;

      if (isExternalUrl && isDevelopment) {
        fetchUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
      }

      // Timeout 설정 (AbortController 사용)
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        endpoint.timeout || 30000,
      );

      // Fetch 요청
      const response = await fetch(fetchUrl, {
        method: endpoint.method,
        headers,
        body,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // Response Mapping 적용 — 경로가 비었거나 배열을 못 가리키면 응답 자체 /
      // 관례 키 (results · data · items …) 에서 행 배열을 찾는다 (리서치 D1).
      const mappedData = resolveResponseData(
        result,
        endpoint.responseMapping?.dataPath,
      ).data;

      // Target DataTable에 데이터 설정
      if ((endpoint.targetCollectionId || endpoint.targetCollection) && mappedData) {
        const { collections } = get();
        // ADR-152 v2.1: targetCollectionId 우선 · targetCollection (이름) fallback
        const targetTable = resolveBoundCollection(
          {
            collectionId: endpoint.targetCollectionId,
            name: endpoint.targetCollection,
          },
          Array.from(collections.values()),
        );
        if (targetTable) {
          const newDataTables = new Map(collections);
          newDataTables.set(targetTable.id, {
            ...targetTable,
            runtimeData: Array.isArray(mappedData) ? mappedData : [mappedData],
          });
          set({ collections: newDataTables });

          // 🆕 Canvas에 동기화
          syncCollectionsToCanvas(newDataTables);
        }
      }

      return mappedData;
    } catch (error) {
      console.error(`❌ ApiEndpoint "${endpoint?.name}" 실행 실패:`, error);
      set((state) => {
        const newErrors = new Map(state.errors);
        newErrors.set(`executeApi_${id}`, error as Error);
        return { errors: newErrors };
      });
      throw error;
    } finally {
      // 로딩 상태 해제
      const currentLoadingApis = get().loadingApis;
      const updatedLoadingApis = new Set(currentLoadingApis);
      updatedLoadingApis.delete(id);
      set({ loadingApis: updatedLoadingApis });
    }
  };

// ============================================
// Variable Actions
// ============================================

/**
 * 프로젝트의 모든 Variable을 가져오는 액션
 */
export const createFetchVariablesAction =
  (set: SetState) =>
  async (projectId: string): Promise<void> => {
    set({ isLoading: true });

    try {
      const db = await getDB();
      const data =
        (await (
          db as unknown as {
            variables: {
              getByProject: (projectId: string) => Promise<Variable[]>;
            };
          }
        ).variables?.getByProject(projectId)) || [];

      const variablesMap = new Map<string, Variable>();
      (data || []).forEach((v) => {
        variablesMap.set(v.name, v);
      });

      set((state) => ({
        variables: variablesMap,
        isLoading: false,
        errors: new Map(state.errors),
      }));
    } catch (error) {
      console.error("❌ Variable 목록 조회 실패:", error);
      set((state) => {
        const newErrors = new Map(state.errors);
        newErrors.set("fetchVariables", error as Error);
        return { errors: newErrors, isLoading: false };
      });
    }
  };

/**
 * 새 Variable을 생성하는 액션
 */
export const createCreateVariableAction =
  (set: SetState, get: GetState) =>
  async (data: VariableCreate): Promise<Variable> => {
    set({ isLoading: true });

    try {
      const db = await getDB();
      const newVariable: Variable = {
        id: crypto.randomUUID(),
        name: data.name,
        project_id: data.project_id,
        type: data.type,
        defaultValue: data.defaultValue,
        persist: data.persist ?? false,
        scope: data.scope || "global",
        page_id: data.page_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await (
        db as unknown as {
          variables: { insert: (v: Variable) => Promise<Variable> };
        }
      ).variables?.insert(newVariable);

      // 메모리 상태 업데이트
      const { variables } = get();
      const newMap = new Map(variables);
      newMap.set(newVariable.name, newVariable);

      set({ variables: newMap, isLoading: false });

      return newVariable;
    } catch (error) {
      console.error("❌ Variable 생성 실패:", error);
      set((state) => {
        const newErrors = new Map(state.errors);
        newErrors.set("createVariable", error as Error);
        return { errors: newErrors, isLoading: false };
      });
      throw error;
    }
  };

/**
 * Variable을 업데이트하는 액션
 *
 * ⚡ 개별 업데이트는 isLoading 표시 안함 (빠른 작업이므로)
 */
export const createUpdateVariableAction =
  (set: SetState, get: GetState) =>
  async (id: string, updates: VariableUpdate): Promise<void> => {
    try {
      const db = await getDB();
      await (
        db as unknown as {
          variables: {
            update: (id: string, updates: VariableUpdate) => Promise<Variable>;
          };
        }
      ).variables?.update(id, updates);

      // 메모리 상태 업데이트
      const { variables } = get();
      const newMap = new Map(variables);

      // ID로 Variable 찾기
      let foundKey: string | undefined;
      variables.forEach((v, key) => {
        if (v.id === id) foundKey = key;
      });

      if (foundKey) {
        const existing = newMap.get(foundKey)!;
        const updated = {
          ...existing,
          ...updates,
          updated_at: new Date().toISOString(),
        };

        // 이름이 변경된 경우 키도 업데이트
        if (updates.name && updates.name !== foundKey) {
          newMap.delete(foundKey);
          newMap.set(updates.name, updated);
        } else {
          newMap.set(foundKey, updated);
        }
      }

      set({ variables: newMap });
    } catch (error) {
      console.error("❌ Variable 업데이트 실패:", error);
      set((state) => {
        const newErrors = new Map(state.errors);
        newErrors.set("updateVariable", error as Error);
        return { errors: newErrors };
      });
      throw error;
    }
  };

/**
 * Variable을 삭제하는 액션
 */
export const createDeleteVariableAction =
  (set: SetState, get: GetState) =>
  async (id: string): Promise<void> => {
    set({ isLoading: true });

    try {
      const db = await getDB();
      await (
        db as unknown as {
          variables: { delete: (id: string) => Promise<void> };
        }
      ).variables?.delete(id);

      // 메모리 상태 업데이트
      const { variables } = get();
      const newMap = new Map(variables);

      // ID로 Variable 찾아서 삭제
      variables.forEach((v, key) => {
        if (v.id === id) newMap.delete(key);
      });

      set({ variables: newMap, isLoading: false });
    } catch (error) {
      console.error("❌ Variable 삭제 실패:", error);
      set((state) => {
        const newErrors = new Map(state.errors);
        newErrors.set("deleteVariable", error as Error);
        return { errors: newErrors, isLoading: false };
      });
      throw error;
    }
  };

/**
 * Variable 값을 가져오는 액션
 */
export const createGetVariableValueAction =
  (get: GetState) =>
  (name: string): unknown => {
    const { variables } = get();
    const variable = variables.get(name);

    if (!variable) {
      console.warn(`⚠️ Variable "${name}" not found`);
      return undefined;
    }

    return variable.defaultValue;
  };

/**
 * Variable 값을 설정하는 액션
 */
export const createSetVariableValueAction =
  (set: SetState, get: GetState) =>
  (name: string, value: unknown): void => {
    const { variables } = get();
    const variable = variables.get(name);

    if (!variable) {
      console.warn(`⚠️ Variable "${name}" not found`);
      return;
    }

    const newMap = new Map(variables);
    newMap.set(name, { ...variable, defaultValue: value });

    set({ variables: newMap });
  };

// ============================================
// Utility Actions
// ============================================

/**
 * 모든 에러 초기화
 */
export const createClearErrorsAction = (set: SetState) => (): void => {
  set({ errors: new Map() });
};

/**
 * 스토어 초기화
 */
export const createResetAction = (set: SetState) => (): void => {
  set({
    collections: new Map(),
    apiEndpoints: new Map(),
    variables: new Map(),
    loadingApis: new Set(),
    errors: new Map(),
    isLoading: false,
  });
};
