/**
 * Layout/Slot System Type Definitions
 *
 * Layout = 자유로운 Element 트리 + Slot 마커
 * Slot = Layout 내 "Page 내용 삽입 위치" 표시
 * Page = 각 Slot에 맞는 Element들 제공
 *
 * **ADR-903 Migration (Phase 0)**
 *
 * 본 파일의 타입들은 CSS/DOM 기반 빌더 시대에 만든 layout-vs-page 이원화 시스템의
 * 산물이다. Skia canonical 전환(ADR-903) 이후에는 다음과 같이 흡수된다:
 *
 * - `Layout` → canonical `FrameNode` + `reusable: true` 로 흡수 (ADR-903 Phase 3)
 * - `SlotProps` / `type="Slot"` + legacy slot ownership → 컨테이너의 `slot?: false | string[]`
 *   schema 속성으로 전환 (ADR-903 Phase 3)
 * - Element frame ownership mirror → page root `type:"ref"` to reusable layout shell
 * - Page frame binding mirror → page root ref 참조로 대체
 * - 별도 layouts store → canonical document tree 내부 `reusable: true` 노드
 *   조회 selector로 해체 (ADR-903 Phase 3/Phase 5 G5)
 *
 * Phase 1~3 기간에는 adapter 입력 타입으로만 사용된다.
 * 신규 기능은 canonical format(`composition-document.types.ts`)에만 추가할 것.
 *
 * @see docs/adr/903-ref-descendants-slot-composition-format-migration-plan.md
 * @see packages/shared/src/types/composition-document.types.ts
 */

import type { Element } from "./unified.types";

// ============================================
// Layout
// ============================================

/**
 * Layout 타입 (layouts 테이블)
 *
 * @deprecated ADR-903 P3: canonical 'FrameNode' + 'reusable: true'로 흡수 예정.
 * layouts[] 별도 테이블은 Phase 5 G5 완료 시점에 canonical document tree 내부
 * reusable 노드로 통합. Phase 1~3 기간 adapter 입력 타입으로만 사용.
 */
export interface Layout {
  id: string;
  name: string;
  project_id: string;
  description?: string;

  // Nested Routes & Slug System
  slug?: string; // URL base path (e.g., "/products")

  // 404 Page Strategy
  notFoundPageId?: string; // Layout 전용 404 페이지 ID
  inheritNotFound?: boolean; // true면 프로젝트 기본 404 상속 (기본값: true)

  created_at?: string;
  updated_at?: string;
}

/**
 * Layout 업데이트 시 필요한 필드
 *
 * @deprecated ADR-903 P3: canonical reusable frame 노드의 속성 직접 업데이트로 대체.
 * Phase 1~3 기간 adapter 입력 타입으로만 사용.
 */
export type LayoutUpdate = Partial<
  Pick<
    Layout,
    "name" | "description" | "slug" | "notFoundPageId" | "inheritNotFound"
  >
>;

// ============================================
// Slot (Element의 특수 형태)
// ============================================

/**
 * Slot props 타입 (Element.props에 저장)
 * Slot은 type="Slot"인 Element
 *
 * @deprecated ADR-903 P3: canonical 컨테이너 schema 속성 `slot?: false | string[]`으로
 * 전환. 별도 Slot 특수 노드(`type="Slot"`) 제거 예정. `name` 필드는 descendants path의
 * key 역할로 흡수. Phase 1~3 기간 adapter 입력 타입으로만 사용.
 */
export interface SlotProps extends Record<string, unknown> {
  /** Slot 식별자 (예: "content", "sidebar", "navigation") */
  name: string;

  /** 필수 여부 - true면 Page에서 반드시 채워야 함 */
  required?: boolean;

  /** Slot 설명 (UI 표시용) */
  description?: string;
}

// ============================================
// Slot Info (Layout에서 추출)
// ============================================

/**
 * Layout에서 추출한 Slot 정보
 *
 * @deprecated ADR-903 P3: `extractSlotMetaFromNode(FrameNode)` 으로 대체.
 * canonical `FrameNode.slot: string[]` 에서 슬롯 메타 추출.
 * Phase 1~3 기간 adapter 입력 타입으로만 사용.
 */
export interface SlotInfo {
  name: string; // 고유 식별자 (이름 없으면 slot_${elementId.slice(0,8)})
  displayName: string; // UI 표시용 이름 (이름 없으면 "unnamed")
  required: boolean;
  description?: string;
  elementId: string; // Slot Element의 ID
}

// ============================================
// Resolved Types (Preview용)
// ============================================

/**
 * Slot에 채워진 내용 (Preview 렌더링용)
 */
export interface ResolvedSlotContent {
  slotName: string;
  slotElementId: string;
  pageElements: Element[];
  isEmpty: boolean;
}

/**
 * Layout + Page 합성 결과 (Preview 렌더링용)
 */
export interface LayoutResolutionResult {
  /** 합성된 Element 트리 */
  resolvedTree: ResolvedElement[];

  /** Slot별 내용 매핑 */
  slotContents: Map<string, ResolvedSlotContent>;

  /** 유효성 검사 에러 */
  validationErrors: SlotValidationError[];

  /** Layout 적용 여부 */
  hasLayout: boolean;
}

/**
 * 합성된 Element (렌더링용)
 */
export interface ResolvedElement {
  /** 원본 Element */
  element: Element;

  /** 합성된 자식들 (Slot인 경우 Page elements로 교체됨) */
  children: ResolvedElement[];

  /** Slot이 Page elements로 교체되었는지 */
  isSlotReplaced?: boolean;
}

// ============================================
// Validation
// ============================================

/**
 * Slot 유효성 검사 에러
 *
 * @deprecated ADR-903 P3: canonical slot 검증은 resolver 단계에서 처리.
 * `DescendantOverride` 3-mode union 기반 slot resolution 으로 대체.
 * Phase 1~3 기간 adapter 입력 타입으로만 사용.
 */
export interface SlotValidationError {
  slotName: string;
  errorType: "REQUIRED_SLOT_EMPTY" | "INVALID_SLOT_NAME";
  message: string;
}

// ============================================
// Edit Mode
// ============================================

/**
 * 편집 모드 타입
 */
export type EditMode = "page" | "layout";

/**
 * 편집 컨텍스트
 */
export interface EditContext {
  mode: EditMode;
  pageId: string | null;
  layoutId: string | null;
}

// ============================================
// Edit Mode Store Types
// ============================================

/**
 * Edit Mode Store State
 */
export interface EditModeStoreState {
  /** 현재 편집 모드 */
  mode: EditMode;

  /** Page 모드일 때 편집 중인 Page ID */
  pageId: string | null;

  /** Layout 모드일 때 편집 중인 Layout ID */
  layoutId: string | null;
}

/**
 * Edit Mode Store Actions
 */
export interface EditModeStoreActions {
  /** Page 편집 모드로 전환 */
  enterPageMode: (pageId: string) => void;

  /** Layout 편집 모드로 전환 */
  enterLayoutMode: (layoutId: string) => void;

  /** 현재 편집 컨텍스트 반환 */
  getEditContext: () => EditContext;

  /** Edit Mode 직접 설정 (탭 전환용) */
  setMode: (mode: EditMode) => void;

  /** 현재 편집 중인 Page ID 설정 */
  setCurrentPageId: (pageId: string | null) => void;

  /** 현재 편집 중인 Layout ID 설정 */
  setCurrentLayoutId: (layoutId: string | null) => void;
}

/**
 * 완전한 Edit Mode Store 타입
 */
export type EditModeStore = EditModeStoreState & EditModeStoreActions;

// ============================================
// Nodes Panel Types
// ============================================

/**
 * Nodes Panel 탭 타입
 */
export type NodesPanelTab = "pages" | "layouts";

/**
 * Pages 탭의 Item
 */
export interface PageTreeItem {
  type: "page" | "element";
  id: string;
  name: string;
  layoutName?: string; // Page에 적용된 Layout 이름
  slotName?: string; // Element의 target slot
  children: PageTreeItem[];
}

/**
 * Layouts 탭의 Item
 */
export interface LayoutTreeItem {
  type: "layout" | "element" | "slot";
  id: string;
  name: string;
  slotProps?: {
    // Slot인 경우
    name: string;
    required: boolean;
  };
  children: LayoutTreeItem[];
}
