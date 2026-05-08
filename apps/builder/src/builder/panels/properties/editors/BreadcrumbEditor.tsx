import { memo, useMemo } from "react";
import { Tag, Link, PointerOff, CheckCircle } from "lucide-react";
import {
  PropertyInput,
  PropertyCustomId,
  PropertySwitch,
  PropertySelect,
  PropertySection,
} from "../../../components";
import { PropertyEditorProps } from "../types/editorTypes";
import { PROPERTY_LABELS } from "../../../../utils/ui/labels";
import { useCanonicalPropertyElement } from "../hooks/useCanonicalPropertyRead";

export const BreadcrumbEditor = memo(function BreadcrumbEditor({
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

  return (
    <>
      {/* Content Section */}
      <PropertySection title="Content">
        <PropertyCustomId
          label="ID"
          value={customId}
          elementId={elementId}
          placeholder="breadcrumb_1"
        />

        <PropertyInput
          label={PROPERTY_LABELS.TEXT}
          value={String(currentProps.children || "")}
          onChange={(value) => updateProp("children", value)}
          icon={Tag}
        />

        <PropertyInput
          label={PROPERTY_LABELS.HREF}
          value={String(currentProps.href || "")}
          onChange={(value) => updateProp("href", value || undefined)}
          placeholder="/"
          icon={Link}
        />
      </PropertySection>

      {/* State Section */}
      <PropertySection title="State">
        <PropertySelect
          label={PROPERTY_LABELS.TARGET}
          value={String(currentProps.target || "")}
          onChange={(value) => updateProp("target", value || undefined)}
          options={[
            { value: "", label: PROPERTY_LABELS.TARGET_NONE },
            { value: "_self", label: PROPERTY_LABELS.TARGET_SELF },
            { value: "_blank", label: PROPERTY_LABELS.TARGET_BLANK },
            { value: "_parent", label: PROPERTY_LABELS.TARGET_PARENT },
            { value: "_top", label: PROPERTY_LABELS.TARGET_TOP },
          ]}
          icon={Link}
        />

        <PropertyInput
          label={PROPERTY_LABELS.REL}
          value={String(currentProps.rel || "")}
          onChange={(value) => updateProp("rel", value || undefined)}
          placeholder="noopener noreferrer"
          icon={Link}
        />

        <PropertySwitch
          label={PROPERTY_LABELS.DISABLED}
          isSelected={Boolean(currentProps.isDisabled)}
          onChange={(checked) => updateProp("isDisabled", checked)}
          icon={PointerOff}
        />

        <PropertySwitch
          label={PROPERTY_LABELS.CURRENT}
          isSelected={Boolean(currentProps.isCurrent)}
          onChange={(checked) => updateProp("isCurrent", checked)}
          icon={CheckCircle}
        />
      </PropertySection>
    </>
  );
});
