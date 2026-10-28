/**
 * ColumnEditorPopover — ADR-288 Decision 2: a column's editor opens under its header (the old
 * `DataTableFieldPanel` body, ADR-212 Phase 3, moved as is). The header's label · chevron open it,
 * the type icon opens it with the type search focused. Esc · a click outside close it (RAC).
 *
 * Name · searchable type list (icon + label) · reference target · required · label · default ·
 * "used by N" (field-level back references) · delete (immediate at 0 uses, else a ConfirmDialog —
 * a RAC Modal above the popover). A type change previews (UX-5) and asks "clear / keep", writing
 * `update_field` + `set_cell` as one DataChange. Every write is `applyDataChange` (HC1); a rename
 * is `update_field { key }` (the reducer moves the rows).
 *
 * G6 수정 12 (사용자 「popover 내에 스타일들이 빌더의 디자인패턴 ui 가 전혀 적용이 안 되었다」): the body
 * is a panel `Section` (title = the column key) with `.fieldset-row` rows of the 7-column grid and
 * the inspector parts — `PropertyInput` (key · label · default) · `PropertySwitch` (required) ·
 * `PropertySelect` (type · reference table · key field — the old in-place search list is gone). The
 * `.section` scope is what lets form-controls · panel-system reach this portal.
 */
import {
  useCallback,
  useEffect,
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
import { FIELD_TYPES, resolveFieldType } from "../utils/fieldTypes";
import { useDataUsageSource } from "../usage/dataUsageSource";
import type { FieldUsageRef } from "../utils/fieldUsage";
import { previewTypeChange, typeChangeToOps } from "../utils/typeChangePreview";
import "./ColumnEditorPopover.css";

const DeleteIcon = ACTION_ICONS.delete;

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
  /** Opened from the type icon: the type search takes focus. */
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
  const { t } = useI18n();
  const dt = useCallback(
    (key: string, params?: Record<string, string | number | boolean>) =>
      t(`datatable.${key}`, params),
    [t],
  );
  const applyDataChange = useDataStore((state) => state.applyDataChange);
  const usage = useDataUsageSource().useFieldUsage(table, field);
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
  dt: (
    key: string,
    params?: Record<string, string | number | boolean>,
  ) => string;
  write: (ops: DataOp[], label?: string) => Promise<boolean>;
  onClose: () => void;
  focus?: "type";
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

  const fieldId = field.id ?? field.key;
  const type = field.type;

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

  const requestTypeChange = (newType: DataFieldType) => {
    if (newType === field.type) return;
    const preview = previewTypeChange(field, newType, rows, field.key);
    if (preview.invalidCount === 0) {
      void patchField({ type: newType });
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
    const ops = typeChangeToOps({
      collectionId,
      field,
      newType: pendingType.newType,
      invalidRowIndexes: pendingType.invalidRowIndexes,
      mode,
      rows,
      fieldKey: field.key,
    });
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
    <Section
      id="datatable-column-editor"
      title={field.key}
      collapsible={false}
      className="datatable-field-form"
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

      {/* Type — the Builder Select (its list is the panel picker: 28 rows · ✓), the trigger shows
          the current type's icon. Opened from the head's type icon, the trigger takes focus. */}
      <div className="fieldset-row" data-wide ref={typeRowRef}>
        <PropertySelect
          className="datatable-field-type"
          label={dt("fieldType")}
          icon={resolveFieldType(type).icon}
          value={type}
          optionValueMode="literal"
          options={FIELD_TYPES.map((ft) => ({
            value: ft.value,
            label: dt(ft.i18n),
          }))}
          onChange={(next) => requestTypeChange(next as DataFieldType)}
        />
      </div>

      {type === "reference" ? (
        <ReferenceTarget
          field={field}
          collectionId={collectionId}
          dt={dt}
          onChange={(reference) => void patchField({ reference })}
        />
      ) : null}

      <div className="fieldset-row" data-wide>
        <PropertySwitch
          label={dt("fieldRequired")}
          isSelected={field.required ?? false}
          onChange={(checked) => void patchField({ required: checked })}
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

      <div className="fieldset-row" data-wide>
        <PropertyInput
          className="datatable-field-default"
          label={dt("fieldDefault")}
          value={
            field.defaultValue === null || field.defaultValue === undefined
              ? ""
              : String(field.defaultValue)
          }
          onChange={(v) => void patchField({ defaultValue: v === "" ? null : v })}
        />
      </div>

      <div className="fieldset-row" data-wide>
        <PropertyFieldset legend={dt("fieldUsage")} className="datatable-field-usage">
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
    </Section>
  );
}

/**
 * ADR-284 Decision 4 — a reference field's target: the collection its values are keys of and the
 * field of that collection the key matches (its `id`, usually). A view reads the target row's
 * fields by a path through this field (`team.name`).
 */
function ReferenceTarget({
  field,
  collectionId,
  dt,
  onChange,
}: {
  field: DataField;
  collectionId: string;
  dt: (key: string) => string;
  onChange: (reference: { collectionId: string; keyField: string }) => void;
}) {
  const collections = useDataStore((state) => state.collections);
  const targets = [...collections.values()].filter(
    (table) => table.id !== collectionId,
  );
  const targetId = field.reference?.collectionId;
  const target = targetId ? collections.get(targetId) : undefined;
  const keyFields = (target?.schema ?? []).filter((item) => item.id);
  return (
    <div className="fieldset-row datatable-field-reference">
      <PropertySelect
        label={dt("fieldReferenceCollection")}
        value={field.reference?.collectionId ?? ""}
        optionValueMode="literal"
        options={[
          ...(field.reference
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
          value={field.reference?.keyField ?? ""}
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
