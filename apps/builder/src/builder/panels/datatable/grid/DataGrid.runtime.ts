/**
 * DataGrid — ADR-212 Phase 2 (게이트 G1). 테이블 편집기의 행 격자.
 *
 * - D1: RAC `Table` (`role=grid`, `keyboardNavigationBehavior="tab"` — 격자 전체가 tab stop 1개,
 *   Arrow 로 셀 이동) + `Virtualizer`/`TableLayout` (행 높이 고정, `aria-rowcount/colcount` 는 RAC).
 * - 셀 편집은 자체 구현: 셀 포커스 → Enter / F2 / 타이핑 → `<input>` (짧은 값) 또는 Popover
 *   (JSON · 날짜 · 긴 값, `resolveCellEditorKind`). 키 라우팅은 `resolveGridKey` 한 표 (R1) —
 *   편집 중엔 `state.setKeyboardNavigationDisabled(true)` 로 RAC 셀 이동을 끄고 input 이 키를 갖는다.
 * - 모든 쓰기는 `applyDataChange` (`set_cell` · `insert_rows` · `remove_rows` · `replace_rows` ·
 *   헤더 `+` 인라인 입력·붙여넣기의 `add_field`) — HC1. undo 는 152 History data entry.
 * - 새 필드: 헤더 행 끝의 `+` → 그 자리 인라인 `<input>` (Enter=생성 add_field string, Esc=취소,
 *   생성 후 입력 유지해 연속 추가). `+` 는 격자 열이 아니라 스크롤 컨테이너 위의 **슬롯**
 *   (`.datagrid-add-field-slot`) — 마지막 열 오른쪽에 붙되 열이 뷰포트를 넘치면 오른쪽 가장자리에
 *   고정된다 (Airtable 어법 + 좁은 스냅 패널에서도 항상 보이는 가시성). 격자의 aria-colcount 는
 *   실제 열만 센다. 팝오버·모달 없음 (HC2).
 * - 컬럼 정보 수정은 빈도별 3단 (인지 > 회상 · 행위의 자리 = 결과의 자리 · 가시성):
 *   헤더 더블클릭 / 라벨 포커스 + F2 → 그 자리 인라인 rename (`update_field { key }`, 행 이전은
 *   적용기) · 헤더 타입 아이콘 클릭 → 필드 패널이 타입 목록에 포커스된 채 열림 · 라벨 클릭 /
 *   Enter / hover 로 드러나는 `⌄` → 필드 패널 전체. 아이콘·`⌄` 는 tab 순서 밖 (격자 tab stop 유지).
 * - 붙여넣기 (⌘V, 셀 포커스): `planGridPaste` → 넘치는 열은 `ConfirmDialog` "새 필드로 추가?".
 *   파싱 실패 셀은 null + `data-invalid` (0 으로 바꾸지 않음).
 */

import { useContext, useEffect } from "react";

import { TableStateContext } from "react-aria-components/Table";

import type {
  DataField,
  DataTable,
} from "../../../../types/builder/data.types";

import { ACTION_ICONS } from "../../../config/actionIcons";

import { type CellEditorKind } from "./cellValue";

import "./DataGrid.css";

export const AddIcon = ACTION_ICONS.add;

/** ADR-289 — the selection bar's Copy ▾ (the registry's copy, shared with the inspector). */
export const CopyIcon = ACTION_ICONS.copy;

export const DeleteIcon = ACTION_ICONS.delete;

export const GRID_ROW_HEIGHT = 28;

export const SELECT_COLUMN = "__select";

/** The select column — the checkbox and (ADR-289) the row's ↗ Open row button. */
export const SELECT_COLUMN_WIDTH = 56;

/** 새 필드 슬롯 폭 — 버튼 / 인라인 입력 */
export const ADD_SLOT_WIDTH = 36;

export const ADD_SLOT_INPUT_WIDTH = 160;

/** `id` 필드는 행 정체 — 격자에서 고치지 않는다 (aria-readonly). */
/**
 * 가로 스크롤러 — 가상화면 Table 자신 (Virtualizer 가 스크롤), 아니면 `.datagrid-scroll` 컨테이너.
 * 둘 중 하나라도 없으면 (마운트 전) null.
 */
export function resolveScroller(
  root: HTMLElement,
  virtualized: boolean,
): { scroller: HTMLElement; table: HTMLElement } | null {
  const container = root.querySelector<HTMLElement>(".datagrid-scroll");
  const table = root.querySelector<HTMLElement>('[role="grid"]');
  if (!container || !table) return null;
  return { scroller: virtualized ? table : container, table };
}

/** `id` and a computed column (ADR-291 사용자 결정 5 — its cells are the formula's). */
export function isReadonlyField(field: DataField): boolean {
  return field.key === "id" || !!field.formula;
}

export interface CellCoord {
  rowIndex: number;
  key: string;
}

export interface EditingState extends CellCoord {
  kind: CellEditorKind;
  initialDraft?: string;
}

export type CommitMove = "down" | "up" | "right" | "left" | "none";

export interface DataGridProps {
  table: DataTable;
  /** false = Virtualizer 없이 (jsdom 테스트 — 뷰포트 크기가 0 이라 가상 행이 안 그려진다) */
  virtualized?: boolean;
}

export function cellId(coord: CellCoord): string {
  return `${coord.rowIndex}:${coord.key}`;
}

export function coordOf(el: Element | null): CellCoord | null {
  const cell = el?.closest<HTMLElement>("[data-row-index][data-field-key]");
  if (!cell) return null;
  const rowIndex = Number(cell.dataset.rowIndex);
  const key = cell.dataset.fieldKey ?? "";
  return Number.isInteger(rowIndex) && key !== "" ? { rowIndex, key } : null;
}

export function nextRowId(
  rows: readonly Record<string, unknown>[],
  type: string,
) {
  if (type === "number") {
    let max = 0;
    for (const row of rows) {
      const v = row.id;
      if (typeof v === "number" && v > max) max = v;
    }
    return max + 1;
  }
  // Past the row count and every `row_N` in use: deleting a row must not hand out an id again.
  const ids = new Set(rows.map((row) => String(row.id)));
  let n = rows.length;
  for (const id of ids) {
    const match = /^row_(\d+)$/.exec(id);
    if (match) n = Math.max(n, Number(match[1]));
  }
  do n += 1;
  while (ids.has(`row_${n}`));
  return `row_${n}`;
}

// ============================================
// 열 헤더 — 타입 아이콘 · 라벨 (클릭 = 패널, 더블클릭/F2 = 인라인 rename) · ⌄ (hover 로 드러남)
// ============================================

export interface ColumnHeadProps {
  field: DataField;
  labelId: string;
  renaming: boolean;
  t: (
    key: string,
    params?: Record<string, string | number | boolean>,
  ) => string;
  /** ADR-288 — the column's editor is a popover under the head; it needs the table's data. */
  table: DataTable;
  onStartRename: () => void;
  onCancelRename: () => void;
  onCommitRename: (raw: string) => void;
  /** The column ⌄ menu (Supabase 어법) — a view sort on this column, or none. */
  sortDirection: "ascending" | "descending" | null;
  onSort: (direction: "ascending" | "descending" | null) => void;
  /** Frozen = pinned to the left edge while the grid scrolls sideways (view state). */
  frozen: boolean;
  onToggleFreeze: () => void;
}

export interface ColumnRenameInputProps {
  columnKey: string;
  label: string;
  onCommit: (raw: string) => void;
  onCancel: () => void;
}

// ============================================
// 셀
// ============================================

export interface DataGridCellProps {
  rowIndex: number;
  field: DataField;
  /** `value` 라는 이름은 못 쓴다 — RAC Collection 이 렌더한 요소에 `value={item}` 을 덮어쓴다 */
  cellValue: unknown;
  headerId: string;
  editing: EditingState | null;
  invalid: boolean;
  onStartEdit: (coord: CellCoord, initialDraft?: string) => void;
  onCommit: (
    coord: CellCoord,
    raw: string,
    move: CommitMove,
  ) => Promise<boolean>;
  onCancel: (focus: CellCoord | null) => void;
  /** Pinned column (`"last"` = the pinned group's right edge). */
  frozen?: "true" | "last";
  /** ADR-291 — a computed cell whose formula failed on this row (the error's name). */
  formulaError?: string;
  hint: (
    key: string,
    params?: Record<string, string | number | boolean>,
  ) => string;
}

/** 편집 중 RAC 셀 이동을 끈다 — 편집기가 언마운트되면 되살린다 (RAC 권고 편집 어법). */
export function useDisableGridNavigation() {
  const state = useContext(TableStateContext);
  useEffect(() => {
    state?.setKeyboardNavigationDisabled(true);
    return () => state?.setKeyboardNavigationDisabled(false);
  }, [state]);
}

export interface CellEditorProps {
  coord: CellCoord;
  field: DataField;
  original: string;
  headerId: string;
  onCommit: (
    coord: CellCoord,
    raw: string,
    move: CommitMove,
  ) => Promise<boolean>;
  onCancel: (focus: CellCoord | null) => void;
}
