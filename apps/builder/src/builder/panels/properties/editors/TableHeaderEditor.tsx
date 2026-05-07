import { useState, memo } from "react";
import {
  ColumnElementProps,
  Element,
} from "../../../../types/core/store.types";

const EMPTY_CHILDREN: Element[] = [];
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
import { supabase } from "../../../../env/supabase.client";
import { ElementUtils } from "../../../../utils/element/elementUtils";
import { PROPERTY_LABELS } from "../../../../utils/ui/labels";
import { generateCustomId } from "../../../utils/idGeneration";

interface TableHeaderElementProps {
  variant?: "default" | "dark" | "light" | "bordered";
  sticky?: boolean;
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
  // 🚀 Phase 19: Zustand selector 패턴 적용 (불필요한 리렌더링 방지)
  // ADR-040: elementsMap/childrenMap O(1) 조회
  const element = useStore((state) => state.elementsMap.get(elementId));
  const rawChildren =
    useStore((state) => state.childrenMap.get(elementId)) ?? EMPTY_CHILDREN;
  const tableElement = useStore((state) =>
    element?.parent_id ? state.elementsMap.get(element.parent_id) : undefined,
  );
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

      // ADR-040: 이벤트 핸들러에서 최신 상태 읽기
      const { elements: currentElements, childrenMap: currentChildrenMap } =
        useStore.getState();
      // 먼저 모든 새 요소들을 준비
      const newColumnElement: Element = {
        id: columnId,
        customId: generateCustomId("Column", currentElements),
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

      // TableBody의 모든 Row 찾기 (childrenMap O(1))
      const tableChildren = currentChildrenMap.get(tableElement.id) ?? [];
      const tableBodyElement = tableChildren.find(
        (el) => el.type === "TableBody",
      );

      const newCellElements: Element[] = [];
      if (tableBodyElement) {
        const rows = (currentChildrenMap.get(tableBodyElement.id) ?? []).filter(
          (el) => el.type === "Row",
        );

        // Track all elements for unique ID generation
        const allElementsSoFar = [...currentElements, newColumnElement];

        for (const row of rows) {
          const cellId = ElementUtils.generateId();
          const newCellElement: Element = {
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

      // 모든 요소를 한 번에 데이터베이스에 추가
      // Convert customId to custom_id for database
      const allNewElements = [newColumnElement, ...newCellElements];
      const elementsForDB = allNewElements.map((el) => {
        const elForDB = { ...el, custom_id: el.customId };
        delete elForDB.customId;
        return elForDB;
      });

      const { error } = await supabase.from("elements").insert(elementsForDB);

      if (error) {
        console.error("컬럼 추가 실패:", error);
        return;
      }

      // 스토어에 모든 요소 추가
      allNewElements.forEach((element) => addElement(element));

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
