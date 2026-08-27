/**
 * Runtime Store - 독립 Zustand 스토어
 *
 * Builder와 완전히 분리된 상태 관리.
 * postMessage를 통해서만 데이터를 수신합니다.
 */

import { create } from "zustand";
import type {
  RuntimeStoreState,
  RuntimeElement,
  RuntimePage,
  RuntimeLayout,
  ThemeVar,
  DataSource,
  RuntimeDataTable,
  RuntimeApiEndpoint,
  RuntimeVariable,
  PreviewEditorPresentationActivePatch,
} from "./types";
import type { EditorMutationDescriptor } from "../../builder/presentation/editorPresentationTypes";
import type {
  EditorPresentationPatchMessage,
  EditorPresentationFinishMessage,
} from "../../builder/presentation/editorPresentationProtocol";
import {
  EMPTY_PREVIEW_PRESENTATION_PROJECTION_INDEX,
  type PreviewPresentationProjectionIndex,
} from "../presentation/editorPresentationProjectionIndex";

function hasShallowPatchChanges(
  prev: Record<string, unknown>,
  patch: Record<string, unknown>,
): boolean {
  for (const key of Object.keys(patch)) {
    if (prev[key] !== patch[key]) return true;
  }
  return false;
}

function deleteRecordKey<T>(
  record: Record<string, T | undefined>,
  key: string,
): Record<string, T | undefined> {
  if (!(key in record)) return record;
  const next = { ...record };
  delete next[key];
  return next;
}

function removePresentationSession(
  state: RuntimeStoreState,
  sessionId: string,
): RuntimeStoreState {
  const renderKeys =
    state.editorPresentationRenderKeysBySession[sessionId] ?? [];
  let renderOverrides = state.editorPresentationOverrides;
  for (const renderKey of renderKeys) {
    if (renderOverrides[renderKey]?.sessionId !== sessionId) continue;
    if (renderOverrides === state.editorPresentationOverrides) {
      renderOverrides = { ...renderOverrides };
    }
    delete renderOverrides[renderKey];
  }
  return {
    ...state,
    editorPresentationOverrides: renderOverrides,
    editorPresentationActivePatches: deleteRecordKey(
      state.editorPresentationActivePatches,
      sessionId,
    ),
    editorPresentationRenderKeysBySession: deleteRecordKey(
      state.editorPresentationRenderKeysBySession,
      sessionId,
    ),
    editorPresentationFinishLatches: deleteRecordKey(
      state.editorPresentationFinishLatches,
      sessionId,
    ),
    pendingEditorPresentationPatches: deleteRecordKey(
      state.pendingEditorPresentationPatches,
      sessionId,
    ),
  };
}

function materializePresentationPatch(
  state: RuntimeStoreState,
  patch: PreviewEditorPresentationActivePatch,
  projectionIndex: PreviewPresentationProjectionIndex,
): RuntimeStoreState {
  const previousRenderKeys =
    state.editorPresentationRenderKeysBySession[patch.sessionId] ?? [];
  const renderOverrides = { ...state.editorPresentationOverrides };
  for (const renderKey of previousRenderKeys) {
    if (renderOverrides[renderKey]?.sessionId === patch.sessionId) {
      delete renderOverrides[renderKey];
    }
  }

  const mutationsByRenderKey = new Map<string, EditorMutationDescriptor[]>();
  for (const mutation of patch.mutations) {
    for (const renderKey of projectionIndex.resolve(
      mutation.target,
      mutation.type === "style.patch" ? mutation.propagation : undefined,
    )) {
      const mutations = mutationsByRenderKey.get(renderKey);
      if (mutations) mutations.push(mutation);
      else mutationsByRenderKey.set(renderKey, [mutation]);
    }
  }

  // Canonical envelope가 먼저 와 projection rebuild가 아직 끝나지 않은 짧은
  // 구간에는 이전 render key를 유지해 old-canonical-without-overlay flash를 막는다.
  if (mutationsByRenderKey.size === 0 && previousRenderKeys.length > 0) {
    for (const renderKey of previousRenderKeys) {
      mutationsByRenderKey.set(renderKey, [...patch.mutations]);
    }
  }

  const nextRenderKeys = [...mutationsByRenderKey.keys()];
  for (const [renderKey, mutations] of mutationsByRenderKey) {
    renderOverrides[renderKey] = Object.freeze({
      mutations: Object.freeze(mutations),
      revision: patch.revision,
      sessionId: patch.sessionId,
    });
  }

  return {
    ...state,
    editorPresentationOverrides: renderOverrides,
    editorPresentationActivePatches: {
      ...state.editorPresentationActivePatches,
      [patch.sessionId]: patch,
    },
    editorPresentationRenderKeysBySession: {
      ...state.editorPresentationRenderKeysBySession,
      [patch.sessionId]: Object.freeze(nextRenderKeys),
    },
    editorPresentationLastRevisions: {
      ...state.editorPresentationLastRevisions,
      [patch.sessionId]: patch.revision,
    },
    pendingEditorPresentationPatches: deleteRecordKey(
      state.pendingEditorPresentationPatches,
      patch.sessionId,
    ),
  };
}

function applyPresentationPatchState(
  state: RuntimeStoreState,
  message: EditorPresentationPatchMessage,
): RuntimeStoreState {
  if (
    state.canonicalProjectId !== null &&
    state.canonicalProjectId !== message.projectId
  ) {
    return state;
  }
  const tombstone = state.editorPresentationTombstones[message.sessionId] ?? -1;
  const lastRevision =
    state.editorPresentationLastRevisions[message.sessionId] ?? -1;
  if (message.revision <= tombstone || message.revision <= lastRevision) {
    return state;
  }
  if (
    state.canonicalProjectId === null ||
    state.canonicalDocumentRevision < message.baseDocumentRevision ||
    state.editorPresentationProjectionIndex.revision !==
      state.canonicalDocumentRevision
  ) {
    const pending = state.pendingEditorPresentationPatches[message.sessionId];
    if (pending && pending.revision >= message.revision) return state;
    return {
      ...state,
      pendingEditorPresentationPatches: {
        ...state.pendingEditorPresentationPatches,
        [message.sessionId]: message,
      },
    };
  }
  if (message.mutations.length === 0) {
    const next = removePresentationSession(state, message.sessionId);
    return {
      ...next,
      editorPresentationLastRevisions: {
        ...next.editorPresentationLastRevisions,
        [message.sessionId]: message.revision,
      },
    };
  }
  return materializePresentationPatch(
    state,
    Object.freeze({
      mutations: message.mutations,
      revision: message.revision,
      sessionId: message.sessionId,
    }),
    state.editorPresentationProjectionIndex,
  );
}

export const createRuntimeStore = () =>
  create<RuntimeStoreState>((set, get) => ({
    // ============================================
    // Elements
    // ============================================
    elements: [],
    setElements: (elements: RuntimeElement[]) => set({ elements }),
    canonicalDocument: null,
    canonicalProjectId: null,
    canonicalDocumentRevision: -1,
    setCanonicalDocument: (canonicalDocument) =>
      // 문서가 새로 오면 실행 override 는 버린다 — 편집 결과를 덮어쓴 채로 남으면
      // 사용자가 방금 바꾼 값이 preview 에서 무시되는 것처럼 보인다.
      set({ canonicalDocument, interactionOverrides: {} }),
    receiveCanonicalDocument: (message) => {
      set((state) => {
        const projectChanged = state.canonicalProjectId !== message.projectId;
        if (
          !projectChanged &&
          message.documentRevision <= state.canonicalDocumentRevision
        ) {
          return state;
        }
        if (projectChanged || message.projectId === null) {
          return {
            ...state,
            canonicalDocument: message.document,
            canonicalProjectId: message.projectId,
            canonicalDocumentRevision: message.documentRevision,
            interactionOverrides: {},
            editorPresentationProjectionIndex:
              EMPTY_PREVIEW_PRESENTATION_PROJECTION_INDEX,
            editorPresentationOverrides: {},
            editorPresentationActivePatches: {},
            editorPresentationRenderKeysBySession: {},
            editorPresentationLastRevisions: {},
            editorPresentationTombstones: {},
            editorPresentationFinishLatches: {},
            pendingEditorPresentationPatches: {},
          };
        }

        let next: RuntimeStoreState = {
          ...state,
          canonicalDocument: message.document,
          canonicalDocumentRevision: message.documentRevision,
          interactionOverrides: {},
          editorPresentationProjectionIndex:
            EMPTY_PREVIEW_PRESENTATION_PROJECTION_INDEX,
        };
        for (const latch of Object.values(
          state.editorPresentationFinishLatches,
        )) {
          if (
            latch &&
            latch.committedDocumentRevision <= message.documentRevision
          ) {
            next = removePresentationSession(next, latch.sessionId);
          }
        }
        return next;
      });
    },

    editorPresentationProjectionIndex:
      EMPTY_PREVIEW_PRESENTATION_PROJECTION_INDEX,
    editorPresentationOverrides: {},
    editorPresentationActivePatches: {},
    editorPresentationRenderKeysBySession: {},
    editorPresentationLastRevisions: {},
    editorPresentationTombstones: {},
    editorPresentationFinishLatches: {},
    pendingEditorPresentationPatches: {},
    setEditorPresentationProjectionIndex: (index) => {
      set((state) => {
        if (index.revision !== state.canonicalDocumentRevision) return state;
        let next: RuntimeStoreState = {
          ...state,
          editorPresentationProjectionIndex: index,
          editorPresentationOverrides: {},
          editorPresentationRenderKeysBySession: {},
        };
        for (const active of Object.values(
          state.editorPresentationActivePatches,
        )) {
          if (active) {
            next = materializePresentationPatch(next, active, index);
          }
        }
        const pending = Object.values(state.pendingEditorPresentationPatches)
          .filter((message): message is EditorPresentationPatchMessage =>
            Boolean(message),
          )
          .sort((left, right) => left.revision - right.revision);
        for (const message of pending) {
          next = applyPresentationPatchState(next, message);
        }
        return next;
      });
    },
    applyEditorPresentationPatch: (message) => {
      set((state) => applyPresentationPatchState(state, message));
    },
    finishEditorPresentation: (message: EditorPresentationFinishMessage) => {
      set((state) => {
        if (state.canonicalProjectId !== message.projectId) return state;
        const tombstone =
          state.editorPresentationTombstones[message.sessionId] ?? -1;
        const lastRevision =
          state.editorPresentationLastRevisions[message.sessionId] ?? -1;
        if (message.revision <= tombstone || message.revision < lastRevision) {
          return state;
        }

        let next: RuntimeStoreState = {
          ...state,
          editorPresentationTombstones: {
            ...state.editorPresentationTombstones,
            [message.sessionId]: message.revision,
          },
          pendingEditorPresentationPatches: deleteRecordKey(
            state.pendingEditorPresentationPatches,
            message.sessionId,
          ),
        };
        if (
          state.canonicalDocumentRevision >= message.committedDocumentRevision
        ) {
          next = removePresentationSession(next, message.sessionId);
          return {
            ...next,
            editorPresentationLastRevisions: {
              ...next.editorPresentationLastRevisions,
              [message.sessionId]: message.revision,
            },
            editorPresentationTombstones: {
              ...next.editorPresentationTombstones,
              [message.sessionId]: message.revision,
            },
          };
        }

        next = materializePresentationPatch(
          next,
          Object.freeze({
            mutations: message.finalMutations,
            revision: message.revision,
            sessionId: message.sessionId,
          }),
          state.editorPresentationProjectionIndex,
        );
        return {
          ...next,
          editorPresentationFinishLatches: {
            ...next.editorPresentationFinishLatches,
            [message.sessionId]: Object.freeze({
              committedDocumentRevision: message.committedDocumentRevision,
              sessionId: message.sessionId,
              terminalRevision: message.revision,
            }),
          },
          editorPresentationTombstones: {
            ...next.editorPresentationTombstones,
            [message.sessionId]: message.revision,
          },
        };
      });
    },
    cancelEditorPresentation: (message) => {
      set((state) => {
        if (state.canonicalProjectId !== message.projectId) return state;
        const tombstone =
          state.editorPresentationTombstones[message.sessionId] ?? -1;
        if (message.revision < tombstone) return state;
        const next = removePresentationSession(state, message.sessionId);
        return {
          ...next,
          editorPresentationLastRevisions: {
            ...next.editorPresentationLastRevisions,
            [message.sessionId]: message.revision,
          },
          editorPresentationTombstones: {
            ...next.editorPresentationTombstones,
            [message.sessionId]: message.revision,
          },
        };
      });
    },

    // ── ADR-158 Phase 3 — 실행 override ──────────────────────────────
    //
    // canonical 렌더 경로(`CanonicalNodeRenderer`)는 `elements` 가 아니라
    // 문서 노드의 props 를 읽는다. 그래서 인터랙션 실행의 prop patch 를
    // `updateElementProps` 로 넣으면 **화면에 반영되지 않는다** (2026-08-16 실측:
    // dispatch 는 성공하는데 display 가 그대로).
    //
    // 문서를 직접 고치는 대신 별도 층에 쌓는다 — 실행은 런타임 동작이지 문서
    // 편집이 아니므로 undo/persist 대상이 아니고, 문서 재수신 때 리셋되는 것이
    // 옳은 수명이다.
    interactionOverrides: {},
    patchInteractionOverride: (id, patch) => {
      if (!id || !patch || Object.keys(patch).length === 0) return;
      set((state) => ({
        interactionOverrides: {
          ...state.interactionOverrides,
          [id]: { ...(state.interactionOverrides[id] ?? {}), ...patch },
        },
      }));
    },
    clearInteractionOverrides: () => set({ interactionOverrides: {} }),
    updateElementProps: (id: string, props: Record<string, unknown>) => {
      const patch = props ?? {};
      if (Object.keys(patch).length === 0) return;

      set((state) => {
        const index = state.elements.findIndex((el) => el.id === id);
        if (index < 0) return state;

        const current = state.elements[index];
        const currentProps = (current.props ?? {}) as Record<string, unknown>;
        if (!hasShallowPatchChanges(currentProps, patch)) return state;

        const nextElement: RuntimeElement = {
          ...current,
          props: { ...currentProps, ...patch },
        };

        const nextElements = state.elements.slice();
        nextElements[index] = nextElement;

        return { elements: nextElements };
      });
    },
    batchUpdateElementProps: (updates) => {
      if (updates.length === 0) return;
      set((state) => {
        const idToIndex = new Map<string, number>();
        for (let i = 0; i < state.elements.length; i++) {
          idToIndex.set(state.elements[i].id, i);
        }
        let nextElements: RuntimeElement[] | null = null;
        for (const { id, props } of updates) {
          const index = idToIndex.get(id);
          if (index === undefined) continue;
          const patch = props ?? {};
          if (Object.keys(patch).length === 0) continue;
          const source = nextElements ?? state.elements;
          const current = source[index];
          const currentProps = (current.props ?? {}) as Record<string, unknown>;
          if (!hasShallowPatchChanges(currentProps, patch)) continue;
          if (!nextElements) nextElements = state.elements.slice();
          nextElements[index] = {
            ...current,
            props: { ...currentProps, ...patch },
          };
        }
        return nextElements ? { elements: nextElements } : state;
      });
    },

    // 🚀 Phase 4: Delta Update Actions
    /**
     * 단일 요소 추가 (Delta)
     */
    addElement: (element: RuntimeElement) => {
      set((state) => ({
        elements: [...state.elements, element],
      }));
    },

    /**
     * 다수 요소 추가 (Delta batch)
     */
    addElements: (newElements: RuntimeElement[]) => {
      set((state) => ({
        elements: [...state.elements, ...newElements],
      }));
    },

    /**
     * 단일 요소 삭제 (Delta)
     */
    removeElement: (elementId: string) => {
      set((state) => ({
        elements: state.elements.filter((el) => el.id !== elementId),
      }));
    },

    /**
     * 다수 요소 삭제 (Delta batch)
     */
    removeElements: (elementIds: string[]) => {
      const idSet = new Set(elementIds);
      set((state) => ({
        elements: state.elements.filter((el) => !idSet.has(el.id)),
      }));
    },

    /**
     * 요소 부분 업데이트 (Delta - props, parentId)
     */
    updateElement: (elementId: string, updates: Partial<RuntimeElement>) => {
      set((state) => ({
        elements: state.elements.map((el) =>
          el.id === elementId ? { ...el, ...updates } : el,
        ),
      }));
    },

    /**
     * 요소 배열 반환 (messageHandler에서 사용)
     */
    getElements: () => get().elements,

    // ============================================
    // Pages
    // ============================================
    pages: [],
    setPages: (pages: RuntimePage[]) => set({ pages }),
    currentPageId: null,
    setCurrentPageId: (pageId: string | null) => set({ currentPageId: pageId }),
    currentPath: "/",
    setCurrentPath: (path: string) => set({ currentPath: path }),

    // ============================================
    // Route Parameters (동적 라우트 파라미터)
    // ============================================
    routeParams: {},
    setRouteParams: (params: Record<string, string>) =>
      set({ routeParams: params }),

    // ============================================
    // Layouts (Nested Routes & Slug System)
    // ============================================
    layouts: [],
    setLayouts: (layouts: RuntimeLayout[]) => set({ layouts }),
    currentLayoutId: null,
    setCurrentLayoutId: (layoutId: string | null) =>
      set({ currentLayoutId: layoutId }),

    // ============================================
    // Theme
    // ============================================
    themeVars: [],
    setThemeVars: (vars: ThemeVar[]) => {
      // 기존 vars에 새 vars를 병합 (name+isDark 기준 덮어쓰기)
      const existing = get().themeVars;
      const merged = [...existing];
      for (const newVar of vars) {
        const idx = merged.findIndex(
          (v) => v.name === newVar.name && v.isDark === newVar.isDark,
        );
        if (idx >= 0) {
          merged[idx] = newVar;
        } else {
          merged.push(newVar);
        }
      }
      set({ themeVars: merged });
      // CSS 변수 적용
      applyThemeVars(merged);
    },
    isDarkMode: false,
    setDarkMode: (isDark: boolean) => {
      set({ isDarkMode: isDark });
      document.documentElement.setAttribute(
        "data-theme",
        isDark ? "dark" : "light",
      );
      // 테마 변수 재적용 (dark/light CSS 블록이 data-theme에 의존하므로 재생성 필요)
      applyThemeVars(get().themeVars);

      // body 인라인 스타일이 하드코딩(#1a1a1a/#ffffff)된 기존 프로젝트 대응:
      // CSS 변수로 강제 override하여 dark mode가 반영되도록 함
      if (document.body) {
        document.body.style.color = "var(--fg)";
        document.body.style.backgroundColor = "var(--bg)";
      }
    },

    // ============================================
    // Data Sources
    // ============================================
    dataSources: [],
    setDataSources: (sources: DataSource[]) => set({ dataSources: sources }),

    // ============================================
    // DataTables (PropertyDataBinding용)
    // ============================================
    collections: [],
    setCollections: (tables: RuntimeDataTable[]) =>
      set({ collections: tables }),

    // ============================================
    // ApiEndpoints (PropertyDataBinding용)
    // ============================================
    apiEndpoints: [],
    setApiEndpoints: (endpoints: RuntimeApiEndpoint[]) =>
      set({ apiEndpoints: endpoints }),

    // ============================================
    // Variables (PropertyDataBinding용)
    // ============================================
    variables: [],
    setVariables: (variables: RuntimeVariable[]) => {
      set({ variables });
      // Variables의 defaultValue를 appState/pageStates에 초기화
      const currentAppState = get().appState;
      const newAppState = { ...currentAppState };

      variables.forEach((variable) => {
        if (
          variable.scope === "global" &&
          variable.defaultValue !== undefined
        ) {
          // 이미 값이 설정되어 있지 않은 경우에만 기본값 설정
          if (!(variable.name in newAppState)) {
            newAppState[variable.name] = variable.defaultValue;
          }
        }
      });

      set({ appState: newAppState });
    },

    // ============================================
    // Auth Context
    // ============================================
    authToken: null,
    setAuthToken: (token: string | null) => set({ authToken: token }),

    // ============================================
    // State Hierarchy
    // ============================================
    appState: {},
    pageStates: new Map(),
    componentStates: new Map(),

    setState: (path: string, value: unknown) => {
      const [scope, ...rest] = path.split(".");
      const key = rest.join(".");

      switch (scope) {
        case "app":
          set((s) => ({ appState: { ...s.appState, [key]: value } }));
          break;

        case "page": {
          const pageId = get().currentPageId;
          if (pageId) {
            set((s) => {
              const pageStates = new Map(s.pageStates);
              const pageState = pageStates.get(pageId) || {};
              pageStates.set(pageId, { ...pageState, [key]: value });
              return { pageStates };
            });
          }
          break;
        }

        case "component": {
          // elementId.propKey 형식
          const dotIndex = key.indexOf(".");
          if (dotIndex > 0) {
            const elementId = key.slice(0, dotIndex);
            const propKey = key.slice(dotIndex + 1);
            set((s) => {
              const componentStates = new Map(s.componentStates);
              const componentState = componentStates.get(elementId) || {};
              componentStates.set(elementId, {
                ...componentState,
                [propKey]: value,
              });
              return { componentStates };
            });
          }
          break;
        }

        default:
          // scope가 없으면 appState로 처리
          set((s) => ({ appState: { ...s.appState, [path]: value } }));
      }
    },

    getState: (path: string) => {
      const [scope, ...rest] = path.split(".");
      const key = rest.join(".");
      const state = get();

      switch (scope) {
        case "app":
          return getNestedValue(state.appState, key);

        case "page":
          return getNestedValue(
            state.pageStates.get(state.currentPageId || "") || {},
            key,
          );

        case "component": {
          const dotIndex = key.indexOf(".");
          if (dotIndex > 0) {
            const elementId = key.slice(0, dotIndex);
            const propKey = key.slice(dotIndex + 1);
            return getNestedValue(
              state.componentStates.get(elementId) || {},
              propKey,
            );
          }
          return undefined;
        }

        default:
          // scope가 없으면 appState에서 찾기
          return getNestedValue(state.appState, path);
      }
    },

    // ============================================
    // Ready State
    // ============================================
    isReady: false,
    setReady: (ready: boolean) => set({ isReady: ready }),
  }));

// ============================================
// Helper Functions
// ============================================

/**
 * 중첩된 객체에서 값 가져오기
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  if (!path) return obj;

  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * Theme 변수를 CSS 변수로 적용.
 * 기존 <style> 요소를 재사용하여 불필요한 DOM 조작(remove→create→append)을 방지합니다.
 * data-theme 속성은 setDarkMode()가 단일 관리하므로 여기서 중복 설정하지 않습니다.
 */
function applyThemeVars(vars: ThemeVar[]): void {
  let styleEl = document.getElementById(
    "runtime-theme-vars",
  ) as HTMLStyleElement | null;

  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "runtime-theme-vars";
    document.head.appendChild(styleEl);
  }

  const lightVars = vars.filter((v) => !v.isDark);
  const darkVars = vars.filter((v) => v.isDark);

  let cssText = ":root {\n";
  lightVars.forEach((v) => {
    cssText += `  ${v.name}: ${v.value};\n`;
  });
  cssText += "}\n";

  if (darkVars.length > 0) {
    cssText += '[data-theme="dark"] {\n';
    darkVars.forEach((v) => {
      cssText += `  ${v.name}: ${v.value};\n`;
    });
    cssText += "}\n";
  }

  styleEl.textContent = cssText;
}

// ============================================
// Store Instance & Hooks
// ============================================

// 싱글톤 스토어 인스턴스
let storeInstance: ReturnType<typeof createRuntimeStore> | null = null;

export function getRuntimeStore() {
  if (!storeInstance) {
    storeInstance = createRuntimeStore();
  }
  return storeInstance;
}

export function useRuntimeStore<T>(
  selector: (state: RuntimeStoreState) => T,
): T {
  const store = getRuntimeStore();
  return store(selector);
}

// 전체 상태 접근 (non-React 환경용)
export function getRuntimeStoreState() {
  return getRuntimeStore().getState();
}
