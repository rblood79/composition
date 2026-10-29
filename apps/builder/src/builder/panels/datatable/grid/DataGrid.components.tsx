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
import { resolveField, type DataOp } from "@composition/shared";

import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  ChevronDown,
  Download,
  Maximize2,
  Pencil,
  Pin,
  PinOff,
  Upload,
  X,
} from "lucide-react";

import Papa from "papaparse";

import {
  memo,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";

import { Button } from "react-aria-components/Button";

import {
  Menu,
  MenuItem,
  MenuTrigger,
  Separator,
} from "react-aria-components/Menu";

import { Popover } from "react-aria-components/Popover";

// ADR-288 G6 수정 7 (사용자 2026-10-29 「checkbox 도 selected · indeterminate 정상작동하지 않는다」):
// the grid drew its own box — a filled square with no check and no dash, so all-selected and
// some-selected looked the same. The shared Checkbox (Builder chrome, `Checkbox.css`) draws both.
import { Checkbox } from "@composition/shared/components/list";

import {
  Cell,
  Column,
  ColumnResizer,
  ResizableTableContainer,
  Row,
  Table,
  TableBody,
  TableHeader,
  TableStateContext,
} from "react-aria-components/Table";

import {
  TableLayout,
  type TableLayoutProps,
  Virtualizer,
} from "react-aria-components/Virtualizer";
import type { InvalidationContext } from "react-stately/useVirtualizerState";
import type { Key } from "react-aria-components/Table";

import { useOptionalI18n } from "../../../../i18n";

import type { DataField } from "../../../../types/builder/data.types";

import { iconEditProps, iconSmall } from "../../../../utils/ui/uiConstants";

import { ConfirmDialog } from "../../../components/overlay/ConfirmDialog";
import { SearchField } from "../../../components/ui/SearchField";

import { SHORTCUT_DEFINITIONS } from "../../../config/keyboardShortcuts";

import { formatShortcut } from "../../../hooks/useKeyboardShortcutsRegistry";
import { PopoverTextEditor } from "./PopoverTextEditor";
import { nativeDateInputOf } from "../../../../../../../packages/shared/src/state/dateValue";
import {
  formulaCellErrors,
  withComputedCells,
} from "../../../../../../../packages/shared/src/collections/formula/compute";
import { formulaShown } from "../../../../../../../packages/shared/src/collections/formula/names";
import {
  schemaHasFormula,
  useFormulaEngine,
} from "../../../catalogRuntime/formulaEngine";

import { useDataStore } from "../../../stores/data";

import { globalToast } from "../../../stores/toast";

import { announceDataPanelStatus } from "../stores/dataPanelStatusStore";

import {
  ColumnCreatePopover,
  ColumnDeleteDialog,
  ColumnEditorPopover,
} from "./ColumnEditorPopover";
import { sortGridItems, type GridSort } from "./gridSort";

import { RowForm, type RowFormMode } from "./RowForm";

import { openRowFormTarget } from "./rowFormTarget";

import { planFieldRename } from "../utils/fieldRename";

import { FieldGlyph } from "../utils/FieldGlyph";
import { resolveFieldType } from "../utils/fieldTypes";

import { parsePastedRows } from "../utils/pasteRows";

import {
  coerceCellValue,
  formatCellValue,
  resolveCellEditorKind,
} from "./cellValue";

import "./DataGrid.css";
// The Insert menu's popover · items use the row-menu sheet (the inspector's ⋮ menu visuals).
import "../../../components/property/PropertyRowMenu.css";

import { resolveGridKey } from "./gridKeys";

import { ImportPreview } from "./ImportPreview";

import {
  ADD_SLOT_INPUT_WIDTH,
  ADD_SLOT_WIDTH,
  AddIcon,
  CellCoord,
  CellEditorProps,
  ColumnHeadProps,
  ColumnRenameInputProps,
  CommitMove,
  CopyIcon,
  DataGridCellProps,
  DataGridProps,
  DeleteIcon,
  EditingState,
  GRID_ROW_HEIGHT,
  SELECT_COLUMN,
  SELECT_COLUMN_WIDTH,
  cellId,
  coordOf,
  isReadonlyField,
  resolveScroller,
  useDisableGridNavigation,
} from "./DataGrid.runtime";
import {
  gridPasteToOps,
  parseClipboardGrid,
  planGridPaste,
  type GridPastePlan,
} from "./pasteGrid";

export function DataGrid({ table, virtualized = true }: DataGridProps) {
  const i18n = useOptionalI18n();
  const t = useCallback(
    (key: string, params?: Record<string, string | number | boolean>) =>
      i18n ? i18n.t(`datatable.${key}`, params) : key,
    [i18n],
  );
  const applyDataChange = useDataStore((state) => state.applyDataChange);
  const schema = table.schema;
  const rows = table.mockData;
  const collectionId = table.id;
  // ADR-291 사용자 결정 5 — computed columns show their values: the rows the grid shows carry the
  // computed cells (copies — the writes · the row form read `rows`, the document's). The engine
  // is wanted only when a column has a formula; the grid renders again when it loads.
  const formulaEngine = useFormulaEngine(schemaHasFormula(schema));
  const shownRows = useMemo(() => {
    void formulaEngine;
    return withComputedCells(rows, schema) as readonly Record<
      string,
      unknown
    >[];
  }, [formulaEngine, rows, schema]);
  const gridId = useId();

  const [editing, setEditing] = useState<EditingState | null>(null);
  const [invalidCells, setInvalidCells] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // Row selection is the checkbox column's own state (Supabase 어법, 사용자 결정 2026-10-29):
  // a cell click only focuses that cell, rows are selected by their checkbox (and the header
  // checkbox) only. RAC Table selection stays off — in `toggle` mode a row press selects the
  // row, and RAC 1.22 Table has no checkbox-only option (`itemBehavior` is ListBox only).
  const [selectedIndexes, setSelectedIndexes] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const [filterText, setFilterText] = useState("");
  // Column ⌄ menu view state (Supabase 어법) — not written to the document.
  const [sort, setSort] = useState<GridSort | null>(null);
  const [frozenKeys, setFrozenKeys] = useState<readonly string[]>([]);
  const [pendingPaste, setPendingPaste] = useState<GridPastePlan | null>(null);
  const [focusRequest, setFocusRequest] = useState<CellCoord | null>(null);
  const [importRows, setImportRows] = useState<
    Record<string, unknown>[] | null
  >(null);
  const [addingField, setAddingField] = useState(false);
  // ADR-289 Decision 1 — the row form (Insert row… · ↗ Update row · Shift+Enter) beside the grid.
  const [rowForm, setRowForm] = useState<RowFormMode | null>(null);
  const [rowFormNonce, setRowFormNonce] = useState(0);
  // 입력은 uncontrolled — 값은 DOM 이 갖고, 열기·추가마다 nonce 로 입력 key 를 바꿔 신선한
  // 빈 입력을 받는다 (연속 추가).
  const [addNonce, setAddNonce] = useState(0);
  // ADR-289 Decision 3 — `Insert ▾ → Insert column…` opens the column editor's create mode under
  // the `+` slot (the slot's inline name input stays the quick path).
  const [creatingField, setCreatingField] = useState(false);
  const addSlotRef = useRef<HTMLDivElement>(null);
  // 새 필드 슬롯의 x — 마지막 열 오른쪽 (열이 뷰포트 안이면) 또는 뷰포트 오른쪽 가장자리
  const [addSlotLeft, setAddSlotLeft] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fieldByKey = useMemo(
    () => new Map(schema.map((f) => [f.key, f])),
    [schema],
  );
  const fieldRef = useCallback(
    (key: string) => fieldByKey.get(key)?.id ?? key,
    [fieldByKey],
  );

  const write = useCallback(
    async (ops: DataOp[], label?: string) => {
      if (ops.length === 0) return false;
      try {
        await applyDataChange({
          ops,
          origin: "user",
          ...(label ? { label } : {}),
        });
        return true;
      } catch (error) {
        globalToast.error(
          error instanceof Error ? error.message : String(error),
        );
        return false;
      }
    },
    [applyDataChange],
  );

  const openAddField = useCallback(() => {
    setAddingField(true);
    setAddNonce((n) => n + 1);
  }, []);

  const cancelAddField = useCallback(() => {
    setAddingField(false);
  }, []);

  const commitAddField = useCallback(
    async (raw: string) => {
      const next = raw.trim();
      if (next === "") {
        cancelAddField();
        return;
      }
      if (schema.some((f) => f.key === next)) {
        globalToast.warning(t("fieldKeyDup", { key: next }));
        return;
      }
      const ok = await write(
        [
          {
            op: "add_field",
            collectionId,
            field: { key: next, type: "string" },
          },
        ],
        t("fieldAdded", { key: next }),
      );
      if (ok) {
        announceDataPanelStatus(t("fieldAdded", { key: next }), {
          tone: "success",
        });
        // 연속 추가: nonce 를 올려 신선한 빈 입력 + 최신 schema 로 헤더 셀을 다시 만든다.
        setAddNonce((n) => n + 1);
      }
    },
    [schema, write, collectionId, t, cancelAddField],
  );

  // 헤더 인라인 rename — 대상 필드 key (null = 없음)
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const commitRename = useCallback(
    async (field: DataField, raw: string) => {
      setRenamingKey(null);
      const plan = planFieldRename(
        collectionId,
        field,
        schema.map((f) => f.key),
        raw,
      );
      if (plan.kind === "noop") return;
      if (plan.kind === "empty") {
        globalToast.warning(t("fieldKeyEmpty"));
        return;
      }
      if (plan.kind === "dup") {
        globalToast.warning(t("fieldKeyDup", { key: plan.key }));
        return;
      }
      const label = t("fieldRenamed", { from: field.key, to: plan.key });
      const ok = await write([plan.op], label);
      if (ok) announceDataPanelStatus(label, { tone: "success" });
    },
    [collectionId, schema, t, write],
  );

  // 행당 검색 문자열 하나 (행 × 열 소문자 변환은 rows/schema 가 바뀔 때만) — 필터 키 입력마다는
  //   행당 includes 1회
  const searchable = useMemo(
    () =>
      shownRows.map((row, index) => ({
        id: index,
        index,
        row,
        haystack: schema
          .map((field) => {
            const value = row[field.key];
            return value === null || value === undefined ? "" : String(value);
          })
          .join("\0")
          .toLowerCase(),
      })),
    [shownRows, schema],
  );
  const items = useMemo(() => {
    const term = filterText.trim().toLowerCase();
    const filtered =
      term === ""
        ? searchable
        : searchable.filter(({ haystack }) => haystack.includes(term));
    const sortField = sort ? resolveField(schema, sort.key) : null;
    return sortField
      ? sortGridItems(filtered, sortField, sort!.direction)
      : filtered;
  }, [searchable, filterText, sort, schema]);

  // Frozen columns come first (after the checkbox column) so a pinned column sticks at its own
  // left offset — the layout pins them (`FrozenTableLayout`). Keys of deleted fields drop out.
  const frozen = useMemo(
    () => schema.filter((f) => frozenKeys.includes(f.key)).map((f) => f.key),
    [schema, frozenKeys],
  );
  const columns = useMemo(
    () => [
      { id: SELECT_COLUMN, field: null as DataField | null },
      ...schema
        .filter((field) => frozen.includes(field.key))
        .map((field) => ({ id: field.key, field })),
      ...schema
        .filter((field) => !frozen.includes(field.key))
        .map((field) => ({ id: field.key, field })),
    ],
    [schema, frozen],
  );
  const frozenMark = useCallback(
    (key: string): "true" | "last" | undefined =>
      frozen.includes(key)
        ? frozen[frozen.length - 1] === key
          ? "last"
          : "true"
        : undefined,
    [frozen],
  );
  const toggleFreeze = useCallback((key: string) => {
    setFrozenKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }, []);

  // 새 필드 슬롯 위치 — 가로 스크롤러 (가상화면 Table 자신, 아니면 컨테이너) 의 콘텐츠 폭·scrollLeft
  // 로 계산. left = min(콘텐츠 끝 − scrollLeft, 뷰포트 폭 − 슬롯 폭): 열이 다 보이면 마지막 열에
  // 붙고, 넘치면 오른쪽 가장자리에 고정된다 (스크롤바는 clientWidth 밖이라 겹치지 않는다).
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const parts = resolveScroller(root, virtualized);
    if (!parts) return;
    const { scroller, table } = parts;
    const slotWidth = addingField ? ADD_SLOT_INPUT_WIDTH : ADD_SLOT_WIDTH;
    let raf = 0;
    const measure = () => {
      raf = 0;
      // 콘텐츠 폭 — 가상화면 Virtualizer 의 sizer (첫 자식, 열 합계 폭; 열도 가상화라 마지막
      // 헤더 rect 는 못 쓴다), 아니면 table 자체. scrollWidth 는 뷰포트보다 작아지지 않아 부적합.
      const contentWidth = virtualized
        ? ((table.firstElementChild as HTMLElement | null)?.offsetWidth ??
          table.scrollWidth)
        : table.offsetWidth;
      const contentEnd = contentWidth - scroller.scrollLeft;
      const viewportEnd = scroller.clientWidth - slotWidth;
      setAddSlotLeft(Math.max(0, Math.min(contentEnd, viewportEnd)));
    };
    const schedule = () => {
      if (raf === 0) raf = requestAnimationFrame(measure);
    };
    measure();
    scroller.addEventListener("scroll", schedule, { passive: true });
    const ro =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(schedule);
    ro?.observe(scroller);
    ro?.observe(table);
    return () => {
      scroller.removeEventListener("scroll", schedule);
      ro?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [virtualized, addingField, schema]);

  // 필드가 추가되면 (연속 추가 중) 새 열이 보이도록 오른쪽 끝으로 스크롤
  const schemaLength = schema.length;
  useEffect(() => {
    if (!addingField) return;
    const scroller = rootRef.current
      ? resolveScroller(rootRef.current, virtualized)?.scroller
      : undefined;
    if (scroller) scroller.scrollLeft = scroller.scrollWidth;
  }, [schemaLength, addingField, virtualized]);

  // 포커스 이동 — commit/취소/행 추가 뒤 대상 셀로. RAC 는 DOM focus 이벤트로 focusedKey 를 맞춘다.
  useLayoutEffect(() => {
    if (!focusRequest || !rootRef.current) return;
    const root = rootRef.current;
    const selector = `[data-row-index="${focusRequest.rowIndex}"][data-field-key="${focusRequest.key.replace(/["\\]/g, "\\$&")}"]`;
    const target = root.querySelector<HTMLElement>(selector);
    if (target) {
      target.focus();
      setFocusRequest(null);
      return;
    }
    // 가상화 — 대상 행이 아직 안 그려졌으면 (행 추가 뒤 마지막 행) 그 위치로 스크롤하고 다음 프레임에 재시도
    const scroller = root.querySelector<HTMLElement>('[role="grid"]');
    if (!scroller) {
      setFocusRequest(null);
      return;
    }
    scroller.scrollTop = Math.max(0, focusRequest.rowIndex * GRID_ROW_HEIGHT);
    let attempts = 0;
    let raf = 0;
    const retry = () => {
      const el = root.querySelector<HTMLElement>(selector);
      if (el) {
        el.focus();
        setFocusRequest(null);
      } else if (attempts++ < 5) {
        raf = requestAnimationFrame(retry);
      } else {
        setFocusRequest(null);
      }
    };
    raf = requestAnimationFrame(retry);
    return () => cancelAnimationFrame(raf);
  }, [focusRequest, rows, editing]);

  const neighbor = useCallback(
    (coord: CellCoord, move: CommitMove): CellCoord => {
      const colIndex = schema.findIndex((f) => f.key === coord.key);
      const clampRow = (r: number) => Math.max(0, Math.min(rows.length - 1, r));
      const clampCol = (c: number) =>
        Math.max(0, Math.min(schema.length - 1, c));
      switch (move) {
        case "down":
          return { rowIndex: clampRow(coord.rowIndex + 1), key: coord.key };
        case "up":
          return { rowIndex: clampRow(coord.rowIndex - 1), key: coord.key };
        case "right":
          return {
            rowIndex: coord.rowIndex,
            key: schema[clampCol(colIndex + 1)].key,
          };
        case "left":
          return {
            rowIndex: coord.rowIndex,
            key: schema[clampCol(colIndex - 1)].key,
          };
        default:
          return coord;
      }
    },
    [schema, rows.length],
  );

  const startEdit = useCallback(
    (coord: CellCoord, initialDraft?: string) => {
      const field = fieldByKey.get(coord.key);
      if (!field || isReadonlyField(field) || coord.rowIndex >= rows.length)
        return;
      const kind = resolveCellEditorKind(
        field.type,
        rows[coord.rowIndex][field.key],
      );
      setEditing({
        ...coord,
        kind,
        ...(kind === "inline" && initialDraft !== undefined
          ? { initialDraft }
          : {}),
      });
    },
    [fieldByKey, rows],
  );

  const endEdit = useCallback((focus: CellCoord | null) => {
    setEditing(null);
    if (focus) setFocusRequest(focus);
  }, []);

  /** 편집 commit — 강제 실패면 false (편집기가 aria-invalid 로 남는다). */
  const commitEdit = useCallback(
    async (
      coord: CellCoord,
      raw: string,
      move: CommitMove,
    ): Promise<boolean> => {
      const field = fieldByKey.get(coord.key);
      if (!field) return false;
      const coerced = coerceCellValue(field.type, raw);
      if (!coerced.ok) {
        globalToast.error(t("gridCellInvalid", { type: field.type }));
        return false;
      }
      const prev = rows[coord.rowIndex]?.[field.key];
      const target = neighbor(coord, move);
      if (formatCellValue(prev) === formatCellValue(coerced.value)) {
        endEdit(target);
        return true;
      }
      endEdit(target);
      setInvalidCells((prevSet) => {
        if (!prevSet.has(cellId(coord))) return prevSet;
        const next = new Set(prevSet);
        next.delete(cellId(coord));
        return next;
      });
      await write([
        {
          op: "set_cell",
          collectionId,
          rowIndex: coord.rowIndex,
          fieldId: fieldRef(coord.key),
          value: coerced.value,
        },
      ]);
      return true;
    },
    [collectionId, endEdit, fieldByKey, fieldRef, neighbor, rows, t, write],
  );

  const clearCell = useCallback(
    async (coord: CellCoord) => {
      const field = fieldByKey.get(coord.key);
      if (!field || isReadonlyField(field)) return;
      const prev = rows[coord.rowIndex]?.[field.key];
      if (prev === null || prev === undefined) return;
      const ok = await write([
        {
          op: "set_cell",
          collectionId,
          rowIndex: coord.rowIndex,
          fieldId: fieldRef(coord.key),
          value: null,
        },
      ]);
      if (ok) announceDataPanelStatus(t("gridCellCleared"));
    },
    [collectionId, fieldByKey, fieldRef, rows, t, write],
  );

  // ADR-289 — Insert row… opens the form (사용자 결정 2); an empty save is the old empty row.
  const openInsertForm = useCallback(() => {
    setRowForm({ kind: "insert" });
    setRowFormNonce((n) => n + 1);
  }, []);
  const openUpdateForm = useCallback(
    (rowIndex: number) => {
      if (rowIndex < 0 || rowIndex >= rows.length) return;
      setRowForm({
        kind: "update",
        rowIndex,
        opened: openRowFormTarget(table, rowIndex),
      });
      setRowFormNonce((n) => n + 1);
    },
    [rows.length, table],
  );
  const closeRowForm = useCallback(() => setRowForm(null), []);
  const focusSavedRow = useCallback(
    (rowIndex: number) => {
      const first = schema.find((f) => !isReadonlyField(f)) ?? schema[0];
      if (first) setFocusRequest({ rowIndex, key: first.key });
    },
    [schema],
  );

  const selectedRowIndexes = useMemo(
    () =>
      [...selectedIndexes]
        .filter((index) => index < rows.length)
        .sort((a, b) => a - b),
    [selectedIndexes, rows.length],
  );
  const toggleRow = useCallback((index: number, selected: boolean) => {
    setSelectedIndexes((prev) => {
      const next = new Set(prev);
      if (selected) next.add(index);
      else next.delete(index);
      return next;
    });
  }, []);
  // The header checkbox covers the visible (filtered) rows only.
  const allVisibleSelected =
    items.length > 0 && items.every((item) => selectedIndexes.has(item.index));
  const someVisibleSelected =
    !allVisibleSelected &&
    items.some((item) => selectedIndexes.has(item.index));
  const toggleVisibleRows = useCallback(
    (selected: boolean) => {
      setSelectedIndexes((prev) => {
        const next = new Set(prev);
        for (const item of items) {
          if (selected) next.add(item.index);
          else next.delete(item.index);
        }
        return next;
      });
    },
    [items],
  );

  const deleteSelected = useCallback(async () => {
    if (selectedRowIndexes.length === 0) return;
    const ok = await write([
      { op: "remove_rows", collectionId, rowIndexes: selectedRowIndexes },
    ]);
    if (!ok) return;
    setSelectedIndexes(new Set());
    announceDataPanelStatus(
      t("gridRowsDeleted", { count: selectedRowIndexes.length }),
      { tone: "success" },
    );
  }, [collectionId, selectedRowIndexes, t, write]);

  const applyPaste = useCallback(
    async (plan: GridPastePlan, addExtraColumns: boolean) => {
      const ops = gridPasteToOps(plan, {
        collectionId,
        schema,
        addExtraColumns,
      });
      const ok = await write(ops);
      if (!ok) return;
      setInvalidCells((prev) => {
        const next = new Set(prev);
        for (const cell of plan.cells) {
          const id = cellId({ rowIndex: cell.rowIndex, key: cell.key });
          if (cell.invalid) next.add(id);
          else next.delete(id);
        }
        return next;
      });
      const message =
        t("gridPasted", {
          rows: plan.pastedRowCount,
          cells: plan.cells.length + plan.newRows.length * schema.length,
        }) +
        (plan.invalidCount > 0
          ? ` ${t("gridPasteInvalid", { count: plan.invalidCount })}`
          : "");
      if (plan.invalidCount > 0) globalToast.error(message);
      else announceDataPanelStatus(message, { tone: "success" });
    },
    [collectionId, schema, t, write],
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLDivElement>) => {
      if (editing) return; // input/textarea 의 기본 붙여넣기
      const target = e.target as HTMLElement;
      if (target.getAttribute("role") !== "gridcell") return;
      const anchor = coordOf(target);
      if (!anchor) return;
      e.preventDefault();
      const grid = parseClipboardGrid(e.clipboardData.getData("text/plain"));
      if (grid.length === 0) {
        globalToast.error(t("gridPasteEmpty"));
        return;
      }
      const colIndex = Math.max(
        0,
        schema.findIndex((f) => f.key === anchor.key),
      );
      const plan = planGridPaste({
        grid,
        schema,
        rowCount: rows.length,
        anchor: { rowIndex: anchor.rowIndex, colIndex },
        // A filter hides rows: paste into the visible ones only.
        rowOrder:
          items.length === rows.length
            ? undefined
            : items.map((item) => item.index),
      });
      if (plan.extraColumns.length > 0) setPendingPaste(plan);
      else void applyPaste(plan, false);
    },
    [applyPaste, editing, items, rows.length, schema, t],
  );

  // 비편집 키 — 편집 중엔 셀 안 편집기가 자기 keydown 에서 처리한다 (R1 매트릭스의 editing 축).
  // A press on an empty spot of the grid area (below the rows, right of the columns, the toolbar's
  // blank space) leaves the cell — Supabase 어법 (사용자 지적 2026-10-29). Those spots are not
  // focusable (the grid element itself is `tabindex=-1` and keeps focus where it was), so without
  // this the clicked cell kept focus and its ring. An open inline editor commits on that blur.
  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const target = e.target as Element;
      if (target.closest(INTERACTIVE_IN_GRID)) return;
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        e.currentTarget.contains(active) &&
        active.closest('[role="gridcell"], [role="columnheader"]')
      ) {
        active.blur();
      }
    },
    [],
  );

  const handleKeyDownCapture = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-grid-editor]")) return;
      const action = resolveGridKey(e, {
        editing: false,
        targetIsCell: target.getAttribute("role") === "gridcell",
      });
      if (action.type === "pass" || action.type === "stop") return;
      const coord = coordOf(target);
      if (!coord) return;
      if (action.type === "start-edit") {
        e.preventDefault();
        e.stopPropagation();
        startEdit(coord, action.initialDraft);
      } else if (action.type === "clear-cell") {
        e.preventDefault();
        e.stopPropagation();
        void clearCell(coord);
      } else if (action.type === "open-row") {
        e.preventDefault();
        e.stopPropagation();
        openUpdateForm(coord.rowIndex);
      }
    },
    [clearCell, openUpdateForm, startEdit],
  );

  const handleFileSelect = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const finish = () => {
        if (fileInputRef.current) fileInputRef.current.value = "";
      };
      const isJson = /\.json$/i.test(file.name);
      file
        .text()
        .then((text) => {
          if (isJson) {
            const parsed = parsePastedRows(text);
            if (!parsed.ok || parsed.rows.length === 0) {
              globalToast.error(t("importParseFailed"));
              finish();
              return;
            }
            setImportRows(parsed.rows);
            finish();
            return;
          }
          Papa.parse<Record<string, unknown>>(text, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              const rows = results.data.filter(
                (r) => r && typeof r === "object",
              );
              if (rows.length === 0) {
                globalToast.error(t("importParseFailed"));
                finish();
                return;
              }
              setImportRows(rows);
              finish();
            },
            error: (error: Error) => {
              globalToast.error(error.message);
              finish();
            },
          });
        })
        .catch(() => {
          globalToast.error(t("importParseFailed"));
          finish();
        });
    },
    [t],
  );

  // ADR-289 Decision 4 — the selection bar: Copy ▾ (CSV · JSON → clipboard) · Export ▾ (the
  // selected rows as a file) · Delete N rows. Without a selection Export ▾ is the whole table.
  const serializeRows = useCallback(
    (subset: readonly Record<string, unknown>[], format: "csv" | "json") =>
      format === "csv"
        ? // Structure values as JSON text (what a paste parses back) — Papa would join an array.
          Papa.unparse(
            subset.map((row) =>
              Object.fromEntries(
                schema.map((f) => {
                  const value = row[f.key];
                  return [
                    f.key,
                    typeof value === "object" && value !== null
                      ? formatCellValue(value)
                      : value,
                  ];
                }),
              ),
            ),
            { columns: schema.map((f) => f.key) },
          )
        : JSON.stringify(subset, null, 2),
    [schema],
  );
  const exportRows = useCallback(
    (
      subset: readonly Record<string, unknown>[],
      format: "csv" | "json",
      suffix = "",
    ) => {
      if (subset.length === 0) return;
      const text = serializeRows(subset, format);
      const blob = new Blob([text], {
        type:
          format === "csv"
            ? "text/csv;charset=utf-8;"
            : "application/json;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${table.name || "data"}${suffix}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    },
    [serializeRows, table.name],
  );
  const selectedRows = useMemo(
    () => selectedRowIndexes.map((index) => rows[index]).filter(Boolean),
    [selectedRowIndexes, rows],
  );
  const copySelected = useCallback(
    async (format: "csv" | "json") => {
      if (selectedRows.length === 0) return;
      try {
        await navigator.clipboard.writeText(
          serializeRows(selectedRows, format),
        );
        announceDataPanelStatus(
          t("gridRowsCopied", { count: selectedRows.length }),
          { tone: "success" },
        );
      } catch {
        globalToast.error(t("gridCopyFailed"));
      }
    },
    [selectedRows, serializeRows, t],
  );

  const tableNode = (
    <Table
      aria-label={table.name}
      className="datagrid-table"
      keyboardNavigationBehavior="tab"
      selectionMode="none"
    >
      <TableHeader
        columns={columns}
        // RAC 는 render 함수 결과를 캐시한다 — 인라인 rename 상태가 헤더에 반영되려면 의존성 선언
        dependencies={[
          renamingKey,
          commitRename,
          t,
          allVisibleSelected,
          someVisibleSelected,
          toggleVisibleRows,
          sort,
          frozenMark,
          toggleFreeze,
        ]}
      >
        {(column) =>
          column.id === SELECT_COLUMN ? (
            <SelectColumn
              label={t("gridSelectAllRows")}
              isSelected={allVisibleSelected}
              isIndeterminate={someVisibleSelected}
              onChange={toggleVisibleRows}
            />
          ) : (
            <Column
              id={column.id}
              isRowHeader={column.id === schema[0]?.key}
              defaultWidth={140}
              minWidth={72}
              className="datagrid-column"
              data-frozen={frozenMark(column.id)}
            >
              <ColumnHead
                field={column.field!}
                labelId={`${gridId}-h-${column.field!.key}`}
                renaming={renamingKey === column.field!.key}
                t={t}
                table={table}
                onStartRename={() => setRenamingKey(column.field!.key)}
                onCancelRename={() => setRenamingKey(null)}
                onCommitRename={(raw) => void commitRename(column.field!, raw)}
                sortDirection={
                  sort?.key === column.field!.key ? sort.direction : null
                }
                onSort={(direction) =>
                  setSort(
                    direction ? { key: column.field!.key, direction } : null,
                  )
                }
                frozen={frozen.includes(column.field!.key)}
                onToggleFreeze={() => toggleFreeze(column.field!.key)}
              />
              <ColumnResizer className="datagrid-column-resizer" />
            </Column>
          )
        }
      </TableHeader>
      <TableBody
        items={items}
        dependencies={[
          editing,
          invalidCells,
          schema,
          gridId,
          openUpdateForm,
          selectedIndexes,
          toggleRow,
          frozenMark,
        ]}
        renderEmptyState={() => (
          <div className="datagrid-empty">
            {t("gridNoRows", {
              shortcut: formatShortcut(SHORTCUT_DEFINITIONS.paste),
            })}
          </div>
        )}
      >
        {(item) => (
          <Row
            id={item.id}
            columns={columns}
            dependencies={[
              editing,
              invalidCells,
              item.row,
              gridId,
              openUpdateForm,
              selectedIndexes,
              toggleRow,
              frozenMark,
            ]}
            className="datagrid-row"
            data-checked={selectedIndexes.has(item.index) || undefined}
          >
            {(column) =>
              column.id === SELECT_COLUMN ? (
                <Cell className="datagrid-cell datagrid-cell-select">
                  {/* slot={null} opts out of the Row's RAC selection slot (selection is off). */}
                  <Checkbox
                    slot={null}
                    size="S"
                    aria-label={t("gridSelectRow")}
                    className="datagrid-checkbox"
                    isSelected={selectedIndexes.has(item.index)}
                    onChange={(selected) => toggleRow(item.index, selected)}
                  />
                  {/* ADR-289 (사용자 결정 4) — ↗ opens the row form on this row; shown on row
                      hover · focus, outside the tab order (the grid stays one tab stop). */}
                  <Button
                    className="datagrid-row-open"
                    aria-label={t("openRow")}
                    excludeFromTabOrder
                    onPress={() => openUpdateForm(item.index)}
                  >
                    <Maximize2 size={iconSmall.size} />
                  </Button>
                </Cell>
              ) : (
                <DataGridCell
                  rowIndex={item.index}
                  field={column.field!}
                  cellValue={item.row[column.field!.key]}
                  headerId={`${gridId}-h-${column.field!.key}`}
                  editing={
                    editing &&
                    editing.rowIndex === item.index &&
                    editing.key === column.field!.key
                      ? editing
                      : null
                  }
                  invalid={invalidCells.has(
                    cellId({ rowIndex: item.index, key: column.field!.key }),
                  )}
                  onStartEdit={startEdit}
                  onCommit={commitEdit}
                  onCancel={endEdit}
                  frozen={frozenMark(column.field!.key)}
                  hint={t}
                  formulaError={
                    column.field!.formula
                      ? formulaCellErrors(item.row)?.[column.field!.key]
                      : undefined
                  }
                />
              )
            }
          </Row>
        )}
      </TableBody>
    </Table>
  );

  return (
    <div
      ref={rootRef}
      className="datagrid"
      data-testid="datagrid"
      data-adding={String(addingField)}
      onKeyDownCapture={handleKeyDownCapture}
      onPointerDown={handlePointerDown}
      onPaste={handlePaste}
    >
      <div className="data-toolbar datagrid-toolbar">
        {/* The Builder's panel search field (Navigator 「Search pages」 와 같은 부품 · 모양) —
            RAC SearchField: its clear button and Esc empty the filter. */}
        <SearchField
          className="datagrid-filter-field"
          appearance="control"
          value={filterText}
          onChange={setFilterText}
          placeholder={t("filterRows")}
          aria-label={t("filterRows")}
        />
        <div className="toolbar-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json,application/json,text/csv"
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />
          {/* ADR-288 G6 수정 8 (Supabase Table Editor 대조, 2026-10-29): one `Insert ▾` menu —
              row · column · CSV import — in place of the footer's Add row and the toolbar's
              Import. With rows selected the bar swaps to `Delete N rows` (the selection toolbar). */}
          {selectedRowIndexes.length > 0 ? (
            <>
              <ToolbarMenu
                label={t("copyRows")}
                icon={<CopyIcon {...iconEditProps} />}
                items={[
                  { id: "csv", label: t("copyCsv") },
                  { id: "json", label: t("copyJson") },
                ]}
                onAction={(id) => void copySelected(id as "csv" | "json")}
              />
              <ToolbarMenu
                label={t("export")}
                icon={<Download {...iconEditProps} />}
                items={[
                  { id: "csv", label: t("exportSelectedCsv") },
                  { id: "json", label: t("exportSelectedJson") },
                ]}
                onAction={(id) =>
                  exportRows(selectedRows, id as "csv" | "json", "-selected")
                }
              />
              <Button
                className="control-button"
                data-tone="danger"
                onPress={() => void deleteSelected()}
              >
                <DeleteIcon {...iconEditProps} />
                {t("gridDeleteRows", { count: selectedRowIndexes.length })}
              </Button>
            </>
          ) : (
            <MenuTrigger>
              <Button
                className="control-button datagrid-insert-trigger"
                aria-label={t("insert")}
              >
                <AddIcon {...iconEditProps} />
                {t("insert")}
                <ChevronDown size={iconSmall.size} aria-hidden="true" />
              </Button>
              <Popover
                className="react-aria-Popover property-select-popover property-row-menu-popover"
                placement="bottom end"
              >
                <Menu
                  className="react-aria-Menu property-row-menu"
                  aria-label={t("insert")}
                  disabledKeys={schema.length === 0 ? ["row"] : []}
                  onAction={(key) => {
                    if (key === "row") openInsertForm();
                    else if (key === "column") setCreatingField(true);
                    else if (key === "csv") fileInputRef.current?.click();
                  }}
                >
                  <MenuItem
                    id="row"
                    className="react-aria-MenuItem"
                    textValue={t("insertRow")}
                  >
                    <span>{t("insertRow")}</span>
                  </MenuItem>
                  <MenuItem
                    id="column"
                    className="react-aria-MenuItem"
                    textValue={t("insertColumn")}
                  >
                    <span>{t("insertColumn")}</span>
                  </MenuItem>
                  <MenuItem
                    id="csv"
                    className="react-aria-MenuItem"
                    textValue={t("importCsv")}
                  >
                    <Upload size={iconSmall.size} />
                    <span>{t("importCsv")}</span>
                  </MenuItem>
                </Menu>
              </Popover>
            </MenuTrigger>
          )}
          {selectedRowIndexes.length === 0 && (
            <ToolbarMenu
              label={t("export")}
              icon={<Download {...iconEditProps} />}
              isDisabled={rows.length === 0}
              items={[
                { id: "csv", label: t("exportCsv") },
                { id: "json", label: t("exportJson") },
              ]}
              onAction={(id) => exportRows(rows, id as "csv" | "json")}
            />
          )}
        </div>
      </div>
      {filterText && (
        <div className="filter-result-info">
          {items.length} / {rows.length}
        </div>
      )}
      {importRows && (
        <ImportPreview
          rows={importRows}
          schema={schema}
          collectionId={collectionId}
          rowCount={rows.length}
          write={write}
          onDone={(imported) => {
            setImportRows(null);
            if (imported !== null)
              announceDataPanelStatus(t("importDone", { rows: imported }), {
                tone: "success",
              });
          }}
        />
      )}
      <div className="datagrid-split" data-form={rowForm ? "true" : undefined}>
        <div className="datagrid-scroll-wrap">
          {virtualized ? (
            <ResizableTableContainer className="datagrid-scroll">
              <Virtualizer<FrozenLayoutOptions>
                layout={FrozenTableLayout}
                layoutOptions={{
                  rowHeight: GRID_ROW_HEIGHT,
                  headingHeight: GRID_ROW_HEIGHT,
                  frozenColumns: frozen.join("\0"),
                }}
              >
                {tableNode}
              </Virtualizer>
            </ResizableTableContainer>
          ) : (
            <ResizableTableContainer className="datagrid-scroll">
              {tableNode}
            </ResizableTableContainer>
          )}
          {/* 새 필드 슬롯 — 헤더 행 높이, 마지막 열 오른쪽 / 뷰포트 오른쪽 가장자리 (가시성) */}
          <div
            ref={addSlotRef}
            className="datagrid-add-field-slot"
            data-adding={String(addingField)}
            style={{ left: addSlotLeft }}
          >
            {addingField ? (
              <input
                key={addNonce}
                className="datagrid-add-field-input"
                autoFocus
                aria-label={t("fieldAddTitle")}
                placeholder={t("fieldNamePlaceholder")}
                defaultValue=""
                data-shortcut-local="undo redo"
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void commitAddField(e.currentTarget.value);
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    cancelAddField();
                  }
                }}
              />
            ) : (
              <Button
                className="datagrid-add-field"
                aria-label={t("fieldAddTitle")}
                onPress={openAddField}
              >
                <AddIcon size={iconSmall.size} />
              </Button>
            )}
          </div>
        </div>
        <ColumnCreatePopover
          table={table}
          triggerRef={addSlotRef}
          isOpen={creatingField}
          onOpenChange={setCreatingField}
        />
        {rowForm && (
          <RowForm
            key={`${rowForm.kind}-${rowForm.kind === "update" ? rowForm.rowIndex : ""}-${rowFormNonce}`}
            table={table}
            mode={rowForm}
            onClose={closeRowForm}
            onSaved={focusSavedRow}
          />
        )}
      </div>
      <ConfirmDialog
        isOpen={pendingPaste !== null}
        title={t("gridPasteExtraTitle")}
        message={
          pendingPaste
            ? t("gridPasteExtraMessage", {
                count: pendingPaste.extraColumns.length,
                keys: pendingPaste.extraColumns.map((c) => c.key).join(", "),
              })
            : ""
        }
        tone="default"
        confirmLabel={t("gridPasteAddFields")}
        cancelLabel={t("gridPasteSkipFields")}
        onConfirm={() => {
          const plan = pendingPaste;
          setPendingPaste(null);
          if (plan) void applyPaste(plan, true);
        }}
        onCancel={() => {
          const plan = pendingPaste;
          setPendingPaste(null);
          if (plan) void applyPaste(plan, false);
        }}
        onDismiss={() => setPendingPaste(null)}
      />
    </div>
  );
}

/** What a press in the grid area may land on and keep its own behavior (not an "empty spot"). */
const INTERACTIVE_IN_GRID =
  '[role="gridcell"], [role="columnheader"], [role="rowheader"], [role="dialog"], button, input, textarea, select, a, label, [contenteditable="true"]';

interface FrozenLayoutOptions extends TableLayoutProps {
  /** Frozen field keys joined by `\0` — a string so the layout can compare it cheaply. */
  frozenColumns?: string;
}

/**
 * RAC `TableLayout` with pinned columns — the checkbox column and the frozen fields are sticky
 * (`isStickyColumn` is the layout's subclass hook; S2 TableView pins its checkbox the same way).
 * Sticky cells keep their own left offset, so the frozen fields are ordered first (`columns`).
 */
class FrozenTableLayout<T> extends TableLayout<T, FrozenLayoutOptions> {
  private frozen: ReadonlySet<string> = new Set();

  shouldInvalidateLayoutOptions(
    newOptions: FrozenLayoutOptions,
    oldOptions: FrozenLayoutOptions,
  ): boolean {
    return (
      newOptions.frozenColumns !== oldOptions.frozenColumns ||
      super.shouldInvalidateLayoutOptions(newOptions, oldOptions)
    );
  }

  update(invalidationContext: InvalidationContext<FrozenLayoutOptions>): void {
    const keys = invalidationContext.layoutOptions?.frozenColumns;
    this.frozen = new Set(keys ? keys.split("\0") : []);
    super.update(invalidationContext);
  }

  // The header · body row groups clip by default (`overflow: hidden`), which makes each group the
  // sticky cells' scroll container — they then scroll away with it. Opening the groups leaves the
  // grid's scroller as the sticky container (rows already allow overflow).
  protected buildTableHeader() {
    const node = super.buildTableHeader();
    node.layoutInfo.allowOverflow = true;
    for (const row of node.children ?? []) row.layoutInfo.allowOverflow = true;
    return node;
  }

  // Every body row group comes through here (`buildBody` and the sectioned collection path). The
  // node type (`GridNode`) is not exported, so the parameter is widened and passed through.
  protected buildRowGroup(y: number, node: unknown) {
    const group = super.buildRowGroup(y, node as never);
    group.layoutInfo.allowOverflow = true;
    return group;
  }

  // Called for header columns and for body cells — a cell's key is `row:field`, so a cell reads
  // its column by `colIndex ?? index` (the lookup `getRenderedColumnWidth` uses).
  protected isStickyColumn(node: {
    key: Key;
    type: string;
    index: number;
    colIndex?: number | null;
  }): boolean {
    const columns = (
      this.virtualizer?.collection as
        { columns?: readonly { key: Key }[] } | undefined
    )?.columns;
    const key =
      node.type === "cell"
        ? columns?.[node.colIndex ?? node.index]?.key
        : node.key;
    return (
      key === SELECT_COLUMN || (key != null && this.frozen.has(String(key)))
    );
  }
}

/** A toolbar `Label ▾` menu — the Insert menu's sheet (row-menu visuals). */
function ToolbarMenu({
  label,
  icon,
  items,
  onAction,
  isDisabled,
}: {
  label: string;
  icon: ReactNode;
  items: readonly { id: string; label: string }[];
  onAction: (id: string) => void;
  isDisabled?: boolean;
}) {
  return (
    <MenuTrigger>
      <Button
        className="control-button datagrid-insert-trigger"
        aria-label={label}
        isDisabled={isDisabled}
      >
        {icon}
        {label}
        <ChevronDown size={iconSmall.size} aria-hidden="true" />
      </Button>
      <Popover
        className="react-aria-Popover property-select-popover property-row-menu-popover"
        placement="bottom end"
      >
        <Menu
          className="react-aria-Menu property-row-menu"
          aria-label={label}
          onAction={(key) => onAction(String(key))}
        >
          {items.map((item) => (
            <MenuItem
              key={item.id}
              id={item.id}
              className="react-aria-MenuItem"
              textValue={item.label}
            >
              <span>{item.label}</span>
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

function ColumnHead({
  field,
  labelId,
  renaming,
  t,
  table,
  onStartRename,
  onCancelRename,
  onCommitRename,
  sortDirection,
  onSort,
  frozen,
  onToggleFreeze,
}: ColumnHeadProps) {
  const typeEntry = resolveFieldType(field.type);
  // ADR-291 (사용자 결정 5) — a computed column's head names its formula (over field keys).
  const formulaEngine = useFormulaEngine(!!field.formula);
  const formulaText = useMemo(
    () =>
      field.formula
        ? formulaShown(formulaEngine, field.formula, table.schema)
        : undefined,
    [field.formula, formulaEngine, table.schema],
  );
  const typeLabel = formulaText
    ? `${t("fieldComputed")} · ${t(typeEntry.i18n)} — ${formulaText}`
    : `${t("fieldType")}: ${t(typeEntry.i18n)}`;
  // ADR-288 Decision 2 — the column editor opens under the head (label · chevron), the type icon
  // opens it on the type list. Esc · outside closes it (RAC Popover).
  const headRef = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<{ focus?: "type" } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const onOpenPanel = (options?: { focus?: "type" }) =>
    setEditor(options ?? {});
  const SortGlyph =
    sortDirection === "ascending"
      ? ArrowUpNarrowWide
      : sortDirection === "descending"
        ? ArrowDownWideNarrow
        : null;
  // The ⌄ menu (Supabase 어법 — sort · copy name · edit · freeze · delete). The label and the type
  // icon open the column editor; the menu is the column's actions, not a third way to the editor.
  const onMenuAction = (id: string) => {
    switch (id) {
      case "sort-asc":
        onSort("ascending");
        break;
      case "sort-desc":
        onSort("descending");
        break;
      case "sort-clear":
        onSort(null);
        break;
      case "copy-name":
        void navigator.clipboard.writeText(field.key).then(
          () =>
            announceDataPanelStatus(t("columnNameCopied", { key: field.key }), {
              tone: "success",
            }),
          () => globalToast.error(t("gridCopyFailed")),
        );
        break;
      case "edit":
        onOpenPanel();
        break;
      case "freeze":
        onToggleFreeze();
        break;
      case "delete":
        setDeleting(true);
        break;
    }
  };
  return (
    <div
      ref={headRef}
      className="datagrid-column-head"
      data-field-type={field.type}
      data-computed={field.formula ? "true" : undefined}
      title={formulaText ? `${t("fieldFormula")}: ${formulaText}` : undefined}
      data-renaming={String(renaming)}
      data-editor-open={editor ? "true" : undefined}
      onDoubleClick={(e) => {
        if (renaming) return;
        e.preventDefault();
        onStartRename();
      }}
      onKeyDown={(e) => {
        if (renaming) return;
        if (e.key === "F2") {
          e.preventDefault();
          e.stopPropagation();
          onStartRename();
        }
      }}
    >
      <Button
        className="datagrid-column-type"
        aria-label={typeLabel}
        excludeFromTabOrder
        onPress={() => onOpenPanel({ focus: "type" })}
      >
        <FieldGlyph field={field} size={iconSmall.size} />
      </Button>
      {renaming ? (
        <ColumnRenameInput
          columnKey={field.key}
          label={t("fieldName")}
          onCommit={onCommitRename}
          onCancel={onCancelRename}
        />
      ) : (
        <Button
          id={labelId}
          className="datagrid-column-label"
          onPress={() => onOpenPanel()}
        >
          {field.key}
        </Button>
      )}
      {SortGlyph && (
        <SortGlyph
          className="datagrid-column-sort"
          size={iconSmall.size}
          aria-hidden="true"
          data-direction={sortDirection}
        />
      )}
      <MenuTrigger>
        <Button
          className="datagrid-column-menu"
          aria-label={t("columnActions", { key: field.key })}
          excludeFromTabOrder
        >
          <ChevronDown size={iconSmall.size} />
        </Button>
        <Popover
          className="react-aria-Popover property-select-popover property-row-menu-popover"
          placement="bottom end"
        >
          <Menu
            className="react-aria-Menu property-row-menu datagrid-column-actions"
            aria-label={t("columnActions", { key: field.key })}
            onAction={(key) => onMenuAction(String(key))}
          >
            <MenuItem
              id="sort-asc"
              className="react-aria-MenuItem"
              textValue={t("sortAscending")}
              data-current={sortDirection === "ascending" || undefined}
            >
              <ArrowUpNarrowWide size={iconSmall.size} aria-hidden="true" />
              <span>{t("sortAscending")}</span>
            </MenuItem>
            <MenuItem
              id="sort-desc"
              className="react-aria-MenuItem"
              textValue={t("sortDescending")}
              data-current={sortDirection === "descending" || undefined}
            >
              <ArrowDownWideNarrow size={iconSmall.size} aria-hidden="true" />
              <span>{t("sortDescending")}</span>
            </MenuItem>
            {sortDirection && (
              <MenuItem
                id="sort-clear"
                className="react-aria-MenuItem"
                textValue={t("sortClear")}
              >
                <X size={iconSmall.size} aria-hidden="true" />
                <span>{t("sortClear")}</span>
              </MenuItem>
            )}
            <Separator className="datagrid-column-actions-separator" />
            <MenuItem
              id="copy-name"
              className="react-aria-MenuItem"
              textValue={t("columnCopyName")}
            >
              <CopyIcon size={iconSmall.size} aria-hidden="true" />
              <span>{t("columnCopyName")}</span>
            </MenuItem>
            <MenuItem
              id="edit"
              className="react-aria-MenuItem"
              textValue={t("columnEdit")}
            >
              <Pencil size={iconSmall.size} aria-hidden="true" />
              <span>{t("columnEdit")}</span>
            </MenuItem>
            <MenuItem
              id="freeze"
              className="react-aria-MenuItem"
              textValue={t(frozen ? "columnUnfreeze" : "columnFreeze")}
            >
              {frozen ? (
                <PinOff size={iconSmall.size} aria-hidden="true" />
              ) : (
                <Pin size={iconSmall.size} aria-hidden="true" />
              )}
              <span>{t(frozen ? "columnUnfreeze" : "columnFreeze")}</span>
            </MenuItem>
            <Separator className="datagrid-column-actions-separator" />
            <MenuItem
              id="delete"
              className="react-aria-MenuItem"
              textValue={t("columnDelete")}
              data-tone="danger"
            >
              <DeleteIcon size={iconSmall.size} aria-hidden="true" />
              <span>{t("columnDelete")}</span>
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      {deleting && (
        <ColumnDeleteDialog
          table={table}
          field={field}
          onClose={() => setDeleting(false)}
        />
      )}
      <ColumnEditorPopover
        table={table}
        field={field}
        triggerRef={headRef}
        isOpen={editor !== null}
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
        focus={editor?.focus}
      />
    </div>
  );
}

/** 헤더 인라인 rename input — 셀 편집기와 같은 RAC 어법: 포커스 키를 이 열로 두고 셀 이동을 끈다
 *  (안 그러면 격자 밖에서 들어온 포커스를 RAC 가 첫 행으로 되돌려 input 이 blur 로 닫힌다). */
function ColumnRenameInput({
  columnKey,
  label,
  onCommit,
  onCancel,
}: ColumnRenameInputProps) {
  const state = useContext(TableStateContext);
  const inputRef = useRef<HTMLInputElement>(null);
  // blur 커밋과 Enter/Esc 커밋이 겹치지 않도록 (Enter 뒤 언마운트 blur)
  const settledRef = useRef(false);
  useDisableGridNavigation();
  useLayoutEffect(() => {
    const manager = state?.selectionManager;
    manager?.setFocused(true);
    manager?.setFocusedKey(columnKey);
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [state, columnKey]);
  return (
    <input
      ref={inputRef}
      className="datagrid-column-rename-input"
      aria-label={label}
      defaultValue={columnKey}
      spellCheck={false}
      data-grid-editor="rename"
      data-shortcut-local="undo redo"
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          settledRef.current = true;
          onCommit(e.currentTarget.value);
        } else if (e.key === "Escape") {
          e.preventDefault();
          settledRef.current = true;
          onCancel();
        }
      }}
      onBlur={(e) => {
        if (settledRef.current) return;
        onCommit(e.currentTarget.value);
      }}
    />
  );
}

// ============================================
// 선택 열 헤더 — 보이는 행 전체 선택 · 해제 (자체 상태, RAC 선택 slot 은 끔)
// ============================================

function SelectColumn({
  label,
  isSelected,
  isIndeterminate,
  onChange,
}: {
  label: string;
  isSelected: boolean;
  isIndeterminate: boolean;
  onChange: (selected: boolean) => void;
}) {
  return (
    <Column
      id={SELECT_COLUMN}
      width={SELECT_COLUMN_WIDTH}
      minWidth={SELECT_COLUMN_WIDTH}
      className="datagrid-column datagrid-column-select"
    >
      <Checkbox
        slot={null}
        size="S"
        aria-label={label}
        className="datagrid-checkbox"
        isSelected={isSelected}
        isIndeterminate={isIndeterminate}
        onChange={onChange}
      />
    </Column>
  );
}

const DataGridCell = memo(function DataGridCell({
  rowIndex,
  field,
  cellValue,
  headerId,
  editing,
  invalid,
  onStartEdit,
  onCommit,
  onCancel,
  frozen,
  hint,
  formulaError,
}: DataGridCellProps) {
  const cellRef = useRef<HTMLTableCellElement | HTMLDivElement | null>(null);
  const readonly = isReadonlyField(field);
  // RAC 는 이 컴포넌트를 collection 빌더 (숨은 트리) 에서 그리고 실제 `<td>` 는 따로 마운트한다 —
  // 효과가 아니라 ref callback 이 실제 요소를 받는다. aria-readonly 는 RAC Cell prop 에 없어
  // DOM 속성만 얹는다 (구조 · role 은 그대로).
  const attachCell = useCallback(
    (el: HTMLTableCellElement | HTMLDivElement | null) => {
      cellRef.current = el;
      if (!el) return;
      if (readonly) el.setAttribute("aria-readonly", "true");
      else el.removeAttribute("aria-readonly");
    },
    [readonly],
  );
  const coord = useMemo(
    () => ({ rowIndex, key: field.key }),
    [rowIndex, field.key],
  );
  const text = formatCellValue(cellValue);

  return (
    <Cell
      // 안정 key — 래퍼 컴포넌트 안의 Cell 은 RAC 자동 id 를 받아 collection 이 다시 만들어질 때
      // (dependencies) key 가 밀리고 Virtualizer 가 셀을 빠뜨린다 (live 실측: 99행 name 누락)
      id={`${rowIndex}:${field.key}`}
      ref={attachCell}
      className="datagrid-cell"
      textValue={text}
      data-row-index={rowIndex}
      data-field-key={field.key}
      data-field-type={field.type}
      data-readonly={readonly || undefined}
      data-invalid={invalid || undefined}
      data-editing={editing ? editing.kind : undefined}
      data-frozen={frozen}
      data-formula-error={formulaError}
      onDoubleClick={readonly ? undefined : () => onStartEdit(coord)}
    >
      {editing?.kind === "inline" ? (
        <InlineCellEditor
          coord={coord}
          field={field}
          initial={editing.initialDraft ?? text}
          original={text}
          headerId={headerId}
          onCommit={onCommit}
          onCancel={onCancel}
        />
      ) : (
        <span
          className="datagrid-cell-text"
          data-kind={
            cellValue === null || cellValue === undefined
              ? "empty"
              : typeof cellValue
          }
          title={formulaError ? hint("gridFormulaCellError") : undefined}
        >
          {text}
        </span>
      )}
      {editing?.kind === "popover" && (
        <PopoverCellEditor
          coord={coord}
          field={field}
          original={text}
          triggerRef={cellRef}
          headerId={headerId}
          hint={hint}
          onCommit={onCommit}
          onCancel={onCancel}
        />
      )}
    </Cell>
  );
});

function InlineCellEditor({
  coord,
  field,
  initial,
  original,
  headerId,
  onCommit,
  onCancel,
}: CellEditorProps & { initial: string }) {
  useDisableGridNavigation();
  const [draft, setDraft] = useState(initial);
  const [isInvalid, setIsInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const settledRef = useRef(false);

  // A date cell edits in the browser's picker of its value's shape (the variable table's date
  // cell — 2026-10-29); a typed key edits the ISO text instead (another precision can be typed).
  const native =
    field.type === "date" && initial === original
      ? nativeDateInputOf(draft)
      : undefined;
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    if (native) {
      // (`showPicker` needs the activation that started the edit; where refused, the field stays.)
      try {
        input.showPicker?.();
      } catch {
        /* no activation · unsupported — the field itself */
      }
      return;
    }
    // 타이핑으로 진입했으면 caret 을 끝에, Enter/F2 면 전체 선택
    if (initial !== original)
      input.setSelectionRange(initial.length, initial.length);
    else input.select();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only: the picker opens once
  }, [initial, original]);

  const commit = async (move: CommitMove) => {
    if (settledRef.current) return;
    settledRef.current = true; // blur 가 겹쳐도 두 번 쓰지 않는다
    const ok = await onCommit(coord, draft, move);
    if (!ok) {
      settledRef.current = false;
      setIsInvalid(true);
    }
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    const action = resolveGridKey(e, { editing: true, targetIsCell: false });
    switch (action.type) {
      case "pass":
        return;
      case "stop":
        e.stopPropagation();
        return;
      case "commit":
        e.preventDefault();
        e.stopPropagation();
        void commit(action.move);
        return;
      case "cancel":
        e.preventDefault();
        e.stopPropagation();
        settledRef.current = true;
        onCancel(coord);
        return;
      case "revert-draft":
        e.preventDefault();
        e.stopPropagation();
        setDraft(original);
        setIsInvalid(false);
        return;
      default:
        return;
    }
  };

  return (
    <input
      ref={inputRef}
      data-grid-editor="inline"
      data-shortcut-local="undo redo"
      className="datagrid-cell-input"
      type={native?.type ?? "text"}
      value={native ? native.value : draft}
      aria-labelledby={headerId}
      aria-invalid={isInvalid || undefined}
      inputMode={field.type === "number" ? "decimal" : undefined}
      onChange={(e) => {
        setDraft(e.target.value);
        setIsInvalid(false);
      }}
      onKeyDown={handleKeyDown}
      onBlur={() => {
        // 포커스가 밖으로 나가면 commit (실패 시 값 유지 없이 취소 — 사용자가 떠났다)
        if (settledRef.current) return;
        settledRef.current = true;
        void onCommit(coord, draft, "none").then((ok) => {
          if (!ok) onCancel(null);
        });
      }}
    />
  );
}

function PopoverCellEditor({
  coord,
  field,
  original,
  triggerRef,
  headerId,
  hint,
  onCommit,
  onCancel,
}: CellEditorProps & {
  triggerRef: RefObject<HTMLElement | null>;
  hint: DataGridCellProps["hint"];
}) {
  useDisableGridNavigation();
  const isJson = field.type === "array" || field.type === "object";
  const hintKey = isJson ? "gridJsonHint" : null;
  return (
    <PopoverTextEditor
      triggerRef={triggerRef}
      title={hint("gridCellEditorTitle", { key: field.key })}
      hint={hintKey ? hint(hintKey) : undefined}
      labelledBy={headerId}
      initial={original}
      rows={isJson ? 8 : 3}
      onCommit={(draft) => onCommit(coord, draft, "none")}
      onCancel={() => onCancel(coord)}
    />
  );
}
