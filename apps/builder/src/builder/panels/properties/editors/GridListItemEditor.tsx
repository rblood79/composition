import { memo, useMemo } from "react";
import { Tag, Binary, PointerOff, FileText } from "lucide-react";
import {
  PropertyInput,
  PropertySwitch,
  PropertyCustomId,
  PropertySection,
} from "../../../components";
import { PropertyEditorProps } from "../types/editorTypes";
import { PROPERTY_LABELS } from "../../../../utils/ui/labels";
import { useStore } from "../../../stores";
import { useCanonicalPropertyElement } from "../hooks/useCanonicalPropertyRead";

export const GridListItemEditor = memo(function GridListItemEditor({
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
      {/* Content Section */}
      <PropertySection title="Content">
        <PropertyCustomId
          label="ID"
          value={customId}
          elementId={elementId}
          onChange={updateCustomId}
          placeholder="gridlistitem_1"
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
    </>
  );
});
