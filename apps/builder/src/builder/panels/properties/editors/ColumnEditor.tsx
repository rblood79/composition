import { memo } from "react";
import {
  PropertyInput,
  PropertySwitch,
  PropertyCustomId,
  PropertySection,
} from "../../../components";
import type { ColumnElementProps } from "../../../../types/core/store.types";
import { PropertyEditorProps } from "../types/editorTypes";
import { useCanonicalPropertyElement } from "../hooks/useCanonicalPropertyRead";
import {
  Type,
  Crown,
  Ruler,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Key,
  Move,
} from "lucide-react";
import { PROPERTY_LABELS } from "../../../../utils/ui/labels";

// interface ColumnEditorProps {
//     // element: Element;
//     // onChange: (updates: Partial<Element>) => void;
// }

export const ColumnEditor = memo(function ColumnEditor({
  elementId,
  currentProps,
  onUpdate,
}: PropertyEditorProps) {
  const element = useCanonicalPropertyElement(elementId);

  // Get customId from element in store
  const customId = element?.customId || "";

  if (!element || !element.id) {
    return (
      <div className="p-4 text-center text-gray-500">
        Column 요소를 선택하세요
      </div>
    );
  }

  const updateProps = (newProps: Partial<ColumnElementProps>) => {
    onUpdate({
      ...newProps,
    });
  };

  return (
    <div className="component-props">
      <PropertySection title={PROPERTY_LABELS.COLUMN_CONTENT}>
        <PropertyCustomId
          label="ID"
          value={customId}
          elementId={elementId}
          placeholder="column_1"
        />

        {/* Data Key */}
        <PropertyInput
          label={PROPERTY_LABELS.DATA_KEY}
          value={(currentProps as ColumnElementProps)?.key || ""}
          onChange={(value) => updateProps({ key: value })}
          placeholder="Data field name (e.g. id, name, email)"
          icon={Key}
        />

        <div className="tab-overview">
          <span className="help-text">
            💡 Must match exactly with the field name from API or data source
          </span>
        </div>

        {/* Column Title */}
        <PropertyInput
          label={PROPERTY_LABELS.COLUMN_TITLE}
          value={
            ((currentProps as ColumnElementProps)?.children as string) || ""
          }
          onChange={(value) => updateProps({ children: value })}
          placeholder="Display title"
          icon={Type}
        />

        {/* Is Row Header */}
        <PropertySwitch
          label={PROPERTY_LABELS.USE_AS_ROW_HEADER}
          isSelected={!!(currentProps as ColumnElementProps)?.isRowHeader}
          onChange={(isSelected) => updateProps({ isRowHeader: isSelected })}
          icon={Crown}
        />

        {/* Allows Sorting */}
        <PropertySwitch
          label={PROPERTY_LABELS.SORTABLE}
          isSelected={
            (currentProps as ColumnElementProps)?.allowsSorting !== false
          }
          onChange={(isSelected) => updateProps({ allowsSorting: isSelected })}
          icon={ArrowUpDown}
        />
      </PropertySection>

      <PropertySection title={PROPERTY_LABELS.COLUMN_SIZING}>
        {/* Enable Resizing */}
        <PropertySwitch
          label={PROPERTY_LABELS.RESIZABLE}
          isSelected={
            (currentProps as ColumnElementProps)?.enableResizing !== false
          }
          onChange={(isSelected) => updateProps({ enableResizing: isSelected })}
          icon={Move}
        />

        <div className="tab-overview">
          <span className="help-text">
            💡 Users can drag column header to adjust width
          </span>
        </div>

        {/* Column Width */}
        <PropertyInput
          label={PROPERTY_LABELS.COLUMN_WIDTH}
          value={(currentProps as ColumnElementProps)?.width || ""}
          onChange={(value) =>
            updateProps({ width: parseInt(value) || undefined })
          }
          placeholder="e.g. 200"
          type="number"
          icon={Ruler}
        />

        {/* Min Width */}
        <PropertyInput
          label={PROPERTY_LABELS.MIN_WIDTH}
          value={(currentProps as ColumnElementProps)?.minWidth || ""}
          onChange={(value) =>
            updateProps({ minWidth: parseInt(value) || undefined })
          }
          placeholder="e.g. 100"
          type="number"
          icon={ArrowLeft}
        />

        {/* Max Width */}
        <PropertyInput
          label={PROPERTY_LABELS.MAX_WIDTH}
          value={(currentProps as ColumnElementProps)?.maxWidth || ""}
          onChange={(value) =>
            updateProps({ maxWidth: parseInt(value) || undefined })
          }
          placeholder="e.g. 400"
          type="number"
          icon={ArrowRight}
        />
      </PropertySection>
    </div>
  );
});
