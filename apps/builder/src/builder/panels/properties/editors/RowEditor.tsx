import { memo } from "react";
import { CellElementProps, Element } from "../../../../types/core/store.types";

const EMPTY_CHILDREN: Element[] = [];
import { useStore } from "../../../stores";
import {
  PropertyInput,
  PropertySelect,
  PropertyCustomId,
  PropertySection,
} from "../../../components";
import { PropertyEditorProps } from "../types/editorTypes";
import { Ruler, Palette, Grid } from "lucide-react";
import { PROPERTY_LABELS } from "../../../../utils/ui/labels";

interface RowElementProps {
  height?: string;
  backgroundColor?: string;
  variant?: "default" | "striped" | "hover";
}

// interface RowEditorProps {
//     // element: Element;
//     // onChange: (updates: Partial<Element>) => void;
// }

export const RowEditor = memo(function RowEditor({
  elementId,
  currentProps,
  onUpdate,
}: PropertyEditorProps) {
  // ADR-040: elementsMap O(1) 조회
  const element = useStore((state) => state.elementsMap.get(elementId));
  // ADR-040: childrenMap O(1) 조회
  const rawChildren =
    useStore((state) => state.childrenMap.get(elementId)) ?? EMPTY_CHILDREN;

  // Get customId from element in store
  const customId = element?.customId || "";

  if (!element || !element.id) {
    return (
      <div className="p-4 text-center text-gray-500">Row 요소를 선택하세요</div>
    );
  }

  const updateProps = (newProps: Partial<RowElementProps>) => {
    onUpdate({
      ...newProps,
    });
  };

  // 현재 행의 셀들 찾기
  const rowCells = rawChildren.filter((el) => el.type === "Cell");

  return (
    <div className="component-props">
      <PropertySection title={PROPERTY_LABELS.ROW_INFORMATION}>
        {/* Custom ID */}
        <PropertyCustomId
          label="ID"
          value={customId}
          elementId={elementId}
          placeholder="row_1"
        />

        {/* Row Info */}
        <div className="tab-overview">
          <p className="tab-overview-text">
            Cells: {rowCells.length || 0} | Position: #
            {(element.order_num || 0) + 1}
          </p>
          <p className="section-overview-help">
            💡 Configure row appearance and dimensions
          </p>
        </div>

        {/* Row Height */}
        <PropertyInput
          label={PROPERTY_LABELS.ROW_HEIGHT}
          value={(currentProps as RowElementProps)?.height || ""}
          onChange={(value) => updateProps({ height: value })}
          placeholder="e.g. 40px, auto"
          icon={Ruler}
        />

        {/* Background Color */}
        <PropertyInput
          label={PROPERTY_LABELS.BACKGROUND_COLOR}
          type="color"
          value={
            (currentProps as RowElementProps)?.backgroundColor || "#ffffff"
          }
          onChange={(value) => updateProps({ backgroundColor: value })}
          icon={Palette}
        />

        {/* Row Variant */}
        <PropertySelect
          label={PROPERTY_LABELS.ROW_STYLE}
          value={(currentProps as RowElementProps)?.variant || "default"}
          options={[
            { value: "default", label: PROPERTY_LABELS.ROW_STYLE_DEFAULT },
            { value: "striped", label: "Striped" },
            { value: "hover", label: "Hover" },
          ]}
          onChange={(key) =>
            updateProps({ variant: key as "default" | "striped" | "hover" })
          }
          icon={Grid}
        />
      </PropertySection>

      <PropertySection title={PROPERTY_LABELS.CELL_OVERVIEW}>
        {/* 셀 목록 */}
        {rowCells.length > 0 && (
          <div className="tabs-list">
            {rowCells.map((cell, index) => (
              <div key={cell.id} className="tab-list-item">
                <span className="tab-title">
                  Cell {index + 1}:{" "}
                  {((cell.props as CellElementProps)?.children as string) ||
                    "No content"}
                </span>
                <span className="text-gray-400 text-xs">
                  ID: {cell.id.slice(0, 8)}...
                </span>
              </div>
            ))}
          </div>
        )}

        {rowCells.length === 0 && (
          <div className="tab-overview">
            <p className="section-overview-help">
              셀이 없습니다. Table 편집기에서 컬럼을 추가하세요.
            </p>
          </div>
        )}
      </PropertySection>
    </div>
  );
});
