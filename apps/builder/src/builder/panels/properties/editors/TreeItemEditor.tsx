import { useState, useEffect, useMemo, memo } from "react";
import { Plus, Tag, Binary, PointerOff, FileText, Link2 } from "lucide-react";
import {
  PropertyInput,
  PropertySwitch,
  PropertyCustomId,
  PropertySection,
} from "../../../components";
import { PropertyEditorProps } from "../types/editorTypes";
import { iconProps } from "../../../../utils/ui/uiConstants";
import { PROPERTY_LABELS } from "../../../../utils/ui/labels";
import { useStore } from "../../../stores";
import { ElementUtils } from "../../../../utils/element/elementUtils";
import { generateCustomId } from "../../../utils/idGeneration";
import type { Element } from "../../../../types/core/store.types";

const EMPTY_CHILDREN: Element[] = [];

export const TreeItemEditor = memo(function TreeItemEditor({
  elementId,
  currentProps,
  onUpdate,
}: PropertyEditorProps) {
  // 🚀 Phase 19: Zustand selector 패턴 적용 (불필요한 리렌더링 방지)
  const addElement = useStore((state) => state.addElement);
  // ADR-040: elementsMap/childrenMap O(1) 조회
  const element = useStore((state) => state.elementsMap.get(elementId));
  const rawChildren =
    useStore((state) => state.childrenMap.get(elementId)) ?? EMPTY_CHILDREN;
  const [localPageId, setLocalPageId] = useState<string>("");

  // Get customId from element in store
  const customId = element?.customId || "";

  const updateProp = (key: string, value: unknown) => {
    const updatedProps = {
      [key]: value,
    };
    onUpdate(updatedProps);
  };

  const updateCustomId = (newCustomId: string) => {
    // Update customId in store (not in props)
    const updateElement = useStore.getState().updateElement;
    if (updateElement && elementId) {
      updateElement(elementId, { customId: newCustomId });
    }
  };

  // 페이지 ID 가져오기
  useEffect(() => {
    const { currentPageId } = useStore.getState();
    if (currentPageId) {
      setLocalPageId(currentPageId);
    }
  }, []);

  // TreeItem의 자식 TreeItem들을 찾기
  const childTreeItems = useMemo(() => {
    return rawChildren.filter((child) => child.type === "TreeItem");
  }, [rawChildren]);

  // 새 하위 TreeItem 추가 함수
  const addNewChildTreeItem = async () => {
    try {
      if (!localPageId) {
        alert("페이지 ID를 찾을 수 없습니다. 페이지를 새로고침해주세요.");
        return;
      }

      const newTreeItemIndex = childTreeItems.length || 0;
      const newTreeItemElement = {
        id: ElementUtils.generateId(),
        customId: generateCustomId("TreeItem", useStore.getState().elements),
        page_id: localPageId,
        type: "TreeItem",
        props: {
          title: `Child Item ${newTreeItemIndex + 1}`,
          value: `Child Item ${newTreeItemIndex + 1}`,
          children: ``, // children 속성 추가
          isDisabled: false,
        },
        parent_id: elementId,
      };

      await addElement(newTreeItemElement);
    } catch (err) {
      console.error("Add Child TreeItem error:", err);
      alert("하위 TreeItem 추가 중 오류가 발생했습니다. 다시 시도해주세요.");
    }
  };

  return (
    <>
      {/* Content Section */}
      <PropertySection title="Content">
        <PropertyCustomId
          label="ID"
          value={customId}
          elementId={elementId}
          onChange={updateCustomId}
          placeholder="treeitem_1"
        />

        <PropertyInput
          label={PROPERTY_LABELS.TITLE}
          value={String(currentProps.title || "")}
          onChange={(value) => updateProp("title", value || undefined)}
          icon={Tag}
        />

        <PropertyInput
          label={PROPERTY_LABELS.VALUE}
          value={String(currentProps.value || "")}
          onChange={(value) => updateProp("value", value || undefined)}
          icon={Binary}
        />

        <PropertyInput
          label={PROPERTY_LABELS.TEXT_VALUE}
          value={String(currentProps.textValue || "")}
          onChange={(value) => updateProp("textValue", value || undefined)}
          icon={FileText}
        />

        <PropertyInput
          label={PROPERTY_LABELS.HREF}
          value={String(currentProps.href || "")}
          onChange={(value) => updateProp("href", value || undefined)}
          icon={Link2}
          placeholder="https://example.com"
        />
      </PropertySection>

      {/* State Section */}
      <PropertySection title="State">
        <PropertySwitch
          label={PROPERTY_LABELS.DISABLED}
          isSelected={Boolean(currentProps.isDisabled)}
          onChange={(checked) => updateProp("isDisabled", checked)}
          icon={PointerOff}
        />
      </PropertySection>

      {/* Child TreeItems Section */}
      <PropertySection title="Child TreeItems">
        <div className="tree-item-overview">
          <p className="tree-item-overview-text">
            Child tree items: {childTreeItems.length || 0}
          </p>
          <p className="tree-item-overview-help">
            💡 Select individual child tree items from layer tree to edit their
            properties
          </p>
        </div>

        <div className="tree-item-actions">
          <button
            className="control-button add"
            onClick={addNewChildTreeItem}
            disabled={!localPageId}
          >
            <Plus
              color={iconProps.color}
              strokeWidth={iconProps.strokeWidth}
              size={iconProps.size}
            />
            Add Child TreeItem
          </button>
        </div>
      </PropertySection>
    </>
  );
});
