import { createElement, memo, useMemo, type ComponentType } from "react";
import type { ComponentSpec } from "@composition/specs";
import { PropertyCustomId, PropertySection } from "../../../components";
import { useStore } from "../../../stores";
import type { ComponentEditorProps } from "../../../inspector/types";
import { evaluateVisibility } from "./evaluateVisibility";
import { SpecField } from "./SpecField";
import { useCanonicalPropertyElementsMap } from "../hooks/useCanonicalPropertyRead";

interface GenericPropertyEditorProps extends ComponentEditorProps {
  spec: ComponentSpec<Record<string, unknown>>;
  renderAfterSections?: ComponentType<{
    elementId: string;
    currentProps: Record<string, unknown>;
    onUpdate: (updatedProps: Record<string, unknown>) => void;
  }>;
}

export const GenericPropertyEditor = memo(function GenericPropertyEditor({
  elementId,
  currentProps,
  onUpdate,
  spec,
  renderAfterSections,
}: GenericPropertyEditorProps) {
  const elementsMap = useCanonicalPropertyElementsMap();

  const customId = useMemo(() => {
    const element = elementsMap.get(elementId);
    return element?.customId || "";
  }, [elementsMap, elementId]);

  const parentTag = useMemo(() => {
    const element = elementsMap.get(elementId);
    if (!element?.parent_id) return undefined;
    const parent = elementsMap.get(element.parent_id);
    return parent?.type;
  }, [elementsMap, elementId]);

  const updateCustomId = (newCustomId: string) => {
    const updateElement = useStore.getState().updateElement;
    if (updateElement && elementId) {
      updateElement(elementId, { customId: newCustomId });
    }
  };

  const { visibleSections, firstContentIndex } = useMemo(() => {
    const sections = (spec.properties?.sections ?? []).filter((section) =>
      evaluateVisibility(section.visibleWhen, currentProps, parentTag),
    );
    return {
      visibleSections: sections,
      firstContentIndex: sections.findIndex((s) => s.title === "Content"),
    };
  }, [spec, currentProps, parentTag]);

  const renderCustomId = () => (
    <PropertyCustomId
      label="ID"
      value={customId}
      elementId={elementId}
      onChange={updateCustomId}
      placeholder={`${spec.name.toLowerCase()}_1`}
    />
  );

  return (
    <>
      {firstContentIndex === -1 && (
        <PropertySection title="Content">{renderCustomId()}</PropertySection>
      )}

      {visibleSections.map((section, sectionIndex) => (
        <PropertySection key={section.title} title={section.title}>
          {sectionIndex === firstContentIndex && renderCustomId()}
          {section.fields
            .filter((field) =>
              evaluateVisibility(field.visibleWhen, currentProps, parentTag),
            )
            .map((field, index) => (
              <SpecField
                key={`${section.title}:${"key" in field ? (field.key ?? field.type) : field.type}:${index}`}
                field={field}
                spec={spec}
                currentProps={currentProps}
                onUpdate={onUpdate}
                elementId={elementId}
              />
            ))}
        </PropertySection>
      ))}

      {renderAfterSections != null &&
        createElement(renderAfterSections, {
          elementId,
          currentProps,
          onUpdate,
        })}
    </>
  );
});
