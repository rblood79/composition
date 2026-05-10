import { useMemo, useCallback, memo } from "react";
import { AppWindow, Plus, X } from "lucide-react";
import {
  PropertySelect,
  PropertySection,
  PropertyInput,
} from "../../../components";
import { GenericPropertyEditor } from "../generic";
import { PropertyEditorProps } from "../types/editorTypes";
import { iconProps } from "../../../../utils/ui/uiConstants";
import { PROPERTY_LABELS } from "../../../../utils/ui/labels";
import { useStore } from "../../../stores";
import { useCanonicalPropertyElements } from "../hooks/useCanonicalPropertyRead";
import { TabsSpec, type TabItem } from "@composition/specs";
import { addTabItem, removeTabItem, resolvePageId } from "./tabsItemActions";

/**
 * ADR-066: items SSOT 패턴.
 * Tab element는 존재하지 않으며 Tabs.props.items가 단일 진실이다.
 * TabPanel element는 itemId prop으로 items[i].id와 페어링한다.
 */
export const TabsHybridAfterSections = memo(function TabsHybridAfterSections({
  elementId,
  currentProps,
  onUpdate,
}: PropertyEditorProps) {
  const addElement = useStore((state) => state.addElement);
  const removeElement = useStore((state) => state.removeElement);
  const currentPageId = useStore((state) => state.currentPageId);
  const canonicalPropertyElements = useCanonicalPropertyElements();

  const items = useMemo(
    () => (currentProps.items as TabItem[] | undefined) ?? [],
    [currentProps.items],
  );

  const defaultTabOptions = useMemo(
    () =>
      items.map((item) => ({
        value: item.id,
        label: item.title,
      })),
    [items],
  );

  const handleDefaultSelectedKeyChange = useCallback(
    (value: string) => {
      onUpdate({ defaultSelectedKey: value || undefined });
    },
    [onUpdate],
  );

  const handleRenameItem = useCallback(
    (itemId: string, title: string) => {
      const next = items.map((item) =>
        item.id === itemId ? { ...item, title } : item,
      );
      onUpdate({ items: next });
    },
    [items, onUpdate],
  );

  const handleAddItem = useCallback(async () => {
    try {
      const pageIdToUse = await resolvePageId(currentPageId);
      if (!pageIdToUse) {
        alert("페이지 ID를 찾을 수 없습니다. 페이지를 새로고침해주세요.");
        return;
      }
      await addTabItem({
        tabsElementId: elementId,
        pageId: pageIdToUse,
        elements: canonicalPropertyElements,
        items,
        currentProps,
        onUpdate,
        addElement,
      });
    } catch (err) {
      console.error("Add tab item error:", err);
      alert("탭 추가 중 오류가 발생했습니다. 다시 시도해주세요.");
    }
  }, [
    addElement,
    canonicalPropertyElements,
    currentPageId,
    currentProps,
    elementId,
    items,
    onUpdate,
  ]);

  const handleRemoveItem = useCallback(
    async (itemId: string) => {
      try {
        await removeTabItem({
          tabsElementId: elementId,
          itemId,
          elements: canonicalPropertyElements,
          items,
          currentProps,
          onUpdate,
          removeElement,
        });
      } catch (err) {
        console.error("Remove tab item error:", err);
      }
    },
    [
      canonicalPropertyElements,
      currentProps,
      elementId,
      items,
      onUpdate,
      removeElement,
    ],
  );

  return (
    <>
      <PropertySection title="State">
        <PropertySelect
          label={PROPERTY_LABELS.DEFAULT_TAB}
          value={String(currentProps.defaultSelectedKey || "")}
          onChange={handleDefaultSelectedKeyChange}
          options={defaultTabOptions}
          icon={AppWindow}
        />
      </PropertySection>

      <PropertySection title={PROPERTY_LABELS.TAB_MANAGEMENT}>
        <div className="tab-items-list">
          {items.map((item) => (
            <div key={item.id} className="tab-items-row">
              <PropertyInput
                label=""
                value={item.title}
                onChange={(value) => handleRenameItem(item.id, value)}
              />
              <button
                type="button"
                className="control-button remove"
                aria-label="Remove tab"
                disabled={items.length <= 1}
                onClick={() => handleRemoveItem(item.id)}
              >
                <X
                  color={iconProps.color}
                  strokeWidth={iconProps.strokeWidth}
                  size={iconProps.size}
                />
              </button>
            </div>
          ))}
        </div>

        <div className="tab-actions">
          <button
            type="button"
            className="control-button add"
            onClick={handleAddItem}
          >
            <Plus
              color={iconProps.color}
              strokeWidth={iconProps.strokeWidth}
              size={iconProps.size}
            />
            {PROPERTY_LABELS.ADD_TAB}
          </button>
        </div>
      </PropertySection>
    </>
  );
});

export const TabsEditor = memo(function TabsEditor(props: PropertyEditorProps) {
  return (
    <GenericPropertyEditor
      {...props}
      spec={TabsSpec}
      renderAfterSections={(sectionProps) => (
        <TabsHybridAfterSections {...sectionProps} />
      )}
    />
  );
});
