import {
  SquarePlus,
  Trash,
  Table,
  Grid,
  Settings,
  Tag,
  List,
  Layers,
  Mouse,
  BookOpen,
  RulerDimensionLine,
} from "lucide-react";
import {
  PropertyInput,
  PropertySelect,
  PropertySwitch,
  PropertyCustomId,
  PropertySection,
  PropertySizeToggle,
} from "../../../components";
import { PropertyEditorProps } from "../types/editorTypes";
import { iconProps } from "../../../../utils/ui/uiConstants";
import { PROPERTY_LABELS } from "../../../../utils/ui/labels";
import { supabase } from "../../../../env/supabase.client";
import { useStore } from "../../../stores";
import { Element } from "../../../../types/core/store.types";
import { ElementUtils } from "../../../../utils/element/elementUtils";
import { TableElementProps } from "../../../../types/builder/unified.types";
// ADR-116 Phase 3 G4 — mutation reverse wrapper (D18=A 정합)
import { mergeElementsCanonicalPrimary } from "@/adapters/canonical/canonicalMutations";
import { useCallback, memo, useMemo } from "react";
import { generateCustomId } from "../../../utils/idGeneration";
import {
  useCanonicalPropertyChildrenMap,
  useCanonicalPropertyElement,
  useCanonicalPropertyElementsMap,
} from "../hooks/useCanonicalPropertyRead";
import "./styles/TableEditor.css";

// interface TableEditorProps {
//     // element: Element;
//     // onChange: (updates: Partial<Element>) => void;
// }

export const TableEditor = memo(
  function TableEditor({
    elementId,
    currentProps,
    onUpdate,
  }: PropertyEditorProps) {
    const element = useCanonicalPropertyElement(elementId);
    const elementsMap = useCanonicalPropertyElementsMap();
    const childrenMap = useCanonicalPropertyChildrenMap();

    // ⭐ 최적화: customId를 현재 시점에만 가져오기 (Zustand 구독 방지)
    const customId = useMemo(() => {
      return element?.customId || "";
    }, [element?.customId]);

    // Table 속성 업데이트 함수들
    const updateTableProps = useCallback(
      (newProps: Partial<TableElementProps>) => {
        onUpdate({
          ...newProps,
        });
      },
      [onUpdate],
    );

    const updateCustomId = (newCustomId: string) => {
      // Update customId in store (not in props)
      const updateElement = useStore.getState().updateElement;
      if (updateElement && elementId) {
        updateElement(elementId, { customId: newCustomId });
      }
    };

    // element가 없는 경우 빈 화면 반환
    if (!element || !element.id) {
      return <div className="table-editor-empty">Table 요소를 선택하세요</div>;
    }

    // Table 구조 분석 — childrenMap은 Element[]를 반환하므로 직접 사용
    const elementChildren = childrenMap.get(element.id) ?? [];
    const tableBody = elementChildren.find((el) => el.type === "TableBody");

    // TableHeader 찾기
    const tableHeaderElement = elementChildren.find(
      (el) => el.type === "TableHeader",
    );

    // 실제 Column Element들 가져오기
    const actualColumns = tableHeaderElement
      ? (childrenMap.get(tableHeaderElement.id) ?? []).filter(
          (el) => el.type === "Column",
        )
      : [];

    // Column Group Element들 가져오기
    const actualColumnGroups = tableHeaderElement
      ? (childrenMap.get(tableHeaderElement.id) ?? []).filter(
          (el) => el.type === "ColumnGroup",
        )
      : [];

    // 현재 테이블의 행들 찾기 (TableBody > Row)
    const rows = tableBody
      ? (childrenMap.get(tableBody.id) ?? []).filter((el) => el.type === "Row")
      : [];

    const addRow = async () => {
      if (!tableBody) return;

      try {
        const rowId = ElementUtils.generateId();
        const allElements = Array.from(elementsMap.values());
        const newRowElement: Element = {
          id: rowId,
          customId: generateCustomId("Row", allElements),
          type: "Row",
          props: {},
          parent_id: tableBody.id,
          page_id: element.page_id!,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // 행 생성
        // Convert customId to custom_id for database
        const rowForDB = {
          ...newRowElement,
          custom_id: newRowElement.customId,
        };
        delete rowForDB.customId;

        const { error: rowError } = await supabase
          .from("elements")
          .upsert([rowForDB], {
            onConflict: "id",
          });

        if (rowError) {
          console.error("행 추가 실패:", rowError);
          return;
        }

        // 각 컬럼에 대한 셀 생성
        const cellsToCreate: Element[] = [];
        // TableElementProps에는 columns가 없으므로 실제 Column Element들을 사용
        const columnsFromProps = actualColumns;

        // Track all elements so far for unique ID generation
        const allElementsSoFar = [...allElements, newRowElement];

        for (let i = 0; i < columnsFromProps.length; i++) {
          const cellId = ElementUtils.generateId();
          const newCellElement: Element = {
            id: cellId,
            customId: generateCustomId("Cell", allElementsSoFar),
            type: "Cell",
            props: {
              children: "",
            },
            parent_id: rowId,
            page_id: element.page_id!,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          cellsToCreate.push(newCellElement);
          allElementsSoFar.push(newCellElement);
        }

        // 셀들 생성
        // Convert customId to custom_id for database
        const cellsForDB = cellsToCreate.map((cell) => {
          const cellForDB = { ...cell, custom_id: cell.customId };
          delete cellForDB.customId;
          return cellForDB;
        });

        const { error: cellsError } = await supabase
          .from("elements")
          .upsert(cellsForDB, {
            onConflict: "id",
          });

        if (cellsError) {
          console.error("셀 추가 실패:", cellsError);
          return;
        }

        // 메모리 상태 업데이트
        mergeElementsCanonicalPrimary([newRowElement, ...cellsToCreate]);

        console.log("✅ 테이블 행 추가 완료");
      } catch (error) {
        console.error("행 추가 중 오류:", error);
      }
    };

    const removeRow = async (rowId: string) => {
      try {
        // removeElement 함수를 사용하여 자식 Cell들도 함께 삭제
        const { removeElement } = useStore.getState();
        await removeElement(rowId);

        console.log("✅ 테이블 행 삭제 완료:", rowId);
      } catch (error) {
        console.error("행 삭제 중 오류:", error);
      }
    };

    const addColumnGroup = async () => {
      if (!tableHeaderElement) return;

      try {
        const groupId = ElementUtils.generateId();
        const newGroupElement: Element = {
          id: groupId,
          customId: generateCustomId(
            "ColumnGroup",
            Array.from(elementsMap.values()),
          ),
          type: "ColumnGroup",
          props: {
            children: "New Group",
            label: "New Group",
            span: 2,
            align: "center",
            variant: "default",
            sticky: false,
          },
          parent_id: tableHeaderElement.id,
          page_id: element.page_id!,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Convert customId to custom_id for database
        const groupForDB = {
          ...newGroupElement,
          custom_id: newGroupElement.customId,
        };
        delete groupForDB.customId;

        const { error } = await supabase.from("elements").upsert([groupForDB], {
          onConflict: "id",
        });

        if (error) {
          console.error("Column Group 추가 실패:", error);
          return;
        }

        // 메모리 상태 업데이트
        mergeElementsCanonicalPrimary([newGroupElement]);

        console.log("✅ Column Group 추가 완료");
      } catch (error) {
        console.error("Column Group 추가 중 오류:", error);
      }
    };

    const removeColumnGroup = async (groupId: string) => {
      try {
        const { removeElement } = useStore.getState();
        await removeElement(groupId);

        console.log("✅ Column Group 삭제 완료:", groupId);
      } catch (error) {
        console.error("Column Group 삭제 중 오류:", error);
      }
    };

    return (
      <>
        {/* Configuration */}
        <PropertySection title="Configuration">
          <PropertyCustomId
            label="ID"
            value={customId}
            elementId={elementId}
            onChange={updateCustomId}
            placeholder="table_1"
          />

          {/* Selection Mode */}
          <PropertySelect
            label={PROPERTY_LABELS.SELECTION_MODE}
            value={(currentProps as TableElementProps)?.selectionMode || "none"}
            options={[
              { value: "none", label: PROPERTY_LABELS.NONE },
              { value: "single", label: PROPERTY_LABELS.SINGLE },
              { value: "multiple", label: PROPERTY_LABELS.MULTIPLE },
            ]}
            onChange={(key) =>
              updateTableProps({
                selectionMode: key as "none" | "single" | "multiple",
              })
            }
            icon={Grid}
          />

          {/* Table Size */}
          <PropertySizeToggle
            label={PROPERTY_LABELS.TABLE_SIZE}
            value={(currentProps as TableElementProps)?.size || "md"}
            onChange={(key) =>
              updateTableProps({ size: key as "sm" | "md" | "lg" })
            }
          />

          {/* Table Variant */}
          <PropertySelect
            label={PROPERTY_LABELS.TABLE_STYLE}
            value={(currentProps as TableElementProps)?.variant || "default"}
            options={[
              { value: "default", label: PROPERTY_LABELS.TABLE_STYLE_DEFAULT },
              { value: "striped", label: PROPERTY_LABELS.TABLE_STYLE_STRIPED },
              {
                value: "bordered",
                label: PROPERTY_LABELS.TABLE_STYLE_BORDERED,
              },
            ]}
            onChange={(key) =>
              updateTableProps({
                variant: key as "default" | "striped" | "bordered",
              })
            }
            icon={Table}
          />

          {/* Table Header Variant */}
          <PropertySelect
            label={PROPERTY_LABELS.HEADER_STYLE}
            value={
              (currentProps as TableElementProps)?.headerVariant || "default"
            }
            options={[
              { value: "default", label: PROPERTY_LABELS.HEADER_STYLE_DEFAULT },
              { value: "dark", label: "Dark" },
              { value: "accent", label: "Accent" },
            ]}
            onChange={(key) =>
              updateTableProps({
                headerVariant: key as "default" | "dark" | "accent",
              })
            }
            icon={Settings}
          />

          {/* Table Cell Variant */}
          <PropertySelect
            label={PROPERTY_LABELS.CELL_STYLE}
            value={
              (currentProps as TableElementProps)?.cellVariant || "default"
            }
            options={[
              { value: "default", label: PROPERTY_LABELS.CELL_STYLE_DEFAULT },
              { value: "striped", label: "Striped" },
            ]}
            onChange={(key) =>
              updateTableProps({ cellVariant: key as "default" | "striped" })
            }
            icon={Settings}
          />
        </PropertySection>

        {/* 페이지네이션 모드 설정 */}
        <div className="component-fieldset">
          <legend className="component-legend">
            <List className="legend-icon" />
            {PROPERTY_LABELS.PAGINATION_MODE}
          </legend>

          <PropertySelect
            icon={
              currentProps?.paginationMode === "infinite" ? Mouse : BookOpen
            }
            label={PROPERTY_LABELS.PAGINATION_MODE}
            value={
              (currentProps as TableElementProps)?.paginationMode || "infinite"
            }
            options={[
              { value: "infinite", label: "Scroll" },
              { value: "pagination", label: "Pagination" },
            ]}
            onChange={(paginationMode) =>
              updateTableProps({
                paginationMode: paginationMode as "pagination" | "infinite",
              })
            }
          />

          <div className="tab-overview">
            <span className="help-text">
              {currentProps?.paginationMode === "pagination"
                ? "Traditional navigation with page numbers"
                : "Automatically load more data on scroll"}
            </span>
          </div>

          {/* 페이지당 행 수 설정 - 페이지네이션 모드일 때만 표시 */}
          {currentProps?.paginationMode === "pagination" && (
            <PropertyInput
              icon={Settings}
              label={PROPERTY_LABELS.ITEMS_PER_PAGE}
              value={(currentProps as TableElementProps)?.itemsPerPage || 10}
              onChange={(itemsPerPage) =>
                updateTableProps({ itemsPerPage: parseInt(itemsPerPage) || 10 })
              }
              type="number"
            />
          )}
        </div>

        {/* 가상화 설정 */}
        <div className="component-fieldset">
          <legend className="component-legend">
            <Grid className="legend-icon" />
            {PROPERTY_LABELS.VIRTUALIZATION_SETTINGS}
          </legend>

          <PropertySelect
            icon={RulerDimensionLine}
            label={PROPERTY_LABELS.TABLE_HEIGHT_MODE}
            value={(currentProps as TableElementProps)?.heightMode || "fixed"}
            options={[
              { value: "auto", label: PROPERTY_LABELS.HEIGHT_AUTO },
              { value: "fixed", label: PROPERTY_LABELS.HEIGHT_FIXED },
              { value: "viewport", label: PROPERTY_LABELS.HEIGHT_VIEWPORT },
              { value: "full", label: "Full Screen" },
            ]}
            onChange={(heightMode) =>
              updateTableProps({
                heightMode: heightMode as
                  | "auto"
                  | "fixed"
                  | "viewport"
                  | "full",
              })
            }
          />

          {/* 고정 높이 설정 - heightMode가 'fixed'일 때만 표시 */}
          {(currentProps as TableElementProps)?.heightMode === "fixed" && (
            <div className="table-editor-height-controls">
              <PropertyInput
                icon={Settings}
                label={PROPERTY_LABELS.HEIGHT_VALUE}
                value={String(
                  (currentProps as TableElementProps)?.height || 400,
                )}
                onChange={(height) =>
                  updateTableProps({ height: parseInt(height) || 400 })
                }
                type="number"
                className="flex-1"
              />
              <PropertySelect
                icon={Settings}
                label={PROPERTY_LABELS.UNIT}
                value={(currentProps as TableElementProps)?.heightUnit || "px"}
                options={[
                  { value: "px", label: "px" },
                  { value: "vh", label: "vh" },
                  { value: "rem", label: "rem" },
                  { value: "em", label: "em" },
                ]}
                onChange={(heightUnit) =>
                  updateTableProps({
                    heightUnit: heightUnit as "px" | "vh" | "rem" | "em",
                  })
                }
                className="w-32"
              />
            </div>
          )}

          {/* 뷰포트 기준 설정 - heightMode가 'viewport'일 때만 표시 */}
          {(currentProps as TableElementProps)?.heightMode === "viewport" && (
            <PropertyInput
              icon={Settings}
              label={PROPERTY_LABELS.VIEWPORT_HEIGHT_RATIO}
              value={String(
                (currentProps as TableElementProps)?.viewportHeight || 50,
              )}
              onChange={(viewportHeight) =>
                updateTableProps({
                  viewportHeight: parseInt(viewportHeight) || 50,
                })
              }
              type="number"
              min={10}
              max={100}
            />
          )}

          <PropertyInput
            icon={Settings}
            label={PROPERTY_LABELS.ROW_HEIGHT}
            value={(currentProps as TableElementProps)?.itemHeight || 50}
            onChange={(itemHeight) =>
              updateTableProps({ itemHeight: parseInt(itemHeight) || 50 })
            }
          />

          <PropertyInput
            icon={Settings}
            label={PROPERTY_LABELS.OVERSCAN}
            value={(currentProps as TableElementProps)?.overscan || 5}
            onChange={(overscan) =>
              updateTableProps({ overscan: parseInt(overscan) || 5 })
            }
          />

          <PropertySwitch
            icon={Table}
            label={PROPERTY_LABELS.STICKY_HEADER}
            isSelected={
              (currentProps as TableElementProps)?.stickyHeader || false
            }
            onChange={(stickyHeader) => updateTableProps({ stickyHeader })}
          />

          <PropertyInput
            icon={Settings}
            label={PROPERTY_LABELS.STICKY_HEADER_OFFSET}
            value={(currentProps as TableElementProps)?.stickyHeaderOffset || 0}
            onChange={(stickyHeaderOffset) =>
              updateTableProps({
                stickyHeaderOffset: parseInt(stickyHeaderOffset) || 0,
              })
            }
            type="number"
          />
        </div>

        {/* 정렬 설정 */}
        <div className="component-fieldset">
          <legend className="component-legend">
            <List className="legend-icon" />
            {PROPERTY_LABELS.SORTING_SETTINGS}
          </legend>

          <div className="tab-overview">
            <span className="help-text">
              💡 Set default sorting or maintain API order. Users can change
              sorting by clicking headers.
            </span>
          </div>

          <PropertySelect
            icon={Tag}
            label={PROPERTY_LABELS.DEFAULT_SORT_COLUMN}
            value={(currentProps as TableElementProps)?.sortColumn || ""}
            options={[
              { value: "", label: "No Sorting (Keep API Order)" },
              { value: "id", label: "ID" },
              { value: "name", label: "Name" },
              { value: "email", label: "Email" },
              { value: "jobTitle", label: "Job Title" },
            ]}
            onChange={(sortColumn) =>
              updateTableProps({ sortColumn: sortColumn || undefined })
            }
          />

          <PropertySelect
            icon={List}
            label={PROPERTY_LABELS.DEFAULT_SORT_DIRECTION}
            value={
              (currentProps as TableElementProps)?.sortDirection || "ascending"
            }
            options={[
              { value: "ascending", label: PROPERTY_LABELS.SORT_ASCENDING },
              { value: "descending", label: PROPERTY_LABELS.SORT_DESCENDING },
            ]}
            onChange={(sortDirection) =>
              updateTableProps({
                sortDirection: sortDirection as "ascending" | "descending",
              })
            }
          />
        </div>

        <PropertySection title={PROPERTY_LABELS.COLUMN_MANAGEMENT}>
          {/* 컬럼 개수 표시 */}
          <div className="tab-overview">
            <p className="tab-overview-text">
              Total columns: {actualColumns.length || 0}
            </p>
            <p className="section-overview-help">
              💡 Select <strong>TableHeader</strong> to add/remove columns
            </p>
          </div>

          {/* 실제 Column Element 목록 (읽기 전용) */}
          {actualColumns.length > 0 && (
            <div className="tabs-list">
              {actualColumns.map((column, index) => {
                const columnProps = column.props as Record<string, unknown>;
                return (
                  <div key={column.id} className="tab-list-item">
                    <div className="tab-content">
                      <span className="tab-title">
                        {index + 1}.{" "}
                        {(columnProps?.children as string) || "제목 없음"}
                        {columnProps?.key != null && (
                          <span className="table-editor-label-hint">
                            ({String(columnProps.key)})
                          </span>
                        )}
                      </span>
                      <div className="tab-controls">
                        {columnProps?.allowsSorting !== false && (
                          <span
                            className="table-editor-hint-text"
                            title="정렬 가능"
                          >
                            📊
                          </span>
                        )}
                        {columnProps?.enableResizing !== false && (
                          <span
                            className="table-editor-hint-text"
                            title="크기 조절 가능"
                          >
                            ↔️
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {actualColumns.length === 0 && (
            <div className="tab-overview">
              <p className="section-overview-help">
                ⚠️ 컬럼이 없습니다. <strong>Layers</strong>에서{" "}
                <strong>TableHeader</strong>를 선택하고 컬럼을 추가하세요.
              </p>
            </div>
          )}
        </PropertySection>

        {/* Column Group Management */}
        <PropertySection title="Column Group Management">
          {/* Column Group 개수 표시 */}
          <div className="tab-overview">
            <p className="tab-overview-text">
              Total groups: {actualColumnGroups.length || 0}
            </p>
            <p className="section-overview-help">
              💡 Column Group을 사용하여 관련 컬럼들을 그룹화하고 멀티레벨
              헤더를 만들 수 있습니다
            </p>
          </div>

          {/* 실제 Column Group Element 목록 */}
          {actualColumnGroups.length > 0 && (
            <div className="tabs-list">
              {actualColumnGroups.map((group, index) => {
                const groupProps = group.props as Record<string, unknown>;
                return (
                  <div key={group.id} className="tab-list-item">
                    <div className="tab-content">
                      <span className="tab-title">
                        {index + 1}. {(groupProps?.label as string) || "Group"}
                        <span className="table-editor-label-hint">
                          (span: {(groupProps?.span as number) || 2})
                        </span>
                      </span>
                      <div className="tab-controls">
                        <span
                          className="table-editor-hint-text"
                          title="Column Group"
                        >
                          📊
                        </span>
                      </div>
                    </div>
                    <button
                      className="control-button delete"
                      onClick={() => removeColumnGroup(group.id)}
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

          {actualColumnGroups.length === 0 && (
            <div className="tab-overview">
              <p className="section-overview-help">
                📋 Column Group이 없습니다. 아래 버튼을 클릭하여 그룹을
                추가하세요.
              </p>
            </div>
          )}

          {/* Column Group 추가 버튼 */}
          <div className="tab-actions">
            <button className="control-button add" onClick={addColumnGroup}>
              <Layers
                color={iconProps.color}
                strokeWidth={iconProps.strokeWidth}
                size={iconProps.size}
              />
              Add Column Group
            </button>
          </div>

          {/* Column Group 사용법 안내 */}
          <div className="tab-overview">
            <p className="section-overview-help">
              <strong>💡 Column Group 사용법:</strong>
              <br />
              • Column Group은 여러 컬럼을 하나의 헤더로 그룹화합니다
              <br />
              • span 속성으로 그룹이 포함할 컬럼 수를 설정합니다
              <br />• 중첩된 그룹 구조도 지원합니다
            </p>
          </div>
        </PropertySection>

        <PropertySection title="Row Management">
          {/* 행 개수 표시 */}
          <div className="tab-overview">
            <p className="tab-overview-text">Total rows: {rows.length || 0}</p>
            <p className="section-overview-help">
              💡 Manage table rows and their cells
            </p>
          </div>

          {/* 기존 행들 */}
          {rows.length > 0 && (
            <div className="tabs-list">
              {rows.map((row, index) => {
                const rowCells = (childrenMap.get(row.id) ?? []).filter(
                  (el) => el.type === "Cell",
                );

                return (
                  <div key={row.id} className="tab-list-item">
                    <span className="tab-title">
                      Row {index + 1} ({rowCells.length} cells)
                    </span>
                    <button
                      className="control-button delete"
                      onClick={() => removeRow(row.id)}
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

          {/* 행 추가 버튼 */}
          <div className="tab-actions">
            <button className="control-button add" onClick={addRow}>
              <SquarePlus
                color={iconProps.color}
                strokeWidth={iconProps.strokeWidth}
                size={iconProps.size}
              />
              Add Row
            </button>
          </div>
        </PropertySection>
      </>
    );
  },
  (prevProps, nextProps) => {
    // ⭐ 기본 비교: id와 properties만 비교
    return (
      prevProps.elementId === nextProps.elementId &&
      JSON.stringify(prevProps.currentProps) ===
        JSON.stringify(nextProps.currentProps)
    );
  },
);
