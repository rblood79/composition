/**
 * Canvas Settings Slice
 *
 * 빌더 캔버스 환경 설정 관리
 * - showGrid, snapToGrid, gridSize, workflow overlay 등
 *
 * @since 2024-12-29
 * @updated 2025-12-29 - overlay/visualization 설정 제거 (WebGL 전환으로 불필요)
 * @updated 2026-02-10 - viewMode 제거 (레거시 ReactFlow 워크플로우 삭제)
 * @updated 2026-02-11 - pageLayoutDirection 추가 (가로/세로/지그재그 페이지 배치, Settings 패널에서 제어)
 */

import { StateCreator } from "zustand";
import type { BreakpointName } from "@composition/shared";

/** 페이지 배치 방향 */
export type PageLayoutDirection = "horizontal" | "vertical" | "zigzag";

export interface HistoryInfo {
  canUndo: boolean;
  canRedo: boolean;
  totalEntries: number;
  currentIndex: number;
}

/**
 * Settings 상태 인터페이스
 * 빌더 캔버스 환경 설정 관리
 *
 * Note: themeMode, uiScale은 src/stores/uiStore.ts로 이관됨
 * Note: showOverlay, overlayOpacity, showElementBorders, showElementLabels 제거됨 (WebGL 전환)
 * Note: viewMode, setViewMode, toggleViewMode 제거됨 (레거시 ReactFlow 워크플로우 삭제)
 */
export interface SettingsState {
  /** Grid 표시 여부 (기본값: false) */
  showGrid: boolean;

  /** Grid에 스냅 활성화 여부 (기본값: false) */
  snapToGrid: boolean;

  /**
   * 객체(다른 페이지/요소) 스냅 활성화 여부 (기본값: true — Figma 기본 관례).
   * ADR-179: 드래그 중 다른 페이지 가장자리·중앙 6축 흡착 + 정렬선.
   * 우선순위는 객체 > snap-to-grid, Cmd/Ctrl 홀드 시 전 스냅 억제.
   */
  snapToObjects: boolean;

  /** Grid 크기 (기본값: 8px) */
  gridSize: 8 | 16 | 24;

  /** History 정보 (Monitor에서 사용) */
  historyInfo: HistoryInfo;

  /** Grid 표시 토글 */
  setShowGrid: (show: boolean) => void;

  /** Grid 스냅 토글 */
  setSnapToGrid: (snap: boolean) => void;

  /** 객체 스냅 토글 (ADR-179) */
  setSnapToObjects: (snap: boolean) => void;

  /** Grid 크기 설정 */
  setGridSize: (size: 8 | 16 | 24) => void;

  /** History 정보 업데이트 */
  setHistoryInfo: (info: HistoryInfo) => void;

  /** Workflow 오버레이 표시 여부 (기본값: false) */
  showWorkflowOverlay: boolean;

  /** Workflow 오버레이 표시 설정 */
  setShowWorkflowOverlay: (show: boolean) => void;

  /** Workflow 오버레이 표시 토글 */
  toggleWorkflowOverlay: () => void;

  /** Workflow Navigation edges 표시 여부 (기본값: true) */
  showWorkflowNavigation: boolean;
  /** Workflow Navigation edges 표시 설정 */
  setShowWorkflowNavigation: (show: boolean) => void;
  /** Workflow Navigation edges 표시 토글 */
  toggleWorkflowNavigation: () => void;

  /** Workflow Event-navigation edges 표시 여부 (기본값: true) */
  showWorkflowEvents: boolean;
  /** Workflow Event-navigation edges 표시 설정 */
  setShowWorkflowEvents: (show: boolean) => void;
  /** Workflow Event-navigation edges 표시 토글 */
  toggleWorkflowEvents: () => void;

  /** Workflow Data source connections 표시 여부 (기본값: true) */
  showWorkflowDataSources: boolean;
  /** Workflow Data source connections 표시 설정 */
  setShowWorkflowDataSources: (show: boolean) => void;
  /** Workflow Data source connections 표시 토글 */
  toggleWorkflowDataSources: () => void;

  /** Workflow Layout group visualization 표시 여부 (기본값: true) */
  showWorkflowLayoutGroups: boolean;
  /** Workflow Layout group visualization 표시 설정 */
  setShowWorkflowLayoutGroups: (show: boolean) => void;
  /** Workflow Layout group visualization 표시 토글 */
  toggleWorkflowLayoutGroups: () => void;

  /** Workflow 엣지 직선 표시 여부 (기본값: true = 직각 orthogonal) */
  workflowStraightEdges: boolean;
  /** Workflow 엣지 직선 표시 설정 */
  setWorkflowStraightEdges: (straight: boolean) => void;

  /** Workflow에서 포커스된 페이지 ID (기본값: null) */
  workflowFocusedPageId: string | null;
  /** Workflow 포커스 페이지 설정 */
  setWorkflowFocusedPageId: (pageId: string | null) => void;

  /** 페이지 배치 방향 (기본값: 'horizontal') */
  pageLayoutDirection: PageLayoutDirection;
  /** 페이지 배치 방향 설정 */
  setPageLayoutDirection: (direction: PageLayoutDirection) => void;

  /**
   * ADR-154: 현재 활성 반응형 breakpoint (기본값: 'desktop').
   * layout/Inspector 가 읽는 responsive resolve SSOT. 기존 BuilderHeader
   * breakpoint 선택기에서 파생 write (BuilderCore.handleBreakpointChange).
   * 변경 시 layoutVersion bump 은 bridge 에서 invalidateLayout() 로 처리
   * (전역 재레이아웃 — 모든 요소 resolve 재계산).
   */
  activeBreakpoint: BreakpointName;
  /** 활성 breakpoint 설정 (bridge 전용 — 호출 후 invalidateLayout 필요) */
  setActiveBreakpoint: (breakpoint: BreakpointName) => void;
}

/**
 * Settings Slice 생성
 */
export const createSettingsSlice: StateCreator<SettingsState> = (set) => ({
  showGrid: false,
  snapToGrid: false,
  snapToObjects: true,
  showWorkflowOverlay: false,
  showWorkflowNavigation: true,
  showWorkflowEvents: true,
  showWorkflowDataSources: true,
  showWorkflowLayoutGroups: true,
  workflowStraightEdges: true,
  workflowFocusedPageId: null,
  pageLayoutDirection: "horizontal" as PageLayoutDirection,
  activeBreakpoint: "desktop" as BreakpointName,
  gridSize: 8,
  historyInfo: {
    canUndo: false,
    canRedo: false,
    totalEntries: 0,
    currentIndex: -1,
  },

  /**
   * Grid 표시 토글
   */
  setShowGrid: (show: boolean) => {
    set({ showGrid: show });
  },

  /**
   * Grid 스냅 토글
   */
  setSnapToGrid: (snap: boolean) => {
    set({ snapToGrid: snap });
  },

  /**
   * 객체 스냅 토글 (ADR-179)
   */
  setSnapToObjects: (snap: boolean) => {
    set({ snapToObjects: snap });
  },

  /**
   * Grid 크기 설정
   */
  setGridSize: (size: 8 | 16 | 24) => {
    set({ gridSize: size });
  },

  /**
   * History 정보 업데이트
   */
  setHistoryInfo: (info: HistoryInfo) => {
    set({ historyInfo: info });
  },

  /**
   * Workflow 오버레이 표시 설정
   */
  setShowWorkflowOverlay: (show: boolean) => {
    set({ showWorkflowOverlay: show });
  },

  /**
   * Workflow 오버레이 표시 토글
   */
  toggleWorkflowOverlay: () => {
    set((state) => ({ showWorkflowOverlay: !state.showWorkflowOverlay }));
  },

  /**
   * Workflow Navigation edges 표시 설정
   */
  setShowWorkflowNavigation: (show: boolean) => {
    set({ showWorkflowNavigation: show });
  },

  /**
   * Workflow Navigation edges 표시 토글
   */
  toggleWorkflowNavigation: () => {
    set((state) => ({ showWorkflowNavigation: !state.showWorkflowNavigation }));
  },

  /**
   * Workflow Event-navigation edges 표시 설정
   */
  setShowWorkflowEvents: (show: boolean) => {
    set({ showWorkflowEvents: show });
  },

  /**
   * Workflow Event-navigation edges 표시 토글
   */
  toggleWorkflowEvents: () => {
    set((state) => ({ showWorkflowEvents: !state.showWorkflowEvents }));
  },

  /**
   * Workflow Data source connections 표시 설정
   */
  setShowWorkflowDataSources: (show: boolean) => {
    set({ showWorkflowDataSources: show });
  },

  /**
   * Workflow Data source connections 표시 토글
   */
  toggleWorkflowDataSources: () => {
    set((state) => ({
      showWorkflowDataSources: !state.showWorkflowDataSources,
    }));
  },

  /**
   * Workflow Layout group visualization 표시 설정
   */
  setShowWorkflowLayoutGroups: (show: boolean) => {
    set({ showWorkflowLayoutGroups: show });
  },

  /**
   * Workflow Layout group visualization 표시 토글
   */
  toggleWorkflowLayoutGroups: () => {
    set((state) => ({
      showWorkflowLayoutGroups: !state.showWorkflowLayoutGroups,
    }));
  },

  /**
   * Workflow 엣지 직선 표시 설정
   */
  setWorkflowStraightEdges: (straight: boolean) => {
    set({ workflowStraightEdges: straight });
  },

  /**
   * Workflow 포커스 페이지 설정
   */
  setWorkflowFocusedPageId: (pageId: string | null) => {
    set({ workflowFocusedPageId: pageId });
  },

  /**
   * 페이지 배치 방향 설정
   */
  setPageLayoutDirection: (direction: PageLayoutDirection) => {
    set({ pageLayoutDirection: direction });
  },

  /**
   * ADR-154: 활성 breakpoint 설정. 값만 변경하며, 전역 재레이아웃 트리거는
   * 호출측(BuilderCore bridge)이 invalidateLayout() 로 수행 (slice 경계상
   * layoutVersion 은 elements slice 소유 — cross-slice bump 회피).
   */
  setActiveBreakpoint: (breakpoint: BreakpointName) => {
    set({ activeBreakpoint: breakpoint });
  },
});
