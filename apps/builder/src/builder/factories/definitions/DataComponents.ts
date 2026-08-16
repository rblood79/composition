/**
 * Data Components Factory Definitions
 *
 * DataTable 등 데이터 관리 컴포넌트 팩토리 정의
 *
 * @see docs/PLANNED_FEATURES.md - DataTable Component Architecture
 */

import { ComponentElementProps } from "../../../types/core/store.types";
import { ComponentDefinition, ComponentCreationContext } from "../types";

/**
 * DataTable 컴포넌트 정의
 *
 * DataTable은 비시각적 컴포넌트로, 데이터를 중앙에서 관리하고
 * 여러 Collection 컴포넌트가 공유할 수 있도록 합니다.
 *
 * Layer Tree에는 표시되지만 Preview에서는 렌더링되지 않습니다.
 */
export function createDataTableDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  // ⭐ Layout/Slot System

  // 고유 DataTable ID 생성 (사용자가 나중에 변경 가능)
  const dataTableId = `datatable-${Date.now()}`;

  return {
    type: "DataTable",
    parent: {
      type: "DataTable",
      props: {
        id: dataTableId,
        name: "New DataTable",
        autoLoad: true,
        // ADR-159 P4b: 기본 dataBinding 없음 — 데이터 소스는 dataTable(collection) 단일이라
        //   사용자가 Inspector 컬렉션 피커에서 지정한다. 구 기본값(source:"api" + MOCK_DATA)은
        //   저장 문서에 api 바인딩을 계속 유입시키는 유일 생성원이었다 (Phase 0 inventory §5-1).
        // 2026-08-17: preview 의 DataTable 렌더러는 바인딩 유무와 무관하게 무동작이 됐다
        //   (`DataRenderers.renderDataTable` 주석 — sink 가 collections.runtimeData 로 이동).
      } as ComponentElementProps,
      parent_id: parentId,
    },
    // DataTable은 자식 요소가 없음
    children: [],
  };
}

/**
 * Slot 컴포넌트 정의
 *
 * Slot은 Layout 내에서 Page 콘텐츠가 삽입될 위치를 나타냅니다.
 * Layout Body에서만 생성 가능합니다.
 */
export function createSlotDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements, layoutId } = context;
  const parentId = parentElement?.id || null;

  // Slot은 reusable frame 편집 컨텍스트에서만 사용 가능
  if (!layoutId) {
    console.warn("⚠️ Slot can only be created in reusable frame mode");
  }

  return {
    type: "Slot",
    parent: {
      type: "Slot",
      props: {
        name: "content",
        required: false,
        description: "Main content area",
      } as ComponentElementProps,
      parent_id: parentId,
    },
    // Slot은 자식 요소가 없음 (Page에서 채워짐)
    children: [],
  };
}
