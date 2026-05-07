import { useMemo, memo } from "react";
import {
  Tag,
  Binary,
  PointerOff,
  SquarePlus,
  Database,
  FileText,
} from "lucide-react";
import {
  PropertyInput,
  PropertySwitch,
  PropertyCustomId,
  PropertySection,
} from "../../../components";
import { PropertyEditorProps } from "../types/editorTypes";
import { PROPERTY_LABELS } from "../../../../utils/ui/labels";
import { useStore } from "../../../stores";
import { ElementUtils } from "../../../../utils/element/elementUtils";
import { iconProps } from "../../../../utils/ui/uiConstants";
import { getDB } from "../../../../lib/db";
import { generateCustomId } from "../../../utils/idGeneration";
import type { Element } from "../../../../types/core/store.types";

const EMPTY_CHILDREN: Element[] = [];

export const ListBoxItemEditor = memo(function ListBoxItemEditor({
  elementId,
  currentProps,
  onUpdate,
}: PropertyEditorProps) {
  // 🚀 Phase 19: Zustand selector 패턴 적용 (불필요한 리렌더링 방지)
  const addElement = useStore((state) => state.addElement);
  const currentPageId = useStore((state) => state.currentPageId);
  const setSelectedElement = useStore((state) => state.setSelectedElement);
  // ADR-040: elementsMap/childrenMap O(1) 조회
  const element = useStore((state) => state.elementsMap.get(elementId));
  const rawChildren =
    useStore((state) => state.childrenMap.get(elementId)) ?? EMPTY_CHILDREN;

  // Get customId from element in store
  const customId = element?.customId || "";

  const updateProp = (key: string, value: unknown) => {
    const updatedProps = {
      [key]: value,
    };
    onUpdate(updatedProps);
  };

  // Field 자식 요소들을 찾기
  const fieldChildren = useMemo(() => {
    return rawChildren.filter((child) => child.type === "Field");
  }, [rawChildren]);

  const hasFieldChildren = fieldChildren.length > 0;

  // Field 자식이 있으면 Field 관리 UI
  if (hasFieldChildren) {
    return (
      <>
        <div className="properties-aria">
          <legend className="fieldset-legend">
            <Database size={iconProps.size} /> Field Management
          </legend>

          <div className="tab-overview">
            <p className="tab-overview-text">
              Total fields: {fieldChildren.length}
            </p>
            <p className="section-overview-help">
              💡 This ListBoxItem uses Field elements for dynamic data rendering
            </p>
          </div>

          {/* Field List */}
          {fieldChildren.length > 0 && (
            <div className="react-aria-ListBox">
              {fieldChildren.map((field) => {
                const fieldProps = field.props as Record<string, unknown>;
                return (
                  <div key={field.id} className="react-aria-ListBoxItem">
                    <span className="tab-title">
                      {String(fieldProps.key || "Unnamed Field")}
                      {fieldProps.type ? ` (${fieldProps.type})` : ""}
                    </span>
                    <button
                      className="tab-edit-button"
                      onClick={() => {
                        setSelectedElement(
                          field.id,
                          fieldProps,
                          fieldProps.style as React.CSSProperties | undefined,
                        );
                      }}
                    >
                      Edit
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Field */}
          <div className="tab-actions">
            <button
              className="control-button add"
              onClick={async () => {
                const pageIdToUse = currentPageId;
                if (!pageIdToUse) {
                  alert(
                    "페이지 ID를 찾을 수 없습니다. 페이지를 새로고침해주세요.",
                  );
                  return;
                }

                const { elements } = useStore.getState();
                const newField: Element = {
                  id: ElementUtils.generateId(),
                  customId: generateCustomId("Field", elements),
                  page_id: pageIdToUse,
                  type: "Field",
                  props: {
                    key: `field${fieldChildren.length + 1}`,
                    label: `Field ${fieldChildren.length + 1}`,
                    type: "string",
                    showLabel: true,
                    visible: true,
                    style: {},
                    className: "",
                  } as Record<string, unknown>,
                  parent_id: elementId,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };

                try {
                  const db = await getDB();
                  const inserted = await db.elements.insert(newField);
                  addElement(inserted);
                  console.log("✅ [IndexedDB] Field created successfully");
                } catch (err) {
                  console.error("❌ [IndexedDB] Failed to create Field:", err);
                  alert(
                    "Field 추가 중 오류가 발생했습니다. 다시 시도해주세요.",
                  );
                }
              }}
            >
              <SquarePlus
                color={iconProps.color}
                strokeWidth={iconProps.strokeWidth}
                size={iconProps.size}
              />
              Add Field
            </button>
          </div>
        </div>
      </>
    );
  }

  // Field 자식이 없으면 기존 정적 아이템 편집 UI
  return (
    <>
      <PropertySection title="Static Item Properties">
        <p className="section-overview-help">
          💡 This is a static ListBoxItem. Add Field elements to enable dynamic
          data rendering.
        </p>
      </PropertySection>

      {/* Content Section */}
      <PropertySection title="Content">
        <PropertyCustomId
          label="ID"
          value={customId}
          elementId={elementId}
          placeholder="listboxitem_1"
        />

        <PropertyInput
          label={PROPERTY_LABELS.LABEL}
          value={String(currentProps.label || "")}
          onChange={(value) => updateProp("label", value || undefined)}
          icon={Tag}
        />

        <PropertyInput
          label={PROPERTY_LABELS.VALUE}
          value={String(currentProps.value || "")}
          onChange={(value) => updateProp("value", value || undefined)}
          icon={Binary}
        />

        <PropertyInput
          label={PROPERTY_LABELS.DESCRIPTION}
          value={String(currentProps.description || "")}
          onChange={(value) => updateProp("description", value || undefined)}
          icon={FileText}
        />

        <PropertyInput
          label={PROPERTY_LABELS.TEXT_VALUE}
          value={String(currentProps.textValue || "")}
          onChange={(value) => updateProp("textValue", value || undefined)}
          icon={Binary}
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

      {/* Add Field Option */}
      <div className="properties-aria">
        <legend className="fieldset-legend">
          <Database size={iconProps.size} /> Convert to Dynamic Item
        </legend>

        <div className="tab-overview">
          <p className="section-overview-help">
            💡 Add Field elements to display dynamic data from API/Database
          </p>
        </div>

        <div className="tab-actions">
          <button
            className="control-button add"
            onClick={async () => {
              const pageIdToUse = currentPageId;
              if (!pageIdToUse) {
                alert(
                  "페이지 ID를 찾을 수 없습니다. 페이지를 새로고침해주세요.",
                );
                return;
              }

              const { elements } = useStore.getState();

              const newField: Element = {
                id: ElementUtils.generateId(),
                customId: generateCustomId("Field", elements),
                page_id: pageIdToUse,
                type: "Field",
                props: {
                  key: "field1",
                  label: "Field 1",
                  type: "string",
                  showLabel: true,
                  visible: true,
                  style: {},
                  className: "",
                } as Record<string, unknown>,
                parent_id: elementId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };

              try {
                const db = await getDB();
                const inserted = await db.elements.insert(newField);
                addElement(inserted);
                console.log("✅ [IndexedDB] Field created successfully");
              } catch (err) {
                console.error("❌ [IndexedDB] Failed to create Field:", err);
                alert("Field 추가 중 오류가 발생했습니다. 다시 시도해주세요.");
              }
            }}
          >
            <SquarePlus
              color={iconProps.color}
              strokeWidth={iconProps.strokeWidth}
              size={iconProps.size}
            />
            Add First Field
          </button>
        </div>
      </div>
    </>
  );
});

export default ListBoxItemEditor;
