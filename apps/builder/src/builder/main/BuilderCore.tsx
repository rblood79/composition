import React, { useState, useCallback, useEffect, useRef } from "react";
import { useParams } from "react-router";
import { Key } from "react-aria-components";

import { useStore } from "../stores";
import { historyManager } from "../stores/history";
import { applySnapshotDocument } from "../stores/history/snapshotRestore";
import { applyCanonicalThemes } from "@/adapters/canonical";
import type { BreakpointName } from "@composition/shared";
import { Button } from "@composition/shared/components";

/**
 * ADR-154: BuilderHeader breakpoint preset(id) → 반응형 BreakpointName 매핑.
 * tablet/mobile 만 override tier 를 가지며 그 외(desktop, 구 localStorage 의 laptop 등)는
 * desktop tier 로 resolve. 아트보드 토글은 desktop/tablet/mobile 3개 (laptop 제거 2026-07-21).
 */
const VALID_BREAKPOINT_IDS = new Set<string>(["desktop", "tablet", "mobile"]);

type ProjectBootstrapPhase = "project" | "data" | "renderer" | "error";

const CANVAS_BOOTSTRAP_PROGRESS: Record<CanvasBootstrapPhase, number> = {
  idle: 55,
  wasm: 65,
  fonts: 75,
  surface: 88,
  "first-frame": 95,
  ready: 100,
  error: 95,
};

function resolveBootstrapProgress(
  projectPhase: ProjectBootstrapPhase,
  canvasPhase: CanvasBootstrapPhase,
  rendererReady: boolean,
): number {
  if (rendererReady) return 100;
  if (projectPhase === "project") return 15;
  if (projectPhase === "data") return 45;
  if (projectPhase === "error") return 0;
  return CANVAS_BOOTSTRAP_PROGRESS[canvasPhase];
}

function toResponsiveBreakpoint(value: string): BreakpointName {
  return value === "tablet" || value === "mobile" ? value : "desktop";
}

// 패널 등록 (side effect import - registerAllPanels() 자동 실행)
import "../panels";

import { BuilderHeader, Breakpoint } from "./BuilderHeader";
import {
  CANVAS_BREAKPOINTS,
  CANVAS_VIEWPORT,
} from "../workspace/canvasBreakpoints";
import { resolvePageLayoutBounds } from "../workspace/canvas/pageLayoutConstants";
import {
  useCanvasLifecycleStore,
  useViewportSyncStore,
  type CanvasBootstrapPhase,
} from "../workspace/canvas/stores";
import { CanvasSelectionShortcutsHost } from "../panels/properties/CanvasSelectionShortcuts";
import { BuilderCanvas } from "./BuilderCanvas";

import { BuilderViewport } from "./BuilderViewport";
import { Workspace } from "../workspace";
import { isWebGLCanvas, isCanvasCompareMode } from "../../utils/featureFlags";
import { startCanonicalDocumentSync } from "../stores/canonical/canonicalDocumentSync";
import { useCanonicalDocumentStore } from "../stores/canonical/canonicalDocumentStore";
// ADR-116 Phase 2 G3 Step 4 — BuilderCore layout refresh dual-mode
import {
  getActiveCanonicalDocument,
  subscribeCanonicalStore,
} from "../stores/canonical/canonicalElementsBridge";
import { visitCanonicalDocumentElements } from "../stores/canonical/canonicalElementsView";
// ADR-116 Phase 3 G4 — mutation reverse wrapper (D18=A 정합)
import {
  setElementsCanonicalPrimary,
  registerCanonicalMutationStoreActions,
} from "@/adapters/canonical/canonicalMutations";
// ADR-184 — mutation 순서 러너 bridge (rebuildIndexes DI)
import { registerCanonicalMutationRunnerBridge } from "@/adapters/canonical/canonicalMutationRunner";
import { PanelWorkspace } from "../layout";
import {
  ToastContainer,
  CommandPalette,
  AgentCommandConfirmDialogHost,
  EditingSemanticsImpactDialogHost,
} from "../components";

import {
  useErrorHandler,
  usePageManager,
  usePageLoader,
  useAdjacentPagePreload,
  useAutoRecovery,
  useToast,
  useIframeMessenger,
  useGlobalKeyboardShortcuts,
} from "@/builder/hooks";
// (ADR-128) cloud `Project` type 제거 — IndexedDB 가 보존하는 최소 필드만 local 표현.
interface Project {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}
import {
  useThemeConfigStore,
  type DarkModePreference,
  type RadiusScale,
} from "../../stores/themeConfigStore";
import type { TintPreset } from "../../utils/theme/tintToSkiaColors";
import { useUiStore } from "../../stores/uiStore";
import { getDB } from "../../lib/db";
import { getCanonicalReusableFrameLayouts } from "../stores/canonical/canonicalFrameStore";
import { useDataTableStore } from "../stores/datatable";
import { useDataStore } from "../stores/data";
import type { Element } from "../../types/core/store.types";

import { MessageService } from "../../utils/messaging";
import { isValidPreviewMessage } from "../../utils/messageValidation";
import {
  getValueByPath,
  upsertData,
  appendData,
  mergeData,
  safeJsonParse,
} from "../../utils/dataHelpers";
import {
  downloadProjectAsJson,
  loadProjectFromFile,
} from "@composition/shared/utils";
import { loadFontRegistry, saveRegistryAndNotify } from "../fonts/customFonts";
import { useI18n } from "../../i18n";
import {
  NEUTRAL_PALETTES,
  type NeutralPreset,
} from "../../utils/theme/neutralToSkiaColors";
import {
  applyEditingSemanticsFixture,
  shouldApplyEditingSemanticsFixture,
} from "../dev/editingSemanticsFixture";
import {
  applyPathHeavy117Fixture,
  shouldApplyPathHeavy117Fixture,
} from "../dev/pathHeavy117Fixture";

function getActiveCanonicalBuilderElements(): Element[] | null {
  const doc = getActiveCanonicalDocument();
  if (!doc) return null;

  const elements: Element[] = [];
  visitCanonicalDocumentElements(doc, (element) => {
    elements.push(element);
  });
  return elements;
}

function getCanonicalOrBootstrapBuilderElements(state: {
  elements?: Element[];
  pages?: Array<{ id: string }>;
}): Element[] {
  const canonicalElements = getActiveCanonicalBuilderElements();
  const { elements: legacyElements = [] } = state;
  if (canonicalElements) {
    const canonicalIds = new Set(
      canonicalElements.map((element) => element.id),
    );
    const pageIds = new Set((state.pages ?? []).map((page) => page.id));
    const missingPageBodyShells = legacyElements.filter(
      (element) =>
        !canonicalIds.has(element.id) &&
        element.type === "body" &&
        element.parent_id == null &&
        typeof element.page_id === "string" &&
        pageIds.has(element.page_id),
    );
    return missingPageBodyShells.length > 0
      ? [...canonicalElements, ...missingPageBodyShells]
      : canonicalElements;
  }
  return legacyElements;
}

function getPageShellBridgeElements(state: {
  elements?: Element[];
  pages?: Array<{ id: string }>;
}): Element[] {
  // Page store mutations are the one remaining legacy page-shell surface.
  // At this boundary the active canonical document is stale by definition:
  // append must include the newly-created body shell, and delete must exclude
  // removed-page elements after instance materialization.
  //
  // 2026-07-14 (Task #8 요소 소실 사건): raw `state.elements` 전체 교체 금지.
  // legacy store 가 부분 상태 (store-level unload / HMR 분리 인스턴스 / 부분
  // hydrate) 일 때 canonical 전체가 그 부분 집합으로 잘리고 자동 persist 가
  // 손실을 확정했다. canonical-first 병합 (누락 body shell 보충) 을 base 로,
  // 삭제 페이지 제외만 legacy pages 목록에서 반영한다.
  const pageIds = new Set((state.pages ?? []).map((page) => page.id));
  return getCanonicalOrBootstrapBuilderElements(state).filter(
    (element) => element.page_id == null || pageIds.has(element.page_id),
  );
}

function hasPageShellTopologyChanged(
  previousPages: ReadonlyArray<{ id: string }> | undefined,
  nextPages: ReadonlyArray<{ id: string }> | undefined,
): boolean {
  if (previousPages === nextPages) return false;
  if (!previousPages || !nextPages) return true;
  if (previousPages.length !== nextPages.length) return true;

  const previousIds = new Set(previousPages.map((page) => page.id));
  for (const page of nextPages) {
    if (!previousIds.has(page.id)) return true;
  }
  return false;
}

export const BuilderCore: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { t } = useI18n();
  const [projectInfo, setProjectInfo] = useState<Project | null>(null);
  // effect가 시작되기 전 첫 render부터 loading이어야 chrome flash가 없다.
  const [projectBootstrapPhase, setProjectBootstrapPhase] =
    useState<ProjectBootstrapPhase>("project");
  const [hasPaintedBootstrapCompletion, setHasPaintedBootstrapCompletion] =
    useState(false);
  const isCanvasReady = useCanvasLifecycleStore((state) => state.isCanvasReady);
  const canvasBootstrapPhase = useCanvasLifecycleStore(
    (state) => state.bootstrapPhase,
  );

  // Store 상태
  // 🚀 최적화: elements/currentPageId 구독 제거 - 필요할 때 getState()로 읽기
  // const selectedElementId = useStore((state) => state.selectedElementId);  // 사용하지 않음
  const setSelectedElement = useStore((state) => state.setSelectedElement);
  // ADR-154: 반응형 breakpoint bridge (기존 선택기 → activeBreakpoint SSOT)
  const setActiveBreakpoint = useStore((state) => state.setActiveBreakpoint);
  const switchPagePositionsBreakpoint = useStore(
    (state) => state.switchPagePositionsBreakpoint,
  );
  const invalidateLayout = useStore((state) => state.invalidateLayout);
  // UI 설정 (글로벌 uiStore에서 가져옴 - Phase 1)
  const themeMode = useUiStore((state) => state.themeMode);
  const setHistoryInfo = useStore((state) => state.setHistoryInfo);
  const toggleWorkflowOverlay = useStore(
    (state) => state.toggleWorkflowOverlay,
  );
  const pageShellBridgeSuspendedRef = useRef(false);

  // ADR-116 Phase 5 G6-2 third slice — canonicalMutations DI registration.
  // wrapper API (canonicalMutations.ts) 의 ESM circular import chain 차단을
  // 위해 callback registration pattern 사용. mount + projectId 변경 시 등록.
  //
  // 2026-05-02 §8.7 확장 — canonical primary reverse path 용 callback 2 추가:
  // - getCurrentLegacySnapshot: canonical snapshot 우선 + bootstrap fallback
  // - getCurrentProjectId: 활성 projectId (canonical store setDocument target)
  useEffect(() => {
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => {
        const state = useStore.getState();
        return {
          elements: getCanonicalOrBootstrapBuilderElements(state),
          pages: state.pages,
          layouts: getCanonicalReusableFrameLayouts(),
        };
      },
      getCurrentProjectId: () => projectId ?? null,
    });
    // ADR-184 — 러너 ③ 스테이지 (rebuildIndexes) DI. persist 는 러너가
    // canonical store + getDB 로 직접 수행하므로 bridge 대상 아님.
    registerCanonicalMutationRunnerBridge({
      rebuildIndexes: () => useStore.getState()._rebuildIndexes(),
    });
  }, [projectId]);

  // ADR-196 Phase 3 — `window.__compositionAgent` (DEV 전용). Chrome MCP 로 빌더를
  // 조작하는 외부 agent 와 live 게이트가 쓰는 진입점이고, AI 패널 도구와 같은 executor 를
  // 지난다. 프로덕션 번들에는 들어가지 않는다 (HC6).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let uninstall: (() => void) | null = null;
    let cancelled = false;
    // 동적 import — 프로덕션 번들에 executor 체인이 실리지 않는다 (HC6).
    void import("../../services/agent/devAgentEntry").then((m) => {
      if (cancelled) return;
      uninstall = m.installDevAgentEntry();
    });
    return () => {
      cancelled = true;
      uninstall?.();
    };
  }, []);

  // ADR-116 direct cutover — canonical document write-through sync.
  useEffect(() => {
    if (!projectId) return;
    const stop = startCanonicalDocumentSync(projectId);
    return stop;
  }, [projectId]);

  // ADR-116 direct cutover — page shell mutations also update the canonical doc.
  // `appendPageShell`, `setPages`, `removePageLocal` are still legacy page-store
  // surfaces; this bridge keeps CompositionDocument as the persisted SSOT.
  useEffect(() => {
    if (!projectId) return;
    let pagesRef = useStore.getState().pages;
    return useStore.subscribe((state) => {
      if (!hasPageShellTopologyChanged(pagesRef, state.pages)) {
        pagesRef = state.pages;
        return;
      }
      pagesRef = state.pages;
      if (pageShellBridgeSuspendedRef.current) return;
      // pages 가 빈 과도 상태 (store reset / HMR 재생성 / init 직전) 에서
      // 재구성하면 전 페이지 요소가 제외 대상이 된다 — 재구성 금지 (Task #8).
      if (!state.pages || state.pages.length === 0) return;
      setElementsCanonicalPrimary(getPageShellBridgeElements(state));
    });
  }, [projectId]);

  // ADR-116 direct cutover — active CompositionDocument 를 DB primary store 로 저장.
  useEffect(() => {
    if (!projectId) return;

    let disposed = false;
    let scheduled = false;

    const persist = async () => {
      const doc = getActiveCanonicalDocument();
      if (!doc || disposed) return;
      try {
        const db = await getDB();
        if (!disposed) {
          // 자동 구독 persist — 급감 가드 대상 (allowShrink 전달 금지).
          // 부분 상태가 canonical 에 투영된 경우 여기서 write 가 차단된다.
          await db.documents.put(projectId, doc, {
            reason: "canonical-subscriber",
          });
        }
      } catch (error) {
        console.warn("[ADR-116] canonical document persist failed:", error);
      }
    };

    const schedulePersist = () => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        void persist();
      });
    };

    const unsubscribe = subscribeCanonicalStore(schedulePersist);
    schedulePersist();

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [projectId]);

  // 히스토리 정보 업데이트 (구독 기반)
  useEffect(() => {
    const updateHistoryInfo = () => {
      const info = historyManager.getCurrentPageHistory();
      setHistoryInfo(info);
    };

    updateHistoryInfo();
    const unsubscribe = historyManager.subscribe(updateHistoryInfo);
    return unsubscribe;
  }, [setHistoryInfo]);

  // Theme Mode 적용 (Builder UI 전용 - Preview와 분리)
  //
  // 이 속성은 색 선택 외에 **"빌더가 mount 중"** 이라는 뜻도 겸한다 —
  // builder-system.css 의 portal fallback(`#root` 밖 body 자식)이 이걸 게이트로 쓰므로,
  // unmount 시 지우지 않으면 dashboard/auth 라우트의 overlay 까지 빌더 팔레트를 받는다.
  useEffect(() => {
    const applyTheme = (theme: "light" | "dark") => {
      document.documentElement.setAttribute("data-builder-theme", theme);
    };
    const clearTheme = () => {
      document.documentElement.removeAttribute("data-builder-theme");
    };

    if (themeMode === "auto") {
      // 시스템 테마 감지
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
        applyTheme(e.matches ? "dark" : "light");
      };

      // 초기 테마 적용
      handleChange(mediaQuery);

      // 시스템 테마 변경 리스너
      mediaQuery.addEventListener("change", handleChange);

      return () => {
        mediaQuery.removeEventListener("change", handleChange);
        clearTheme();
      };
    } else {
      // 명시적인 테마 적용
      applyTheme(themeMode);
      return clearTheme;
    }
  }, [themeMode]);

  // 훅 사용
  const { error, setError, handleError, clearError } = useErrorHandler();
  // const { handleAddElement } = useElementCreator();  // 사용하지 않음
  const {
    handleIframeLoad,
    handleMessage,
    // iframeUndo, iframeRedo는 사용하지 않음
    // updateElementProps는 제거됨
    iframeReadyState,
  } = useIframeMessenger();
  const {
    pages,
    // selectedPageId,  // 사용하지 않음
    fetchElements,
    // addPage,  // 사용하지 않음
    initializeProject,
    // pageList,  // 사용하지 않음
  } = usePageManager();
  // 🚀 Phase 5: 페이지 Lazy Loading 통합
  const { isLoading: isPageLoading, stats: pageLoaderStats } = usePageLoader();
  // 인접 페이지 프리로드 (백그라운드)
  useAdjacentPagePreload();

  // 🚀 Phase 7: Toast 알림
  const { toasts, showToast, dismissToast } = useToast();

  // 🚀 Phase 7: 전역 키보드 단축키 (Undo/Redo, Zoom)
  useGlobalKeyboardShortcuts();

  // 🚀 Phase 7: 자동 복구 통합
  const { stats: recoveryStats } = useAutoRecovery({
    onRecovery: useCallback(
      (reason: string) => {
        showToast("info", t("messages.perfRecovered", { reason }), 8000);
      },
      [showToast, t],
    ),
    onWarning: useCallback(
      (metrics: { healthScore: number }) => {
        showToast(
          "warning",
          t("messages.perfWarning", { health: metrics.healthScore }),
          5000,
        );
      },
      [showToast, t],
    ),
  });

  // Dev 모드에서 복구 통계 로깅 (필요 시 구현)

  const _recoveryStatsForDebug = recoveryStats;

  // Dev 모드에서 페이지 로더 통계 로깅 (필요 시 구현)

  const _pageLoaderStatsForDebug = pageLoaderStats;

  // Local 상태
  const [breakpoint, setBreakpoint] = useState<Set<Key>>(() => {
    // 로컬 스토리지에서 저장된 breakpoint 복원.
    // laptop 토글 제거(2026-07-21) 이전에 "laptop" 이 저장돼 있으면 무효 id 이므로
    // desktop 으로 정합화 (토글에 없는 key 선택 방지).
    const savedBreakpoint = localStorage.getItem("builder-breakpoint");
    if (savedBreakpoint && VALID_BREAKPOINT_IDS.has(savedBreakpoint)) {
      return new Set<Key>([savedBreakpoint]);
    }
    return new Set<Key>(["desktop"]);
  });

  // 프레임 크기는 `canvasBreakpoints` 가 SSOT — 프리셋 썸네일도 같은 값을 기준으로 삼는다
  // (ADR-168 R4). 여기서 리터럴로 다시 적으면 두 기준이 어긋날 자리가 생긴다.
  const [breakpoints] = useState<Breakpoint[]>(() => [...CANVAS_BREAKPOINTS]);

  // breakpoint 변경 시 로컬 스토리지에 저장
  const handleBreakpointChange = useCallback(
    (value: Key) => {
      const newBreakpoint = new Set<Key>([value]);
      setBreakpoint(newBreakpoint);
      localStorage.setItem("builder-breakpoint", String(value));
      // ADR-154: 반응형 override resolve SSOT 동기화 + 전역 재레이아웃.
      // desktop → desktop tier, tablet/mobile → 동명 tier.
      const nextBreakpoint = toResponsiveBreakpoint(String(value));
      const currentBreakpoint = useStore.getState().activeBreakpoint;
      const viewport = useViewportSyncStore.getState();
      const pageLayoutBounds = resolvePageLayoutBounds(
        viewport.containerSize.width,
        viewport.zoom,
        useStore.getState().pageGap,
        viewport.pageLayoutPanelMetrics,
      );
      switchPagePositionsBreakpoint(currentBreakpoint, nextBreakpoint, {
        pageWidth: CANVAS_VIEWPORT[nextBreakpoint].width,
        pageHeight: CANVAS_VIEWPORT[nextBreakpoint].height,
        gap: useStore.getState().pageGap,
        direction: useStore.getState().pageLayoutDirection,
        availableWidth: pageLayoutBounds.availableWidth,
        pageStartX: pageLayoutBounds.leftInset,
      });
      setActiveBreakpoint(nextBreakpoint);
      invalidateLayout();
    },
    [invalidateLayout, setActiveBreakpoint, switchPagePositionsBreakpoint],
  );

  // ADR-154: 마운트/복원 시 활성 breakpoint 를 store 에 1회 동기화
  // (localStorage 로 tablet/mobile 로 복원된 경우 store 기본값 desktop 과 정합).
  useEffect(() => {
    const initial = Array.from(breakpoint)[0];
    if (initial != null) {
      const nextBreakpoint = toResponsiveBreakpoint(String(initial));
      const currentBreakpoint = useStore.getState().activeBreakpoint;
      const viewport = useViewportSyncStore.getState();
      const pageLayoutBounds = resolvePageLayoutBounds(
        viewport.containerSize.width,
        viewport.zoom,
        useStore.getState().pageGap,
        viewport.pageLayoutPanelMetrics,
      );
      switchPagePositionsBreakpoint(currentBreakpoint, nextBreakpoint, {
        pageWidth: CANVAS_VIEWPORT[nextBreakpoint].width,
        pageHeight: CANVAS_VIEWPORT[nextBreakpoint].height,
        gap: useStore.getState().pageGap,
        direction: useStore.getState().pageLayoutDirection,
        availableWidth: pageLayoutBounds.availableWidth,
        pageStartX: pageLayoutBounds.leftInset,
      });
      setActiveBreakpoint(nextBreakpoint);
    }
    // 마운트 1회만 — 이후 변경은 handleBreakpointChange 경유
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setActiveBreakpoint, switchPagePositionsBreakpoint]);

  // 프로젝트 정보 가져오기 (IndexedDB만 조회 - Supabase 동기화는 대시보드에서 처리)
  useEffect(() => {
    const fetchProjectInfo = async () => {
      if (!projectId) return;

      try {
        const db = await getDB();
        const localProject = await db.projects.getById(projectId);
        if (localProject) {
          setProjectInfo(localProject as Project);
        } else {
          console.warn("[BuilderCore] 프로젝트를 찾을 수 없음:", projectId);
        }
      } catch (error) {
        console.error("[BuilderCore] 프로젝트 정보 로드 실패:", error);
      }
    };

    fetchProjectInfo();
  }, [projectId]);

  // 프로젝트 초기화 (중복 실행 방지)
  const isInitializing = useRef(false);
  const initializedProjectId = useRef<string | null>(null);

  useEffect(() => {
    const initialize = async () => {
      // 중복 실행 방지: 이미 초기화 중이거나 같은 프로젝트가 초기화되었으면 스킵
      if (
        !projectId ||
        isInitializing.current ||
        initializedProjectId.current === projectId
      ) {
        return;
      }

      isInitializing.current = true;

      setProjectBootstrapPhase("project");
      useCanvasLifecycleStore.getState().beginCanvasBootstrap(projectId);
      pageShellBridgeSuspendedRef.current = true;
      const result = await initializeProject(projectId).finally(() => {
        pageShellBridgeSuspendedRef.current = false;
      });

      if (!result.success) {
        setError(result.error?.message || t("errors.projectInitFailed"));
        setProjectBootstrapPhase("error");
        isInitializing.current = false;
        return;
      }

      setProjectBootstrapPhase("data");

      // ⭐ DataStore 초기화 (Variables, Collections, ApiEndpoints) — edit mode 무관.
      // Why: collections/variables 는 project 스코프이고 page 모드에서도 소비된다
      //   (PropertyDataBinding 컬렉션 피커 / useCollectionData 행 데이터).
      //   과거 `editMode === "layout"` 게이트는 frame element 로드 블록의 잔재로
      //   (본문은 2026-05-02 canonical 전환에서 제거됨), 기본값인 page 모드 boot 에서
      //   초기화가 통째로 skip 되어 DataTable 패널을 한 번 열기 전까지 컬렉션 목록이
      //   비어 보였다.
      try {
        await useDataStore.getState().initializeForProject(projectId);
      } catch (error) {
        console.error("[BuilderCore] DataStore 초기화 실패:", error);
      }

      // ADR-021 Phase C: localStorage에서 ThemeConfig 복원
      useThemeConfigStore.getState().initThemeConfig(projectId);

      // ADR-110 Phase 2 ts-3.1: canonical themes write-through (env flag opt-in)
      // env flag 미설정 시 호출 안 함 — Phase 1 (read-only snapshot) 동작 유지.
      // ADR-116 projection 제거: active canonical document 만 사용한다.
      if (import.meta.env.VITE_ADR110_P2_THEMES_WRITE_THROUGH === "true") {
        try {
          const doc = getActiveCanonicalDocument();
          if (doc) {
            const themeState = useThemeConfigStore.getState();
            const applied = applyCanonicalThemes(doc, {
              setTint: (tint) => themeState.setTint(tint as TintPreset),
              setDarkMode: (mode) =>
                themeState.setDarkMode(mode as DarkModePreference),
              setNeutral: (neutral) =>
                themeState.setNeutral(neutral as NeutralPreset),
              setRadiusScale: (scale) =>
                themeState.setRadiusScale(scale as RadiusScale),
            });
            if (applied && import.meta.env.DEV) {
              console.log(
                "[ADR-110 P2 ts-3.1] applied canonical themes from document",
              );
            }
          }
        } catch (err) {
          console.warn("[ADR-110 P2 ts-3.1] applyCanonicalThemes failed:", err);
        }
      }

      // Preview iframe에 초기 테마 토큰 전송
      // iframe이 준비되면 자동으로 전송되도록 별도 useEffect 사용

      if (import.meta.env.DEV && shouldApplyEditingSemanticsFixture()) {
        applyEditingSemanticsFixture(useStore.getState());
      }

      if (import.meta.env.DEV && shouldApplyPathHeavy117Fixture()) {
        applyPathHeavy117Fixture(projectId, useStore.getState());
      }

      const canonicalState = useCanonicalDocumentStore.getState();
      if (canonicalState.currentProjectId !== projectId) {
        setError(t("errors.projectInitFailed"));
        setProjectBootstrapPhase("error");
        isInitializing.current = false;
        return;
      }

      // document/data/theme가 모두 반영된 최소 revision을 target으로 고정한다.
      // 이 호출만으로 ready가 되지 않으며, Skia main surface가 해당 revision
      // 이상을 실제 flush한 뒤 acknowledgment해야 chrome이 열린다.
      useCanvasLifecycleStore.getState().setPresentationTarget({
        projectId,
        documentRevision: canonicalState.documentVersion,
      });
      setProjectBootstrapPhase("renderer");
      initializedProjectId.current = projectId;
      isInitializing.current = false;
    };

    initialize();

    // 컴포넌트 언마운트 시 정리
    return () => {
      MessageService.clearIframeCache();
    };
  }, [projectId, initializeProject, setError]);

  // 🔧 FIX: 프리뷰 요소 전송은 PREVIEW_READY 핸들러에서 처리
  // (BuilderCore에서 중복 전송하지 않음 - useIframeMessenger.ts:178-201 참고)

  // ADR-021: Tint/Neutral/Radius/DarkMode → Preview에 CSS 변수 + 다크모드 전송
  useEffect(() => {
    if (iframeReadyState !== "ready") return;

    /** 현재 ThemeConfig 상태를 iframe에 전송 */
    function sendThemeConfigToIframe(config: {
      tint: string;
      neutral: string;
      radiusScale: string;
      darkMode: string;
    }) {
      const iframe = MessageService.getIframe();
      if (!iframe?.contentWindow) return;
      const origin = window.location.origin;

      // Tint
      const tintVars = [
        { name: "--tint", value: `var(--${config.tint})`, isDark: false },
        { name: "--tint", value: `var(--${config.tint})`, isDark: true },
      ];

      // Neutral — hex 직접 전송 (Preview에 팔레트 변수 없음)
      const palette =
        NEUTRAL_PALETTES[config.neutral as keyof typeof NEUTRAL_PALETTES];
      const neutralSteps = [
        50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
      ];
      const neutralVars = neutralSteps.flatMap((step) => [
        {
          name: `--color-neutral-${step}`,
          value: palette[step],
          isDark: false,
        },
        { name: `--color-neutral-${step}`, value: palette[step], isDark: true },
      ]);

      // Radius — 스케일 팩터로 조정
      const scaleFactors: Record<string, number> = {
        none: 0,
        sm: 0.5,
        md: 1,
        lg: 1.5,
        xl: 2,
      };
      const factor = scaleFactors[config.radiusScale] ?? 1;
      const baseRadii: Record<string, number> = {
        "--radius-xs": 2,
        "--radius-sm": 4,
        "--radius-md": 6,
        "--radius-lg": 8,
        "--radius-xl": 12,
        "--radius-2xl": 16,
        "--radius-3xl": 24,
        "--radius-4xl": 32,
      };
      const radiusVars = Object.entries(baseRadii).flatMap(([name, px]) => [
        { name, value: `${px * factor}px`, isDark: false },
        { name, value: `${px * factor}px`, isDark: true },
      ]);

      // THEME_VARS 전송
      const allVars = [...tintVars, ...neutralVars, ...radiusVars];
      iframe.contentWindow.postMessage(
        { type: "THEME_VARS", vars: allVars },
        origin,
      );

      // DarkMode — SET_DARK_MODE 메시지 전송
      const isDark =
        config.darkMode === "dark" ||
        (config.darkMode === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      iframe.contentWindow.postMessage(
        { type: "SET_DARK_MODE", isDark },
        origin,
      );
    }

    // 초기 전송: iframe ready 시 현재 복원된 설정 즉시 반영
    const current = useThemeConfigStore.getState();
    sendThemeConfigToIframe(current);

    // 변경 구독
    const unsub = useThemeConfigStore.subscribe((state, prev) => {
      if (
        state.tint !== prev.tint ||
        state.neutral !== prev.neutral ||
        state.radiusScale !== prev.radiusScale ||
        state.darkMode !== prev.darkMode
      ) {
        sendThemeConfigToIframe(state);
      }
    });

    return unsub;
  }, [iframeReadyState]);

  // ADR-125: Preview active render sync 는 useIframeMessenger 의
  // UPDATE_CANONICAL_DOCUMENT effect 가 단독으로 담당한다.

  // NAVIGATE_TO_PAGE 메시지 수신 (Preview iframe에서)
  useEffect(() => {
    const handleNavigateMessage = async (event: MessageEvent) => {
      // ADR-006 P2-2: source + origin 이중 검증
      if (!isValidPreviewMessage(event)) return;
      if (event.data?.type !== "NAVIGATE_TO_PAGE") return;

      const { path } = event.data.payload as {
        path: string;
        replace?: boolean;
      };

      // 경로 정규화: 항상 "/"로 시작하도록 통일
      const normalizedPath = path.startsWith("/") ? path : `/${path}`;

      // pages 배열에서 slug 기반으로 pageId 조회
      // slug와 path 모두 "/"로 시작하는 형식으로 통일하여 비교
      const targetPage = pages.find((p) => {
        const pageSlug = p.slug || "/";
        // slug도 정규화 (DB에 "/" 없이 저장된 경우 대비)
        const normalizedSlug = pageSlug.startsWith("/")
          ? pageSlug
          : `/${pageSlug}`;
        return normalizedSlug === normalizedPath;
      });

      if (targetPage) {
        // 페이지 elements 로드
        const result = await fetchElements(targetPage.id);
        if (!result.success) {
          handleError(
            result.error || new Error(t("errors.pageLoadFailed")),
            t("errors.pageNavigateContext"),
          );
        }
      } else {
        console.warn(`[BuilderCore] Page not found for path: ${path}`);
        // 페이지를 찾지 못한 경우 사용자에게 알림
        handleError(
          new Error(t("errors.pageNotFound", { path })),
          t("errors.pageNavigateContext"),
        );
      }
    };

    window.addEventListener("message", handleNavigateMessage);

    return () => {
      window.removeEventListener("message", handleNavigateMessage);
    };
  }, [pages, fetchElements, handleError]);

  // ===== Data Panel Integration Message Handlers (Phase 5) =====
  useEffect(() => {
    const handleDataMessage = async (event: MessageEvent) => {
      // ADR-006 P2-2: source + origin 이중 검증
      if (!isValidPreviewMessage(event)) return;
      const { type, payload } = event.data || {};

      switch (type) {
        case "LOAD_DATA_TABLE":
          await handleLoadDataTable(payload);
          break;
        case "SYNC_COMPONENT":
          await handleSyncComponent(payload);
          break;
        case "SAVE_TO_DATA_TABLE":
          await handleSaveToDataTable(payload);
          break;
      }
    };

    /**
     * DataTable 로드 핸들러
     */
    async function handleLoadDataTable(payload: {
      dataTableName: string;
      forceRefresh?: boolean;
      cacheTTL?: number;
      targetVariable?: string;
    }) {
      const { dataTableName, forceRefresh } = payload;
      const { collections, loadDataTable, refreshDataTable } =
        useDataTableStore.getState();

      // DataTable을 이름으로 검색
      let targetDataTableId: string | null = null;
      collections.forEach((config, id) => {
        if (config.name === dataTableName) {
          targetDataTableId = id;
        }
      });

      if (!targetDataTableId) {
        console.warn(`[BuilderCore] DataTable '${dataTableName}' not found`);
        return;
      }

      // DataTable 로드 또는 새로고침
      if (forceRefresh) {
        await refreshDataTable(targetDataTableId);
      } else {
        await loadDataTable(targetDataTableId);
      }

      // TODO: Canvas iframe에 업데이트된 데이터 전송
      // sendDataTablesToIframe();
    }

    /**
     * 컴포넌트 동기화 핸들러
     */
    async function handleSyncComponent(payload: {
      sourceId: string;
      targetId: string;
      syncMode: "replace" | "merge" | "append";
      dataPath?: string;
    }) {
      const { sourceId, targetId, syncMode, dataPath } = payload;
      const { elements, updateElementProps } = useStore.getState();

      // 소스 컴포넌트 찾기 (customId 또는 id)
      const sourceElement = elements.find(
        (el) => el.customId === sourceId || el.id === sourceId,
      );

      if (!sourceElement) {
        console.warn(`[BuilderCore] Source element '${sourceId}' not found`);
        return;
      }

      // 타겟 컴포넌트 찾기
      const targetElement = elements.find(
        (el) => el.customId === targetId || el.id === targetId,
      );

      if (!targetElement) {
        console.warn(`[BuilderCore] Target element '${targetId}' not found`);
        return;
      }

      // 소스에서 데이터 추출 (selectedKeys, value 등)
      const sourceProps = sourceElement.props as Record<string, unknown>;
      let sourceData =
        sourceProps.selectedKeys || sourceProps.value || sourceProps.items;

      // dataPath가 있으면 경로로 값 추출
      if (dataPath && sourceData) {
        sourceData = getValueByPath(sourceData, dataPath);
      }

      // syncMode에 따라 타겟 업데이트
      const targetProps = targetElement.props as Record<string, unknown>;
      const targetValue = targetProps.value || targetProps.items || [];
      let newValue: unknown;

      switch (syncMode) {
        case "replace":
          newValue = sourceData;
          break;
        case "merge":
          if (typeof targetValue === "object" && !Array.isArray(targetValue)) {
            newValue = mergeData(
              targetValue as Record<string, unknown>,
              sourceData,
            );
          } else {
            newValue = sourceData;
          }
          break;
        case "append":
          if (Array.isArray(targetValue)) {
            newValue = appendData(
              targetValue as Record<string, unknown>[],
              sourceData,
            );
          } else {
            newValue = sourceData;
          }
          break;
        default:
          newValue = sourceData;
      }

      // 타겟 엘리먼트 업데이트
      await updateElementProps(targetElement.id, { value: newValue });
    }

    /**
     * DataTable에 데이터 저장 핸들러
     */
    async function handleSaveToDataTable(payload: {
      dataTableName: string;
      source: "response" | "variable" | "static";
      sourcePath?: string;
      saveMode: "replace" | "merge" | "append" | "upsert";
      keyField?: string;
      transform?: string;
    }) {
      const {
        dataTableName,
        source,
        sourcePath,
        saveMode,
        keyField,
        transform,
      } = payload;
      const { collections, dataTableStates } = useDataTableStore.getState();

      // DataTable을 이름으로 검색
      let targetDataTableId: string | null = null;
      let targetConfig = null;
      collections.forEach((config, id) => {
        if (config.name === dataTableName) {
          targetDataTableId = id;
          targetConfig = config;
        }
      });

      if (!targetDataTableId || !targetConfig) {
        console.warn(`[BuilderCore] DataTable '${dataTableName}' not found`);
        return;
      }

      // 소스에서 데이터 가져오기
      let data: unknown;
      switch (source) {
        case "response":
          // 마지막 API 응답에서 가져오기 (현재는 상태에서 가져옴)
          // TODO: lastApiResponse 상태 관리 필요 - 현재 미구현
          data = undefined;
          break;
        case "variable":
          // 변수에서 가져오기
          if (sourcePath) {
            data = getValueByPath(useStore.getState(), sourcePath);
          }
          break;
        case "static":
          // 정적 값 파싱
          data = safeJsonParse(sourcePath || "[]", []);
          break;
      }

      // Transform 적용 (선택사항)
      if (transform) {
        try {
          const transformFn = new Function("data", `return ${transform}`);
          data = transformFn(data);
        } catch (err) {
          console.warn("[BuilderCore] Transform failed:", err);
        }
      }

      // 현재 DataTable 데이터
      const currentState = dataTableStates.get(targetDataTableId);
      const currentData = currentState?.data || [];
      let newData: Record<string, unknown>[];

      // saveMode에 따라 DataTable 업데이트
      switch (saveMode) {
        case "replace":
          newData = Array.isArray(data)
            ? (data as Record<string, unknown>[])
            : [data as Record<string, unknown>];
          break;
        case "merge":
          newData = currentData.map((item, i) => ({
            ...item,
            ...(Array.isArray(data)
              ? (data as Record<string, unknown>[])[i]
              : (data as Record<string, unknown>)),
          }));
          break;
        case "append":
          newData = appendData(currentData, data);
          break;
        case "upsert":
          newData = upsertData(currentData, data, keyField || "id");
          break;
        default:
          newData = currentData;
      }

      // DataTable 상태 업데이트 (직접 상태 업데이트)
      useDataTableStore.setState((state) => {
        const newDataTableStates = new Map(state.dataTableStates);
        const existingState = newDataTableStates.get(targetDataTableId!);

        if (existingState) {
          newDataTableStates.set(targetDataTableId!, {
            ...existingState,
            data: newData,
            lastLoadedAt: Date.now(),
          });
        }

        return { dataTableStates: newDataTableStates };
      });
    }

    window.addEventListener("message", handleDataMessage);

    return () => {
      window.removeEventListener("message", handleDataMessage);
    };
  }, []); // 의존성 없음 - 핸들러 내부에서 최신 상태 직접 접근

  // 페이지 추가 핸들러 (사용하지 않음 - 주석 처리)
  // const handleAddPage = useCallback(async () => {
  //   if (!projectId) return;
  //   const addElement = useStore.getState().addElement as (
  //     element: Element
  //   ) => void;
  //   const result = await addPage(projectId, addElement);
  //   if (!result.success) {
  //     handleError(result.error || new Error("페이지 생성 실패"), "페이지 생성");
  //   }
  // }, [projectId, addPage, handleError]);

  // 요소 로드 핸들러 (사용하지 않음 - 주석 처리)
  // const fetchElementsWrapper = useCallback(
  //   async (pageId: string) => {
  //     const result = await fetchElements(pageId);
  //     if (!result.success) {
  //       handleError(result.error || new Error("요소 로드 실패"), "요소 로드");
  //     }
  //   },
  //   [fetchElements, handleError]
  // );

  // 프리뷰 관련 핸들러들
  const handlePreview = useCallback(() => {
    // Store에서 현재 상태 가져오기
    const state = useStore.getState();
    const { currentPageId: storeCurrentPageId } = state;
    const document = getActiveCanonicalDocument();
    if (!document) {
      console.error("[BuilderCore] canonical document is not ready");
      return;
    }

    // ADR-021 Phase C: themeConfig 포함
    const { tint, neutral, radiusScale } = useThemeConfigStore.getState();

    // 프로젝트 데이터 구성 (pages는 usePageManager에서 가져온 것 사용)
    const previewData = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      project: {
        id: projectId || "preview",
        name: projectInfo?.name || "Preview",
      },
      document,
      currentPageId: storeCurrentPageId,
      themeConfig: { tint, neutral, radiusScale },
      fontRegistry: loadFontRegistry(),
    };

    // sessionStorage에 저장 (같은 origin의 새 탭에서 접근 가능)
    sessionStorage.setItem(
      "composition-preview-data",
      JSON.stringify(previewData),
    );

    // 새 탭에서 publish 앱 열기
    window.open("/publish/", "_blank");
  }, [projectId, projectInfo]);

  const handlePlay = useCallback(() => {}, []);

  const handleExportProject = useCallback(() => {
    const document = getActiveCanonicalDocument();
    if (!projectId || !document) {
      showToast("error", t("header.projectFileUnavailable"));
      return;
    }

    try {
      downloadProjectAsJson(
        projectId,
        projectInfo?.name || "Untitled Project",
        document,
        useStore.getState().currentPageId,
        loadFontRegistry(),
      );
      showToast("success", t("header.exportProjectSuccess"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("error", t("header.exportProjectFailed", { message }), 8000);
    }
  }, [projectId, projectInfo, showToast, t]);

  const handleImportProject = useCallback(
    async (file: File): Promise<void> => {
      if (!projectId) {
        showToast("error", t("header.projectFileUnavailable"));
        return;
      }

      try {
        const result = await loadProjectFromFile(file);
        if (!result.success) {
          showToast(
            "error",
            t("header.importProjectFailed", {
              message: result.error.message,
            }),
            8000,
          );
          return;
        }

        const previousPageIds = useStore
          .getState()
          .pages.map((page) => page.id);
        pageShellBridgeSuspendedRef.current = true;
        try {
          // 현재 프로젝트의 로컬 identity 는 유지하고 파일의 canonical document 만
          // 전체 교체한다. 복원 SSOT 경로가 page/element 파생과 IndexedDB 저장까지
          // 같은 순서로 수행한다.
          await applySnapshotDocument(
            useStore.getState,
            projectId,
            result.data.document,
          );

          if (result.data.fontRegistry) {
            saveRegistryAndNotify(result.data.fontRegistry);
          }

          const importedState = useStore.getState();
          const importedPageIds = new Set(
            importedState.pages.map((page) => page.id),
          );
          const importedCurrentPageId = result.data.currentPageId;
          if (
            importedCurrentPageId &&
            importedPageIds.has(importedCurrentPageId)
          ) {
            importedState.activatePage(importedCurrentPageId);
          }

          // 전체 문서 교체 후 과거 element diff 를 적용하면 다른 문서를 손상시킬 수
          // 있으므로, 이 프로젝트가 가졌던 페이지와 새 페이지의 history 만 비운다.
          const historyPageIds = new Set([
            ...previousPageIds,
            ...importedPageIds,
          ]);
          historyPageIds.forEach((pageId) => {
            historyManager.clearPageHistory(pageId);
          });
        } finally {
          pageShellBridgeSuspendedRef.current = false;
        }

        showToast("success", t("header.importProjectSuccess"));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        showToast("error", t("header.importProjectFailed", { message }), 8000);
      }
    },
    [projectId, showToast, t],
  );

  // 클릭 외부 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // UI 요소들을 클릭한 경우는 무시
      if (
        target.closest(".selection-overlay") ||
        target.closest(".sidebar") ||
        target.closest(".inspector") ||
        target.closest(".header") ||
        target.closest(".footer") ||
        target.closest("#previewFrame")
      ) {
        return;
      }

      // workspace나 bg 클래스를 가진 요소를 클릭했을 때만 선택 해제
      const isWorkspaceBackground =
        target.classList.contains("workspace") ||
        target.classList.contains("bg");
      if (isWorkspaceBackground) {
        setSelectedElement(null);
        // 🚀 Phase 11: WebGL-only 모드에서는 iframe clearOverlay 스킵
        const isWebGLOnly = isWebGLCanvas() && !isCanvasCompareMode();
        if (!isWebGLOnly) {
          MessageService.clearOverlay();
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [setSelectedElement]);

  const usesSkiaRenderer = isWebGLCanvas();
  const rendererReady = usesSkiaRenderer
    ? isCanvasReady
    : iframeReadyState === "ready";
  const isBuilderReady = projectBootstrapPhase === "renderer" && rendererReady;
  useEffect(() => {
    if (!isBuilderReady) {
      setHasPaintedBootstrapCompletion(false);
      return;
    }

    // normal motion은 시각 fill의 transitionend가 완료 presentation을 확정한다.
    // reduced motion에서는 transition이 없으므로 실제 100%를 한 번 paint한 뒤 공개한다.
    const prefersReducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true;
    if (!prefersReducedMotion) {
      return;
    }

    let revealFrameId = 0;
    const completionFrameId = window.requestAnimationFrame(() => {
      revealFrameId = window.requestAnimationFrame(() => {
        setHasPaintedBootstrapCompletion(true);
      });
    });
    return () => {
      window.cancelAnimationFrame(completionFrameId);
      window.cancelAnimationFrame(revealFrameId);
    };
  }, [isBuilderReady]);

  const isBuilderPresented = isBuilderReady && hasPaintedBootstrapCompletion;
  const bootstrapProgress = resolveBootstrapProgress(
    projectBootstrapPhase,
    canvasBootstrapPhase,
    isBuilderReady,
  );
  const handleBootstrapProgressTransitionEnd = (
    event: React.TransitionEvent<HTMLDivElement>,
  ) => {
    if (event.propertyName === "transform" && isBuilderReady) {
      setHasPaintedBootstrapCompletion(true);
    }
  };
  const isInitialBootstrap =
    projectBootstrapPhase !== "error" && !isBuilderPresented;
  const isPageOnlyLoading = isBuilderPresented && isPageLoading;
  const showLoadingOverlay = isInitialBootstrap || isPageLoading;
  const hasCanvasBootstrapError =
    isInitialBootstrap && canvasBootstrapPhase === "error";
  const loadingLabel = isPageOnlyLoading
    ? t("messages.loadingData")
    : projectBootstrapPhase === "renderer"
      ? t("workspace.canvasInitializing")
      : t("messages.loadingData");

  return (
    <BuilderViewport
      className={isBuilderPresented ? "app" : "app builder-booting"}
    >
      {/* ADR-155 Phase 2: 캔버스 전역 선택 단축키 host — 패널 Activity gating 과
          무관하게 항상 mounted. leaf null 렌더라 구독 재렌더가 여기로 전파 안 됨 */}
      <CanvasSelectionShortcutsHost />

      {/* 에러 표시 */}
      {error && (
        <div className="error-banner">
          <span>⚠️ {error}</span>
          <button onClick={clearError}>×</button>
        </div>
      )}

      {/* 로딩 표시 (프로젝트 + matching Skia first presentation 또는 페이지 로딩) */}
      {showLoadingOverlay && (
        <div className="loading-overlay">
          {hasCanvasBootstrapError ? (
            <div className="loading-error" role="alert">
              <span>{t("canvas.engineLoadFailed")}</span>
              <Button
                variant="primary"
                size="sm"
                onPress={() => window.location.reload()}
              >
                {t("canvas.reload")}
              </Button>
            </div>
          ) : (
            <div className="loading-content">
              <div className="loading-status">
                <div className="loading-text">{loadingLabel}</div>
                {!isPageOnlyLoading && (
                  <>
                    <div className="loading-progress">
                      <progress
                        className="loading-progress-native"
                        aria-label={loadingLabel}
                        max={100}
                        value={bootstrapProgress}
                      />
                      <div
                        className="loading-progress-fill"
                        aria-hidden
                        style={{
                          transform: `scaleX(${bootstrapProgress / 100})`,
                        }}
                        onTransitionEnd={handleBootstrapProgressTransitionEnd}
                      />
                    </div>
                    <div className="loading-percent">{bootstrapProgress}%</div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ADR-922 Phase 4: renderer mode는 공통 Workspace 내부 content만 선택한다. */}
      <PanelWorkspace
        chrome={
          <BuilderHeader
            projectId={projectId}
            projectName={projectInfo?.name}
            breakpoint={breakpoint}
            breakpoints={breakpoints}
            onBreakpointChange={handleBreakpointChange}
            onPreview={handlePreview}
            onPlay={handlePlay}
            onImportProject={handleImportProject}
            onExportProject={handleExportProject}
            onWorkflowOverlayToggle={toggleWorkflowOverlay}
          />
        }
      >
        <Workspace
          breakpoint={breakpoint}
          breakpoints={breakpoints}
          fallbackCanvas={
            <BuilderCanvas
              projectId={projectId}
              breakpoint={new Set(Array.from(breakpoint).map(String))}
              breakpoints={breakpoints}
              onIframeLoad={handleIframeLoad}
              onMessage={handleMessage}
            />
          }
        />
      </PanelWorkspace>

      {/* 🚀 Phase 7: Toast 알림 컨테이너 */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* 🚀 Phase 7: 커맨드 팔레트 (Cmd+K) */}
      <CommandPalette />

      {/* ADR-112 Phase E: origin 편집 영향 미리보기 */}
      <EditingSemanticsImpactDialogHost />

      {/* ADR-196 Phase 3: agent 명령 승인 (파괴적 명령은 이 host 없이는 실행되지 않는다) */}
      <AgentCommandConfirmDialogHost />
    </BuilderViewport>
  );
};
