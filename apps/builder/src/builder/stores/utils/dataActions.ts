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
import { normalizeCollectionMap } from "../../../utils/data/normalizeCollection";
import {
  resolveBoundCollection,
  resolveCollectionByName,
} from "@composition/shared";
import {
  createApplyDataChangeAction,
  syncCollectionsToCanvas,
} from "./dataChange";
import { collectionUpdateToOps } from "./dataChangeDiff";
import { getDB } from "../../../lib/db";
import {
  migrateVariableOwner,
  migrateVariableOwners,
  readVariableOwnerPageIds,
} from "./variableOwnerMigration";
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

// Type aliases for set/get
type DataStore = DataStoreState & DataStoreActions;
type SetState = Parameters<StateCreator<DataStore>>[0];
type GetState = Parameters<StateCreator<DataStore>>[1];

// ============================================
// Canvas Sync Helper
// ============================================

// `syncCollectionsToCanvas` 는 `./dataChange` 로 옮겨졌다 (적용기와 공유).

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
 * 새 DataTable을 생성하는 액션 — `applyDataChange` 의 얇은 wrapper (ADR-152 Phase 1c).
 * `create_collection` op 1개 → History `data` entry (undo = 삭제).
 */
export const createCreateDataTableAction =
  (set: SetState, get: GetState) =>
  async (data: DataTableCreate): Promise<DataTable> => {
    set({ isLoading: true });
    const apply = createApplyDataChangeAction(set, get);
    try {
      const result = await apply(
        {
          ops: [
            {
              op: "create_collection",
              projectId: data.project_id,
              name: data.name,
              schema: data.schema ?? [],
              rows: data.mockData ?? [],
              source: (data.useMockData ?? true) ? "manual" : "api",
            },
          ],
          origin: "user",
        },
        { projectId: data.project_id },
      );
      const [collectionId] = result.collectionIds;
      const created = get().collections.get(collectionId);
      if (!created)
        throw new Error("생성된 collection 을 store 에서 찾을 수 없습니다");
      set({ isLoading: false });
      return created;
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
 * DataTable을 업데이트하는 액션 — `applyDataChange` 의 얇은 wrapper (ADR-152 Phase 1c).
 *
 * partial patch 를 `collectionUpdateToOps` 로 op 에 옮긴다 — 편집기의 셀 · 행 · CSV ·
 * rename 경로가 호출부 변경 없이 History 에 실린다. `runtimeData` 만 History 밖
 * (메모리 전용 — API 응답). 새 필드 (편집기 "필드 추가") 의 id 부여는 적용기가 한다 (HC7).
 *
 * ⚡ 개별 업데이트는 isLoading 표시 안함 (빠른 작업이므로)
 */
export const createUpdateDataTableAction =
  (set: SetState, get: GetState) =>
  async (id: string, updates: DataTableUpdate): Promise<void> => {
    const existing = get().collections.get(id);
    if (!existing) {
      console.warn("⚠️ updateCollection: collection 없음", id);
      return;
    }
    try {
      const { ops, runtimeData } = collectionUpdateToOps(existing, updates);
      if (ops.length > 0) {
        await createApplyDataChangeAction(set, get)({ ops, origin: "user" });
      }
      if (runtimeData !== undefined) {
        const { collections } = get();
        const current = collections.get(id);
        if (current) {
          const newMap = new Map(collections);
          newMap.set(id, { ...current, runtimeData });
          set({ collections: newMap });
          syncCollectionsToCanvas(newMap);
        }
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
 * DataTable을 삭제하는 액션 — `applyDataChange` 의 얇은 wrapper (ADR-152 Phase 1c).
 * undo 는 같은 id 로 되살린다 (바인딩 `collectionId` 참조 보존).
 */
export const createDeleteDataTableAction =
  (set: SetState, get: GetState) =>
  async (id: string): Promise<void> => {
    set({ isLoading: true });
    try {
      await createApplyDataChangeAction(
        set,
        get,
      )({
        ops: [{ op: "delete_collection", collectionId: id }],
        origin: "user",
      });
      set({ isLoading: false });
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
      if (
        (endpoint.targetCollectionId || endpoint.targetCollection) &&
        mappedData
      ) {
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

      // ADR-214 Phase 1 — `owner` 읽기 변환 (결정적 · 메모리만 · IndexedDB 재직렬화 0).
      //   component / page-without-page_id (페이지 2개 이상) 는 owner-unresolved 배지 + 로그 1회.
      //   page-without-page_id 는 프로젝트 페이지가 1개뿐이면 그 페이지 (판정 C, 2026-09-11) —
      //   페이지 목록은 `stores/index.ts` 가 등록한 공급자에서 읽는다.
      const { variables: migrated } = migrateVariableOwners(data || [], {
        projectId,
        pageIds: readVariableOwnerPageIds(),
      });
      const variablesMap = new Map<string, Variable>();
      migrated.forEach((v) => {
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
 * 프로젝트 변수 생성 — ADR-214 Phase 1: ADR-152 적용기 `define_variable` 의 얇은 wrapper
 * (History `type:"data"` entry · IndexedDB · 메모리 · 이름 고유 검증을 적용기가 맡는다).
 *
 * 구 UI 가 `scope: "page" | "component"` 를 요청하면 (Phase 5 가 표면을 교체하기 전의
 * legacy 경로) 적용기를 거치지 않고 종전 직접 저장을 유지한다 — 그 형태는 `define_variable`
 * 로 표현되지 않으며 (프로젝트 변수 op), 로드 변환이 `owner-unresolved` 로 표시한다.
 */
export const createCreateVariableAction =
  (set: SetState, get: GetState) =>
  async (data: VariableCreate): Promise<Variable> => {
    set({ isLoading: true });

    try {
      const scope = data.scope || "global";
      if (scope === "global") {
        const result = await createApplyDataChangeAction(set, get)(
          {
            ops: [
              {
                op: "define_variable",
                definition: {
                  name: data.name,
                  type: data.type,
                  ...(data.defaultValue !== undefined
                    ? { defaultValue: data.defaultValue }
                    : {}),
                  persist: data.persist ?? false,
                },
              },
            ],
            origin: "user",
          },
          { projectId: data.project_id },
        );
        const [variableId] = result.variableIds;
        const created = findVariableByIdInMap(get().variables, variableId);
        if (!created)
          throw new Error("생성된 변수를 store 에서 찾을 수 없습니다");
        set({ isLoading: false });
        return created;
      }

      // legacy scope (page / component) — 직접 저장 (Phase 5 표면 교체 전까지).
      // page 는 `page_id` 필수 (사용자 판정 2026-09-11) — 소유 페이지 없는 page 변수를 더
      // 만들지 않는다 (구 UI 가 한 번도 안 채워 실 데이터가 전부 그 형태였다).
      if (scope === "page" && !data.page_id) {
        throw new Error(
          "page 변수는 page_id (소유 페이지) 가 있어야 합니다 — 현재 페이지 id 를 넘기세요",
        );
      }
      const db = await getDB();
      const newVariable: Variable = migrateVariableOwner({
        id: crypto.randomUUID(),
        name: data.name,
        project_id: data.project_id,
        type: data.type,
        defaultValue: data.defaultValue,
        persist: data.persist ?? false,
        scope,
        page_id: data.page_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).variable;

      await (
        db as unknown as {
          variables: { insert: (v: Variable) => Promise<Variable> };
        }
      ).variables?.insert(newVariable);

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

function findVariableByIdInMap(
  variables: ReadonlyMap<string, Variable>,
  id: string | undefined,
): Variable | undefined {
  if (!id) return undefined;
  for (const variable of variables.values()) {
    if (variable.id === id) return variable;
  }
  return undefined;
}

const VARIABLE_DEFINITION_KEYS = [
  "name",
  "type",
  "defaultValue",
  "persist",
] as const satisfies readonly (keyof VariableUpdate)[];

/**
 * 프로젝트 변수 갱신 — ADR-214 Phase 1: 정의 축 (name · type · defaultValue · persist) 은
 * 적용기 `define_variable` (History 동봉). 그 밖의 legacy 필드 (scope · page_id · validation ·
 * transform — Phase 5 에서 숨김/정리 대상) 만 종전 직접 저장 경로로 남긴다.
 *
 * ⚡ 개별 업데이트는 isLoading 표시 안함 (빠른 작업이므로)
 */
export const createUpdateVariableAction =
  (set: SetState, get: GetState) =>
  async (id: string, updates: VariableUpdate): Promise<void> => {
    try {
      const existing = findVariableByIdInMap(get().variables, id);
      if (!existing) {
        console.warn("⚠️ updateVariable: variable 없음", id);
        return;
      }

      const definitionTouched = VARIABLE_DEFINITION_KEYS.some(
        (key) => key in updates,
      );
      if (definitionTouched) {
        const defaultValue =
          "defaultValue" in updates
            ? updates.defaultValue
            : existing.defaultValue;
        await createApplyDataChangeAction(
          set,
          get,
        )({
          ops: [
            {
              op: "define_variable",
              variableId: id,
              definition: {
                name: updates.name ?? existing.name,
                type: updates.type ?? existing.type,
                ...(defaultValue !== undefined ? { defaultValue } : {}),
                persist: updates.persist ?? existing.persist ?? false,
              },
            },
          ],
          origin: "user",
        });
      }

      const legacyUpdates: Partial<Variable> = {};
      for (const [key, value] of Object.entries(updates)) {
        if ((VARIABLE_DEFINITION_KEYS as readonly string[]).includes(key))
          continue;
        (legacyUpdates as Record<string, unknown>)[key] = value;
      }
      if (Object.keys(legacyUpdates).length === 0) return;

      const db = await getDB();
      await (
        db as unknown as {
          variables: {
            update: (
              id: string,
              updates: Partial<Variable>,
            ) => Promise<Variable>;
          };
        }
      ).variables?.update(id, legacyUpdates);

      const { variables } = get();
      const current = findVariableByIdInMap(variables, id);
      if (!current) return;
      const newMap = new Map(variables);
      const merged: Variable = {
        ...current,
        ...legacyUpdates,
        updated_at: new Date().toISOString(),
      };
      // scope / page_id 가 바뀌면 메모리 `owner` (로드 변환 결과) 를 다시 판정한다 —
      // IndexedDB 는 owner 를 갖지 않으므로 여기서 지우고 같은 규칙으로 재계산.
      const ownerTouched =
        "scope" in legacyUpdates || "page_id" in legacyUpdates;
      if (ownerTouched) {
        delete merged.owner;
        delete merged.migrationStatus;
      }
      newMap.set(
        current.name,
        ownerTouched
          ? migrateVariableOwner(merged, {
              pageIds: readVariableOwnerPageIds(),
            }).variable
          : merged,
      );
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
 * 프로젝트 변수 삭제 — ADR-214 Phase 1: 적용기 `define_variable` (definition null) 의 wrapper.
 * undo 는 같은 id 로 되살린다 (참조 보존).
 */
export const createDeleteVariableAction =
  (set: SetState, get: GetState) =>
  async (id: string): Promise<void> => {
    set({ isLoading: true });

    try {
      await createApplyDataChangeAction(
        set,
        get,
      )({
        ops: [{ op: "define_variable", variableId: id, definition: null }],
        origin: "user",
      });
      set({ isLoading: false });
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
