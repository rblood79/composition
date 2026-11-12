import { memo, useCallback, useMemo } from "react";
import { Button as AriaButton } from "react-aria-components/Button";
import { ToggleButton as AriaToggleButton } from "react-aria-components/ToggleButton";
import { ChevronDown, ChevronRight, Minus } from "lucide-react";
import type {
  ItemsManagerField,
  ItemsManagerFieldItemSchema,
} from "@composition/rendering";
import { PropertyInput } from "../../../components/property/PropertyInput";
import { PropertySwitch } from "../../../components/property/PropertySwitch";
import { PropertyIconPicker } from "../../../components/property/PropertyIconPicker";
import { useItemsSource } from "./itemsSource";
import { packHalfRows } from "./fieldEditor";
import { resolveItemEditorIdentities } from "./itemsEditorIdentity";
import { localizeSemanticLabel, useOptionalI18n } from "@/i18n";

import "../editors/styles/propertyEditors.css";
import "./ItemsManager.css";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { useSelectionState } from "../../../components/property/propertySelection";
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
  label,
  onRemove,
  removeLabel,
}: {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  expandLabel: string;
  label: string;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <div className="list-row items-manager-row">
      <div className="list-row__body">
        <AriaToggleButton
          className="list-row__action items-manager-row__expand"
          aria-label={expandLabel}
          isSelected={expanded}
          onChange={onExpandedChange}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </AriaToggleButton>
        <span className="list-row__label">{label}</span>
      </div>
      <div className="list-row__actions">
        <AriaButton
          className="list-row__action"
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
const isHalfSchemaField = (field: ItemsManagerFieldItemSchema) =>
  field.type === "boolean";
function packSchemaRows(
  schema: readonly ItemsManagerFieldItemSchema[],
): ItemsManagerFieldItemSchema[][] {
  return packHalfRows(schema, isHalfSchemaField);
}

interface ItemsManagerProps {
  elementId: string;
  field: ItemsManagerField;
}

/**
 * 행 콜백은 항목 id 를 첫 인자로 받는다 — 부모가 행마다 새 클로저를 만들지 않아 `memo` 가 살고,
 * 한 항목의 한 글자 입력이 다른 행을 다시 그리지 않는다.
 */
interface ItemRowProps {
  itemId: string | number;
  item: Record<string, unknown>;
  schema: ItemsManagerFieldItemSchema[];
  labelKey: string;
  onUpdate: (itemId: string | number, patch: Record<string, unknown>) => void;
  onRemove: (itemId: string | number) => void;
}

const ItemRow = memo(function ItemRow({
  itemId,
  item,
  schema,
  labelKey,
  onUpdate,
  onRemove,
}: ItemRowProps) {
  const i18n = useOptionalI18n();
  // The row's open state is the element's: the editor stays mounted across a selection of the
  // same type, and two elements' items can share a key (an id from a template, a position).
  const [expanded, setExpanded] = useSelectionState(false);
  const label = String(item[labelKey] ?? "—");

  const handleFieldChange = useCallback(
    (key: string, value: unknown) => {
      onUpdate(itemId, { [key]: value });
    },
    [onUpdate, itemId],
  );
  const handleRemove = useCallback(() => onRemove(itemId), [onRemove, itemId]);

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
        onRemove={handleRemove}
        removeLabel={i18n?.t("itemsManager.removeItem") ?? "Remove item"}
      />

      {expanded && (
        <div className="list-row__fields items-manager-row-fields">
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

// ─── ItemsManager ─────────────────────────────────────────────────────────────

export const ItemsManager = memo(function ItemsManager({
  elementId,
  field,
}: ItemsManagerProps) {
  const i18n = useOptionalI18n();
  const itemsKey = field.itemsKey;
  const labelKey = field.labelKey ?? "label";
  const itemLabel = field.itemLabel ?? field.itemTypeName;

  const source = useItemsSource();
  const rawItems = source.useItems(elementId, itemsKey) as Record<
    string,
    unknown
  >[];
  const identities = useMemo(
    () => resolveItemEditorIdentities(rawItems),
    [rawItems],
  );
  // ADR-234 Phase 3 — 작성자가 채운 목록은 목록 틀의 항목 instance 자식이 정본 (캔버스 · Slot "+" 로
  //   편집). items 편집기는 바인딩 목록 전용 — 정적 목록에 `items` 를 쓰면 두 목록이 겹친다.
  const isStaticOwner = source.useIsStaticOwner(elementId);
  const actions = source.useActions(elementId, itemsKey);

  const handleAdd = useCallback(
    () => actions.add(field.defaultItem as Record<string, unknown>),
    [actions, field.defaultItem],
  );
  const handleRemove = useCallback(
    (itemId: string | number) => actions.remove(itemId),
    [actions],
  );
  const handleUpdate = useCallback(
    (itemId: string | number, patch: Record<string, unknown>) =>
      actions.update(itemId, patch),
    [actions],
  );
  const totalCount = rawItems.length;

  // legend = 필드 라벨 + 항목 수 (종전 「Total: N」 문단) — 다른 필드와 같은 fieldset/legend 어법
  const rawLabel = field.label ?? field.itemTypeName;
  const displayLabel = localizeSemanticLabel(i18n, rawLabel);
  if (isStaticOwner) return null;

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
            const identity = identities[index];
            return (
              <ItemRow
                key={identity.key}
                itemId={identity.target}
                item={entry}
                schema={field.itemSchema}
                labelKey={labelKey}
                onUpdate={handleUpdate}
                onRemove={handleRemove}
              />
            );
          })}
        </div>
      )}

      <div className="editor-actions">
        <AriaButton
          className="control-button"
          data-variant="add"
          onPress={handleAdd}
        >
          <AddIcon size={14} />
          {i18n?.t("itemsManager.addItem", {
            type: localizeSemanticLabel(i18n, itemLabel),
          }) ?? `Add ${itemLabel}`}
        </AriaButton>
      </div>
    </fieldset>
  );
});
