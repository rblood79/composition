/**
 * Data Store Actions - Factory Pattern
 *
 * DataTable, ApiEndpoint, Variable의
 * CRUD 및 실행 액션을 독립적인 팩토리 함수로 분리
 *
 * ✅ IndexedDB 사용
 *
 * @see docs/features/DATA_PANEL_SYSTEM.md
 */

import type { StateCreator } from "zustand";
import { resolveResponseData } from "../../../utils/data/responseData";
import {
  getProjectSecrets,
  getSecretRevisions,
  substituteSecrets,
} from "../../panels/datatable/utils/secretVault";
import { computeSourceRev } from "../../panels/datatable/utils/sourceRev";
import { renameRowsKey } from "../../../utils/data/schemaMigration";
import {
  resolveBoundCollection,
  resolveCollectionByName,
} from "@composition/shared";
import {
  commitDataDefinitions,
  createApplyDataChangeAction,
} from "./dataChange";
import { collectionUpdateToOps } from "./dataChangeDiff";
import {
  isUploadEndpointProbe,
  tusResumableVersion,
} from "./uploadEndpointProbe";
import { getDB } from "../../../lib/db";
import type {
  DataTable,
  DataTableCreate,
  DataTableUpdate,
  ApiEndpoint,
  ApiEndpointCreate,
  ApiEndpointUpdate,
  ApiRunRecord,
  Variable,
  VariableCreate,
  VariableUpdate,
  DataStoreState,
  DataStoreActions,
} from "../../../types/builder/data.types";

// ADR-218 (R2/HC5) — collection 별 실행 시퀀스. 완료는 시작 seq 가 여전히 최신일 때만
// store·캐시를 수용한다 (늦은 A 가 빠른 B 를 덮지 못함). 세션 전용 (영속·History 무관).
const runSeqByCollection = new Map<string, number>();

// Type aliases for set/get
type DataStore = DataStoreState & DataStoreActions;
type SetState = Parameters<StateCreator<DataStore>>[0];
type GetState = Parameters<StateCreator<DataStore>>[1];

type CollectionsDB = {
  collection_runtime?: {
    get: (
      collectionId: string,
    ) => Promise<import("@composition/shared").CollectionRuntimeRow | null>;
    put: (
      row: import("@composition/shared").CollectionRuntimeRow,
    ) => Promise<void>;
    delete: (collectionId: string) => Promise<void>;
    getByProject: (
      projectId: string,
    ) => Promise<import("@composition/shared").CollectionRuntimeRow[]>;
  };
};

/**
 * ADR-286 — API rows (`runtimeData`) are not the document: the store keeps them per collection id
 * (`runtimeRows`) and merges them into the projected table (the rows a list of an API collection
 * shows). `undefined` = none.
 */
export function setRuntimeRows(
  set: SetState,
  get: GetState,
  id: string,
  rows: Record<string, unknown>[] | undefined,
): void {
  const state = get();
  const runtimeRows = new Map(state.runtimeRows);
  if (rows) runtimeRows.set(id, rows);
  else runtimeRows.delete(id);
  const table = state.collections.get(id);
  const collections = new Map(state.collections);
  if (table) {
    const { runtimeData: _old, ...definition } = table;
    collections.set(
      id,
      rows ? { ...definition, runtimeData: rows } : definition,
    );
  }
  set({ runtimeRows, collections });
}

// ============================================
// DataTable Actions
// ============================================

/**
 * ADR-218 — runtimeData 캐시(collection_runtime) hydration. collections·apiEndpoints 가
 * 모두 로드된 뒤 (initialize 의 Promise.all 후) 1회 호출한다.
 *
 * 각 캐시 행마다 지금의 요청 정의로 지문(`sourceRev`)을 재계산해 저장 지문과 대조한다:
 * - 일치 → runtimeData 를 collection 에 붙인다 (오프라인/미실행이라도 마지막 성공 응답 표시).
 *   field id→key 맵이 다르면 rename 된 열만 새 key 로 옮긴다 (G1, 옛 key 섞임 0).
 * - 불일치(소스·인증·secret 값·스키마 변경) 또는 정의/endpoint 부재 → 옛 캐시 폐기 (h1·R8).
 */
export const createHydrateRuntimeCacheAction =
  (set: SetState, get: GetState) =>
  async (projectId: string): Promise<void> => {
    try {
      const db = (await getDB()) as unknown as CollectionsDB;
      const rows = (await db.collection_runtime?.getByProject(projectId)) ?? [];
      if (rows.length === 0) return;
      const { collections, apiEndpoints } = get();
      const endpoints = Array.from(apiEndpoints.values());
      const secretRevisions = await getSecretRevisions(projectId);
      const next = new Map<string, Record<string, unknown>[]>();
      for (const row of rows) {
        const table = collections.get(row.collectionId);
        // 정의 없는 고아 캐시 정리 (R8)
        if (!table) {
          await db.collection_runtime?.delete(row.collectionId);
          continue;
        }
        // 이 collection 을 target 으로 하는 endpoint (없으면 지문 계산 불가 → 폐기)
        const linked = endpoints.find(
          (ep) =>
            ep.targetCollectionId === table.id ||
            (!ep.targetCollectionId && ep.targetCollection === table.name),
        );
        if (!linked) {
          await db.collection_runtime?.delete(row.collectionId);
          continue;
        }
        const currentRev = computeSourceRev({
          endpoint: linked,
          schema: table.schema,
          secretRevisions,
        });
        if (currentRev !== row.sourceRev) {
          // 소스·인증·secret 값·스키마(추가/삭제/타입) 변경 → 옛 캐시 폐기 (h1)
          await db.collection_runtime?.delete(row.collectionId);
          continue;
        }
        // 유효 — rename 된 열만 현재 key 로 옮겨 붙인다 (id 는 같고 key 만 다른 필드).
        let runtimeData = row.runtimeData;
        const storedKeys = row.fieldKeys ?? {};
        for (const f of table.schema ?? []) {
          const oldKey = f.id ? storedKeys[f.id] : undefined;
          if (oldKey && oldKey !== f.key) {
            runtimeData =
              renameRowsKey(runtimeData, oldKey, f.key) ?? runtimeData;
          }
        }
        next.set(table.id, runtimeData);
      }
      if (next.size) {
        // The user moved to another project while the cache loaded (audit L2).
        const current = (get() as { currentProjectId?: string | null })
          .currentProjectId;
        if (current != null && current !== projectId) return;
        for (const [id, runtimeData] of next)
          setRuntimeRows(set, get, id, runtimeData);
      }
    } catch (error) {
      console.warn("⚠️ runtimeData 캐시 hydration 실패:", error);
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
      if (runtimeData !== undefined) setRuntimeRows(set, get, id, runtimeData);
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

    setRuntimeRows(set, get, dataTable.id, data);
  };

// ============================================
// ApiEndpoint Actions
// ============================================

/** The id of the collection an endpoint names (id first, else the v1 name). */
function targetIdOf(
  get: GetState,
  endpoint: Pick<ApiEndpoint, "targetCollectionId" | "targetCollection">,
): string | undefined {
  const collections = get().collections;
  if (
    endpoint.targetCollectionId &&
    collections.has(endpoint.targetCollectionId)
  )
    return endpoint.targetCollectionId;
  if (!endpoint.targetCollection) return undefined;
  return resolveCollectionByName(
    endpoint.targetCollection,
    Array.from(collections.values()),
  )?.id;
}

function findEndpoint(get: GetState, id: string): ApiEndpoint | undefined {
  for (const endpoint of get().apiEndpoints.values())
    if (endpoint.id === id) return endpoint;
  return undefined;
}

/**
 * 새 ApiEndpoint 생성 — ADR-286: 문서 entry (명령 하나 · History · 저장). 이름 고유는
 * `define_endpoint` 와 같은 규칙.
 */
export const createCreateApiEndpointAction =
  (set: SetState, get: GetState) =>
  async (data: ApiEndpointCreate): Promise<ApiEndpoint> => {
    try {
      for (const endpoint of get().apiEndpoints.values())
        if (endpoint.name.trim() === data.name.trim())
          throw new Error(`endpoint 이름이 이미 있습니다: ${data.name}`);
      const targetCollectionId = targetIdOf(get, data);
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
        ...(data.bodyTemplate !== undefined
          ? { bodyTemplate: data.bodyTemplate }
          : {}),
        // 빈 경로 = 응답 전체 (실행기가 배열을 자동 감지한다 — utils/data/responseData.ts)
        responseMapping: data.responseMapping || { dataPath: "" },
        ...(targetCollectionId ? { targetCollectionId } : {}),
        executionMode: data.executionMode || "client",
        ...(data.serverConfig ? { serverConfig: data.serverConfig } : {}),
        timeout: data.timeout || 30000,
        retryCount: data.retryCount || 0,
      };
      commitDataDefinitions({
        endpoints: [newApiEndpoint],
        payload: {
          change: { ops: [], origin: "user", label: "Add API" },
          inverse: [],
        },
      });
      return findEndpoint(get, newApiEndpoint.id) ?? newApiEndpoint;
    } catch (error) {
      console.error("❌ ApiEndpoint 생성 실패:", error);
      set((state) => {
        const newErrors = new Map(state.errors);
        newErrors.set("createApiEndpoint", error as Error);
        return { errors: newErrors };
      });
      throw error;
    }
  };

/** ApiEndpoint 갱신 — ADR-286: 문서 entry 하나를 바꾸는 명령 (History · 저장). */
export const createUpdateApiEndpointAction =
  (set: SetState, get: GetState) =>
  async (id: string, updates: ApiEndpointUpdate): Promise<void> => {
    try {
      const existing = findEndpoint(get, id);
      if (!existing) {
        console.warn("⚠️ updateApiEndpoint: endpoint 없음", id);
        return;
      }
      const merged: ApiEndpoint = { ...existing, ...updates };
      const {
        targetCollection: _name,
        targetCollectionId: _id,
        ...rest
      } = merged;
      const targetCollectionId = targetIdOf(get, merged);
      commitDataDefinitions({
        endpoints: [
          { ...rest, ...(targetCollectionId ? { targetCollectionId } : {}) },
        ],
        payload: {
          change: { ops: [], origin: "user", label: "Edit API" },
          inverse: [],
        },
      });
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

/** ApiEndpoint 삭제 — ADR-286: `delete_endpoint` (History · 저장, undo 는 같은 id). */
export const createDeleteApiEndpointAction =
  (set: SetState, get: GetState) =>
  async (id: string): Promise<void> => {
    try {
      await createApplyDataChangeAction(
        set,
        get,
      )({
        ops: [{ op: "delete_endpoint", endpointId: id }],
        origin: "user",
      });
    } catch (error) {
      console.error("❌ ApiEndpoint 삭제 실패:", error);
      set((state) => {
        const newErrors = new Map(state.errors);
        newErrors.set("deleteApiEndpoint", error as Error);
        return { errors: newErrors };
      });
      throw error;
    }
  };

/**
 * ApiEndpoint을 실행하는 액션
 */
/**
 * 실행 스냅샷의 응답 본문 미리보기 상한 (ADR-213 Phase 3 — "왜 실패했지?" 컨텍스트의
 * "본문 앞 2KB"). 바이트 기준, 멀티바이트 문자 경계에서 자른다.
 */
export const API_RUN_BODY_PREVIEW_MAX_BYTES = 2_048;

const utf8 = new TextEncoder();

/** 바이트 상한 안에서 code point 경계로 자른 앞부분 */
function previewBody(text: string): {
  bodyPreview: string;
  bodyTruncated: boolean;
  bodyBytes: number;
} {
  const bodyBytes = utf8.encode(text).length;
  if (bodyBytes <= API_RUN_BODY_PREVIEW_MAX_BYTES) {
    return { bodyPreview: text, bodyTruncated: false, bodyBytes };
  }
  let used = 0;
  let out = "";
  for (const ch of text) {
    const n = utf8.encode(ch).length;
    if (used + n > API_RUN_BODY_PREVIEW_MAX_BYTES) break;
    used += n;
    out += ch;
  }
  return { bodyPreview: out, bodyTruncated: true, bodyBytes };
}

function headersToRecord(headers: Headers | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers || typeof headers.forEach !== "function") return out;
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

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

    // ADR-213 Phase 3 — 실행 스냅샷 (endpoint 당 마지막 1건 · 원문 · 세션 전용)
    const startedAt = new Date();
    const runId = `run_${startedAt.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    let requestSnapshot: ApiRunRecord["request"] = {
      method: endpoint.method,
      url: `${endpoint.baseUrl}${endpoint.path}`,
      headers: {},
      bodyType: endpoint.bodyType,
    };
    let responseSnapshot: ApiRunRecord["response"] = null;
    const recordRun = (ok: boolean, error?: string) => {
      const run: ApiRunRecord = {
        runId,
        endpointId: id,
        startedAt: startedAt.toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
        ok,
        request: requestSnapshot,
        response: responseSnapshot,
        ...(error !== undefined ? { error } : {}),
      };
      set((state) => {
        const apiRuns = new Map(state.apiRuns);
        apiRuns.set(id, run);
        return { apiRuns };
      });
    };

    try {
      // URL 구성
      let url = `${endpoint.baseUrl}${endpoint.path}`;

      // Path 변수 치환 (예: /users/{{userId}})
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          url = url.replace(`{{${key}}}`, String(value));
        });
      }

      // `useAsyncList`'s load arguments (`{{ cursor }}` · `{{ filterText }}` ·
      // `{{ sortDescriptor.* }}`) are the first load's empty ones here: their parameters are left
      // out (the Preview session gives them — `loadCollectionEndpoint`).
      const LOAD_ARGUMENT =
        /\{\{\s*(?:cursor|filterText|sortDescriptor)\b[^}]*\}\}/g;
      const withoutLoadArguments = (text: string) =>
        text.replace(LOAD_ARGUMENT, "");
      url = withoutLoadArguments(url);

      // Query Parameters 추가
      if (endpoint.queryParams.length > 0) {
        const searchParams = new URLSearchParams();
        endpoint.queryParams.forEach((qp) => {
          if (qp.key) {
            let value = withoutLoadArguments(qp.value);
            if (value === "" && qp.value !== "") return;
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

      // requestSnapshot 은 secret 치환 **전** (placeholder 유지) — ADR-212 HC6: apiRuns 는
      // AI/설명 경로가 읽으므로 원문 secret 을 담지 않는다 (redactor 이전에 애초에 안 넣는다).
      requestSnapshot = {
        method: endpoint.method,
        url,
        headers,
        bodyType: endpoint.bodyType,
        ...(body !== undefined ? { body } : {}),
      };

      // vault 치환은 실제 fetch 로 나가는 복사본에만 (원문은 composition-secrets DB 에만 존재).
      const secrets = await getProjectSecrets(endpoint.project_id);
      // ADR-218 (R1/h1) — 시작 시점 캐시 지문. 완료 수용 시 재계산 지문과 대조해
      // 진행 중 소스·인증·secret 값 변경이면 캐시를 채우지 않는다 (secret 원문 미포함, HC6).
      const startSecretRevisions = await getSecretRevisions(
        endpoint.project_id,
      );
      const startTarget = resolveBoundCollection(
        {
          collectionId: endpoint.targetCollectionId,
          name: endpoint.targetCollection,
        },
        Array.from(get().collections.values()),
      );
      const startRev = computeSourceRev({
        endpoint,
        schema: startTarget?.schema,
        secretRevisions: startSecretRevisions,
      });
      // ADR-218 (R2/HC5) — 이 실행의 시퀀스 번호 (target collection 기준). 완료 시 최신인지 확인.
      const seqKey = startTarget?.id ?? endpoint.targetCollectionId ?? id;
      const startSeq = (runSeqByCollection.get(seqKey) ?? 0) + 1;
      runSeqByCollection.set(seqKey, startSeq);
      const fetchHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(headers)) {
        fetchHeaders[k] = substituteSecrets(v, secrets);
      }
      const fetchBody =
        body !== undefined ? substituteSecrets(body, secrets) : undefined;
      const secretUrl = substituteSecrets(url, secrets);
      // A template left after the test params and secrets (`/users/{{ params.id }}` — the route is
      // the Preview's): refused, not sent literally.
      const unresolved = /\{\{[^}]*\}\}/.exec(secretUrl)?.[0];
      if (unresolved)
        throw new Error(
          `${unresolved} 를 풀 수 없습니다 (경로 param 은 Preview 에서 읽는다)`,
        );

      // 개발 환경에서 외부 API 호출 시 프록시 사용 (CORS 우회)
      let fetchUrl = secretUrl;
      const isExternalUrl =
        secretUrl.startsWith("http://") || secretUrl.startsWith("https://");
      const isDevelopment = import.meta.env.DEV;

      if (isExternalUrl && isDevelopment) {
        fetchUrl = `/api/proxy?url=${encodeURIComponent(secretUrl)}`;
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
        headers: fetchHeaders,
        body: fetchBody,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const responseText = await response.text();
      responseSnapshot = {
        status: response.status,
        statusText: response.statusText,
        headers: headersToRecord(response.headers),
        ...previewBody(responseText),
      };

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      let result: unknown;
      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error("응답 본문이 JSON 이 아닙니다");
      }

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
          // ADR-218 (R1/h1) — 완료 시점 지문 재계산. 진행 중 소스·인증·secret 값이
          // 바뀌었으면(시작 지문과 불일치) 이 응답은 옛 상태의 것이라 캐시를 채우지 않는다.
          // apiEndpoints Map 은 name 키라 id 로 순회 검색 (실행 중 정의 변경 감지).
          let currentEndpoint = endpoint;
          for (const ep of get().apiEndpoints.values()) {
            if (ep.id === endpoint.id) {
              currentEndpoint = ep;
              break;
            }
          }
          const endRev = computeSourceRev({
            endpoint: currentEndpoint,
            schema: targetTable.schema,
            secretRevisions: await getSecretRevisions(endpoint.project_id),
          });
          const runtimeData = Array.isArray(mappedData)
            ? mappedData
            : [mappedData];
          // ADR-218 (R2/HC5) — 이 실행이 여전히 최신 seq 인지. 더 늦게 시작한 실행이
          // 이미 있으면(늦은 A ← 빠른 B) 이 응답은 버린다 (single-flight 수용).
          const isLatest =
            (runSeqByCollection.get(targetTable.id) ?? startSeq) === startSeq;
          // 지금의 collections 에 붙인다 — 위 await 동안 끝난 편집 (다른 collection 추가 ·
          // 행 · schema) 을 실행 시작 때 읽은 Map 으로 되돌리지 않는다 (감사 L9).
          const latest = get().collections;
          const latestTable = latest.get(targetTable.id);
          if (endRev === startRev && isLatest && latestTable) {
            setRuntimeRows(set, get, targetTable.id, runtimeData);

            // ADR-218 — runtimeData 캐시 영속 (별도 store, History 밖). 실패는 로드/실행을
            // 막지 않는다 (다음 실행에서 다시 채운다).
            try {
              const db = (await getDB()) as unknown as CollectionsDB;
              const fieldKeys: Record<string, string> = {};
              for (const f of targetTable.schema ?? []) {
                if (f.id) fieldKeys[f.id] = f.key;
              }
              await db.collection_runtime?.put({
                collectionId: targetTable.id,
                project_id: targetTable.project_id,
                runtimeData,
                sourceRev: endRev,
                fieldKeys,
                updated_at: new Date().toISOString(),
              });
            } catch (persistError) {
              console.warn(
                "⚠️ runtimeData 캐시 영속 실패 (다음 실행에서 재시도):",
                persistError,
              );
            }
          } else {
            console.warn(
              `[ADR-218] '${targetTable.name}' 응답 폐기 — ${
                endRev !== startRev
                  ? "실행 중 소스/인증 변경 (지문 불일치)"
                  : "더 늦은 실행이 우선 (single-flight seq)"
              }`,
            );
          }
        }
      }

      recordRun(true);
      return mappedData;
    } catch (error) {
      recordRun(false, error instanceof Error ? error.message : String(error));
      // ADR-201 후속 — TUS 업로드 endpoint 는 GET 을 받지 않는 것이 정상 (405/412 + Tus-Resumable).
      // 오류 채널 (console.error · errors Map) 에 싣지 않는다 — 편집기가 안내로 그린다.
      if (isUploadEndpointProbe(responseSnapshot)) {
        console.info(
          `ℹ️ ApiEndpoint "${endpoint?.name}" 은 업로드 endpoint (TUS ${tusResumableVersion(responseSnapshot!.headers)}) — GET 프로브 ${responseSnapshot!.status} 는 정상`,
        );
        throw error;
      }
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
 * 프로젝트 변수 생성 — ADR-214 · 286: `define_variable` 의 얇은 wrapper (문서 entry · History).
 * 페이지 · 요소 변수는 문서의 `StateVariableEntry` 다 (이 store 의 scope 는 project 뿐).
 */
export const createCreateVariableAction =
  (set: SetState, get: GetState) =>
  async (data: VariableCreate): Promise<Variable> => {
    try {
      if (data.scope && data.scope !== "global")
        throw new Error(
          "페이지 · 요소 변수는 문서의 상태 변수입니다 (State 섹션) — 이 목록은 프로젝트 변수만",
        );
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
      return created;
    } catch (error) {
      console.error("❌ Variable 생성 실패:", error);
      set((state) => {
        const newErrors = new Map(state.errors);
        newErrors.set("createVariable", error as Error);
        return { errors: newErrors };
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
 * 프로젝트 변수 갱신 — 정의 축 (name · type · defaultValue · persist) 은 `define_variable`,
 * validation · transform 은 같은 entry 를 쓰는 문서 명령 (둘 다 History · 저장). scope ·
 * page_id 는 없다 (ADR-286 — 페이지 변수는 문서의 상태 변수).
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
      if (!("validation" in updates) && !("transform" in updates)) return;
      const current = findVariableByIdInMap(get().variables, id);
      if (!current) return;
      const next: Variable = { ...current };
      if ("validation" in updates) {
        if (updates.validation) next.validation = updates.validation;
        else delete next.validation;
      }
      if ("transform" in updates) {
        if (updates.transform !== undefined) next.transform = updates.transform;
        else delete next.transform;
      }
      commitDataDefinitions({
        variables: [next],
        payload: {
          change: { ops: [], origin: "user", label: "Edit variable" },
          inverse: [],
        },
      });
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
 * 프로젝트 변수 삭제 — 적용기 `define_variable` (definition null) 의 wrapper.
 * undo 는 같은 id 로 되살린다 (참조 보존).
 */
export const createDeleteVariableAction =
  (set: SetState, get: GetState) =>
  async (id: string): Promise<void> => {
    try {
      await createApplyDataChangeAction(
        set,
        get,
      )({
        ops: [{ op: "define_variable", variableId: id, definition: null }],
        origin: "user",
      });
    } catch (error) {
      console.error("❌ Variable 삭제 실패:", error);
      set((state) => {
        const newErrors = new Map(state.errors);
        newErrors.set("deleteVariable", error as Error);
        return { errors: newErrors };
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
 * Variable 값을 설정하는 액션 — ADR-286: 시작값은 문서 정의다 (`updateVariable`). 런타임 값은
 * Preview 세션의 것 (ADR-214) 이라 이 store 에는 쓰지 않는다.
 */
export const createSetVariableValueAction =
  (set: SetState, get: GetState) =>
  (name: string, value: unknown): void => {
    const variable = get().variables.get(name);
    if (!variable) {
      console.warn(`⚠️ Variable "${name}" not found`);
      return;
    }
    void createUpdateVariableAction(set, get)(variable.id, {
      defaultValue: value,
    });
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
    runtimeRows: new Map(),
    loadingApis: new Set(),
    apiRuns: new Map(),
    errors: new Map(),
    isLoading: false,
  });
};
