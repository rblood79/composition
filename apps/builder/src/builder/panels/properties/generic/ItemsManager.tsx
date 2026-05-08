import { memo, useCallback, useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Minus,
} from "lucide-react";
import type {
  ItemsManagerField,
  ItemsManagerFieldItemSchema,
} from "@composition/specs";
import { useStore } from "../../../stores";
import { EVENT_REGISTRY } from "../../../../types/events/events.registry";
import {
  PropertyInput,
  PropertySwitch,
  PropertySelect,
  PropertyIconPicker,
} from "../../../components";
import { useCanonicalPropertyElement } from "../hooks/useCanonicalPropertyRead";

// ADR-055: EVENT_REGISTRY에서 select 옵션 파생
const EVENT_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "", label: "— none —" },
  ...Object.entries(EVENT_REGISTRY).map(([key, def]) => ({
    value: key,
    label: def.label,
  })),
];

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
  const [expanded, setExpanded] = useState(false);
  const label = String(item[labelKey] ?? "—");

  const handleFieldChange = useCallback(
    (key: string, value: unknown) => {
      onUpdate({ [key]: value });
    },
    [onUpdate],
  );

  return (
    <div className="items-manager-row">
      <div className="items-manager-row-header">
        <button
          className="tab-edit-button items-manager-expand"
          aria-label={expanded ? "Collapse" : "Expand"}
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        <span className="tab-title">{label}</span>
        <button
          className="tab-edit-button"
          aria-label="Remove item"
          onClick={onRemove}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {expanded && (
        <div className="items-manager-row-fields">
          {schema.map((schemaField) => {
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
                      handleFieldChange(schemaField.key, iconName || undefined)
                    }
                    onClear={() =>
                      handleFieldChange(schemaField.key, undefined)
                    }
                  />
                );

              case "event-id":
                return (
                  <PropertySelect
                    key={schemaField.key}
                    label={schemaField.label}
                    value={String(currentValue ?? "")}
                    onChange={(value) =>
                      handleFieldChange(
                        schemaField.key,
                        value === "" ? undefined : value,
                      )
                    }
                    options={EVENT_OPTIONS}
                  />
                );

              default:
                return null;
            }
          })}
        </div>
      )}
    </div>
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
    <div className="items-manager-row items-manager-separator-row">
      <div className="items-manager-row-header">
        <Minus size={12} className="items-manager-separator-icon" />
        <span className="tab-title items-manager-separator-label">
          Separator
        </span>
        <button
          className="tab-edit-button"
          aria-label="Remove separator"
          onClick={onRemove}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
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
      <div className="items-manager-row-header items-manager-section-header">
        <button
          className="tab-edit-button items-manager-expand"
          aria-label={expanded ? "Collapse section" : "Expand section"}
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        <span className="tab-title items-manager-section-title">{header}</span>
        <button
          className="tab-edit-button"
          aria-label="Remove section"
          onClick={onRemoveSection}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {expanded && (
        <div className="items-manager-section-body">
          {/* Section header 편집 */}
          <div className="items-manager-row-fields">
            <PropertyInput
              label="Header"
              value={header}
              onChange={(value) =>
                onUpdateSection({ header: value || "Section" })
              }
            />
            {hasSelection && (
              <>
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

          <div className="tab-actions items-manager-section-actions">
            <button className="control-button add" onClick={onAddItem}>
              <Plus size={12} />
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
    (itemId: string) => {
      void useStore.getState().removeItem(elementId, itemsKey, itemId);
    },
    [elementId, itemsKey],
  );

  const handleUpdate = useCallback(
    (itemId: string, patch: Record<string, unknown>) => {
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

  return (
    <div className="children-manager">
      <div className="tab-overview">
        <p className="tab-overview-text">Total: {totalCount}</p>
      </div>

      {rawItems.length > 0 && (
        <div className="tabs-list">
          {rawItems.map((entry) => {
            const entryId = String(entry.id ?? "");

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
                key={entryId}
                itemId={entryId}
                item={entry}
                schema={field.itemSchema}
                labelKey={labelKey}
                onUpdate={(patch) => handleUpdate(entryId, patch)}
                onRemove={() => handleRemove(entryId)}
              />
            );
          })}
        </div>
      )}

      <div className="tab-actions">
        <button className="control-button add" onClick={handleAdd}>
          <Plus size={14} />
          Add {field.itemTypeName}
        </button>
        {allowSections && (
          <button className="control-button add" onClick={handleAddSection}>
            <FolderPlus size={14} />
            Add Section
          </button>
        )}
        {allowSeparators && (
          <button className="control-button add" onClick={handleAddSeparator}>
            <Minus size={14} />
            Add Separator
          </button>
        )}
      </div>
    </div>
  );
});
