/**
 * Data Store - Zustand Store for Data Panel System
 *
 * DataTable, ApiEndpoint, Variable 관리
 * Factory Pattern으로 액션을 분리하여 코드 재사용성 향상
 *
 * ## 아키텍처 설계
 *
 * 1. **Source of Truth**: Supabase (persist 미들웨어 사용 안함)
 *    - 앱 시작 시 Supabase에서 로드
 *    - 변경 시 Supabase에 저장 + 메모리 업데이트
 *
 * 2. **Runtime Values**: 메모리에서만 관리
 *    - Variable.persist: true인 경우 localStorage에 값만 저장
 *    - 런타임 중 변경된 값은 runtimeValues Map에서 관리
 *
 * 3. **Canvas 동기화**: subscribe로 자동 전송
 *    - variables/collections/apiEndpoints 변경 시 자동으로 iframe에 전송
 *
 * @see docs/features/DATA_PANEL_SYSTEM.md
 */

import { useMemo } from "react";
import { resolveCollectionByName, type VariableDef } from "@composition/shared";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { StateCreator } from "zustand";
import type {
  DataTable,
  ApiEndpoint,
  ApiRunRecord,
  Variable,
  DataStoreState,
  DataStoreActions,
} from "../../types/builder/data.types";
import {
  // DataTable Actions
  createFetchDataTablesAction,
  createCreateDataTableAction,
  createUpdateDataTableAction,
  createDeleteDataTableAction,
  createGetDataTableDataAction,
  createSetRuntimeDataAction,
  // ApiEndpoint Actions
  createFetchApiEndpointsAction,
  createCreateApiEndpointAction,
  createUpdateApiEndpointAction,
  createDeleteApiEndpointAction,
  createExecuteApiEndpointAction,
  // Variable Actions
  createFetchVariablesAction,
  createCreateVariableAction,
  createUpdateVariableAction,
  createDeleteVariableAction,
  createGetVariableValueAction,
  createSetVariableValueAction,
  // Utility Actions
  createClearErrorsAction,
  createResetAction,
} from "./utils/dataActions";
import { createApplyDataChangeAction } from "./utils/dataChange";

// ============================================
// Extended State (Runtime Values)
// ============================================

interface DataStoreExtended extends DataStoreState, DataStoreActions {
  // Runtime variable values (메모리 + localStorage for persist:true)
  runtimeValues: Map<string, unknown>;
  setRuntimeValue: (name: string, value: unknown) => void;
  getRuntimeValue: (name: string) => unknown;

  // 초기화 상태
  isInitialized: boolean;
  currentProjectId: string | null;

  // 초기화 액션
  initializeForProject: (projectId: string) => Promise<void>;
}

// ============================================
// Store Type
// ============================================

type DataStore = DataStoreExtended;

// ============================================
// LocalStorage helpers for persist:true variables
// ============================================

const RUNTIME_VALUES_KEY = "composition-runtime-values";

function loadPersistedRuntimeValues(): Map<string, unknown> {
  try {
    const stored = localStorage.getItem(RUNTIME_VALUES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return new Map(Object.entries(parsed));
    }
  } catch (e) {
    console.warn("[DataStore] Failed to load persisted runtime values:", e);
  }
  return new Map();
}

function savePersistedRuntimeValues(
  runtimeValues: Map<string, unknown>,
  variables: Map<string, Variable>,
) {
  try {
    const toSave: Record<string, unknown> = {};
    variables.forEach((variable, name) => {
      if (variable.persist && runtimeValues.has(name)) {
        toSave[name] = runtimeValues.get(name);
      }
    });
    localStorage.setItem(RUNTIME_VALUES_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.warn("[DataStore] Failed to save persisted runtime values:", e);
  }
}

// ============================================
// Store Slice Creator
// ============================================

export const createDataSlice: StateCreator<DataStore> = (set, get) => {
  // Factory 함수로 액션 생성

  // DataTable Actions
  const fetchCollections = createFetchDataTablesAction(set);
  const createDataTable = createCreateDataTableAction(set, get);
  const updateCollection = createUpdateDataTableAction(set, get);
  const deleteCollection = createDeleteDataTableAction(set, get);
  const getDataTableData = createGetDataTableDataAction(get);
  const setRuntimeData = createSetRuntimeDataAction(set, get);
  const applyDataChange = createApplyDataChangeAction(set, get);

  // ApiEndpoint Actions
  const fetchApiEndpoints = createFetchApiEndpointsAction(set);
  const createApiEndpoint = createCreateApiEndpointAction(set, get);
  const updateApiEndpoint = createUpdateApiEndpointAction(set, get);
  const deleteApiEndpoint = createDeleteApiEndpointAction(set, get);
  const executeApiEndpoint = createExecuteApiEndpointAction(set, get);

  // Variable Actions
  const fetchVariables = createFetchVariablesAction(set);
  const createVariable = createCreateVariableAction(set, get);
  const updateVariable = createUpdateVariableAction(set, get);
  const deleteVariable = createDeleteVariableAction(set, get);
  const getVariableValue = createGetVariableValueAction(get);
  const setVariableValue = createSetVariableValueAction(set, get);

  // Utility Actions
  const clearErrors = createClearErrorsAction(set);
  const reset = createResetAction(set);

  // ============================================
  // Runtime Value Actions
  // ============================================

  const setRuntimeValue = (name: string, value: unknown) => {
    const { runtimeValues, variables } = get();
    const newRuntimeValues = new Map(runtimeValues);
    newRuntimeValues.set(name, value);
    set({ runtimeValues: newRuntimeValues });

    // persist:true인 경우 localStorage에도 저장
    savePersistedRuntimeValues(newRuntimeValues, variables);
  };

  const getRuntimeValue = (name: string): unknown => {
    const { runtimeValues, variables } = get();

    // 1. 런타임 값이 있으면 반환
    if (runtimeValues.has(name)) {
      return runtimeValues.get(name);
    }

    // 2. Variable의 defaultValue 반환
    const variable = variables.get(name);
    return variable?.defaultValue;
  };

  // ============================================
  // Project Initialization
  // ============================================

  const initializeForProject = async (projectId: string) => {
    const { currentProjectId, isInitialized } = get();

    // 이미 같은 프로젝트로 초기화됨
    if (isInitialized && currentProjectId === projectId) {
      console.log(`[DataStore] Already initialized for project: ${projectId}`);
      return;
    }

    console.log(`[DataStore] Initializing for project: ${projectId}`);
    set({ isLoading: true, currentProjectId: projectId });

    try {
      // Supabase에서 병렬로 로드
      await Promise.all([
        fetchVariables(projectId),
        fetchCollections(projectId),
        fetchApiEndpoints(projectId),
      ]);

      // persist:true인 Variable들의 런타임 값 복원
      const persistedValues = loadPersistedRuntimeValues();
      const { variables } = get();
      const runtimeValues = new Map<string, unknown>();

      variables.forEach((variable, name) => {
        if (variable.persist && persistedValues.has(name)) {
          runtimeValues.set(name, persistedValues.get(name));
        }
      });

      set({
        isInitialized: true,
        isLoading: false,
        runtimeValues,
      });

      console.log(
        `[DataStore] Initialized: ${variables.size} variables, ${get().collections.size} tables`,
      );
    } catch (error) {
      console.error("[DataStore] Initialization failed:", error);
      set({ isLoading: false });
      throw error;
    }
  };

  return {
    // ============================================
    // State
    // ============================================
    collections: new Map<string, DataTable>(),
    apiEndpoints: new Map<string, ApiEndpoint>(),
    variables: new Map<string, Variable>(),
    loadingApis: new Set<string>(),
    apiRuns: new Map<string, ApiRunRecord>(),
    errors: new Map<string, Error>(),
    isLoading: false,

    // Extended State
    runtimeValues: new Map<string, unknown>(),
    isInitialized: false,
    currentProjectId: null,

    // ============================================
    // Actions
    // ============================================

    // DataTable CRUD
    fetchCollections,
    createDataTable,
    updateCollection,
    deleteCollection,
    getDataTableData,
    setRuntimeData,
    applyDataChange,

    // ApiEndpoint CRUD
    fetchApiEndpoints,
    createApiEndpoint,
    updateApiEndpoint,
    deleteApiEndpoint,
    executeApiEndpoint,

    // Variable CRUD
    fetchVariables,
    createVariable,
    updateVariable,
    deleteVariable,
    getVariableValue,
    setVariableValue,

    // Runtime Values
    setRuntimeValue,
    getRuntimeValue,

    // Initialization
    initializeForProject,

    // Utilities
    clearErrors,
    reset,
  };
};

// ============================================
// Store Instance (with subscribeWithSelector)
// ============================================

export const useDataStore = create<DataStore>()(
  subscribeWithSelector(createDataSlice),
);

// ============================================
// Selectors (for optimized re-renders)
// ============================================

/**
 * 모든 DataTable 목록 가져오기
 */
export const useCollections = (): DataTable[] => {
  const collections = useDataStore((state) => state.collections);
  // Map 이 그대로면 같은 배열을 돌려준다 — 렌더마다 새 배열이면 이를 deps 로 둔 memo 가 전부
  //   무효화돼 Properties 의 Chart 컨트롤이 showGrid/resize 마다 다시 그렸다 (ADR-210 P4 실측).
  return useMemo(() => Array.from(collections.values()), [collections]);
};

/**
 * 특정 DataTable 가져오기
 */
export const useCollection = (name: string): DataTable | undefined => {
  const collections = useDataStore((state) => state.collections);
  // Map 은 id 키 (ADR-152 HC8) — name 시그니처는 fallback wrapper 로 유지.
  return useMemo(
    () =>
      resolveCollectionByName(name, Array.from(collections.values())) ??
      undefined,
    [collections, name],
  );
};

/** id 로 DataTable 가져오기 — O(1) (ADR-152 v2 안정 참조). */
export const useCollectionById = (
  id: string | undefined,
): DataTable | undefined => {
  const collections = useDataStore((state) => state.collections);
  return id ? collections.get(id) : undefined;
};

/**
 * 모든 ApiEndpoint 목록 가져오기
 */
export const useApiEndpoints = (): ApiEndpoint[] => {
  const apiEndpoints = useDataStore((state) => state.apiEndpoints);
  return Array.from(apiEndpoints.values());
};

/**
 * 특정 ApiEndpoint 가져오기
 */
export const useApiEndpoint = (name: string): ApiEndpoint | undefined => {
  const apiEndpoints = useDataStore((state) => state.apiEndpoints);
  return apiEndpoints.get(name);
};

/**
 * 모든 Variable 목록 가져오기
 */
export const useVariables = (): Variable[] => {
  const variables = useDataStore((state) => state.variables);
  return Array.from(variables.values());
};

/**
 * ADR-214 — 프로젝트 변수를 공용 `VariableDef` 로 투영 (가시성 사슬 마지막 단 · scene
 * `stateDeps` 해석 입력). Map 이 그대로면 같은 배열 (scene 재빌드 memo 안정).
 * 소유자가 page 인 legacy 항목 (`scope:"page" + page_id`) 은 제외한다 — 페이지 변수의
 * 정본은 canonical 페이지 노드 `state` 이고, 이 store 의 page 항목은 읽기 변환 잔재다.
 */
export const useProjectVariableDefs = (): VariableDef[] => {
  const variables = useDataStore((state) => state.variables);
  return useMemo(() => toProjectVariableDefs(variables), [variables]);
};

export function toProjectVariableDefs(
  variables: ReadonlyMap<string, Variable>,
): VariableDef[] {
  const out: VariableDef[] = [];
  for (const variable of variables.values()) {
    if (variable.owner && variable.owner.kind !== "project") continue;
    out.push({
      id: variable.id,
      name: variable.name,
      type: variable.type,
      ...(variable.defaultValue !== undefined
        ? { defaultValue: variable.defaultValue }
        : {}),
      ...(variable.persist ? { persist: true } : {}),
    });
  }
  return out;
}

/**
 * 특정 Variable 가져오기
 */
export const useVariable = (name: string): Variable | undefined => {
  const variables = useDataStore((state) => state.variables);
  return variables.get(name);
};

/**
 * Variable 런타임 값 가져오기 (defaultValue 포함)
 */
export const useVariableValue = (name: string): unknown => {
  const getRuntimeValue = useDataStore((state) => state.getRuntimeValue);
  return getRuntimeValue(name);
};

// ============================================
// Canvas Sync Utilities
// ============================================

/**
 * Variables를 Canvas RuntimeVariable 형태로 변환
 */
export const getVariablesForCanvas = () => {
  const { variables, getRuntimeValue } = useDataStore.getState();
  return Array.from(variables.values()).map((v) => ({
    id: v.id,
    name: v.name,
    type: v.type,
    defaultValue: getRuntimeValue(v.name), // 런타임 값 포함
    persist: v.persist,
    scope: v.scope,
    page_id: v.page_id,
  }));
};
