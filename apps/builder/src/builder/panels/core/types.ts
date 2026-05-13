/**
 * Panel System Types
 *
 * 모든 패널이 따라야 하는 인터페이스와 타입 정의
 * 12개 패널을 동등하게 취급하는 범용 시스템
 */

import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * 패널 카테고리
 * - navigation: Pages, Components, Library 등 탐색 관련
 * - editor: Properties, Styles, Data, Events 등 편집 관련
 * - tool: Theme, AI 등 도구
 * - system: User, Settings 등 시스템
 */
export type PanelCategory = "navigation" | "editor" | "tool" | "system";

/**
 * 패널 위치
 */
export type PanelSide = "left" | "right" | "bottom";

/**
 * 패널 표시 모드
 * - panel: 사이드바/하단에 고정된 패널 (기본)
 * - modal: 떠있는 모달 형태 (드래그 가능, React Aria Components 기반)
 */
export type PanelDisplayMode = "panel" | "modal";

/**
 * 패널 ID
 *
 * ADR-131 Phase 5 (2026-05-13): 'actions' 패널 신규 — canonical
 * `document.actions` root collection 직접 편집.
 * ADR-131 Phase 8 (2026-05-13): 'data' 패널 제거 — `DataTablePanel` (기존, 'datatable')
 * 이 data SSOT 역할. `Element.dataBinding` 은 element 별 binding reference.
 */
export type PanelId =
  // Navigation panels
  | "nodes"
  | "components"
  | "library"
  | "datatable"
  | "datatableEditor" // DataTable 에디터 패널 (DataTablePanel과 함께 사용)
  // Tool panels
  | "theme"
  | "fonts"
  | "ai"
  // System panels
  | "user"
  | "settings"
  // Editor panels
  | "properties"
  | "styles"
  | "events"
  | "history"
  // ADR-131 Phase 5 G3 — Actions root collection editor panel
  | "actions"
  // Bottom panels
  | "monitor";

/**
 * 패널 설정
 *
 * 모든 패널은 이 인터페이스를 구현해야 함
 */
export interface PanelConfig {
  /** 고유 ID */
  id: PanelId;

  /** 표시 이름 (한글) */
  name: string;

  /** 표시 이름 (영문, 옵션) */
  nameEn?: string;

  /** 아이콘 컴포넌트 (lucide-react) */
  icon: LucideIcon;

  /** 패널 컴포넌트 */
  component: ComponentType<PanelProps>;

  /** 카테고리 */
  category: PanelCategory;

  /** 기본 위치 */
  defaultPosition: PanelSide;

  /** 최소 너비 (px, 옵션) */
  minWidth?: number;

  /** 최대 너비 (px, 옵션) */
  maxWidth?: number;

  /** 기본 너비 (px, modal 초기값) */
  defaultWidth?: number;

  /** 기본 높이 (px, modal 초기값) */
  defaultHeight?: number;

  /** 최소 높이 (px, modal 제약) */
  minHeight?: number;

  /** 최대 높이 (px, modal 제약) */
  maxHeight?: number;

  /** 설명 (옵션) */
  description?: string;

  /** 키보드 단축키 (옵션) */
  shortcut?: string;

  /** 지원하는 표시 모드 목록 (기본: ['panel']) */
  displayModes?: PanelDisplayMode[];
}

/**
 * 패널 컴포넌트 Props
 *
 * 모든 패널 컴포넌트가 받는 공통 props
 */
export interface PanelProps {
  /** 현재 패널이 활성 상태인지 */
  isActive?: boolean;

  /** 패널이 위치한 사이드 */
  side?: PanelSide;

  /** 현재 표시 모드 */
  displayMode?: PanelDisplayMode;

  /** 패널 닫기 콜백 (옵션) */
  onClose?: () => void;
}

/**
 * Modal 패널 상태
 */
export interface ModalPanelState {
  /** 패널 ID */
  panelId: PanelId;

  /** 표시 모드 */
  mode: "modal";

  /** 위치 (드래그 이동 시 업데이트) */
  position: { x: number; y: number };

  /** 크기 (리사이즈 시 업데이트) */
  size: { width: number; height: number };

  /** z-index (포커스 순서) */
  zIndex: number;
}

/**
 * 패널 레이아웃 상태
 *
 * Zustand store에 저장되는 패널 배치 정보
 */
export interface PanelLayoutState {
  /** 좌측 사이드바에 배치된 패널 ID 배열 */
  leftPanels: PanelId[];

  /** 우측 인스펙터에 배치된 패널 ID 배열 */
  rightPanels: PanelId[];

  /** 좌측에서 현재 활성화된 패널 ID 배열 (Multi toggle 지원) */
  activeLeftPanels: PanelId[];

  /** 우측에서 현재 활성화된 패널 ID 배열 (Multi toggle 지원) */
  activeRightPanels: PanelId[];

  /** 좌측 사이드바 표시 여부 */
  showLeft: boolean;

  /** 우측 인스펙터 표시 여부 */
  showRight: boolean;

  /** 하단 패널에 배치된 패널 ID 배열 */
  bottomPanels: PanelId[];

  /** 하단에서 현재 활성화된 패널 ID 배열 */
  activeBottomPanels: PanelId[];

  /** 하단 패널 표시 여부 */
  showBottom: boolean;

  /** 하단 패널 높이 (px) */
  bottomHeight: number;

  /** Modal 패널 목록 */
  modalPanels: ModalPanelState[];

  /** 다음 modal 패널의 z-index */
  nextModalZIndex: number;
}

/**
 * 기본 패널 레이아웃
 *
 * 최초 로드 시 또는 리셋 시 사용되는 기본 배치
 */
export const DEFAULT_PANEL_LAYOUT: PanelLayoutState = {
  leftPanels: [
    "nodes",
    "components",
    "datatable",
    "datatableEditor", // DataTable 에디터 (datatable과 함께 사용)
    "theme",
  ],
  rightPanels: ["properties", "styles", "events", "ai", "fonts", "history"],
  activeLeftPanels: ["nodes"], // Multi toggle 지원: 배열
  activeRightPanels: ["properties"], // Multi toggle 지원: 배열
  showLeft: true,
  showRight: true,
  // Bottom panel defaults
  bottomPanels: ["monitor"],
  activeBottomPanels: [], // 기본 닫힘
  showBottom: false,
  bottomHeight: 200,
  // Modal panel defaults
  modalPanels: [],
  nextModalZIndex: 1000,
};

/**
 * 패널 레이아웃 액션
 */
export interface PanelLayoutActions {
  /** 패널을 다른 사이드로 이동 */
  movePanel: (panelId: PanelId, from: PanelSide, to: PanelSide) => void;

  /** 패널 토글 (활성화/비활성화) - Multi toggle 지원 */
  togglePanel: (side: PanelSide, panelId: PanelId) => void;

  /** 레이아웃 초기화 */
  resetLayout: () => void;

  /** 레이아웃 전체 설정 */
  setLayout: (layout: PanelLayoutState) => void;

  /** 하단 패널 토글 */
  toggleBottomPanel: (panelId: PanelId) => void;

  /** 하단 패널 높이 설정 */
  setBottomHeight: (height: number) => void;

  /** 하단 패널 닫기 */
  closeBottomPanel: () => void;

  /** 패널을 Modal로 열기 */
  openPanelAsModal: (panelId: PanelId) => void;

  /** Modal 패널 닫기 */
  closeModalPanel: (panelId: PanelId) => void;

  /** Modal 패널 포커스 (z-index 업데이트) */
  focusModalPanel: (panelId: PanelId) => void;

  /** Modal 패널 위치 업데이트 */
  updateModalPanelPosition: (
    panelId: PanelId,
    position: { x: number; y: number },
  ) => void;

  /** Modal 패널 크기 업데이트 */
  updateModalPanelSize: (
    panelId: PanelId,
    size: { width: number; height: number },
  ) => void;

  /** 모든 Modal 패널 닫기 */
  closeAllModalPanels: () => void;
}

/**
 * 패널 검색 필터
 */
export interface PanelFilter {
  category?: PanelCategory;
  search?: string;
}
