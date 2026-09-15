import { memo, useCallback, useMemo, useState, type ReactNode } from "react";
import { Button as AriaButton } from "react-aria-components/Button";
import { ToggleButton as AriaToggleButton } from "react-aria-components/ToggleButton";
import {
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Minus,
  SeparatorHorizontal,
} from "lucide-react";
import type {
  ItemsManagerField,
  ItemsManagerFieldItemSchema,
} from "@composition/specs";
import { useStore } from "../../../stores";
import {
  PropertyInput,
  PropertySwitch,
  PropertySelect,
  PropertyIconPicker,
} from "../../../components";
import { useCanonicalPropertyElement } from "../hooks/useCanonicalPropertyRead";
import { resolveItemEditorIdentities } from "./itemsEditorIdentity";
import { semanticLabelKeys, translateKey, useOptionalI18n } from "@/i18n";

import "../editors/styles/propertyEditors.css";
import "./ItemsManager.css";
import { ACTION_ICONS } from "../../../config/actionIcons";
/** 여러 화면에 공통으로 나오는 액션의 아이콘 정본 (`config/actionIcons.ts`). */
const AddIcon = ACTION_ICONS.add;

/**
 * 목록 행 — Styles 의 Fill · Shadow 레이어 행과 같은 구조 (2026-09-15 사용자 판정):
 * [본문 28 (pad 4): [펼침 토글 20][라벨]] [액션 그룹 28: [제거 20 (Minus)]]. 종전엔 CSS 가 한 줄도
 * 없어 (`.items-manager-row` · `.editor-item-*` 정의 0) 브라우저 기본 글자 크기로 그려졌다.
 */
function ListRow({
  expanded,
  onExpandedChange,
  expandLabel,
  leading,
  label,
  onRemove,
  removeLabel,
  className,
}: {
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  expandLabel?: string;
  /** 펼침 토글 대신 놓는 정적 표지 (Separator 의 ―) */
  leading?: ReactNode;
  label: string;
  onRemove: () => void;
  removeLabel: string;
  className?: string;
}) {
  return (
    <div className={`items-manager-row ${className ?? ""}`}>
      <div className="items-manager-row__body">
        {onExpandedChange ? (
          <AriaToggleButton
            className="items-manager-row__action items-manager-row__expand"
            aria-label={expandLabel}
            isSelected={Boolean(expanded)}
            onChange={onExpandedChange}
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </AriaToggleButton>
        ) : (
          <span className="items-manager-row__action items-manager-row__mark">
            {leading}
          </span>
        )}
        <span className="items-manager-row__label">{label}</span>
      </div>
      <div className="items-manager-row__actions">
        <AriaButton
          className="items-manager-row__action"
          aria-label={removeLabel}
          onPress={onRemove}
        >
          <Minus size={12} />
        </AriaButton>
      </div>
    </div>
  );
}

/** 펼친 행의 필드 — 텍스트 · 아이콘은 전폭, 스위치는 반폭 짝 (GenericFieldRenderer 와 같은 격자) */
function packSchemaRows(
  schema: readonly ItemsManagerFieldItemSchema[],
): ItemsManagerFieldItemSchema[][] {
  const rows: ItemsManagerFieldItemSchema[][] = [];
  for (const field of schema) {
    const half = field.type === "boolean";
    const last = rows[rows.length - 1];
    if (half && last && last.length === 1 && last[0]!.type === "boolean") {
      last.push(field);
    } else {
      rows.push([field]);
    }
  }
  return rows;
}

const SELECTION_MODE_OPTIONS: ReadonlyArray<{ value: string; label: string }> =
  [
    { value: "", label: "— none —" },
    { value: "none", label: "None" },
    { value: "single", label: "Single" },
    { value: "multiple", label: "Multiple" },
  ];

interface ItemsManagerProps {
  elementId: string;
  field: ItemsManagerField;
}

interface ItemRowProps {
  itemId: string;
  item: Record<string, unknown>;
  schema: ItemsManagerFieldItemSchema[];
  labelKey: string;
  onUpdate: (patch: Record<string, unknown>) => void;
  onRemove: () => void;
}

const ItemRow = memo(function ItemRow({
  itemId: _itemId,
  item,
  schema,
  labelKey,
  onUpdate,
  onRemove,
}: ItemRowProps) {
  const i18n = useOptionalI18n();
  const [expanded, setExpanded] = useState(false);
  const label = String(item[labelKey] ?? "—");

  const handleFieldChange = useCallback(
    (key: string, value: unknown) => {
      onUpdate({ [key]: value });
    },
    [onUpdate],
  );

  return (
    <>
      <ListRow
        expanded={expanded}
        onExpandedChange={setExpanded}
        expandLabel={
          i18n?.t(expanded ? "itemsManager.collapse" : "itemsManager.expand") ??
          (expanded ? "Collapse" : "Expand")
        }
        label={label}
        onRemove={onRemove}
        removeLabel={i18n?.t("itemsManager.removeItem") ?? "Remove item"}
      />

      {expanded && (
        <div className="items-manager-row-fields">
          {packSchemaRows(schema).map((row) => (
            <div
              key={row.map((f) => f.key).join("|")}
              className="fieldset-row"
              data-wide={
                row.length === 1 && row[0]!.type !== "boolean"
                  ? "true"
                  : undefined
              }
            >
              {row.map((schemaField) => {
                const currentValue = item[schemaField.key];

                switch (schemaField.type) {
                  case "string":
                    return (
                      <PropertyInput
                        key={schemaField.key}
                        label={schemaField.label}
                        value={String(currentValue ?? "")}
                        onChange={(value) =>
                          handleFieldChange(
                            schemaField.key,
                            value === "" ? undefined : value,
                          )
                        }
                      />
                    );

                  case "boolean":
                    return (
                      <PropertySwitch
                        key={schemaField.key}
                        label={schemaField.label}
                        isSelected={Boolean(currentValue)}
                        onChange={(checked) =>
                          handleFieldChange(schemaField.key, checked)
                        }
                      />
                    );

                  case "icon":
                    return (
                      <PropertyIconPicker
                        key={schemaField.key}
                        label={schemaField.label}
                        value={currentValue as string | undefined}
                        onChange={(iconName) =>
                          handleFieldChange(
                            schemaField.key,
                            iconName || undefined,
                          )
                        }
                        onClear={() =>
                          handleFieldChange(schemaField.key, undefined)
                        }
                      />
                    );

                  default:
                    return null;
                }
              })}
            </div>
          ))}
        </div>
      )}
    </>
  );
});

// ─── SeparatorRow ──────────────────────────────────────────────────────────────

interface SeparatorRowProps {
  separatorId: string;
  onRemove: () => void;
}

const SeparatorRow = memo(function SeparatorRow({
  separatorId: _separatorId,
  onRemove,
}: SeparatorRowProps) {
  return (
    <ListRow
      className="items-manager-separator-row"
      leading={<Minus size={12} />}
      label="Separator"
      onRemove={onRemove}
      removeLabel="Remove separator"
    />
  );
});

// ─── SectionRow ───────────────────────────────────────────────────────────────

interface SectionRowProps {
  sectionId: string;
  section: Record<string, unknown>;
  schema: ItemsManagerFieldItemSchema[];
  labelKey: string;
  hasSelection: boolean;
  defaultItem: Record<string, unknown>;
  itemTypeName: string;
  onUpdateSection: (patch: Record<string, unknown>) => void;
  onRemoveSection: () => void;
  onAddItem: () => void;
  onUpdateItem: (itemId: string, patch: Record<string, unknown>) => void;
  onRemoveItem: (itemId: string) => void;
}

const SectionRow = memo(function SectionRow({
  sectionId: _sectionId,
  section,
  schema,
  labelKey,
  hasSelection,
  itemTypeName,
  onUpdateSection,
  onRemoveSection,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
}: SectionRowProps) {
  const [expanded, setExpanded] = useState(true);
  const header = String(section.header ?? "Section");
  const sectionItems = Array.isArray(section.items)
    ? (section.items as Record<string, unknown>[])
    : [];

  return (
    <div className="items-manager-section-row">
      <ListRow
        className="items-manager-section-header"
        expanded={expanded}
        onExpandedChange={setExpanded}
        expandLabel={expanded ? "Collapse section" : "Expand section"}
        label={header}
        onRemove={onRemoveSection}
        removeLabel="Remove section"
      />

      {expanded && (
        <div className="items-manager-section-body">
          {/* Section header 편집 */}
          <div className="items-manager-row-fields">
            <div className="fieldset-row" data-wide="true">
              <PropertyInput
                label="Header"
                value={header}
                onChange={(value) =>
                  onUpdateSection({ header: value || "Section" })
                }
              />
            </div>
            {hasSelection && (
              <>
                <div className="fieldset-row">
                  <PropertySelect
                    label="Selection Mode"
                    value={String(section.selectionMode ?? "")}
                    onChange={(value) =>
                      onUpdateSection({
                        selectionMode: value === "" ? undefined : value,
                      })
                    }
                    options={SELECTION_MODE_OPTIONS}
                  />
                </div>
                <div className="fieldset-row" data-wide="true">
                  <PropertyInput
                    label="Default Selected Keys"
                    value={
                      Array.isArray(section.defaultSelectedKeys)
                        ? (section.defaultSelectedKeys as string[]).join(", ")
                        : ""
                    }
                    onChange={(value) =>
                      onUpdateSection({
                        defaultSelectedKeys:
                          value === ""
                            ? undefined
                            : value.split(",").map((s) => s.trim()),
                      })
                    }
                  />
                </div>
              </>
            )}
          </div>

          {/* Section 내부 items */}
          {sectionItems.length > 0 && (
            <div className="items-manager-section-items">
              {sectionItems.map((item) => {
                const itemId = String(item.id ?? "");
                return (
                  <ItemRow
                    key={itemId}
                    itemId={itemId}
                    item={item}
                    schema={schema}
                    labelKey={labelKey}
                    onUpdate={(patch) => onUpdateItem(itemId, patch)}
                    onRemove={() => onRemoveItem(itemId)}
                  />
                );
              })}
            </div>
          )}

          <div className="editor-actions items-manager-section-actions">
            <button
              className="control-button"
              data-variant="add"
              onClick={onAddItem}
            >
              <AddIcon size={14} />
              Add {itemTypeName}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

// ─── ItemsManager ─────────────────────────────────────────────────────────────

const EMPTY_ITEMS: Record<string, unknown>[] = [];

export const ItemsManager = memo(function ItemsManager({
  elementId,
  field,
}: ItemsManagerProps) {
  const i18n = useOptionalI18n();
  const itemsKey = field.itemsKey;
  const labelKey = field.labelKey ?? "label";
  const allowSections = field.allowSections ?? false;
  const allowSeparators = field.allowSeparators ?? false;
  const sectionHasSelection = field.sectionHasSelection ?? false;

  const element = useCanonicalPropertyElement(elementId);
  const rawItems = useMemo(() => {
    const val = (element?.props as Record<string, unknown> | undefined)?.[
      itemsKey
    ];
    return Array.isArray(val)
      ? (val as Record<string, unknown>[])
      : EMPTY_ITEMS;
  }, [element, itemsKey]);
  const identities = useMemo(
    () => resolveItemEditorIdentities(rawItems),
    [rawItems],
  );

  const handleAdd = useCallback(() => {
    void useStore
      .getState()
      .addItem(
        elementId,
        itemsKey,
        field.defaultItem as Record<string, unknown>,
      );
  }, [elementId, itemsKey, field.defaultItem]);

  const handleAddSection = useCallback(() => {
    void useStore.getState().addSection(elementId, itemsKey);
  }, [elementId, itemsKey]);

  const handleAddSeparator = useCallback(() => {
    void useStore.getState().addSeparator(elementId, itemsKey);
  }, [elementId, itemsKey]);

  const handleRemove = useCallback(
    (itemId: string | number) => {
      void useStore.getState().removeItem(elementId, itemsKey, itemId);
    },
    [elementId, itemsKey],
  );

  const handleUpdate = useCallback(
    (itemId: string | number, patch: Record<string, unknown>) => {
      void useStore.getState().updateItem(elementId, itemsKey, itemId, patch);
    },
    [elementId, itemsKey],
  );

  const handleAddItemToSection = useCallback(
    (sectionId: string) => {
      void useStore
        .getState()
        .addItemToSection(
          elementId,
          itemsKey,
          sectionId,
          field.defaultItem as Record<string, unknown>,
        );
    },
    [elementId, itemsKey, field.defaultItem],
  );

  const handleUpdateItemInSection = useCallback(
    (sectionId: string, itemId: string, patch: Record<string, unknown>) => {
      void useStore
        .getState()
        .updateItemInSection(elementId, itemsKey, sectionId, itemId, patch);
    },
    [elementId, itemsKey],
  );

  const handleRemoveItemFromSection = useCallback(
    (sectionId: string, itemId: string) => {
      void useStore
        .getState()
        .removeItemFromSection(elementId, itemsKey, sectionId, itemId);
    },
    [elementId, itemsKey],
  );

  // 총 항목 수 계산 (section 내 items 포함)
  const totalCount = rawItems.reduce((acc, entry) => {
    if (entry.type === "section" && Array.isArray(entry.items)) {
      return acc + (entry.items as unknown[]).length;
    }
    if (entry.type === "separator") return acc;
    return acc + 1;
  }, 0);

  // legend = 필드 라벨 + 항목 수 (종전 「Total: N」 문단) — 다른 필드와 같은 fieldset/legend 어법
  const rawLabel = field.label ?? field.itemTypeName;
  const displayLabel = i18n
    ? translateKey(i18n.t, semanticLabelKeys[rawLabel] ?? rawLabel, rawLabel)
    : rawLabel;
  return (
    <fieldset className="properties-aria items-manager">
      <legend className="fieldset-legend">
        {displayLabel}
        <span
          className="items-manager__count"
          aria-label={
            i18n?.t("itemsManager.total", { count: totalCount }) ??
            `Total: ${totalCount}`
          }
        >
          {totalCount}
        </span>
      </legend>

      {rawItems.length > 0 && (
        <div className="items-manager__list">
          {rawItems.map((entry, index) => {
            const entryId = String(entry.id ?? "");
            const identity = identities[index];

            // Section 엔트리
            if (entry.type === "section") {
              return (
                <SectionRow
                  key={entryId}
                  sectionId={entryId}
                  section={entry}
                  schema={field.itemSchema}
                  labelKey={labelKey}
                  hasSelection={sectionHasSelection}
                  defaultItem={field.defaultItem as Record<string, unknown>}
                  itemTypeName={field.itemTypeName}
                  onUpdateSection={(patch) => handleUpdate(entryId, patch)}
                  onRemoveSection={() => handleRemove(entryId)}
                  onAddItem={() => handleAddItemToSection(entryId)}
                  onUpdateItem={(itemId, patch) =>
                    handleUpdateItemInSection(entryId, itemId, patch)
                  }
                  onRemoveItem={(itemId) =>
                    handleRemoveItemFromSection(entryId, itemId)
                  }
                />
              );
            }

            // Separator 엔트리
            if (entry.type === "separator") {
              return (
                <SeparatorRow
                  key={entryId}
                  separatorId={entryId}
                  onRemove={() => handleRemove(entryId)}
                />
              );
            }

            // 일반 item 엔트리 (type 미지정 포함)
            return (
              <ItemRow
                key={identity.key}
                itemId={identity.key}
                item={entry}
                schema={field.itemSchema}
                labelKey={labelKey}
                onUpdate={(patch) => handleUpdate(identity.target, patch)}
                onRemove={() => handleRemove(identity.target)}
              />
            );
          })}
        </div>
      )}

      <div className="editor-actions">
        <button
          className="control-button"
          data-variant="add"
          onClick={handleAdd}
        >
          <AddIcon size={14} />
          {i18n?.t("itemsManager.addItem", {
            type:
              field.itemTypeName === "ChartRow"
                ? i18n.t("chart.row")
                : field.itemTypeName,
          }) ?? `Add ${field.itemTypeName}`}
        </button>
        {allowSections && (
          <button
            className="control-button"
            data-variant="add"
            onClick={handleAddSection}
          >
            <FolderPlus size={14} />
            Add Section
          </button>
        )}
        {allowSeparators && (
          <button
            className="control-button"
            data-variant="add"
            onClick={handleAddSeparator}
          >
            <SeparatorHorizontal size={14} />
            Add Separator
          </button>
        )}
      </div>
    </fieldset>
  );
});
