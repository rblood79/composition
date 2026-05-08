import { memo } from "react";

import {
  PropertyInput,
  PropertySelect,
  PropertyCustomId,
  PropertySection,
} from "../../../components";
import type { CellElementProps } from "../../../../types/core/store.types";
import { PropertyEditorProps } from "../types/editorTypes";
import { useStore } from "../../../stores";
import { useCanonicalPropertyElement } from "../hooks/useCanonicalPropertyRead";
import { Type, AlignLeft, Palette, Grid } from "lucide-react";
import { PROPERTY_LABELS } from "../../../../utils/ui/labels";

// interface CellEditorProps {
//     // element: Element;
//     // onChange: (updates: Partial<Element>) => void;
// }

export const CellEditor = memo(function CellEditor({
  elementId,
  currentProps,
  onUpdate,
}: PropertyEditorProps) {
  const element = useCanonicalPropertyElement(elementId);
  const customId = element?.customId || "";

  const updateCustomId = (newCustomId: string) => {
    // Update customId in store (not in props)
    const updateElement = useStore.getState().updateElement;
    if (updateElement && elementId) {
      updateElement(elementId, { customId: newCustomId });
    }
  };

  if (!element || !element.id) {
    return (
      <div className="p-4 text-center text-gray-500">
        Cell 요소를 선택하세요
      </div>
    );
  }

  const updateProps = (newProps: Partial<CellElementProps>) => {
    onUpdate({
      ...newProps,
    });
  };

  return (
    <>
      <PropertySection title={PROPERTY_LABELS.CELL_CONTENT}>
        <PropertyCustomId
          label="ID"
          value={customId}
          elementId={elementId}
          onChange={updateCustomId}
          placeholder="cell_1"
        />
        {/* Cell Content */}
        <PropertyInput
          label={PROPERTY_LABELS.CHILDREN}
          value={((currentProps as CellElementProps)?.children as string) || ""}
          onChange={(value) => updateProps({ children: value })}
          placeholder="Enter cell content"
          icon={Type}
        />
      </PropertySection>

      <PropertySection title={PROPERTY_LABELS.TEXT_ALIGNMENT}>
        {/* Text Alignment */}
        <PropertySelect
          label={PROPERTY_LABELS.TEXT_ALIGNMENT}
          value={(currentProps as CellElementProps)?.textAlign || "left"}
          options={[
            { value: "left", label: PROPERTY_LABELS.ALIGN_LEFT },
            { value: "center", label: PROPERTY_LABELS.ALIGN_CENTER },
            { value: "right", label: PROPERTY_LABELS.ALIGN_RIGHT },
          ]}
          onChange={(key) =>
            updateProps({ textAlign: key as "left" | "center" | "right" })
          }
          icon={AlignLeft}
        />

        {/* Vertical Alignment */}
        <PropertySelect
          label={PROPERTY_LABELS.VERTICAL_ALIGNMENT}
          value={(currentProps as CellElementProps)?.verticalAlign || "middle"}
          options={[
            { value: "top", label: PROPERTY_LABELS.ALIGN_TOP },
            { value: "middle", label: PROPERTY_LABELS.ALIGN_MIDDLE },
            { value: "bottom", label: PROPERTY_LABELS.ALIGN_BOTTOM },
          ]}
          onChange={(key) =>
            updateProps({ verticalAlign: key as "top" | "middle" | "bottom" })
          }
          icon={Grid}
        />
      </PropertySection>

      <PropertySection title={PROPERTY_LABELS.STYLING}>
        {/* Background Color */}
        <PropertyInput
          label={PROPERTY_LABELS.BACKGROUND_COLOR}
          type="color"
          value={
            (currentProps as CellElementProps)?.backgroundColor || "#ffffff"
          }
          onChange={(value) => updateProps({ backgroundColor: value })}
          icon={Palette}
        />

        {/* Text Color */}
        <PropertyInput
          label={PROPERTY_LABELS.TEXT_COLOR}
          type="color"
          value={(currentProps as CellElementProps)?.color || "#000000"}
          onChange={(value) => updateProps({ color: value })}
          icon={Palette}
        />
      </PropertySection>
    </>
  );
});
