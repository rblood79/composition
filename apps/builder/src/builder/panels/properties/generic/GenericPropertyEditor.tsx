import { createElement, memo, useMemo, type ComponentType } from "react";
import type { ComponentSpec } from "@composition/specs";
import {
  getPrimitiveBinding,
  isCatalogCutover,
  type InspectorFieldTheme,
} from "@composition/shared";
import { PropertyCustomId, PropertySection } from "../../../components";
import { useStore } from "../../../stores";
import type { ComponentEditorProps } from "../../../inspector/types";
import { CatalogInspectorFields } from "./CatalogInspectorFields";
import { evaluateVisibility } from "./evaluateVisibility";
import { inferLabel } from "./inferLabel";
import { SIZE_DISPLAY_LABELS, SpecField } from "./SpecField";
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

  // ── ADR-142: catalog generic Inspector 게이트 ──────────────────────────────
  // cutover 된 component type 은 spec.properties.sections 대신 PrimitiveBinding 의
  // accepts(PropContract) + theme 로 generic 편집 필드를 생성한다. isCatalogCutover 가
  // 비어있는 동안에는 이 분기를 타지 않음 → legacy 경로 보존 (live 회귀 0).
  const componentType = useMemo(
    () => elementsMap.get(elementId)?.type,
    [elementsMap, elementId],
  );
  const catalogBinding = componentType
    ? getPrimitiveBinding(componentType)
    : undefined;
  const useCatalog =
    componentType != null &&
    catalogBinding != null &&
    isCatalogCutover(componentType);

  // 전환기 theme adapter: variant/size 값 집합을 spec.variants/sizes keys 에서 조회
  // (목표는 theme/tokens data-* rules — Phase 5).
  const specInspectorTheme = useMemo<InspectorFieldTheme>(
    () => ({
      resolveDimensionOptions(_type, _key, kind) {
        if (kind === "variant") {
          return Object.keys(spec.variants ?? {}).map((value) => ({
            value,
            label: inferLabel(value),
          }));
        }
        return Object.keys(spec.sizes ?? {}).map((value) => ({
          value,
          label: SIZE_DISPLAY_LABELS[value] ?? value.toUpperCase(),
        }));
      },
    }),
    [spec],
  );

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

  // ── ADR-142: cutover 된 컴포넌트 → catalog generic 경로 ──────────────────────
  if (useCatalog && catalogBinding && componentType) {
    return (
      <>
        <CatalogInspectorFields
          componentType={componentType}
          contracts={catalogBinding.props.accepts}
          theme={specInspectorTheme}
          currentProps={currentProps}
          onUpdate={onUpdate}
          parentTag={parentTag}
          customIdControl={renderCustomId()}
        />
        {renderAfterSections != null &&
          createElement(renderAfterSections, {
            elementId,
            currentProps,
            onUpdate,
          })}
      </>
    );
  }

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
