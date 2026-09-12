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
 * - 새 필드: 헤더 `+` → 그 자리 인라인 `<input>` (Enter=생성 add_field string, Esc=취소, 생성 후
 *   입력 유지해 연속 추가). 입력은 uncontrolled + nonce 열 키 (RAC 헤더 정적 컬렉션 회피).
 *   팝오버·모달 없음 (HC2). 타입 변경은 열 라벨 클릭 → 필드 패널.
 * - 붙여넣기 (⌘V, 셀 포커스): `planGridPaste` → 넘치는 열은 `ConfirmDialog` "새 필드로 추가?".
 *   파싱 실패 셀은 null + `data-invalid` (0 으로 바꾸지 않음).
 */
import {
  memo,
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
import { Download, Search, Upload, X } from "lucide-react";
import Papa from "papaparse";
import type { DataOp } from "@composition/shared";
import { Button } from "react-aria-components/Button";
import { Checkbox } from "react-aria-components/Checkbox";
import { Dialog } from "react-aria-components/Dialog";
import { Heading } from "react-aria-components/Heading";
import { Popover } from "react-aria-components/Popover";
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
  useTableOptions,
  type Selection,
} from "react-aria-components/Table";
import { TableLayout, Virtualizer } from "react-aria-components/Virtualizer";
import { useOptionalI18n } from "../../../../i18n";
import type {
  DataField,
  DataTable,
} from "../../../../types/builder/data.types";
import { iconEditProps, iconSmall } from "../../../../utils/ui/uiConstants";
import { ConfirmDialog } from "../../../components/overlay/ConfirmDialog";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { useDataStore } from "../../../stores/data";
import { globalToast } from "../../../stores/toast";
import { announceDataPanelStatus } from "../stores/dataPanelStatusStore";
import { useDataTableEditorStore } from "../stores/dataTableEditorStore";
import {
  coerceCellValue,
  formatCellValue,
  resolveCellEditorKind,
  type CellEditorKind,
} from "./cellValue";
import { resolveGridKey } from "./gridKeys";
import {
  gridPasteToOps,
  parseClipboardGrid,
  planGridPaste,
  type GridPastePlan,
} from "./pasteGrid";
import { ImportPreview } from "./ImportPreview";
import { parsePastedRows } from "../utils/pasteRows";
import "./DataGrid.css";

const AddIcon = ACTION_ICONS.add;
const DeleteIcon = ACTION_ICONS.delete;

const GRID_ROW_HEIGHT = 28;
const SELECT_COLUMN = "__select";
const ADD_COLUMN = "__add";
// 인라인 입력 중엔 다른 열 키(`__add_edit_${nonce}`)를 써서 RAC 가 헤더 셀을 다시 만들게 한다
// — 헤더 컬렉션은 키가 바뀔 때만 rebuild 한다 (같은 키로 내용만 바꾸면 캐시된 셀이 남는다).
const ADD_COLUMN_EDIT = "__add_edit";
const isAddColumn = (id: string) =>
  id === ADD_COLUMN || id.startsWith(ADD_COLUMN_EDIT);

/** `id` 필드는 행 정체 — 격자에서 고치지 않는다 (aria-readonly). */
function isReadonlyField(field: DataField): boolean {
  return field.key === "id";
}

interface CellCoord {
  rowIndex: number;
  key: string;
}

interface EditingState extends CellCoord {
  kind: CellEditorKind;
  initialDraft?: string;
}

type CommitMove = "down" | "up" | "right" | "left" | "none";

export interface DataGridProps {
  table: DataTable;
  /** false = Virtualizer 없이 (jsdom 테스트 — 뷰포트 크기가 0 이라 가상 행이 안 그려진다) */
  virtualized?: boolean;
}

function cellId(coord: CellCoord): string {
  return `${coord.rowIndex}:${coord.key}`;
}

function coordOf(el: Element | null): CellCoord | null {
  const cell = el?.closest<HTMLElement>("[data-row-index][data-field-key]");
  if (!cell) return null;
  const rowIndex = Number(cell.dataset.rowIndex);
  const key = cell.dataset.fieldKey ?? "";
  return Number.isInteger(rowIndex) && key !== "" ? { rowIndex, key } : null;
}

function nextRowId(rows: readonly Record<string, unknown>[], type: string) {
  if (type === "number") {
    let max = 0;
    for (const row of rows) {
      const v = row.id;
      if (typeof v === "number" && v > max) max = v;
    }
    return max + 1;
  }
  return `row_${rows.length + 1}`;
}

export function DataGrid({ table, virtualized = true }: DataGridProps) {
  const i18n = useOptionalI18n();
  const t = useCallback(
    (key: string, params?: Record<string, string | number | boolean>) =>
      i18n ? i18n.t(`datatable.${key}`, params) : key,
    [i18n],
  );
  const applyDataChange = useDataStore((state) => state.applyDataChange);
  const openFieldPanel = useDataTableEditorStore(
    (state) => state.openFieldPanel,
  );
  const schema = table.schema;
  const rows = table.mockData;
  const collectionId = table.id;
  const gridId = useId();

  const [editing, setEditing] = useState<EditingState | null>(null);
  const [invalidCells, setInvalidCells] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [selectedKeys, setSelectedKeys] = useState<Selection>(new Set());
  const [filterText, setFilterText] = useState("");
  const [pendingPaste, setPendingPaste] = useState<GridPastePlan | null>(null);
  const [focusRequest, setFocusRequest] = useState<CellCoord | null>(null);
  const [importRows, setImportRows] = useState<
    Record<string, unknown>[] | null
  >(null);
  const [addingField, setAddingField] = useState(false);
  // 입력은 uncontrolled — RAC 헤더는 정적 컬렉션이라 controlled value/핸들러가 첫 렌더에
  // 얼어붙는다. 값은 DOM 이 갖고, 열기·추가마다 nonce 로 열 키를 바꿔 신선한 빈 입력 +
  // 최신 schema 클로저를 받는다.
  const [addNonce, setAddNonce] = useState(0);
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

  const items = useMemo(() => {
    const all = rows.map((row, index) => ({ id: index, index, row }));
    const term = filterText.trim().toLowerCase();
    if (term === "") return all;
    return all.filter(({ row }) =>
      schema.some((field) => {
        const value = row[field.key];
        return (
          value !== null &&
          value !== undefined &&
          String(value).toLowerCase().includes(term)
        );
      }),
    );
  }, [rows, schema, filterText]);

  const columns = useMemo(
    () => [
      { id: SELECT_COLUMN, field: null as DataField | null },
      ...schema.map((field) => ({ id: field.key, field })),
      {
        id: addingField ? `${ADD_COLUMN_EDIT}_${addNonce}` : ADD_COLUMN,
        field: null as DataField | null,
      },
    ],
    [schema, addingField, addNonce],
  );

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

  const addRow = useCallback(async () => {
    const row: Record<string, unknown> = {};
    for (const field of schema) {
      row[field.key] = isReadonlyField(field)
        ? nextRowId(rows, field.type)
        : (field.defaultValue ?? null);
    }
    const at = rows.length;
    const ok = await write([
      { op: "insert_rows", collectionId, rows: [row], at },
    ]);
    if (!ok) return;
    announceDataPanelStatus(t("gridRowAdded"), { tone: "success" });
    const first = schema.find((f) => !isReadonlyField(f)) ?? schema[0];
    if (first) setFocusRequest({ rowIndex: at, key: first.key });
  }, [collectionId, rows, schema, t, write]);

  const selectedRowIndexes = useMemo(() => {
    if (selectedKeys === "all") return items.map((item) => item.index);
    return [...selectedKeys]
      .map((key) => Number(key))
      .filter((n) => Number.isInteger(n));
  }, [selectedKeys, items]);

  const deleteSelected = useCallback(async () => {
    if (selectedRowIndexes.length === 0) return;
    const ok = await write([
      { op: "remove_rows", collectionId, rowIndexes: selectedRowIndexes },
    ]);
    if (!ok) return;
    setSelectedKeys(new Set());
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
      });
      if (plan.extraColumns.length > 0) setPendingPaste(plan);
      else void applyPaste(plan, false);
    },
    [applyPaste, editing, rows.length, schema, t],
  );

  // 비편집 키 — 편집 중엔 셀 안 편집기가 자기 keydown 에서 처리한다 (R1 매트릭스의 editing 축).
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
      }
    },
    [clearCell, startEdit],
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

  const handleExportCSV = useCallback(() => {
    if (rows.length === 0) return;
    const csv = Papa.unparse(rows, { columns: schema.map((f) => f.key) });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${table.name || "data"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [rows, schema, table.name]);

  const tableNode = (
    <Table
      aria-label={table.name}
      className="datagrid-table"
      keyboardNavigationBehavior="tab"
      selectionMode="multiple"
      selectionBehavior="toggle"
      selectedKeys={selectedKeys}
      onSelectionChange={setSelectedKeys}
    >
      <TableHeader columns={columns}>
        {(column) =>
          column.id === SELECT_COLUMN ? (
            <SelectColumn label={t("gridSelectAllRows")} />
          ) : isAddColumn(column.id) ? (
            <Column
              id={column.id}
              width={addingField ? 160 : 36}
              minWidth={36}
              className="datagrid-column datagrid-column-add"
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
            </Column>
          ) : (
            <Column
              id={column.id}
              isRowHeader={column.id === schema[0]?.key}
              defaultWidth={140}
              minWidth={72}
              className="datagrid-column"
            >
              <Button
                id={`${gridId}-h-${column.field!.key}`}
                className="datagrid-column-label"
                data-field-type={column.field!.type}
                onPress={() =>
                  openFieldPanel(
                    collectionId,
                    column.field!.id ?? column.field!.key,
                  )
                }
              >
                {column.field!.key}
              </Button>
              <ColumnResizer className="datagrid-column-resizer" />
            </Column>
          )
        }
      </TableHeader>
      <TableBody
        items={items}
        dependencies={[editing, invalidCells, schema, gridId]}
        renderEmptyState={() => (
          <div className="datagrid-empty">{t("gridNoRows")}</div>
        )}
      >
        {(item) => (
          <Row
            id={item.id}
            columns={columns}
            dependencies={[editing, invalidCells, item.row, gridId]}
            className="datagrid-row"
          >
            {(column) =>
              column.id === SELECT_COLUMN ? (
                <Cell className="datagrid-cell datagrid-cell-select">
                  <Checkbox
                    slot="selection"
                    aria-label={t("gridSelectRow")}
                    className="datagrid-checkbox"
                  >
                    <span className="datagrid-checkbox-box" />
                  </Checkbox>
                </Cell>
              ) : isAddColumn(column.id) ? (
                <Cell className="datagrid-cell datagrid-cell-add" />
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
                  hint={t}
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
      onPaste={handlePaste}
    >
      <div className="data-toolbar datagrid-toolbar">
        <div className="filter-input-wrapper">
          <Search {...iconEditProps} className="filter-icon" />
          <input
            type="text"
            className="filter-input"
            placeholder={t("filterRows")}
            aria-label={t("filterRows")}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
          {filterText && (
            <button
              type="button"
              className="filter-clear-btn"
              aria-label={t("filterClear")}
              onClick={() => setFilterText("")}
            >
              <X size={iconSmall.size} />
            </button>
          )}
        </div>
        <div className="toolbar-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json,application/json,text/csv"
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />
          <Button
            className="control-button"
            onPress={() => fileInputRef.current?.click()}
            aria-label={t("importCsv")}
          >
            <Upload {...iconEditProps} />
            {t("import")}
          </Button>
          <Button
            className="control-button"
            onPress={handleExportCSV}
            isDisabled={rows.length === 0}
            aria-label={t("exportCsv")}
          >
            <Download {...iconEditProps} />
            {t("export")}
          </Button>
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
      {virtualized ? (
        <ResizableTableContainer className="datagrid-scroll">
          <Virtualizer
            layout={TableLayout}
            layoutOptions={{
              rowHeight: GRID_ROW_HEIGHT,
              headingHeight: GRID_ROW_HEIGHT,
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
      <div className="datagrid-footer">
        <Button
          className="control-button"
          data-variant="add"
          onPress={() => void addRow()}
          isDisabled={schema.length === 0}
        >
          <AddIcon {...iconEditProps} />
          {t("gridAddRow")}
        </Button>
        {selectedRowIndexes.length > 0 && (
          <Button
            className="control-button"
            data-tone="danger"
            onPress={() => void deleteSelected()}
          >
            <DeleteIcon {...iconEditProps} />
            {t("gridDeleteRows", { count: selectedRowIndexes.length })}
          </Button>
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
      />
    </div>
  );
}

// ============================================
// 선택 열 헤더 — useTableOptions 는 TableHeader 안에서만
// ============================================

function SelectColumn({ label }: { label: string }) {
  const { selectionMode } = useTableOptions();
  return (
    <Column
      id={SELECT_COLUMN}
      width={36}
      minWidth={36}
      className="datagrid-column datagrid-column-select"
    >
      {selectionMode === "multiple" && (
        <Checkbox
          slot="selection"
          aria-label={label}
          className="datagrid-checkbox"
        >
          <span className="datagrid-checkbox-box" />
        </Checkbox>
      )}
    </Column>
  );
}

// ============================================
// 셀
// ============================================

interface DataGridCellProps {
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
  hint: (
    key: string,
    params?: Record<string, string | number | boolean>,
  ) => string;
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
  hint,
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

/** 편집 중 RAC 셀 이동을 끈다 — 편집기가 언마운트되면 되살린다 (RAC 권고 편집 어법). */
function useDisableGridNavigation() {
  const state = useContext(TableStateContext);
  useEffect(() => {
    state?.setKeyboardNavigationDisabled(true);
    return () => state?.setKeyboardNavigationDisabled(false);
  }, [state]);
}

interface CellEditorProps {
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

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    // 타이핑으로 진입했으면 caret 을 끝에, Enter/F2 면 전체 선택
    if (initial !== original)
      input.setSelectionRange(initial.length, initial.length);
    else input.select();
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
      type="text"
      value={draft}
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
  const i18n = useOptionalI18n();
  const [draft, setDraft] = useState(original);
  const [isInvalid, setIsInvalid] = useState(false);
  const settledRef = useRef(false);
  const isJson = field.type === "array" || field.type === "object";
  const hintKey =
    field.type === "date"
      ? "gridDateHint"
      : field.type === "datetime"
        ? "gridDatetimeHint"
        : isJson
          ? "gridJsonHint"
          : null;

  const commit = async () => {
    if (settledRef.current) return;
    settledRef.current = true;
    const ok = await onCommit(coord, draft, "none");
    if (!ok) {
      settledRef.current = false;
      setIsInvalid(true);
    }
  };
  const cancel = () => {
    if (settledRef.current) return;
    settledRef.current = true;
    onCancel(coord);
  };

  return (
    <Popover
      triggerRef={triggerRef}
      isOpen
      onOpenChange={(open) => {
        if (!open) cancel();
      }}
      placement="bottom start"
      className="datagrid-popover"
    >
      <Dialog className="datagrid-popover-dialog">
        <div className="datagrid-popover-body" data-grid-editor="popover">
          <Heading slot="title" className="datagrid-popover-title">
            {hint("gridCellEditorTitle", { key: field.key })}
          </Heading>
          <textarea
            autoFocus
            data-shortcut-local="undo redo"
            className="datagrid-popover-textarea"
            aria-labelledby={headerId}
            aria-invalid={isInvalid || undefined}
            aria-multiline="true"
            rows={isJson ? 8 : 3}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setIsInvalid(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                e.stopPropagation();
                void commit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                cancel();
              } else if (e.key !== "Tab") {
                e.stopPropagation();
              }
            }}
          />
          <div className="datagrid-popover-footer">
            {hintKey && (
              <span className="datagrid-popover-hint">{hint(hintKey)}</span>
            )}
            <Button className="control-button" onPress={cancel}>
              {i18n ? i18n.t("common.cancel") : "Cancel"}
            </Button>
            <Button
              className="control-button"
              data-variant="primary"
              onPress={() => void commit()}
            >
              {i18n ? i18n.t("common.save") : "Save"}
            </Button>
          </div>
        </div>
      </Dialog>
    </Popover>
  );
}
