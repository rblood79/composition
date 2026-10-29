/**
 * VariableTable — ADR-288 Decision 3: the one table every variable owner edits in. The Data panel
 * (project variables, plus the page · element index as read-only rows — 사용자 결정 2) and the
 * Design panel's State section (a page's or an element's variables — 사용자 결정 4: name · type ·
 * default + ⋮) render the same component; the owner decides what a cell may do:
 *
 * Two shapes, the same content (사용자 2026-10-29 「내용은 동일하지만 Data 패널의 Variables 탭은 현재
 * 테이블 스타일 그대로, Design 패널 State 절은 변수마다 패널 행」): the Data panel's is a table in the
 * data grid's look (「격자 모양으로」 — 28 px rules, cell focus, Enter · F2 · typing · double-click
 * edits in place, Enter commits · Escape cancels · leaving or the cell going away commits, the type
 * list in a popover on the cell); the Design panel's (`dense`) is a panel field row per variable —
 * the 7-column grid's 84 · 84 · 28 like ID · Route: [name + type][default][⋮ · ↗], inputs that
 * commit on Enter · blur, a compact type Select inside the name box.
 *
 * - name: a cell (grid) / an input (dense); a RAC state row (`source`) and an index row
 *   (`readOnly`) are name-only / text.
 * - type: cell text whose list opens on Enter · F2 · double-click (grid — a click only focuses the
 *   cell) / a compact RAC Select (dense); text on a source · index row.
 * - default: by the row's type — Switch (boolean), a cell · an input (string · number — the owner
 *   parses and reports an error), JSON popover (object · array — the project's only); a page · element
 *   structured default is "set by a rule" (contract 51 — `""`), a source row follows its state.
 * - persist (project only), usage (hidden when `dense` — it moves into ⋮). The row's last cell is a
 *   transparent delete button where delete is its only action (the Data panel — 사용자 2026-10-29
 *   「삭제 외에는 추가할 기능이 없다면 삭제 버튼으로」). Dense, the row's ⋮ (`PropertyRowMenu` — usage ·
 *   delete) · ↗ is the panel row's action column (사용자 2026-10-29 「grid 7column 구조에 마지막
 *   우측영역에 추가기능 버튼 영역」).
 *
 * Builder chrome RAC: no virtualization — a row per variable. The rows · cells · columns carry only
 * `variable-table__*` classes — the Builder's global `.react-aria-Row { display: flex }` (the
 * catalog Table's row grid, ADR-257) would otherwise break the table layout (live 2026-10-28).
 */
import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Button } from "react-aria-components/Button";
import { ListBox, ListBoxItem } from "react-aria-components/ListBox";
import { Popover } from "react-aria-components/Popover";
import {
  Select as AriaSelect,
  SelectValue,
} from "react-aria-components/Select";
import { Switch as AriaSwitch } from "react-aria-components/Switch";
import { Text } from "react-aria-components/Text";
import {
  Cell,
  Column,
  Row,
  Table,
  TableBody,
  TableHeader,
  TableStateContext,
} from "react-aria-components/Table";
import { ArrowUpRight } from "lucide-react";
import { useI18n } from "@/i18n";
import { iconProps, iconSmall } from "../../../utils/ui/uiConstants";
import { ACTION_ICONS } from "../../config/actionIcons";
import { nativeDateInputOf } from "../../../../../../packages/shared/src/state/dateValue";
import { PopoverTextEditor } from "../../panels/datatable/grid/PopoverTextEditor";
import {
  FIELD_TYPES,
  resolveFieldType,
} from "../../panels/datatable/utils/fieldTypes";
import { PropertyFieldset } from "../property/PropertyFieldset";
import { PropertyRowMenu } from "../property/PropertyRowMenu";
import { PropertySelect } from "../property/PropertySelect";
import { ActionIconButton } from "../ui/ActionIconButton";
import "./VariableTable.css";

export type VariableTableOwner = "project" | "page" | "element";

export interface VariableTableRow {
  id: string;
  name: string;
  /** `string` · `number` · `boolean` · `object` · `array` (· `string[]` for a keys state). */
  type: string;
  defaultValue: unknown;
  usage: number;
  /** Project variables only — kept in localStorage at run time. */
  persist?: boolean;
  /** A page variable that names a node's RAC state: name only, the value follows the state. */
  source?: { prop: string };
  /** Another owner's variable (the Data panel's index): read-only, the row goes to its owner. */
  readOnly?: { owner: string };
  /** The owner's message for this row (an invalid default · a taken name). */
  error?: string | null;
}

export interface VariableTableProps {
  owner: VariableTableOwner;
  rows: readonly VariableTableRow[];
  /** The table's accessible name. */
  label: string;
  /** The Design panel (233 ~ 387 px): no usage column — the count goes into ⋮. */
  dense?: boolean;
  typeOptions: ReadonlyArray<{ value: string; label: string }>;
  onRename: (id: string, name: string) => void;
  onType: (id: string, type: string) => void;
  /** A scalar default as typed (`"true"` · `"42"` · text) — the owner parses it for the type. */
  onDefault: (id: string, raw: string) => void;
  /**
   * An object · array default (parsed JSON; `undefined` = none) — the project's, and a page ·
   * element variable's since 2026-10-29 (the owner stores the type from the value). Absent =
   * the default is 「set by a rule」.
   */
  onJsonDefault?: (id: string, value: unknown) => void;
  onPersist?: (id: string, persist: boolean) => void;
  onRemove: (id: string) => void;
  onGoToOwner?: (id: string) => void;
  /** Rendered under the table (an add button · hints). */
  children?: ReactNode;
}

const DeleteIcon = ACTION_ICONS.delete;

/** A boolean default's choices in the Design panel's rows. */
const BOOLEAN_OPTIONS = [
  { value: "true", label: "true" },
  { value: "false", label: "false" },
];

const structured = (type: string) => type === "object" || type === "array";

/**
 * The screen's one structured type (사용자 2026-10-29 「화면에서만 JSON 하나로 보여 주고, 목록 여부는
 * 저장할 때 값으로 정하기」 — Supabase has no separate list type either): `object` and `array` show
 * as JSON; picking JSON stores `object`, and the owner stores `array` when the saved value is one.
 */
const JSON_TYPE = "object";
const uiType = (type: string) => (structured(type) ? JSON_TYPE : type);

/** A type choice as every type list shows it — the column editor's (name + one-line hint). */
interface TypeChoice {
  value: string;
  label: string;
  description?: string;
}

/**
 * The owner's types as shown — the table's column type list (`FIELD_TYPES`, 사용자 2026-10-29
 * 「type 선택하는 popover 창 자체가 다른데」): the same names and hints in the same order, JSON
 * standing for `object` · `array`, `reference` left out (a table's own).
 */
function typeChoicesOf(
  options: ReadonlyArray<{ value: string; label: string }>,
  t: (key: string) => string,
): TypeChoice[] {
  const allowed = new Set(options.map((option) => uiType(option.value)));
  return FIELD_TYPES.filter(
    (entry) => entry.value !== "reference" && allowed.has(entry.value),
  ).map((entry) => ({
    value: entry.value,
    label: t(`datatable.${entry.i18n}`),
    description: t(`datatable.${entry.i18n.replace(/^types\./, "typeHints.")}`),
  }));
}

/** A picked option as the stored type — JSON keeps a structured type, else `object`. */
const storedTypeOf = (picked: string, current: string) =>
  picked === JSON_TYPE ? (structured(current) ? current : "object") : picked;

/** A list item as the panel Select draws one — the name, and its hint under it. */
function TypeChoiceItem({ choice }: { choice: TypeChoice }) {
  return (
    <ListBoxItem
      id={choice.value}
      textValue={choice.label}
      className="react-aria-ListBoxItem"
    >
      {choice.description ? (
        <span className="property-select__option-text">
          <Text slot="label">{choice.label}</Text>
          <Text
            slot="description"
            className="property-select__option-description"
          >
            {choice.description}
          </Text>
        </span>
      ) : (
        choice.label
      )}
    </ListBoxItem>
  );
}

function formatDefault(value: unknown, type: string): string {
  if (value === undefined || value === null || value === "") return "";
  if (structured(type)) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * A dense row's text field — commits on Enter · blur, restores on Escape (the State section).
 * `date`: the browser's date picker instead (`nativeDateInputOf`).
 */
function CommitInput({
  value,
  label,
  invalid,
  placeholder,
  date,
  onCommit,
}: {
  value: string;
  label: string;
  invalid?: boolean;
  placeholder?: string;
  date?: boolean;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const cancel = useRef(false);
  useEffect(() => {
    setDraft(value);
  }, [value]);
  const commit = () => {
    if (cancel.current) {
      cancel.current = false;
      return;
    }
    if (draft !== value) onCommit(draft);
  };
  const native = date ? nativeDateInputOf(draft) : undefined;
  return (
    <input
      className="react-aria-Input"
      aria-label={label}
      aria-invalid={invalid || undefined}
      type={native?.type}
      value={native ? native.value : draft}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          event.preventDefault();
          cancel.current = true;
          setDraft(value);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

/** A variable type's glyph — the data grid header's type icons (`FIELD_TYPES`). */
function TypeGlyph({ type }: { type: string }) {
  const Icon = resolveFieldType(type).icon;
  return (
    <Icon
      size={iconProps.size}
      strokeWidth={iconProps.strokeWidth}
      aria-hidden="true"
    />
  );
}

/**
 * A dense row's type picker — the State section's Select, its trigger the panel Select's ▾ box
 * holding the type's icon (사용자 2026-10-29 「select 다운버튼 스타일로 아이콘으로」); the value is
 * the button's hidden text, the list shows icon + name.
 */
function TypeSelect({
  value,
  label,
  options,
  onChange,
}: {
  value: string;
  label: string;
  options: readonly TypeChoice[];
  onChange: (value: string) => void;
}) {
  return (
    <AriaSelect
      className="react-aria-Select variable-row__type"
      aria-label={label}
      selectedKey={value}
      onSelectionChange={(key) => key !== null && onChange(String(key))}
    >
      <Button className="react-aria-Button">
        <SelectValue className="react-aria-SelectValue variable-table__sr">
          {({ selectedText }) => selectedText}
        </SelectValue>
        <span aria-hidden="true" className="select-chevron">
          <TypeGlyph type={value} />
        </span>
      </Button>
      <Popover className="react-aria-Popover property-select-popover variable-row__type-popover">
        <ListBox className="react-aria-ListBox">
          {options.map((choice) => (
            <TypeChoiceItem key={choice.value} choice={choice} />
          ))}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
}

/** The cells that edit on the spot — text in place, the type in a popover on the cell. */
type EditableColumn = "name" | "default" | "type";

interface CellEdit {
  rowId: string;
  column: EditableColumn;
  /** The draft to start from — a typed key replaces the value; Enter · F2 keep it. */
  initial?: string;
}

/**
 * The table's focus management keeps the focused cell focused — while an editor is open it would
 * pull focus back out of it (the grid's `useDisableGridNavigation`).
 */
function useTableNavigationLock() {
  const tableState = useContext(TableStateContext);
  useEffect(() => {
    tableState?.setKeyboardNavigationDisabled(true);
    return () => tableState?.setKeyboardNavigationDisabled(false);
  }, [tableState]);
}

/**
 * The in-place editor of a text cell — the data grid's inline input (transparent, the cell's
 * focus ring stays). Enter commits · Escape cancels · blur commits. A cell removed while editing
 * (a tab switch) gets no blur — the browser fires it inside React's commit — so the unmount
 * commits a changed draft too (the PropertyInput rule, 2026-10-29).
 */
function CellEditor({
  value,
  initial,
  label,
  invalid,
  numeric,
  placeholder,
  date,
  onCommit,
  onClose,
}: {
  value: string;
  initial?: string;
  label: string;
  invalid?: boolean;
  numeric?: boolean;
  placeholder?: string;
  /** A date cell: the browser's picker, opened on start (a typed key edits the text instead). */
  date?: boolean;
  onCommit: (next: string) => void;
  /** `refocus` — back to the cell (Enter · Escape); a blur leaves focus where it went. */
  onClose: (refocus: boolean) => void;
}) {
  const [draft, setDraft] = useState(initial ?? value);
  const inputRef = useRef<HTMLInputElement>(null);
  useTableNavigationLock();
  /** Settled = committed or cancelled — a later blur · unmount writes nothing. */
  const settled = useRef(false);
  const latest = useRef({ draft, value, onCommit });
  useLayoutEffect(() => {
    latest.current = { draft, value, onCommit };
  });
  const native =
    date && initial === undefined ? nativeDateInputOf(draft) : undefined;
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    if (native) {
      // (The picker opens with the edit — `showPicker` needs the user's activation, which the
      //   Enter · double-click that started the edit is; where it is refused, the field stays.)
      try {
        input.showPicker?.();
      } catch {
        /* no activation · unsupported — the field itself */
      }
      return;
    }
    if (initial !== undefined)
      input.setSelectionRange(initial.length, initial.length);
    else input.select();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only: a typed key starts the draft once
  }, []);
  useEffect(
    () => () => {
      const pending = latest.current;
      if (!settled.current && pending.draft !== pending.value)
        pending.onCommit(pending.draft);
    },
    [],
  );
  const commit = (refocus: boolean) => {
    if (settled.current) return;
    settled.current = true;
    if (draft !== value) onCommit(draft);
    onClose(refocus);
  };
  return (
    <input
      ref={inputRef}
      className="variable-table__cell-input"
      data-cell-editor
      aria-label={label}
      aria-invalid={invalid || undefined}
      placeholder={placeholder}
      type={native?.type}
      inputMode={numeric ? "decimal" : undefined}
      value={native ? native.value : draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => commit(false)}
      onKeyDown={(event) => {
        // The table's cell keys (arrows · Home/End) stay in the text while editing.
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          commit(true);
        } else if (event.key === "Escape") {
          event.preventDefault();
          settled.current = true;
          onClose(true);
        }
      }}
    />
  );
}

/** A key that starts editing a focused text cell (the grid's rule — `gridKeys.ts`). */
function editStartOf(
  event: ReactKeyboardEvent,
): { start: true; initial?: string } | null {
  if (event.metaKey || event.ctrlKey || event.altKey) return null;
  if (event.key === "Enter" || event.key === "F2") return { start: true };
  if (event.key.length === 1 && event.key !== " ")
    return { start: true, initial: event.key };
  return null;
}

/**
 * The type list of a focused type cell — a popover anchored on the cell (the grid's popover
 * editor), focus in the list on the current type. Picking a type writes it; Escape · an outside
 * press closes without writing; the focus goes back to the cell.
 */
function CellListPopover({
  triggerRef,
  value,
  label,
  options,
  onChange,
  onClose,
}: {
  triggerRef: RefObject<HTMLElement | null>;
  value: string;
  label: string;
  options: readonly TypeChoice[];
  onChange: (value: string) => void;
  onClose: (refocus: boolean) => void;
}) {
  useTableNavigationLock();
  return (
    <Popover
      triggerRef={triggerRef}
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose(true);
      }}
      placement="bottom start"
      // The panel picker sheets (ListBox.css 「Popover Context」 · the item rows · ✓) key on the
      // trigger name — this list is the panel Select's, opened from the cell.
      trigger="Select"
      className="react-aria-Popover property-select-popover variable-table__type-popover"
    >
      <ListBox
        aria-label={label}
        className="react-aria-ListBox"
        autoFocus
        selectionMode="single"
        selectedKeys={[value]}
        onSelectionChange={(keys) => {
          const next = keys === "all" ? undefined : [...keys][0];
          if (next !== undefined && String(next) !== value)
            onChange(String(next));
          onClose(true);
        }}
      >
        {options.map((choice) => (
          <TypeChoiceItem key={choice.value} choice={choice} />
        ))}
      </ListBox>
    </Popover>
  );
}

/**
 * A project variable's JSON default — the data grid's popover cell editor on the cell
 * (`PopoverTextEditor`, 사용자 2026-10-29 「json 편집 popover 창, table 의 편집 popover 창 같이 쓰면」):
 * ⏎ saves valid JSON of an object · array (empty = none; the owner stores the type from the
 * value), a half-typed · scalar draft stays open marked invalid, Esc · an outside press cancel.
 */
function JsonCellPopover({
  triggerRef,
  value,
  name,
  initial,
  onCommit,
  onClose,
}: {
  triggerRef: RefObject<HTMLElement | null>;
  value: unknown;
  name: string;
  initial?: string;
  onCommit: (parsed: unknown) => void;
  onClose: (refocus: boolean) => void;
}) {
  const { t } = useI18n();
  useTableNavigationLock();
  const text = formatDefault(value, "object");
  return (
    <PopoverTextEditor
      triggerRef={triggerRef}
      title={t("datatable.gridCellEditorTitle", { key: name })}
      hint={t("datatable.gridJsonHint")}
      label={`${name} ${t("propertiesPanel.stateDefault")}`}
      initial={initial ?? text}
      placeholder="{}"
      onCommit={(draft) => {
        if (draft.trim() === "") {
          if (text !== "") onCommit(undefined);
          onClose(true);
          return true;
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(draft);
        } catch {
          return false;
        }
        if (typeof parsed !== "object" || parsed === null) return false;
        if (JSON.stringify(parsed) !== (text || undefined)) onCommit(parsed);
        onClose(true);
        return true;
      }}
      onCancel={() => onClose(true)}
    />
  );
}

/**
 * A panel row's JSON default (the State section, 2026-10-29): the value as text in the field box,
 * a press opens the grid's popover editor on it (`JsonCellPopover`).
 */
function JsonFieldButton({
  value,
  name,
  text,
  onCommit,
}: {
  value: unknown;
  name: string;
  text: string;
  onCommit: (parsed: unknown) => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        ref={ref}
        className="react-aria-Button variable-row__json"
        aria-label={`${name} ${t("propertiesPanel.stateDefault")}`}
        onPress={() => setOpen(true)}
      >
        <span
          className="variable-row__json-text"
          data-kind={text ? "json" : "empty"}
        >
          {text}
        </span>
      </Button>
      {open && (
        <JsonCellPopover
          triggerRef={ref}
          value={value}
          name={name}
          onCommit={onCommit}
          onClose={() => {
            setOpen(false);
            ref.current?.focus();
          }}
        />
      )}
    </>
  );
}

export const VariableTable = memo(function VariableTable({
  owner,
  rows,
  label,
  dense,
  typeOptions,
  onRename,
  onType,
  onDefault,
  onJsonDefault,
  onPersist,
  onRemove,
  onGoToOwner,
  children,
}: VariableTableProps) {
  const { t } = useI18n();
  const shownTypes = typeChoicesOf(typeOptions, t);
  const labelOfType = (type: string) =>
    shownTypes.find((option) => option.value === uiType(type))?.label ?? type;
  const pickType = (row: VariableTableRow, picked: string) => {
    const next = storedTypeOf(picked, row.type);
    if (next !== row.type) onType(row.id, next);
  };
  /** The Data panel's table is the data grid's look and keys; the dense one is panel fields. */
  const grid = !dense;
  const [editing, setEditing] = useState<CellEdit | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  /** The cell to focus again when its editor closes (the grid returns focus to the cell). */
  const refocus = useRef<CellEdit | null>(null);
  useEffect(() => {
    if (editing || !refocus.current) return;
    const { rowId, column } = refocus.current;
    refocus.current = null;
    wrapRef.current
      ?.querySelector<HTMLElement>(
        `[data-variable-id="${CSS.escape(rowId)}"] [data-edit-column="${column}"]`,
      )
      ?.focus();
  }, [editing]);
  const closeEditor = useCallback((back: boolean) => {
    setEditing((current) => {
      refocus.current = back ? current : null;
      return null;
    });
  }, []);
  /** The cell a popover anchors on — the type, a boolean · JSON default (set when its edit starts). */
  const listCellRef = useRef<HTMLElement | null>(null);
  const startEdit = (edit: CellEdit, cell: HTMLElement) => {
    if (cell.dataset.editKind === "list" || cell.dataset.editKind === "popover")
      listCellRef.current = cell;
    setEditing(edit);
  };
  const editableOf = (target: HTMLElement): CellEdit | null => {
    const cell = target.closest<HTMLElement>("[data-edit-column]");
    const row = cell?.closest<HTMLElement>("[data-variable-id]");
    if (!cell || cell !== target || !row) return null;
    return {
      rowId: row.dataset.variableId!,
      column: cell.dataset.editColumn as EditableColumn,
    };
  };
  const onKeyDownCapture = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-cell-editor]")) return;
    const cell = editableOf(target);
    const start = cell && editStartOf(event);
    if (!cell || !start) return;
    // A typed key starts a text edit with it; a list cell (type · boolean) only opens its list.
    if (target.dataset.editKind === "list" && start.initial !== undefined)
      return;
    event.preventDefault();
    event.stopPropagation();
    startEdit({ ...cell, initial: start.initial }, target);
  };
  const showPersist = owner === "project" && onPersist !== undefined;
  const showUsage = !dense;
  const usageLabel = (count: number) =>
    t("propertiesPanel.stateUsageCount", { count });

  const editingOf = (rowId: string, column: EditableColumn) =>
    editing && editing.rowId === rowId && editing.column === column
      ? editing
      : null;

  const defaultCell = (row: VariableTableRow): ReactNode => {
    if (row.source)
      return (
        <span className="variable-table__muted">
          {t("propertiesPanel.stateFollowsSource", { prop: row.source.prop })}
        </span>
      );
    if (row.readOnly)
      return (
        <span className="variable-table__text">
          {formatDefault(row.defaultValue, row.type)}
        </span>
      );
    if (structured(row.type)) {
      if (!onJsonDefault)
        return (
          <span className="variable-table__muted">
            {t("propertiesPanel.stateRuleSets")}
          </span>
        );
      const text = formatDefault(row.defaultValue, row.type);
      if (!grid)
        return (
          <JsonFieldButton
            value={row.defaultValue}
            name={row.name}
            text={text}
            onCommit={(parsed) => onJsonDefault(row.id, parsed)}
          />
        );
      const edit = editingOf(row.id, "default");
      return (
        <>
          <span
            className="variable-table__text"
            data-kind={text === "" ? "empty" : "json"}
            title={text}
          >
            {text}
          </span>
          {edit && (
            <JsonCellPopover
              triggerRef={listCellRef}
              value={row.defaultValue}
              name={row.name}
              initial={edit.initial}
              onCommit={(parsed) => onJsonDefault(row.id, parsed)}
              onClose={closeEditor}
            />
          )}
        </>
      );
    }
    if (row.type === "boolean") {
      // A choice of true · false, like the type cell — Enter · F2 · double-click open the list on
      // the cell (사용자 2026-10-29 「bool 일경우 true, false 선택」 · 「data 패널에도 동일하게」).
      const value = row.defaultValue === true ? "true" : "false";
      return (
        <>
          <span className="variable-table__text" data-kind="boolean">
            {value}
          </span>
          {editingOf(row.id, "default") && (
            <CellListPopover
              triggerRef={listCellRef}
              value={value}
              label={`${row.name} ${t("propertiesPanel.stateDefault")}`}
              options={BOOLEAN_OPTIONS}
              onChange={(next) => onDefault(row.id, next)}
              onClose={closeEditor}
            />
          )}
        </>
      );
    }
    const text = formatDefault(row.defaultValue, row.type);
    // (A date: the browser's picker; in the grid a typed key edits its ISO text instead — the
    //   text's shape says its precision, shared `dateValue.ts`.)
    const placeholder =
      row.type === "number"
        ? "0"
        : row.type === "date"
          ? "YYYY-MM-DD"
          : undefined;
    if (!grid)
      return (
        <CommitInput
          value={text}
          label={`${row.name} ${t("propertiesPanel.stateDefault")}`}
          invalid={!!row.error}
          placeholder={placeholder}
          date={row.type === "date"}
          onCommit={(raw) => onDefault(row.id, raw)}
        />
      );
    const edit = editingOf(row.id, "default");
    if (edit)
      return (
        <CellEditor
          value={text}
          initial={edit.initial}
          label={`${row.name} ${t("propertiesPanel.stateDefault")}`}
          invalid={!!row.error}
          numeric={row.type === "number"}
          placeholder={placeholder}
          date={row.type === "date"}
          onCommit={(raw) => onDefault(row.id, raw)}
          onClose={closeEditor}
        />
      );
    return (
      <span
        className="variable-table__text"
        data-kind={text === "" ? "empty" : row.type}
        title={text}
      >
        {text}
      </span>
    );
  };

  /** Whether a scalar default cell edits as grid text (not a boolean · JSON · rule · source). */
  const textDefault = (row: VariableTableRow) =>
    grid &&
    !row.source &&
    !row.readOnly &&
    !structured(row.type) &&
    row.type !== "boolean";
  /** Whether a default cell edits as a list on the cell (a boolean's true · false). */
  const listDefault = (row: VariableTableRow) =>
    grid && !row.source && !row.readOnly && row.type === "boolean";
  /** Whether a default cell edits in the grid's popover editor (the project's JSON). */
  const jsonDefault = (row: VariableTableRow) =>
    grid &&
    !!onJsonDefault &&
    !row.source &&
    !row.readOnly &&
    structured(row.type);

  const menuFor = (row: VariableTableRow) => {
    if (row.readOnly)
      return onGoToOwner ? (
        <ActionIconButton
          className="variable-table__goto"
          aria-label={t("propertiesPanel.stateGoToOwner")}
          onPress={() => onGoToOwner(row.id)}
        >
          <ArrowUpRight size={iconSmall.size} />
        </ActionIconButton>
      ) : null;
    // Delete is the only action outside dense — a transparent icon button, not a one-item menu.
    if (!dense)
      return (
        <ActionIconButton
          className="variable-table__delete"
          aria-label={`${t("common.delete")} ${row.name}`}
          onPress={() => onRemove(row.id)}
        >
          <DeleteIcon
            size={iconProps.size}
            strokeWidth={iconProps.strokeWidth}
          />
        </ActionIconButton>
      );
    const items = [
      { id: "usage", label: usageLabel(row.usage), isDisabled: true },
      { id: "remove", label: t("common.delete"), icon: DeleteIcon },
    ];
    return (
      <PropertyRowMenu
        label={t("propertiesPanel.stateRowActions", { name: row.name })}
        items={items}
        onAction={(id) => {
          if (id === "remove") onRemove(row.id);
        }}
      />
    );
  };

  // RAC caches the row renders — the open editor and the handlers are inputs of them (body · row).
  const rowDependencies = [
    editing,
    owner,
    dense,
    typeOptions,
    onRename,
    onType,
    onDefault,
    onJsonDefault,
    onPersist,
    onRemove,
    onGoToOwner,
    t,
  ];
  const errorLines = rows
    .filter((row) => row.error)
    .map((row) => (
      <p
        key={row.id}
        className="variable-table__error"
        role="alert"
        data-variable-id={row.id}
      >
        {row.name}: {row.error}
      </p>
    ));

  const table = (
    <div
      ref={wrapRef}
      className="variable-table-wrap"
      data-owner={owner}
      data-look="grid"
      onKeyDownCapture={onKeyDownCapture}
    >
      <Table
        aria-label={label}
        className="variable-table"
        // The grid's keys: one tab stop, arrows move between cells (`DataGrid`).
        keyboardNavigationBehavior="tab"
      >
        <TableHeader className="variable-table__head">
          <Column
            id="name"
            isRowHeader
            className="variable-table__col variable-table__col-name"
          >
            {t("propertiesPanel.stateName")}
          </Column>
          <Column
            id="type"
            className="variable-table__col variable-table__col-type"
          >
            {t("propertiesPanel.stateType")}
          </Column>
          <Column
            id="default"
            className="variable-table__col variable-table__col-default"
          >
            {t("propertiesPanel.stateDefault")}
          </Column>
          {showPersist && (
            <Column
              id="persist"
              className="variable-table__col variable-table__col-persist"
            >
              {t("propertiesPanel.statePersist")}
            </Column>
          )}
          {showUsage && (
            <Column
              id="usage"
              className="variable-table__col variable-table__col-usage"
            >
              {t("propertiesPanel.stateUsage")}
            </Column>
          )}
          <Column
            id="actions"
            className="variable-table__col variable-table__col-actions"
          >
            <span className="variable-table__sr">
              {t("propertiesPanel.stateActions")}
            </span>
          </Column>
        </TableHeader>
        <TableBody
          className="variable-table__body"
          items={rows}
          dependencies={rowDependencies}
          renderEmptyState={() => (
            <span className="variable-table__muted">
              {t("propertiesPanel.stateEmpty")}
            </span>
          )}
        >
          {(row) => (
            <Row
              id={row.id}
              className="variable-table__row"
              dependencies={rowDependencies}
              data-variable-id={row.id}
              data-source={row.source ? "true" : undefined}
              data-read-only={row.readOnly ? "true" : undefined}
              {...(row.readOnly && onGoToOwner
                ? { onAction: () => onGoToOwner(row.id) }
                : {})}
            >
              <Cell
                className="variable-table__cell variable-table__cell-name"
                data-edit-column={row.readOnly ? undefined : "name"}
                data-editing={editingOf(row.id, "name") ? "inline" : undefined}
                data-invalid={row.error ? "true" : undefined}
                onDoubleClick={
                  row.readOnly
                    ? undefined
                    : (event) =>
                        startEdit(
                          { rowId: row.id, column: "name" },
                          event.currentTarget,
                        )
                }
              >
                {row.readOnly ? (
                  <span className="variable-table__text" title={row.name}>
                    {row.name}
                    <span className="variable-table__owner">
                      {row.readOnly.owner}
                    </span>
                  </span>
                ) : editingOf(row.id, "name") ? (
                  <CellEditor
                    value={row.name}
                    initial={editingOf(row.id, "name")!.initial}
                    label={t("propertiesPanel.stateName")}
                    invalid={!!row.error}
                    onCommit={(name) => onRename(row.id, name)}
                    onClose={closeEditor}
                  />
                ) : (
                  <span className="variable-table__text" title={row.name}>
                    {row.name}
                  </span>
                )}
              </Cell>
              <Cell
                className="variable-table__cell variable-table__cell-type"
                data-edit-column={
                  row.source || row.readOnly ? undefined : "type"
                }
                data-edit-kind={row.source || row.readOnly ? undefined : "list"}
                data-editing={editingOf(row.id, "type") ? "popover" : undefined}
                onDoubleClick={
                  row.source || row.readOnly
                    ? undefined
                    : (event) =>
                        startEdit(
                          { rowId: row.id, column: "type" },
                          event.currentTarget,
                        )
                }
              >
                {row.source || row.readOnly ? (
                  <span className="variable-table__muted">
                    {labelOfType(row.type)}
                  </span>
                ) : (
                  <span className="variable-table__text variable-table__type-text">
                    {labelOfType(row.type)}
                  </span>
                )}
                {editingOf(row.id, "type") && (
                  <CellListPopover
                    triggerRef={listCellRef}
                    value={uiType(row.type)}
                    label={t("propertiesPanel.stateType")}
                    options={shownTypes}
                    onChange={(type) => pickType(row, type)}
                    onClose={closeEditor}
                  />
                )}
              </Cell>
              <Cell
                className="variable-table__cell variable-table__cell-default"
                data-edit-column={
                  textDefault(row) || listDefault(row) || jsonDefault(row)
                    ? "default"
                    : undefined
                }
                data-edit-kind={
                  listDefault(row)
                    ? "list"
                    : jsonDefault(row)
                      ? "popover"
                      : undefined
                }
                data-editing={
                  editingOf(row.id, "default")
                    ? listDefault(row) || jsonDefault(row)
                      ? "popover"
                      : "inline"
                    : undefined
                }
                data-invalid={
                  row.error && textDefault(row) ? "true" : undefined
                }
                onDoubleClick={
                  textDefault(row) || listDefault(row) || jsonDefault(row)
                    ? (event) =>
                        startEdit(
                          { rowId: row.id, column: "default" },
                          event.currentTarget,
                        )
                    : undefined
                }
              >
                {defaultCell(row)}
              </Cell>
              {showPersist && (
                <Cell className="variable-table__cell variable-table__cell-persist">
                  {row.readOnly || row.source ? null : (
                    <AriaSwitch
                      className="react-aria-Switch variable-table__switch"
                      aria-label={`${row.name} ${t("propertiesPanel.statePersist")}`}
                      isSelected={row.persist === true}
                      onChange={(on) => onPersist!(row.id, on)}
                    >
                      <div className="indicator" />
                    </AriaSwitch>
                  )}
                </Cell>
              )}
              {showUsage && (
                <Cell className="variable-table__cell variable-table__cell-usage">
                  <span className="variable-table__count">{row.usage}</span>
                </Cell>
              )}
              <Cell className="variable-table__cell variable-table__cell-actions">
                {menuFor(row)}
              </Cell>
            </Row>
          )}
        </TableBody>
      </Table>
      {errorLines}
      {children}
    </div>
  );
  if (grid) return table;

  // The Design panel: a panel field row per variable (`.fieldset-row` — ID · Route's 84 · 84 · 28):
  // the name box (the name input + the type), the default, the row action.
  const nameLabel = t("propertiesPanel.stateName");
  const defaultLabel = t("propertiesPanel.stateDefault");
  const fieldRow = (row: VariableTableRow) => {
    const typeLabel = labelOfType(row.type);
    // A type that is not editable here (a source · an inherited row): the icon alone, named.
    const typeText = (
      <span
        className="variable-row__type-icon"
        role="img"
        aria-label={typeLabel}
        title={typeLabel}
      >
        <TypeGlyph type={uiType(row.type)} />
      </span>
    );
    // Typed text · a JSON field edit in a field box; a switch · a rule · a source's text sit bare.
    const boxedDefault =
      !row.source &&
      !row.readOnly &&
      (!structured(row.type) || !!onJsonDefault) &&
      row.type !== "boolean";
    const booleanDefault =
      row.type === "boolean" && !row.source && !row.readOnly;
    return (
      <div
        key={row.id}
        className="fieldset-row variable-row"
        role="group"
        aria-label={row.name}
        data-variable-id={row.id}
        data-source={row.source ? "true" : undefined}
        data-read-only={row.readOnly ? "true" : undefined}
      >
        {row.readOnly ? (
          <div className="variable-row__name variable-row__value">
            <span className="variable-table__text" title={row.name}>
              {row.name}
              <span className="variable-table__owner">
                {row.readOnly.owner}
              </span>
            </span>
            {typeText}
          </div>
        ) : (
          <PropertyFieldset
            legend={nameLabel}
            labelMode="hidden"
            className="variable-row__name"
          >
            <CommitInput
              value={row.name}
              label={nameLabel}
              invalid={!!row.error}
              onCommit={(name) => onRename(row.id, name)}
            />
            {row.source ? (
              typeText
            ) : (
              <TypeSelect
                value={uiType(row.type)}
                label={t("propertiesPanel.stateType")}
                options={shownTypes}
                onChange={(type) => pickType(row, type)}
              />
            )}
          </PropertyFieldset>
        )}
        {booleanDefault ? (
          // A boolean's default is a choice of true · false (사용자 2026-10-29 「bool 일경우 true,
          // false 선택」) — the panel Select, value-as-label.
          <PropertySelect
            label={`${row.name} ${defaultLabel}`}
            labelMode="inline"
            className="variable-row__default"
            value={row.defaultValue === true ? "true" : "false"}
            options={BOOLEAN_OPTIONS}
            translateOptions={false}
            onChange={(value) => onDefault(row.id, value)}
          />
        ) : boxedDefault ? (
          <PropertyFieldset
            legend={defaultLabel}
            labelMode="hidden"
            className="variable-row__default"
          >
            {defaultCell(row)}
          </PropertyFieldset>
        ) : (
          <div className="variable-row__default variable-row__value">
            {defaultCell(row)}
          </div>
        )}
        <div className="fieldset-actions">{menuFor(row)}</div>
      </div>
    );
  };
  return (
    <div
      className="variable-rows"
      data-owner={owner}
      data-look="fields"
      aria-label={label}
      role="group"
    >
      {rows.length === 0 ? (
        <span className="variable-table__muted">
          {t("propertiesPanel.stateEmpty")}
        </span>
      ) : (
        rows.map(fieldRow)
      )}
      {errorLines}
      {children}
    </div>
  );
});
