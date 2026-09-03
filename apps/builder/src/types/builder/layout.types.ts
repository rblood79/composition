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
 * - EditMode* UI 상태 타입 → `builder/stores/editMode.ts` 로 분리 (layout schema 비의존)
 * - SlotInfo / SlotProps UI·template 소비 → 각 consumer 로컬 계약 (본 파일 export 제거)
 *
 * Phase 1~3 기간에는 adapter 입력 타입으로만 사용된다.
 * 신규 기능은 canonical format(`composition-document.types.ts`)에만 추가할 것.
 *
 * @see docs/adr/903-ref-descendants-slot-composition-format-migration-plan.md
 * @see packages/shared/src/types/composition-document.types.ts
 */

// ============================================
// Layout (adapter / mutation boundary)
// ============================================

/**
 * Layout 타입 (layouts 테이블)
 *
 * @deprecated ADR-903 P3: canonical 'FrameNode' + 'reusable: true'로 흡수 예정.
 * layouts[] 별도 테이블은 Phase 5 G5 완료 시점에 canonical document tree 내부
 * reusable 노드로 통합. Phase 1~3 기간 adapter 입력 타입으로만 사용.
 * UI/list 읽기 경로는 `ReusableFrameLayoutSummary` (`canonicalFrameStore`) 를 쓴다.
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
