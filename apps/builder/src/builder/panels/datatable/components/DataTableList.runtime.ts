/**
 * DataTableList - DataTable 목록 컴포넌트
 *
 * ADR-212 Phase 1 — 항목은 RAC `GridList` 행 (키보드로 열림 · 행 안 버튼은 Arrow 로 도달,
 * A5) 이고 배지는 필드 수 · 행 수 · 소스 (샘플/API) · 사용처 N (152 역참조) · 0행 · 마지막
 * 실행 오류 (UI-6, Main 아트보드). 세 곳 (목록 · 편집기 · 캔버스 배지) 이 같은 값을 보이는
 * 규칙의 첫 자리.
 *
 * @see presets/dataTablePresets.ts (카탈로그) · @composition/sample-data (생성기, ADR-220) — DATATABLE_PRESET_SYSTEM.md 는 없다 (stale 참조 정리 2026-09-16)
 */

import { ACTION_ICONS } from "../../../config/actionIcons";

import { findLinkedApi } from "../utils/collectionBadgeStatus";
/** 여러 화면에 공통으로 나오는 액션의 아이콘 정본 (`config/actionIcons.ts`). */
export const AddIcon = ACTION_ICONS.add;

/** 컨텍스트 메뉴·다중 선택 툴바와 같은 삭제 아이콘 정본 (`config/actionIcons.ts`). */
export const DeleteIcon = ACTION_ICONS.delete;

export interface DataTableListProps {
  projectId: string;
  editingId: string | null;
  onEditingChange: (id: string | null) => void;
  onCreateClick: () => void;
}

// findLinkedApi 정의는 utils/collectionBadgeStatus 로 이동 (목록·편집기·캔버스 배지 공용 SSOT).
// 기존 소비처 호환을 위해 재노출한다.
export { findLinkedApi };
