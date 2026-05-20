import { createElement, memo, useMemo, type ComponentType } from "react";
import type { ComponentSpec } from "@composition/specs";
import {
  buildInspectorFieldSections,
  getPrimitiveInspectorThemeValues,
  getPrimitiveBinding,
} from "@composition/shared";
import { PropertyCustomId, PropertySection } from "../../../components";
import { useStore } from "../../../stores";
import type { ComponentEditorProps } from "../../../inspector/types";
import { CatalogField } from "./CatalogField";
import { evaluateVisibility } from "./evaluateVisibility";
import { SpecField } from "./SpecField";
import { useCanonicalPropertyElementsMap } from "../hooks/useCanonicalPropertyRead";

interface GenericPropertyEditorProps extends ComponentEditorProps {
  componentType?: string;
  spec?: ComponentSpec<Record<string, unknown>>;
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
  componentType,
  spec,
  renderAfterSections,
}: GenericPropertyEditorProps) {
  const elementsMap = useCanonicalPropertyElementsMap();
  const editorType = componentType ?? spec?.name ?? "";
  const primitiveBinding = useMemo(
    () => getPrimitiveBinding(editorType),
    [editorType],
  );

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

  const catalogSections = useMemo(() => {
    if (!primitiveBinding?.props.accepts) return [];
    return buildInspectorFieldSections({
      componentType: primitiveBinding.tag,
      contracts: primitiveBinding.props.accepts,
      theme: getPrimitiveInspectorThemeValues(primitiveBinding.tag),
    });
  }, [primitiveBinding]);

  const { visibleSections, firstContentIndex } = useMemo(() => {
    const sections = (spec?.properties?.sections ?? []).filter((section) =>
      evaluateVisibility(section.visibleWhen, currentProps, parentTag),
    );
    return {
      visibleSections: sections,
      firstContentIndex: sections.findIndex((s) => s.title === "Content"),
    };
  }, [spec, currentProps, parentTag]);

  const firstCatalogContentIndex = useMemo(
    () => catalogSections.findIndex((s) => s.title === "Content"),
    [catalogSections],
  );
  const useCatalogSections = catalogSections.length > 0;

  const renderCustomId = () => (
    <PropertyCustomId
      label="ID"
      value={customId}
      elementId={elementId}
      onChange={updateCustomId}
      placeholder={`${editorType.toLowerCase()}_1`}
    />
  );

  return (
    <>
      {useCatalogSections && firstCatalogContentIndex === -1 && (
        <PropertySection title="Content">{renderCustomId()}</PropertySection>
      )}

      {!useCatalogSections && spec && firstContentIndex === -1 && (
        <PropertySection title="Content">{renderCustomId()}</PropertySection>
      )}

      {useCatalogSections &&
        catalogSections.map((section, sectionIndex) => (
          <PropertySection key={section.title} title={section.title}>
            {sectionIndex === firstCatalogContentIndex && renderCustomId()}
            {section.fields
              .filter((field) =>
                evaluateVisibility(field.visibleWhen, currentProps, parentTag),
              )
              .map((field) => (
                <CatalogField
                  key={`${section.title}:${field.key}:${field.kind}`}
                  field={field}
                  currentProps={currentProps}
                  onUpdate={onUpdate}
                />
              ))}
          </PropertySection>
        ))}

      {!useCatalogSections &&
        spec &&
        visibleSections.map((section, sectionIndex) => (
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
