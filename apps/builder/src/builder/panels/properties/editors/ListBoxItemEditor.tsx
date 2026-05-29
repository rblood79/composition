import { memo } from "react";
import {
  Tag,
  Binary,
  PointerOff,
  FileText,
  Link as LinkIcon,
} from "lucide-react";
import {
  PropertyInput,
  PropertySwitch,
  PropertyCustomId,
  PropertySection,
  PropertyIconPicker,
} from "../../../components";
import { PropertyEditorProps } from "../types/editorTypes";
import { PROPERTY_LABELS } from "../../../../utils/ui/labels";
import { useCanonicalPropertyElement } from "../hooks/useCanonicalPropertyRead";

/**
 * ListBoxItemEditor — ADR-147 slot composition model.
 *
 * React Aria `ListBoxItem` 의 `<Text slot="label">`/`<Text slot="description">` + decorative
 * icon + selection indicator 에 대응하는 slot 편집기. 레거시 `Field` 자식 / "Convert to Dynamic
 * Item" 동적 모델은 제거됐다(ADR-132 dataBinding row projection 이 동적 데이터를 대체 — 데이터 소스는
 * ListBox 레벨 dataBinding/columnMapping 으로 편집). 기존 프로젝트의 Field 자식은 렌더 경로에서
 * 보존되며 hydration migration 대상이다.
 */
export const ListBoxItemEditor = memo(function ListBoxItemEditor({
  elementId,
  currentProps,
  onUpdate,
}: PropertyEditorProps) {
  const element = useCanonicalPropertyElement(elementId);
  const customId = element?.customId || "";

  const updateProp = (key: string, value: unknown) => {
    onUpdate({ [key]: value });
  };

  const labelValue = String(currentProps.label ?? currentProps.children ?? "");
  const iconValue =
    typeof currentProps.icon === "string" ? currentProps.icon : "";

  return (
    <>
      {/* Content slots (ADR-147) */}
      <PropertySection title="Content">
        <PropertyCustomId
          label="ID"
          value={customId}
          elementId={elementId}
          placeholder="listboxitem_1"
        />

        <PropertyInput
          label={PROPERTY_LABELS.LABEL}
          value={labelValue}
          onChange={(value) => updateProp("label", value || undefined)}
          icon={Tag}
        />

        <PropertyInput
          label={PROPERTY_LABELS.DESCRIPTION}
          value={String(currentProps.description ?? "")}
          onChange={(value) => updateProp("description", value || undefined)}
          icon={FileText}
        />

        <PropertyIconPicker
          label={PROPERTY_LABELS.ICON}
          value={iconValue}
          onChange={(value) => updateProp("icon", value || undefined)}
        />
      </PropertySection>

      {/* Data / selection identity */}
      <PropertySection title="Data">
        <PropertyInput
          label={PROPERTY_LABELS.VALUE}
          value={String(currentProps.value ?? "")}
          onChange={(value) => updateProp("value", value || undefined)}
          icon={Binary}
        />

        <PropertyInput
          label={PROPERTY_LABELS.TEXT_VALUE}
          value={String(currentProps.textValue ?? "")}
          onChange={(value) => updateProp("textValue", value || undefined)}
          icon={Binary}
        />

        <PropertyInput
          label={PROPERTY_LABELS.HREF}
          value={String(currentProps.href ?? "")}
          onChange={(value) => updateProp("href", value || undefined)}
          icon={LinkIcon}
        />
      </PropertySection>

      {/* State */}
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

export default ListBoxItemEditor;
