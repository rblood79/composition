import { memo, useMemo } from "react";
import {
  PropertyInput,
  PropertyCustomId,
  PropertySection,
} from "../../../components";
import { PropertyEditorProps } from "../types/editorTypes";
import { useStore } from "../../../stores";
import { useCanonicalPropertyElement } from "../hooks/useCanonicalPropertyRead";
import { Type } from "lucide-react";
import { PROPERTY_LABELS } from "../../../../utils/ui/labels";

export const ColumnGroupEditor = memo(function ColumnGroupEditor({
  elementId,
  currentProps,
  onUpdate,
}: PropertyEditorProps) {
  const element = useCanonicalPropertyElement(elementId);
  const customId = useMemo(() => element?.customId || "", [element?.customId]);

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

  return (
    <>
      <PropertySection title="Content">
        <PropertyCustomId
          label="ID"
          value={customId}
          elementId={elementId}
          onChange={updateCustomId}
          placeholder="column_group_1"
        />

        {/* Group Title */}
        <PropertyInput
          label={PROPERTY_LABELS.COLUMN_TITLE}
          value={String(currentProps.children || "")}
          onChange={(value) => updateProp("children", value)}
          placeholder="Group title"
          icon={Type}
        />
      </PropertySection>
    </>
  );
});
