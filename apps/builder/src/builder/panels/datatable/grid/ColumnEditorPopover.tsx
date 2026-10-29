/**
 * ColumnEditorPopover — ADR-288 Decision 2: a column's editor opens under its header (the old
 * `DataTableFieldPanel` body, ADR-212 Phase 3, moved as is). The header's label · chevron open it,
 * the type icon opens it with the type select focused. Esc · a click outside close it (RAC).
 *
 * ADR-289 Decision 3 — the body is four panel sections (Supabase's Insert / Update column panel):
 * **Name** (key · label) · **Type** (the type select — every option with a one-line hint,
 * `datatable.typeHints.*` — and the default, a `FieldValueInput` of the column's type) · **Rules**
 * (required · the reference target) · **Usage** ("used by N" · delete). The default is stored in
 * the column's type (`coerceCellValue` on commit — a boolean · a number · a parsed array / object,
 * `""` = `null`); a text that is not a value of the type is refused with a message. A type change
 * re-reads the default through `resolveFieldDefault` and clears it (with a note) when it does not
 * fit the new type — all in the same `update_field`.
 *
 * `ColumnCreatePopover` (ADR-289 — `Insert ▾ → Insert column…`) is the same part in **create**
 * mode, anchored to the header's `+` slot: name · type · default · required · reference ·
 * 「Create more」 → one `add_field`. The `+` slot's inline name input (string · Enter) stays as the
 * quick path.
 *
 * Every write is `applyDataChange` (HC1); a rename is `update_field { key }` (the reducer moves the
 * rows). A type change previews (UX-5) and asks "clear / keep", writing `update_field` + `set_cell`
 * as one DataChange.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { resolveField, type DataOp } from "@composition/shared";
import { Button } from "react-aria-components/Button";
import { Dialog } from "react-aria-components/Dialog";
import { Popover } from "react-aria-components/Popover";
import { useI18n } from "../../../../i18n";
import type {
  DataField,
  DataFieldType,
  DataTable,
} from "../../../../types/builder/data.types";
import { iconSmall } from "../../../../utils/ui/uiConstants";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { Section } from "../../../components/panel/Section";
import { PropertyFieldset } from "../../../components/property/PropertyFieldset";
import { PropertyInput } from "../../../components/property/PropertyInput";
import { PropertySelect } from "../../../components/property/PropertySelect";
import { PropertySwitch } from "../../../components/property/PropertySwitch";
import { ConfirmDialog } from "../../../components/overlay/ConfirmDialog";
import { useDataStore } from "../../../stores/data";
import { globalToast } from "../../../stores/toast";
import { announceDataPanelStatus } from "../stores/dataPanelStatusStore";
import { planFieldRename } from "../utils/fieldRename";
import {
  FIELD_FORMATS,
  FIELD_TYPES,
  resolveFieldGlyph,
  shownFieldType,
} from "../utils/fieldTypes";
import { useDataUsageSource } from "../usage/dataUsageSource";
import type { FieldUsageRef } from "../utils/fieldUsage";
import { previewTypeChange, typeChangeToOps } from "../utils/typeChangePreview";
import { coerceCellValue, formatCellValue } from "./cellValue";
import { FieldValueInput } from "./FieldValueInput";
import { resolveFieldDefault } from "./fieldDefault";
import "./ColumnEditorPopover.css";

const DeleteIcon = ACTION_ICONS.delete;

type Dt = (
  key: string,
  params?: Record<string, string | number | boolean>,
) => string;

interface PendingTypeChange {
  newType: DataFieldType;
  total: number;
  invalidRowIndexes: number[];
}

export interface ColumnEditorPopoverProps {
  table: DataTable;
  field: DataField;
  /** The column head — the popover anchors under it. */
  triggerRef: RefObject<Element | null>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opened from the type icon: the type select takes focus. */
  focus?: "type";
}

export function ColumnEditorPopover({
  table,
  field,
  triggerRef,
  isOpen,
  onOpenChange,
  focus,
}: ColumnEditorPopoverProps) {
  return (
    <Popover
      triggerRef={triggerRef}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      placement="bottom start"
      className="react-aria-Popover datatable-field-popover"
    >
      <Dialog
        className="react-aria-Dialog datatable-field-dialog"
        aria-label={field.key}
      >
        <ColumnEditor
          table={table}
          field={field}
          focus={focus}
          onClose={() => onOpenChange(false)}
        />
      </Dialog>
    </Popover>
  );
}

export interface ColumnCreatePopoverProps {
  table: DataTable;
  /** The header's `+` slot — the popover anchors under it. */
  triggerRef: RefObject<Element | null>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

/** ADR-289 — `Insert ▾ → Insert column…`: the editor in create mode. */
export function ColumnCreatePopover({
  table,
  triggerRef,
  isOpen,
  onOpenChange,
}: ColumnCreatePopoverProps) {
  const { t } = useI18n();
  return (
    <Popover
      triggerRef={triggerRef}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      placement="bottom end"
      className="react-aria-Popover datatable-field-popover"
    >
      <Dialog
        className="react-aria-Dialog datatable-field-dialog"
        aria-label={t("datatable.fieldCreateTitle")}
      >
        <ColumnCreator table={table} onClose={() => onOpenChange(false)} />
      </Dialog>
    </Popover>
  );
}

function useWrite() {
  const applyDataChange = useDataStore((state) => state.applyDataChange);
  return useCallback(
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
}

function useDt(): Dt {
  const { t } = useI18n();
  return useCallback(
    (key: string, params?: Record<string, string | number | boolean>) =>
      t(`datatable.${key}`, params),
    [t],
  );
}

/**
 * A text column's kind (2026-10-29 — email · URL · image were types; now `string` + a format):
 * the Format select under the type, 「Text」 = none.
 */
function FormatSelect({
  value,
  dt,
  onChange,
}: {
  value: DataField["format"];
  dt: Dt;
  onChange: (format: DataField["format"] | undefined) => void;
}) {
  return (
    <div className="fieldset-row" data-wide>
      <PropertySelect
        className="datatable-field-format"
        label={dt("fieldFormat")}
        value={value ?? ""}
        optionValueMode="literal"
        options={[
          { value: "", label: dt("fieldFormatNone") },
          ...FIELD_FORMATS.map((format) => ({
            value: format.value,
            label: dt(format.i18n),
          })),
        ]}
        descriptions={Object.fromEntries(
          FIELD_FORMATS.map((format) => [
            format.value,
            dt(format.i18n.replace(/^types\./, "typeHints.")),
          ]),
        )}
        onChange={(next) =>
          onChange(next === "" ? undefined : (next as DataField["format"]))
        }
      />
    </div>
  );
}

/** The type options — label + the one-line hint (사용자 결정 3). */
function useTypeOptions(dt: Dt) {
  return useMemo(
    () => ({
      options: FIELD_TYPES.map((ft) => ({
        value: ft.value,
        label: dt(ft.i18n),
      })),
      descriptions: Object.fromEntries(
        FIELD_TYPES.map((ft) => [
          ft.value,
          dt(ft.i18n.replace(/^types\./, "typeHints.")),
        ]),
      ) as Record<string, string>,
    }),
    [dt],
  );
}

/** The column ⌄ menu's 「Delete column」 — always confirms (Supabase 어법); the message names the
 *  references that break when the column is used. One `remove_field` (one Undo). */
export function ColumnDeleteDialog({
  table,
  field,
  onClose,
}: {
  table: DataTable;
  field: DataField;
  onClose: () => void;
}) {
  const dt = useDt();
  const usage = useDataUsageSource().useFieldUsage(table, field);
  const write = useWrite();
  const fieldId = field.id ?? field.key;
  return (
    <ConfirmDialog
      isOpen
      title={dt("fieldDeleteConfirmTitle", { key: field.key })}
      message={
        usage.length > 0
          ? dt("fieldDeleteConfirmUsed", { key: field.key, count: usage.length })
          : dt("fieldDeleteConfirm", { key: field.key })
      }
      tone="danger"
      onConfirm={() =>
        void write([
          { op: "remove_field", collectionId: table.id, fieldId },
        ]).then((ok) => {
          if (ok) {
            announceDataPanelStatus(dt("fieldDeleted", { key: field.key }), {
              tone: "success",
            });
          }
          onClose();
        })
      }
      onCancel={onClose}
    />
  );
}

/** The editor's body with its data (the usage source · the store) — the popover's content. */
export function ColumnEditor({
  table,
  field,
  focus,
  onClose,
}: {
  table: DataTable;
  field: DataField;
  focus?: "type";
  onClose: () => void;
}) {
  const dt = useDt();
  const usage = useDataUsageSource().useFieldUsage(table, field);
  const write = useWrite();
  return (
    <FieldForm
      key={field.id ?? field.key}
      collectionId={table.id}
      existingKeys={table.schema.map((f) => f.key)}
      rows={table.mockData}
      field={field}
      usage={usage}
      dt={dt}
      write={write}
      onClose={onClose}
      focus={focus}
    />
  );
}

interface FieldFormProps {
  collectionId: string;
  existingKeys: string[];
  rows: readonly Record<string, unknown>[];
  field: DataField;
  usage: readonly FieldUsageRef[];
  dt: Dt;
  write: (ops: DataOp[], label?: string) => Promise<boolean>;
  onClose: () => void;
  focus?: "type";
}

/**
 * The default the column will keep after a type change — the current default re-read as the new
 * type (`resolveFieldDefault`); `cleared` when it does not fit.
 */
function remapDefault(
  field: DataField,
  newType: DataFieldType,
): { patch: Record<string, unknown>; cleared: boolean } {
  if (field.defaultValue === null || field.defaultValue === undefined)
    return { patch: {}, cleared: false };
  const next = resolveFieldDefault({ ...field, type: newType });
  return next.ok
    ? { patch: { defaultValue: next.value }, cleared: false }
    : { patch: { defaultValue: null }, cleared: true };
}

function FieldForm({
  collectionId,
  existingKeys,
  rows,
  field,
  usage,
  dt,
  write,
  onClose,
  focus,
}: FieldFormProps) {
  // A rejected rename (empty · duplicate) remounts the key input back to the stored key.
  const [keyNonce, setKeyNonce] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingType, setPendingType] = useState<PendingTypeChange | null>(
    null,
  );
  const { options: typeOptions, descriptions: typeHints } = useTypeOptions(dt);

  const fieldId = field.id ?? field.key;
  const type = field.type;

  // The default as text — committed on blur · Enter (`coerceCellValue`), the stored value re-read
  // through `resolveFieldDefault` (a legacy text default shows coerced; a mismatch shows a note).
  const storedDefault = useMemo(() => resolveFieldDefault(field), [field]);
  const [defaultText, setDefaultText] = useState(() =>
    storedDefault.ok ? formatCellValue(storedDefault.value) : "",
  );
  const [defaultError, setDefaultError] = useState<string | null>(() =>
    storedDefault.ok ? null : dt("fieldDefaultInvalid"),
  );
  const [defaultNote, setDefaultNote] = useState<string | null>(null);
  useEffect(() => {
    setDefaultText(
      storedDefault.ok ? formatCellValue(storedDefault.value) : "",
    );
    setDefaultError(storedDefault.ok ? null : dt("fieldDefaultInvalid"));
  }, [storedDefault, dt]);

  const commitKey = async (draft: string) => {
    const plan = planFieldRename(collectionId, field, existingKeys, draft);
    if (plan.kind === "noop") return;
    if (plan.kind === "empty") {
      globalToast.warning(dt("fieldKeyEmpty"));
      setKeyNonce((n) => n + 1);
      return;
    }
    if (plan.kind === "dup") {
      globalToast.warning(dt("fieldKeyDup", { key: plan.key }));
      setKeyNonce((n) => n + 1);
      return;
    }
    const label = dt("fieldRenamed", { from: field.key, to: plan.key });
    const ok = await write([plan.op], label);
    if (ok) announceDataPanelStatus(label);
  };

  // Opened from the type icon — the type select's trigger takes focus (after the dialog's own
  // autofocus).
  const typeRowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focus === "type")
      typeRowRef.current
        ?.querySelector<HTMLElement>(".react-aria-Select .react-aria-Button")
        ?.focus();
  }, [focus]);

  const patchField = async (patch: Record<string, unknown>) => {
    await write([{ op: "update_field", collectionId, fieldId, patch }]);
  };

  const commitDefault = () => {
    const coerced = coerceCellValue(type, defaultText);
    if (!coerced.ok) {
      setDefaultError(dt("fieldDefaultInvalid"));
      return;
    }
    setDefaultError(null);
    const current = storedDefault.ok ? storedDefault.value : null;
    if (formatCellValue(coerced.value) === formatCellValue(current)) return;
    void patchField({ defaultValue: coerced.value });
  };

  const requestTypeChange = (newType: DataFieldType) => {
    // (JSON is one choice — an `array` column picking it again changes nothing.)
    if (newType === shownFieldType(field.type)) return;
    const remap = remapDefault(field, newType);
    setDefaultNote(remap.cleared ? dt("fieldDefaultCleared") : null);
    const preview = previewTypeChange(field, newType, rows, field.key);
    if (preview.invalidCount === 0) {
      void patchField({ type: newType, ...remap.patch });
      return;
    }
    setPendingType({
      newType,
      total: preview.total,
      invalidRowIndexes: preview.invalidRowIndexes,
    });
  };

  const applyTypeChange = async (mode: "keep" | "clear") => {
    if (!pendingType) return;
    const remap = remapDefault(field, pendingType.newType);
    const ops = typeChangeToOps({
      collectionId,
      field,
      newType: pendingType.newType,
      invalidRowIndexes: pendingType.invalidRowIndexes,
      mode,
      rows,
      fieldKey: field.key,
    }).map((op) =>
      op.op === "update_field"
        ? { ...op, patch: { ...op.patch, ...remap.patch } }
        : op,
    );
    setPendingType(null);
    await write(ops);
  };

  const deleteField = async () => {
    if (usage.length > 0) {
      setConfirmDelete(true);
      return;
    }
    await runDelete();
  };
  const runDelete = async () => {
    setConfirmDelete(false);
    const ok = await write([{ op: "remove_field", collectionId, fieldId }]);
    if (ok) {
      announceDataPanelStatus(dt("fieldDeleted", { key: field.key }), {
        tone: "success",
      });
      onClose();
    }
  };

  return (
    <div className="datatable-field-form" data-mode="edit">
      <Section
        id="datatable-column-name"
        title={dt("fieldSectionName")}
        collapsible={false}
      >
        <div className="fieldset-row" data-wide>
          <PropertyInput
            key={`key-${keyNonce}`}
            className="datatable-field-key"
            label={dt("fieldName")}
            value={field.key}
            onChange={(next) => void commitKey(next)}
          />
        </div>
        <div className="fieldset-row" data-wide>
          <PropertyInput
            className="datatable-field-label"
            label={dt("fieldLabel")}
            value={field.label ?? ""}
            onChange={(v) => {
              if (v !== (field.label ?? ""))
                void patchField({ label: v === "" ? null : v });
            }}
          />
        </div>
      </Section>

      <Section
        id="datatable-column-type"
        title={dt("fieldSectionType")}
        collapsible={false}
      >
        {/* Type — the Builder Select (its list is the panel picker: 28 rows · ✓), every option
            with its one-line hint, the trigger shows the current type's icon. Opened from the
            head's type icon, the trigger takes focus. */}
        <div className="fieldset-row" data-wide ref={typeRowRef}>
          <PropertySelect
            className="datatable-field-type"
            label={dt("fieldType")}
            icon={resolveFieldGlyph(field)}
            value={shownFieldType(type)}
            optionValueMode="literal"
            options={typeOptions}
            descriptions={typeHints}
            onChange={(next) => requestTypeChange(next as DataFieldType)}
            afterControl={
              defaultNote ? (
                <span slot="description" className="datatable-field-note">
                  {defaultNote}
                </span>
              ) : undefined
            }
          />
        </div>
        {type === "string" ? (
          <FormatSelect
            value={field.format}
            dt={dt}
            onChange={(format) => void patchField({ format: format ?? null })}
          />
        ) : null}
        <div className="fieldset-row" data-wide>
          <FieldValueInput
            className="datatable-field-default"
            field={{ ...field, defaultValue: null }}
            label={dt("fieldDefault")}
            text={defaultText}
            placeholder={dt("rowFormEmpty")}
            error={defaultError}
            onChange={(text) => {
              setDefaultText(text);
              setDefaultError(null);
              // The boolean Select commits as it changes (no blur).
              if (type === "boolean") {
                const coerced = coerceCellValue(type, text);
                if (coerced.ok)
                  void patchField({ defaultValue: coerced.value });
              }
            }}
            onBlur={type === "boolean" ? undefined : commitDefault}
            onSubmit={commitDefault}
          />
        </div>
      </Section>

      <Section
        id="datatable-column-rules"
        title={dt("fieldSectionRules")}
        collapsible={false}
      >
        <div className="fieldset-row" data-wide>
          <PropertySwitch
            label={dt("fieldRequired")}
            isSelected={field.required ?? false}
            onChange={(checked) => void patchField({ required: checked })}
          />
        </div>
        {type === "reference" ? (
          <ReferenceTarget
            reference={field.reference}
            collectionId={collectionId}
            dt={dt}
            onChange={(reference) => void patchField({ reference })}
          />
        ) : null}
      </Section>

      <Section
        id="datatable-column-usage"
        title={dt("fieldUsage")}
        collapsible={false}
      >
        <div className="fieldset-row" data-wide>
          <PropertyFieldset
            legend={dt("fieldUsage")}
            className="datatable-field-usage"
          >
            <span className="react-aria-Input" aria-readonly="true">
              {usage.length > 0
                ? dt("fieldUsedBy", { count: usage.length })
                : dt("fieldUsedByNone")}
            </span>
          </PropertyFieldset>
        </div>

        <Button
          className="control-button"
          data-tone="danger"
          onPress={() => void deleteField()}
        >
          <DeleteIcon size={iconSmall.size} />
          {dt("fieldDelete")}
        </Button>
      </Section>

      <ConfirmDialog
        isOpen={confirmDelete}
        title={dt("fieldDeleteConfirmTitle", { key: field.key })}
        message={dt("fieldDeleteConfirmUsed", {
          key: field.key,
          count: usage.length,
        })}
        tone="danger"
        onConfirm={() => void runDelete()}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmDialog
        isOpen={pendingType !== null}
        title={dt("fieldTypeChangeTitle", { key: field.key })}
        message={
          pendingType
            ? dt("fieldTypeChangeInvalid", {
                total: pendingType.total,
                count: pendingType.invalidRowIndexes.length,
                type: dt(
                  FIELD_TYPES.find((f) => f.value === pendingType.newType)
                    ?.i18n ?? pendingType.newType,
                ),
              })
            : ""
        }
        tone="default"
        confirmLabel={dt("fieldTypeChangeClear")}
        cancelLabel={dt("fieldTypeChangeKeep")}
        onConfirm={() => void applyTypeChange("clear")}
        onCancel={() => void applyTypeChange("keep")}
        onDismiss={() => setPendingType(null)}
      />
    </div>
  );
}

/**
 * ADR-289 — create mode: name · type (with hints) · default · required · reference target ·
 * 「Create more」. One `add_field` per column; the key check is the rename planner's.
 */
export function ColumnCreator({
  table,
  onClose,
}: {
  table: DataTable;
  onClose: () => void;
}) {
  const dt = useDt();
  const { t } = useI18n();
  const write = useWrite();
  const { options: typeOptions, descriptions: typeHints } = useTypeOptions(dt);
  const [key, setKey] = useState("");
  const [keyNonce, setKeyNonce] = useState(0);
  const [type, setType] = useState<DataFieldType>("string");
  const [format, setFormat] = useState<DataField["format"]>(undefined);
  const [defaultText, setDefaultText] = useState("");
  const [defaultError, setDefaultError] = useState<string | null>(null);
  const [required, setRequired] = useState(false);
  const [reference, setReference] = useState<
    { collectionId: string; keyField: string } | undefined
  >(undefined);
  const [createMore, setCreateMore] = useState(false);
  // The key input takes focus when the popover opens (one primary input — autofocus on desktop).
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    rootRef.current
      ?.querySelector<HTMLInputElement>(".datatable-field-key input")
      ?.focus();
  }, []);
  const draft = useMemo<DataField>(
    () => ({
      key: key.trim(),
      type,
      ...(type === "string" && format ? { format } : {}),
      ...(required ? { required: true } : {}),
      ...(type === "reference" && reference ? { reference } : {}),
    }),
    [key, type, format, required, reference],
  );

  const reset = () => {
    setKey("");
    setKeyNonce((n) => n + 1);
    setType("string");
    setFormat(undefined);
    setDefaultText("");
    setDefaultError(null);
    setRequired(false);
    setReference(undefined);
  };

  const create = async () => {
    const next = key.trim();
    if (next === "") {
      globalToast.warning(dt("fieldKeyEmpty"));
      return;
    }
    if (table.schema.some((f) => f.key === next)) {
      globalToast.warning(dt("fieldKeyDup", { key: next }));
      return;
    }
    const coerced = coerceCellValue(type, defaultText);
    if (!coerced.ok) {
      setDefaultError(dt("fieldDefaultInvalid"));
      return;
    }
    const field: DataField = {
      ...draft,
      key: next,
      ...(coerced.value !== null ? { defaultValue: coerced.value } : {}),
    };
    const ok = await write(
      [{ op: "add_field", collectionId: table.id, field }],
      dt("fieldAdded", { key: next }),
    );
    if (!ok) return;
    announceDataPanelStatus(dt("fieldAdded", { key: next }), {
      tone: "success",
    });
    if (createMore) reset();
    else onClose();
  };

  return (
    <div ref={rootRef} className="datatable-field-form" data-mode="create">
      <Section
        id="datatable-column-create"
        title={dt("fieldCreateTitle")}
        collapsible={false}
      >
        <div className="fieldset-row" data-wide>
          <PropertyInput
            key={`key-${keyNonce}`}
            className="datatable-field-key"
            label={dt("fieldName")}
            value={key}
            placeholder={dt("fieldNamePlaceholder")}
            onChange={setKey}
          />
        </div>
        <div className="fieldset-row" data-wide>
          <PropertySelect
            className="datatable-field-type"
            label={dt("fieldType")}
            icon={resolveFieldGlyph(draft)}
            value={type}
            optionValueMode="literal"
            options={typeOptions}
            descriptions={typeHints}
            onChange={(next) => {
              setType(next as DataFieldType);
              setDefaultText("");
              setDefaultError(null);
            }}
          />
        </div>
        {type === "string" ? (
          <FormatSelect value={format} dt={dt} onChange={setFormat} />
        ) : null}
        <div className="fieldset-row" data-wide>
          <FieldValueInput
            className="datatable-field-default"
            field={draft}
            label={dt("fieldDefault")}
            text={defaultText}
            placeholder={dt("rowFormEmpty")}
            error={defaultError}
            onChange={(text) => {
              setDefaultText(text);
              setDefaultError(null);
            }}
            onSubmit={() => void create()}
          />
        </div>
        <div className="fieldset-row" data-wide>
          <PropertySwitch
            label={dt("fieldRequired")}
            isSelected={required}
            onChange={setRequired}
          />
        </div>
        {type === "reference" ? (
          <ReferenceTarget
            reference={reference}
            collectionId={table.id}
            dt={dt}
            onChange={setReference}
          />
        ) : null}
        <div className="fieldset-row" data-wide>
          <PropertySwitch
            className="datatable-field-more"
            label={dt("rowFormCreateMore")}
            labelMode="inline"
            isSelected={createMore}
            onChange={setCreateMore}
          />
        </div>
        <div className="datatable-field-actions">
          <Button className="control-button" onPress={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            className="control-button"
            data-variant="primary"
            onPress={() => void create()}
          >
            {dt("create")}
          </Button>
        </div>
      </Section>
    </div>
  );
}

/**
 * ADR-284 Decision 4 — a reference field's target: the collection its values are keys of and the
 * field of that collection the key matches (its `id`, usually). A view reads the target row's
 * fields by a path through this field (`team.name`).
 */
function ReferenceTarget({
  reference,
  collectionId,
  dt,
  onChange,
}: {
  reference: DataField["reference"];
  collectionId: string;
  dt: (key: string) => string;
  onChange: (reference: { collectionId: string; keyField: string }) => void;
}) {
  const collections = useDataStore((state) => state.collections);
  const targets = [...collections.values()].filter(
    (table) => table.id !== collectionId,
  );
  const targetId = reference?.collectionId;
  const target = targetId ? collections.get(targetId) : undefined;
  const keyFields = (target?.schema ?? []).filter((item) => item.id);
  return (
    <div className="fieldset-row datatable-field-reference">
      <PropertySelect
        label={dt("fieldReferenceCollection")}
        value={reference?.collectionId ?? ""}
        optionValueMode="literal"
        options={[
          ...(reference
            ? []
            : [{ value: "", label: dt("fieldReferenceNone") }]),
          ...targets.map((table) => ({ value: table.id, label: table.name })),
        ]}
        onChange={(collectionId) => {
          const next = collections.get(collectionId);
          if (!next) return;
          // (The target's `id` field when it has one — what a row key usually is.)
          const key = resolveField(next.schema, "id") ?? next.schema[0];
          if (key?.id) onChange({ collectionId: next.id, keyField: key.id });
        }}
      />
      {target ? (
        <PropertySelect
          label={dt("fieldReferenceKey")}
          value={reference?.keyField ?? ""}
          optionValueMode="literal"
          options={keyFields.map((item) => ({
            value: item.id!,
            label: item.key,
          }))}
          onChange={(value) =>
            onChange({ collectionId: target.id, keyField: value })
          }
        />
      ) : null}
    </div>
  );
}
