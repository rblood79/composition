import { useState, memo } from "react";
import type { ColumnElementProps } from "../../../../types/builder/unified.types";
import { useStore } from "../../../stores";
import {
  PropertySelect,
  PropertyInput,
  PropertyCustomId,
  PropertySection,
} from "../../../components";
import { PropertyEditorProps } from "../types/editorTypes";
import { iconProps } from "../../../../utils/ui/uiConstants";
import { Table, Pin, SquarePlus, Trash, Tag, Type } from "lucide-react";
import { ElementUtils } from "../../../../utils/element/elementUtils";
import { PROPERTY_LABELS } from "../../../../utils/ui/labels";
import { generateCustomId } from "../../../utils/idGeneration";
import {
  useCanonicalPropertyChildren,
  useCanonicalPropertyElement,
  useCanonicalPropertyElements,
} from "../hooks/useCanonicalPropertyRead";

interface TableHeaderElementProps {
  variant?: "default" | "dark" | "light" | "bordered";
  sticky?: boolean;
}

interface TableHeaderLookupNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  parent_id?: string | null;
}

interface TableHeaderElementPayload {
  id: string;
  type: string;
  props: Record<string, unknown>;
  parent_id: string;
  page_id: string;
  customId: string;
  created_at: string;
  updated_at: string;
}

function getChildElements(
  elements: readonly TableHeaderLookupNode[],
  parentId: string,
) {
  return elements.filter((element) => element.parent_id === parentId);
}

// interface TableHeaderEditorProps {
//     // element: Element;
//     // onChange: (updates: Partial<Element>) => void;
// }

export const TableHeaderEditor = memo(function TableHeaderEditor({
  elementId,
  currentProps,
  onUpdate,
}: PropertyEditorProps) {
  const element = useCanonicalPropertyElement(elementId);
  const rawChildren = useCanonicalPropertyChildren(elementId);
  const canonicalPropertyElements = useCanonicalPropertyElements();
  const tableElement = useCanonicalPropertyElement(element?.parent_id ?? "");
  const addElement = useStore((state) => state.addElement);
  const removeElement = useStore((state) => state.removeElement);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnLabel, setNewColumnLabel] = useState("");
  const [newColumnKey, setNewColumnKey] = useState("");

  // Get customId from element in store
  const customId = element?.customId || "";

  if (!element || !element.id) {
    return (
      <div className="p-4 text-center text-gray-500">
        TableHeader 요소를 선택하세요
      </div>
    );
  }

  const updateProps = (newProps: Partial<TableHeaderElementProps>) => {
    onUpdate({
      ...newProps,
    });
  };

  // 현재 테이블 헤더의 컬럼들 찾기
  const columns = rawChildren.filter((el) => el.type === "Column");

  // 컬럼 추가 함수
  const addColumn = async () => {
    if (!newColumnLabel.trim() || !newColumnKey.trim() || !tableElement) return;

    try {
      const columnId = ElementUtils.generateId();

      // 먼저 모든 새 요소들을 준비
      const newColumnElement: TableHeaderElementPayload = {
        id: columnId,
        customId: generateCustomId("Column", canonicalPropertyElements),
        type: "Column",
        props: {
          key: newColumnKey.trim(),
          children: newColumnLabel.trim(),
          isRowHeader: false,
          allowsSorting: true,
          enableResizing: true,
          width: 150,
        },
        parent_id: elementId, // TableHeader ID
        page_id: element.page_id!,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // TableBody의 모든 Row 찾기
      const tableChildren = getChildElements(
        canonicalPropertyElements,
        tableElement.id,
      );
      const tableBodyElement = tableChildren.find(
        (el) => el.type === "TableBody",
      );

      const newCellElements: TableHeaderElementPayload[] = [];
      if (tableBodyElement) {
        const rows = getChildElements(
          canonicalPropertyElements,
          tableBodyElement.id,
        ).filter((el) => el.type === "Row");

        // Track all elements for unique ID generation
        const allElementsSoFar = [
          ...canonicalPropertyElements,
          newColumnElement,
        ];

        for (const row of rows) {
          const cellId = ElementUtils.generateId();
          const newCellElement: TableHeaderElementPayload = {
            id: cellId,
            customId: generateCustomId("Cell", allElementsSoFar),
            type: "Cell",
            props: {
              children: "",
            },
            parent_id: row.id,
            page_id: element.page_id!,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          newCellElements.push(newCellElement);
          allElementsSoFar.push(newCellElement);
        }
      }

      // 스토어에 모든 요소 추가 (IndexedDB persistence 는 addElement 안에서 처리)
      const allNewElements = [newColumnElement, ...newCellElements];
      allNewElements.forEach((element) => {
        void addElement(element);
      });

      // 폼 초기화
      setNewColumnLabel("");
      setNewColumnKey("");
      setIsAddingColumn(false);

      console.log(
        "✅ 헤더에서 컬럼 추가 완료:",
        newColumnLabel,
        `(key: ${newColumnKey}, 컬럼 1개 + 셀 ${newCellElements.length}개)`,
      );
    } catch (error) {
      console.error("컬럼 추가 중 오류:", error);
    }
  };

  // 컬럼 삭제 함수
  const deleteColumn = async (columnId: string) => {
    try {
      await removeElement(columnId);
      console.log("✅ 헤더에서 컬럼 삭제 완료:", columnId);
    } catch (error) {
      console.error("컬럼 삭제 중 오류:", error);
    }
  };

  return (
    <div className="component-props">
      <PropertySection title={PROPERTY_LABELS.TABLE_HEADER_PROPERTIES}>
        {/* Custom ID */}
        <PropertyCustomId
          label="ID"
          value={customId}
          elementId={elementId}
          placeholder="tableheader_1"
        />

        {/* Header Info */}
        <div className="tab-overview">
          <p className="tab-overview-text">
            Total columns: {columns.length || 0}
          </p>
          <p className="section-overview-help">
            💡 Configure table header appearance and behavior
          </p>
        </div>

        {/* Header Variant */}
        <PropertySelect
          label={PROPERTY_LABELS.HEADER_STYLE}
          value={
            (currentProps as TableHeaderElementProps)?.variant || "default"
          }
          options={[
            { value: "default", label: PROPERTY_LABELS.HEADER_STYLE_DEFAULT },
            { value: "dark", label: "Dark" },
            { value: "light", label: "Light" },
            { value: "bordered", label: "Bordered" },
          ]}
          onChange={(key) =>
            updateProps({
              variant: key as "default" | "dark" | "light" | "bordered",
            })
          }
          icon={Table}
        />

        {/* Sticky Header */}
        <PropertySelect
          label={PROPERTY_LABELS.STICKY_HEADER}
          value={
            (currentProps as TableHeaderElementProps)?.sticky ? "true" : "false"
          }
          options={[
            { value: "false", label: "Normal" },
            { value: "true", label: "Fixed to Top" },
          ]}
          onChange={(key) => updateProps({ sticky: key === "true" })}
          icon={Pin}
        />
      </PropertySection>

      <PropertySection title={PROPERTY_LABELS.COLUMN_MANAGEMENT}>
        {/* 컬럼 개수 표시 */}
        <div className="tab-overview">
          <p className="tab-overview-text">
            Total columns: {columns.length || 0}
          </p>
          <p className="section-overview-help">
            💡 Add, edit, and manage table columns
          </p>
        </div>

        {/* 컬럼 입력 필드 */}
        {isAddingColumn && (
          <div className="space-y-2">
            <PropertyInput
              label={PROPERTY_LABELS.DATA_KEY}
              value={newColumnKey}
              onChange={setNewColumnKey}
              placeholder="Data field name (e.g. id, name)"
              icon={Tag}
            />
            <PropertyInput
              label={PROPERTY_LABELS.COLUMN_TITLE}
              value={newColumnLabel}
              onChange={setNewColumnLabel}
              placeholder="Display title"
              icon={Type}
            />
          </div>
        )}

        {/* 컬럼 목록 */}
        {columns.length > 0 && (
          <div className="tabs-list">
            {columns.map((column, index) => {
              const columnProps = column.props as ColumnElementProps;
              return (
                <div key={column.id} className="tab-list-item">
                  <div className="tab-content">
                    <span className="tab-title">
                      {index + 1}.{" "}
                      {(columnProps?.children as string) || "제목 없음"}
                      {columnProps?.key && (
                        <span className="ml-2 text-gray-500 text-sm">
                          ({columnProps.key})
                        </span>
                      )}
                      {columnProps?.isRowHeader && (
                        <span className="ml-2 px-1 py-0.5 text-xs bg-blue-100 text-blue-600 rounded">
                          헤더
                        </span>
                      )}
                    </span>
                    <div className="tab-controls">
                      {columnProps?.allowsSorting !== false && (
                        <span className="text-xs text-gray-500">📊</span>
                      )}
                      {columnProps?.enableResizing !== false && (
                        <span className="text-xs text-gray-500">↔️</span>
                      )}
                    </div>
                  </div>
                  <button
                    className="control-button delete"
                    onClick={() => deleteColumn(column.id)}
                  >
                    <Trash
                      color={iconProps.color}
                      strokeWidth={iconProps.strokeWidth}
                      size={iconProps.size}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* 컬럼 관리 버튼들 */}
        <div className="tab-actions">
          {isAddingColumn ? (
            <>
              <button className="control-button add" onClick={addColumn}>
                <SquarePlus
                  color={iconProps.color}
                  strokeWidth={iconProps.strokeWidth}
                  size={iconProps.size}
                />
                Add Column
              </button>
              <button
                className="control-button secondary"
                onClick={() => {
                  setIsAddingColumn(false);
                  setNewColumnLabel("");
                  setNewColumnKey("");
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              className="control-button add"
              onClick={() => setIsAddingColumn(true)}
            >
              <SquarePlus
                color={iconProps.color}
                strokeWidth={iconProps.strokeWidth}
                size={iconProps.size}
              />
              Add Column
            </button>
          )}
        </div>
      </PropertySection>
    </div>
  );
});
