/**
 * DataTableFieldPanel — 편집기 옆에 스냅되는 필드 편집 패널 (ADR-212 Phase 3).
 *
 * 대상은 `dataTableEditorStore.fieldPanel` (헤더 열 라벨 클릭 → 그 필드 편집). 새 필드 생성은
 * 격자 헤더 `+` 인라인 입력이 담당하고, 이 패널은 기존 필드 편집 전용이다. 이름 ·
 * 검색 가능한 타입 목록 (아이콘+라벨, Y7) · required · default · label · "사용처 N" (필드 단위
 * 152 역참조) · 삭제 (사용처 0 이면 즉시, 아니면 ConfirmDialog). 타입 변경은 미리보기 (UX-5) 로
 * "비움/유지" 를 물어 `update_field` + `set_cell` 을 한 DataChange 로 묶는다. 쓰기는 전부
 * `applyDataChange` (HC1) — rename 은 `update_field { key }` (152 적용기가 행도 옮긴다).
 */
import { useCallback, useMemo, useState } from "react";
import {
  Braces,
  Calendar,
  CalendarClock,
  Columns3,
  Hash,
  Image as ImageIcon,
  Link as LinkIcon,
  List,
  Mail,
  ToggleLeft,
  Type as TypeIcon,
  type LucideIcon,
} from "lucide-react";
import type { DataOp } from "@composition/shared";
import { Button } from "react-aria-components/Button";
import { ListBox, ListBoxItem } from "react-aria-components/ListBox";
import { getAiToolReadModel } from "../../../services/ai/tools/canonicalToolReadModel";
import { useI18n } from "../../../i18n";
import type {
  DataField,
  DataFieldType,
} from "../../../types/builder/data.types";
import { iconProps, iconSmall } from "../../../utils/ui/uiConstants";
import { ACTION_ICONS } from "../../config/actionIcons";
import { ConfirmDialog } from "../../components/overlay/ConfirmDialog";
import { PanelContents, PanelHeader } from "../../components";
import { useStore } from "../../stores";
import { useDataStore } from "../../stores/data";
import { globalToast } from "../../stores/toast";
import { announceDataPanelStatus } from "./stores/dataPanelStatusStore";
import {
  useDataTableEditorStore,
  useDataTableFieldPanel,
} from "./stores/dataTableEditorStore";
import { resolveFieldUsage } from "./utils/fieldUsage";
import { previewTypeChange, typeChangeToOps } from "./utils/typeChangePreview";
import type { PanelProps } from "../core/types";
import "./DataTableFieldPanel.css";

const DeleteIcon = ACTION_ICONS.delete;

const FIELD_TYPES: { value: DataFieldType; icon: LucideIcon; i18n: string }[] =
  [
    { value: "string", icon: TypeIcon, i18n: "types.string" },
    { value: "number", icon: Hash, i18n: "types.number" },
    { value: "boolean", icon: ToggleLeft, i18n: "types.boolean" },
    { value: "date", icon: Calendar, i18n: "types.date" },
    { value: "datetime", icon: CalendarClock, i18n: "types.dateTime" },
    { value: "email", icon: Mail, i18n: "types.email" },
    { value: "url", icon: LinkIcon, i18n: "types.url" },
    { value: "image", icon: ImageIcon, i18n: "types.image" },
    { value: "array", icon: List, i18n: "types.array" },
    { value: "object", icon: Braces, i18n: "types.object" },
  ];

interface PendingTypeChange {
  newType: DataFieldType;
  total: number;
  invalidRowIndexes: number[];
}

export function DataTableFieldPanel(_props: PanelProps) {
  const { t } = useI18n();
  const dt = (
    key: string,
    params?: Record<string, string | number | boolean>,
  ) => t(`datatable.${key}`, params);
  const target = useDataTableFieldPanel();
  const closeFieldPanel = useDataTableEditorStore(
    (state) => state.closeFieldPanel,
  );
  const applyDataChange = useDataStore((state) => state.applyDataChange);
  const collection = useDataStore((state) =>
    target ? state.collections.get(target.collectionId) : undefined,
  );
  const elements = useStore((state) => state.elements);

  const field = useMemo<DataField | null>(() => {
    if (!target?.fieldId || !collection) return null;
    return (
      collection.schema.find(
        (f) => f.id === target.fieldId || f.key === target.fieldId,
      ) ?? null
    );
  }, [target, collection]);

  const usage = useMemo(() => {
    void elements; // 요소가 바뀌면 다시 센다 (읽기는 getAiToolReadModel 경유)
    if (!collection || !field) return [];
    return resolveFieldUsage(getAiToolReadModel().elements, collection, field);
  }, [collection, field, elements]);

  const write = useCallback(
    async (ops: DataOp[], label?: string) => {
      if (ops.length === 0 || !collection) return false;
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
    [applyDataChange, collection],
  );

  const title = field ? field.key : dt("fieldPanel");

  return (
    <div className="panel datatable-field-panel">
      <PanelHeader
        icon={<Columns3 size={iconProps.size} />}
        title={title}
        panelId="datatableField"
        onClose={closeFieldPanel}
      />
      <PanelContents>
        {collection && field ? (
          <FieldForm
            key={field.id ?? field.key}
            collectionId={collection.id}
            existingKeys={collection.schema.map((f) => f.key)}
            rows={collection.mockData}
            field={field}
            usage={usage}
            dt={dt}
            write={write}
            onClose={closeFieldPanel}
          />
        ) : (
          <div className="datatable-field-empty">{dt("fieldPanelEmpty")}</div>
        )}
      </PanelContents>
    </div>
  );
}

interface FieldFormProps {
  collectionId: string;
  existingKeys: string[];
  rows: readonly Record<string, unknown>[];
  field: DataField;
  usage: ReturnType<typeof resolveFieldUsage>;
  dt: (
    key: string,
    params?: Record<string, string | number | boolean>,
  ) => string;
  write: (ops: DataOp[], label?: string) => Promise<boolean>;
  onClose: () => void;
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
}: FieldFormProps) {
  const [keyDraft, setKeyDraft] = useState(field.key);
  const [typeFilter, setTypeFilter] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingType, setPendingType] = useState<PendingTypeChange | null>(
    null,
  );

  const fieldId = field.id ?? field.key;
  const type = field.type;
  const filteredTypes = useMemo(() => {
    const q = typeFilter.trim().toLowerCase();
    if (q === "") return FIELD_TYPES;
    return FIELD_TYPES.filter(
      (ft) => ft.value.includes(q) || dt(ft.i18n).toLowerCase().includes(q),
    );
  }, [typeFilter, dt]);

  const commitKey = async () => {
    const next = keyDraft.trim();
    if (next === field.key) return;
    if (next === "") {
      globalToast.warning(dt("fieldKeyEmpty"));
      setKeyDraft(field.key);
      return;
    }
    if (existingKeys.includes(next)) {
      globalToast.warning(dt("fieldKeyDup", { key: next }));
      setKeyDraft(field.key);
      return;
    }
    const ok = await write(
      [
        {
          op: "update_field",
          collectionId,
          fieldId,
          patch: { key: next },
        },
      ],
      dt("fieldRenamed", { from: field.key, to: next }),
    );
    if (ok)
      announceDataPanelStatus(
        dt("fieldRenamed", { from: field.key, to: next }),
      );
  };

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
    <div className="datatable-field-form">
      <fieldset className="properties-aria datatable-field-key">
        <legend className="fieldset-legend">{dt("fieldName")}</legend>
        <input
          type="text"
          className="datatable-field-input"
          value={keyDraft}
          spellCheck={false}
          onChange={(e) => setKeyDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void commitKey();
            }
          }}
          onBlur={() => void commitKey()}
        />
      </fieldset>

      <fieldset className="properties-aria datatable-field-type">
        <legend className="fieldset-legend">{dt("fieldType")}</legend>
        <input
          type="text"
          className="datatable-field-input datatable-field-type-search"
          placeholder={dt("fieldTypeSearch")}
          aria-label={dt("fieldTypeSearch")}
          spellCheck={false}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        />
        <ListBox
          className="datatable-field-type-list"
          aria-label={dt("fieldType")}
          selectionMode="single"
          selectedKeys={[type]}
          onSelectionChange={(keys) => {
            const next = [...(keys as Set<string>)][0] as DataFieldType;
            if (next) requestTypeChange(next);
          }}
        >
          {filteredTypes.map((ft) => {
            const Icon = ft.icon;
            return (
              <ListBoxItem
                key={ft.value}
                id={ft.value}
                textValue={dt(ft.i18n)}
                className="datatable-field-type-item"
              >
                <Icon size={iconSmall.size} />
                <span>{dt(ft.i18n)}</span>
              </ListBoxItem>
            );
          })}
        </ListBox>
      </fieldset>

      <fieldset className="properties-aria datatable-field-flags">
        <legend className="fieldset-legend">{dt("fieldRequired")}</legend>
        <label className="datatable-field-check">
          <input
            type="checkbox"
            checked={field.required ?? false}
            onChange={(e) => void patchField({ required: e.target.checked })}
          />
          <span>{dt("fieldRequired")}</span>
        </label>
      </fieldset>

      <fieldset className="properties-aria datatable-field-label">
        <legend className="fieldset-legend">{dt("fieldLabel")}</legend>
        <input
          type="text"
          className="datatable-field-input"
          defaultValue={field.label ?? ""}
          key={`label-${field.id ?? field.key}`}
          onBlur={(e) => {
            const v = e.target.value;
            if (v !== (field.label ?? ""))
              void patchField({ label: v === "" ? null : v });
          }}
        />
      </fieldset>

      <fieldset className="properties-aria datatable-field-default">
        <legend className="fieldset-legend">{dt("fieldDefault")}</legend>
        <input
          type="text"
          className="datatable-field-input"
          defaultValue={
            field.defaultValue === null || field.defaultValue === undefined
              ? ""
              : String(field.defaultValue)
          }
          key={`def-${field.id ?? field.key}`}
          onBlur={(e) => {
            const v = e.target.value;
            void patchField({ defaultValue: v === "" ? null : v });
          }}
        />
      </fieldset>

      <div className="datatable-field-usage">
        {usage.length > 0
          ? dt("fieldUsedBy", { count: usage.length })
          : dt("fieldUsedByNone")}
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
      />
    </div>
  );
}

export default DataTableFieldPanel;
