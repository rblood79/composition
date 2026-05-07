import { memo } from "react";
import { useStore } from "../../../stores";
import {
  PropertySelect,
  PropertyCustomId,
  PropertySection,
} from "../../../components";
import { PropertyEditorProps } from "../types/editorTypes";
import { Table, Grid } from "lucide-react";
import { PROPERTY_LABELS } from "../../../../utils/ui/labels";
import type { Element } from "../../../../types/core/store.types";

const EMPTY_CHILDREN: Element[] = [];

interface TableBodyElementProps {
  variant?: "default" | "striped" | "bordered" | "hover";
  selectable?: boolean;
}

// interface TableBodyEditorProps {
//     // element: Element;
//     // onChange: (updates: Partial<Element>) => void;
// }

export const TableBodyEditor = memo(function TableBodyEditor({
  elementId,
  currentProps,
  onUpdate,
}: PropertyEditorProps) {
  // ADR-040: elementsMap/childrenMap O(1) 조회
  const element = useStore((state) => state.elementsMap.get(elementId));
  const rawChildren =
    useStore((state) => state.childrenMap.get(elementId)) ?? EMPTY_CHILDREN;
  const childrenMap = useStore((state) => state.childrenMap);

  // Get customId from element in store
  const customId = element?.customId || "";

  if (!element || !element.id) {
    return (
      <div className="p-4 text-center text-gray-500">
        TableBody 요소를 선택하세요
      </div>
    );
  }

  const updateProps = (newProps: Partial<TableBodyElementProps>) => {
    onUpdate({
      ...newProps,
    });
  };

  // 현재 테이블 바디의 행들 찾기
  const rows = rawChildren.filter((el) => el.type === "Row");

  // 총 셀 개수 계산
  const totalCells = rows.reduce((total, row) => {
    const rowCells = (childrenMap.get(row.id) ?? []).filter(
      (el) => el.type === "Cell",
    );
    return total + rowCells.length;
  }, 0);

  return (
    <div className="component-props">
      <PropertySection title={PROPERTY_LABELS.TABLE_BODY_PROPERTIES}>
        {/* Custom ID */}
        <PropertyCustomId
          label="ID"
          value={customId}
          elementId={elementId}
          placeholder="tablebody_1"
        />

        {/* Body Info */}
        <div className="tab-overview">
          <p className="tab-overview-text">
            Total rows: {rows.length || 0} | Total cells: {totalCells || 0}
          </p>
          <p className="section-overview-help">
            💡 Configure table body appearance and row behavior
          </p>
        </div>

        {/* Body Variant */}
        <PropertySelect
          label={PROPERTY_LABELS.BODY_STYLE}
          value={(currentProps as TableBodyElementProps)?.variant || "default"}
          options={[
            { value: "default", label: PROPERTY_LABELS.BODY_STYLE_DEFAULT },
            { value: "striped", label: PROPERTY_LABELS.BODY_STYLE_STRIPED },
            { value: "bordered", label: "Bordered" },
            { value: "hover", label: PROPERTY_LABELS.BODY_STYLE_HOVER },
          ]}
          onChange={(key) =>
            updateProps({
              variant: key as "default" | "striped" | "bordered" | "hover",
            })
          }
          icon={Table}
        />

        {/* Row Selection */}
        <PropertySelect
          label={PROPERTY_LABELS.ROW_SELECTION}
          value={
            (currentProps as TableBodyElementProps)?.selectable
              ? "true"
              : "false"
          }
          options={[
            { value: "false", label: "Not Selectable" },
            { value: "true", label: "Selectable" },
          ]}
          onChange={(key) => updateProps({ selectable: key === "true" })}
          icon={Grid}
        />
      </PropertySection>

      <PropertySection title="Row Overview">
        {/* 행 목록 */}
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
                  <span className="text-gray-400 text-xs">
                    ID: {row.id.slice(0, 8)}...
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {rows.length === 0 && (
          <div className="tab-overview">
            <p className="section-overview-help">
              No rows found. Add rows from the Table editor.
            </p>
          </div>
        )}
      </PropertySection>
    </div>
  );
});
