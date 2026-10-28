/**
 * RowForm — ADR-289 Decision 1: a row in one view (Supabase Table Editor's Insert row · Update row
 * panel), beside the grid (`DataGrid` draws it in the body's second column, 360 px).
 *
 * - Fields: `required` columns first, the rest under 「Optional — empty = default」. One
 *   `FieldValueInput` per column (typed input · placeholder = the default on insert).
 * - Values (`rowFormValues.ts`): Insert — empty = the default, `null` without one. Update — untouched
 *   = not written, emptied = `null`. `required` is judged on the stored value; a failing field shows
 *   its error and the save focuses the first one.
 * - Save = one `applyDataChange` (HC1): `insert_rows` at the end · the changed cells as `set_cell`
 *   ops of one change. Update resolves its target right before the call (`rowFormTarget.ts` — a
 *   changed row set is a conflict: refused, input kept, alert with Close).
 * - 「Create more」 keeps the form open after an insert (cleared, first field focused). Esc · ✕ ·
 *   Cancel with unsaved input → ConfirmDialog.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { DataOp } from "@composition/shared";
import { Button } from "react-aria-components/Button";
import { Dialog } from "react-aria-components/Dialog";
import { useOptionalI18n } from "../../../../i18n";
import type {
  DataField,
  DataTable,
} from "../../../../types/builder/data.types";
import { ConfirmDialog } from "../../../components/overlay/ConfirmDialog";
import { PanelHeader } from "../../../components/panel/PanelHeader";
import { Section } from "../../../components/panel/Section";
import { PropertySwitch } from "../../../components/property/PropertySwitch";
import { useDataStore } from "../../../stores/data";
import { globalToast } from "../../../stores/toast";
import { announceDataPanelStatus } from "../stores/dataPanelStatusStore";
import { formatCellValue } from "./cellValue";
import { isReadonlyField, nextRowId } from "./DataGrid.runtime";
import { FieldValueInput } from "./FieldValueInput";
import { resolveFieldDefault } from "./fieldDefault";
import {
  resolveRowFormTarget,
  type OpenedRowFormTarget,
} from "./rowFormTarget";
import {
  finalRowValue,
  initialDraftText,
  isMissingRequired,
  type FieldDraft,
  type FinalRowValue,
} from "./rowFormValues";
import "./RowForm.css";

export type RowFormMode =
  | { kind: "insert" }
  | { kind: "update"; rowIndex: number; opened: OpenedRowFormTarget };

export interface RowFormProps {
  table: DataTable;
  mode: RowFormMode;
  onClose: () => void;
  /** After a successful write — the grid focuses that row. */
  onSaved?: (rowIndex: number) => void;
}

type Drafts = Record<string, FieldDraft>;

function jsonError(field: DataField, text: string): boolean {
  if (field.type !== "array" && field.type !== "object") return false;
  if (text.trim() === "") return false;
  try {
    const parsed: unknown = JSON.parse(text);
    return field.type === "array"
      ? !Array.isArray(parsed)
      : Array.isArray(parsed) || typeof parsed !== "object" || parsed === null;
  } catch {
    return true;
  }
}

export function RowForm({ table, mode, onClose, onSaved }: RowFormProps) {
  const i18n = useOptionalI18n();
  const t = useCallback(
    (key: string, params?: Record<string, string | number | boolean>) =>
      i18n ? i18n.t(`datatable.${key}`, params) : key,
    [i18n],
  );
  const common = useCallback(
    (key: string) => (i18n ? i18n.t(`common.${key}`) : key),
    [i18n],
  );
  const applyDataChange = useDataStore((state) => state.applyDataChange);

  const schema = table.schema;
  const kind = mode.kind;
  // The row as it was when the form opened — Update's "current" values (the target check
  // guarantees the latest rows equal these before anything is written).
  const current = useMemo<Record<string, unknown>>(
    () =>
      mode.kind === "update" ? (mode.opened.mockData[mode.rowIndex] ?? {}) : {},
    [mode],
  );
  const editable = useMemo(
    () => schema.filter((field) => !isReadonlyField(field)),
    [schema],
  );
  const requiredFields = useMemo(
    () => editable.filter((field) => field.required),
    [editable],
  );
  const optionalFields = useMemo(
    () => editable.filter((field) => !field.required),
    [editable],
  );
  const idField = useMemo(() => schema.find(isReadonlyField), [schema]);

  const freshDrafts = useCallback((): Drafts => {
    const drafts: Drafts = {};
    for (const field of editable)
      drafts[field.key] = {
        text: initialDraftText(kind, current[field.key]),
        touched: false,
      };
    return drafts;
  }, [editable, kind, current]);

  const [drafts, setDrafts] = useState<Drafts>(freshDrafts);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createMore, setCreateMore] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const controls = useRef(new Map<string, HTMLElement>());
  const dirty = Object.values(drafts).some((draft) => draft.touched);

  const setDraft = (key: string, text: string) => {
    setDrafts((prev) => ({ ...prev, [key]: { text, touched: true } }));
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const title =
    kind === "insert"
      ? t("rowFormInsertTitle", { name: table.name })
      : t("rowFormUpdateTitle", { name: table.name });

  const focusField = (key: string) => {
    const el = controls.current.get(key);
    if (!el) return;
    el.focus();
    // The caret goes to the end of the current text (Update starts with a value).
    if (
      (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) &&
      typeof el.setSelectionRange === "function"
    ) {
      try {
        const end = el.value.length;
        el.setSelectionRange(end, end);
      } catch {
        // date · datetime-local inputs reject setSelectionRange
      }
    }
  };

  const write = async (ops: DataOp[]): Promise<boolean> => {
    try {
      await applyDataChange({ ops, origin: "user" });
      return true;
    } catch (error) {
      globalToast.error(error instanceof Error ? error.message : String(error));
      return false;
    }
  };

  const save = () => {
    const finals = new Map<string, FinalRowValue>();
    const nextErrors: Record<string, string> = {};
    for (const field of editable) {
      const draft = drafts[field.key] ?? { text: "", touched: false };
      if (jsonError(field, draft.text)) {
        nextErrors[field.key] = t("rowFormJsonInvalid");
        continue;
      }
      const final = finalRowValue(kind, field, draft);
      finals.set(field.key, final);
      if (final.kind === "invalid")
        nextErrors[field.key] = t("rowFormInvalid", { type: field.type });
      else if (isMissingRequired(field, final, current[field.key]))
        nextErrors[field.key] = t("rowFormRequiredError");
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      const first = editable.find((field) => field.key in nextErrors);
      if (first) focusField(first.key);
      return;
    }
    // Read the store at the call — not a render-time prop (R2: the reducer reads this state).
    const latest = useDataStore.getState().collections.get(table.id);
    if (kind === "insert") {
      const rows = latest?.mockData ?? table.mockData;
      const row: Record<string, unknown> = {};
      for (const field of schema) {
        if (isReadonlyField(field))
          row[field.key] = nextRowId(rows, field.type);
        else {
          const final = finals.get(field.key);
          row[field.key] = final?.kind === "value" ? final.value : null;
        }
      }
      const at = rows.length;
      void write([
        { op: "insert_rows", collectionId: table.id, rows: [row], at },
      ]).then((ok) => {
        if (!ok) return;
        announceDataPanelStatus(t("gridRowAdded"), { tone: "success" });
        if (createMore) {
          setDrafts(freshDrafts());
          setErrors({});
          const first = editable[0];
          if (first) focusField(first.key);
        } else {
          onSaved?.(at);
          onClose();
        }
      });
      return;
    }
    if (mode.kind !== "update") return;
    const ops: DataOp[] = [];
    const written: string[] = [];
    for (const field of editable) {
      const final = finals.get(field.key);
      if (!final || final.kind !== "value") continue;
      if (formatCellValue(final.value) === formatCellValue(current[field.key]))
        continue;
      const fieldId = field.id ?? field.key;
      written.push(fieldId);
      ops.push({
        op: "set_cell",
        collectionId: table.id,
        rowIndex: mode.rowIndex,
        fieldId,
        value: final.value,
      });
    }
    if (ops.length === 0) {
      onClose();
      return;
    }
    const target = resolveRowFormTarget(latest, mode.opened, written);
    if ("conflict" in target) {
      setConflict(true);
      return;
    }
    // No await between the target check and the call — `applyDataChange` reduces at the call.
    void write(
      ops.map((op) =>
        op.op === "set_cell" ? { ...op, rowIndex: target.rowIndex } : op,
      ),
    ).then((ok) => {
      if (!ok) return;
      announceDataPanelStatus(t("rowFormUpdated"), { tone: "success" });
      onSaved?.(target.rowIndex);
      onClose();
    });
  };

  const requestClose = () => {
    if (dirty && !conflict) setConfirmDiscard(true);
    else onClose();
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      requestClose();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
      save();
    }
  };

  // The first field takes focus when the form opens (desktop, one primary task).
  const firstKey = editable[0]?.key;
  useEffect(() => {
    if (firstKey) focusField(firstKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const placeholderFor = (field: DataField) => {
    if (kind === "update") return t("rowFormEmpty");
    const fallback = resolveFieldDefault(field);
    return fallback.ok && fallback.value !== null
      ? t("rowFormDefault", { value: formatCellValue(fallback.value) })
      : t("rowFormEmpty");
  };

  const renderField = (field: DataField) => (
    <FieldValueInput
      key={field.id ?? field.key}
      field={field}
      label={field.key}
      showTypeIcon
      text={drafts[field.key]?.text ?? ""}
      onChange={(text) => setDraft(field.key, text)}
      placeholder={placeholderFor(field)}
      error={errors[field.key] ?? null}
      onSubmit={save}
      controlRef={(el) => {
        if (el) controls.current.set(field.key, el);
        else controls.current.delete(field.key);
      }}
    />
  );

  return (
    <Dialog
      className="react-aria-Dialog datatable-row-form"
      aria-label={title}
      data-mode={kind}
    >
      <div className="datatable-row-form-body" onKeyDown={onKeyDown}>
        <PanelHeader
          className="datatable-row-form-header"
          title={title}
          onClose={requestClose}
        />
        {conflict && (
          <div role="alert" className="datatable-row-form-conflict">
            <span>{t("rowFormConflict")}</span>
            <Button className="control-button" onPress={onClose}>
              {common("close")}
            </Button>
          </div>
        )}
        <div className="datatable-row-form-fields">
          {idField && kind === "insert" && (
            <Section
              id="datatable-row-form-id"
              title={t("rowFormAutoTitle")}
              collapsible={false}
            >
              <FieldValueInput
                field={idField}
                label={idField.key}
                showTypeIcon
                text=""
                onChange={() => {}}
                readonlyText={t("rowFormAuto", {
                  value: formatCellValue(
                    nextRowId(table.mockData, idField.type),
                  ),
                })}
              />
            </Section>
          )}
          {requiredFields.length > 0 && (
            <Section
              id="datatable-row-form-required"
              title={t("rowFormRequired")}
              collapsible={false}
            >
              {requiredFields.map(renderField)}
            </Section>
          )}
          {optionalFields.length > 0 && (
            <Section
              id="datatable-row-form-optional"
              title={
                kind === "insert"
                  ? t("rowFormOptionalDefault")
                  : t("rowFormOptional")
              }
              collapsible={false}
            >
              {optionalFields.map(renderField)}
            </Section>
          )}
        </div>
        <div className="datatable-row-form-footer">
          {kind === "insert" && (
            <PropertySwitch
              className="datatable-row-form-more"
              label={t("rowFormCreateMore")}
              labelMode="inline"
              isSelected={createMore}
              onChange={setCreateMore}
            />
          )}
          <div className="datatable-row-form-actions">
            <Button className="control-button" onPress={requestClose}>
              {common("cancel")}
            </Button>
            <Button
              className="control-button"
              data-variant="primary"
              isDisabled={conflict}
              onPress={save}
            >
              {common("save")}
            </Button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        isOpen={confirmDiscard}
        title={t("rowFormDiscardTitle")}
        message={t("rowFormDiscardMessage")}
        tone="danger"
        confirmLabel={t("rowFormDiscard")}
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </Dialog>
  );
}
