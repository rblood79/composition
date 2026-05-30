/**
 * ADR-142 — generic Inspector 렌더러 (M1 #8 live 배선).
 *
 * `buildInspectorFields`(PropContract + theme → 필드 그룹) 결과를 `PropertySection` +
 * kind 별 control primitive 로 렌더한다. 컴포넌트당 `spec.properties.sections` /
 * `SpecField` 분기를 대체 — 모든 컴포넌트가 동일 generic 경로로 편집된다.
 *
 * cutover 게이트(`isCatalogCutover`)는 `GenericPropertyEditor` 가 적용한다. 본 컴포넌트는
 * 게이트와 무관하게 독립 렌더 가능 — 단위 테스트는 이를 직접 렌더한다.
 */
import { memo } from "react";

import {
  buildInspectorFields,
  type InspectorField,
  type InspectorFieldTheme,
  type PropContract,
} from "@composition/shared";

import {
  PropertyIconPicker,
  PropertyInput,
  PropertyNumberInput,
  PropertySection,
  PropertySelect,
  PropertySizeToggle,
  PropertySwitch,
} from "../../../components";
import { evaluateVisibility } from "./evaluateVisibility";

interface CatalogInspectorFieldsProps {
  componentType: string;
  contracts: Record<string, PropContract>;
  theme: InspectorFieldTheme;
  currentProps: Record<string, unknown>;
  onUpdate: (updated: Record<string, unknown>) => void;
  parentTag?: string;
  /** 첫 "content" 그룹(또는 없으면 선두 Content 섹션)에 주입할 ID 컨트롤 등. */
  customIdControl?: React.ReactNode;
}

function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

const CatalogField = memo(function CatalogField({
  field,
  currentProps,
  onUpdate,
}: {
  field: InspectorField;
  currentProps: Record<string, unknown>;
  onUpdate: (updated: Record<string, unknown>) => void;
}) {
  const value = currentProps[field.key];
  const update = (v: unknown) => onUpdate({ [field.key]: v });

  switch (field.kind) {
    case "variant":
    case "enum":
      return (
        <PropertySelect
          label={field.label}
          value={String(value ?? field.default ?? "")}
          onChange={(v) => update(v)}
          options={field.options ?? []}
        />
      );

    case "size":
      return (
        <PropertySizeToggle
          label={field.label}
          value={String(value ?? field.default ?? "")}
          onChange={(v) => update(v)}
          options={(field.options ?? []).map((o) => ({
            id: o.value,
            label: o.label,
          }))}
        />
      );

    case "boolean":
      return (
        <PropertySwitch
          label={field.label}
          isSelected={Boolean(value ?? field.default)}
          onChange={(checked) => update(checked)}
        />
      );

    case "string":
      return (
        <PropertyInput
          label={field.label}
          value={String(value ?? "")}
          onChange={(v) => update(v === "" ? undefined : v)}
        />
      );

    case "string-array": {
      const display = Array.isArray(value) ? value.join(", ") : "";
      return (
        <PropertyInput
          label={field.label}
          value={display}
          onChange={(v) => {
            const parts = v
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
            update(parts.length > 0 ? parts : undefined);
          }}
        />
      );
    }

    case "number":
      return (
        <PropertyNumberInput
          label={field.label}
          value={
            value != null
              ? Number(value)
              : field.default != null
                ? Number(field.default)
                : undefined
          }
          onChange={(val) => update(val)}
          min={field.min}
          max={field.max}
          step={field.step}
        />
      );

    case "icon":
      return (
        <PropertyIconPicker
          label={field.label}
          value={value as string | undefined}
          onChange={(name) => update(name)}
          onClear={() => update(undefined)}
        />
      );

    // "binding" — collection data binding 은 Phase 6 collections family 에서 처리
    default:
      return null;
  }
});

export const CatalogInspectorFields = memo(function CatalogInspectorFields({
  componentType,
  contracts,
  theme,
  currentProps,
  onUpdate,
  parentTag,
  customIdControl,
}: CatalogInspectorFieldsProps) {
  const groups = buildInspectorFields(componentType, contracts, theme);
  const contentIndex = groups.findIndex((g) => g.section === "content");

  return (
    <>
      {contentIndex === -1 && customIdControl != null && (
        <PropertySection title="Content">{customIdControl}</PropertySection>
      )}

      {groups.map((group, groupIndex) => {
        const visible = group.fields.filter((f) =>
          evaluateVisibility(f.visibleWhen, currentProps, parentTag),
        );
        const showCustomId =
          groupIndex === contentIndex && customIdControl != null;
        if (visible.length === 0 && !showCustomId) return null;

        return (
          <PropertySection
            key={group.section}
            title={capitalize(group.section)}
          >
            {showCustomId && customIdControl}
            {visible.map((field) => (
              <CatalogField
                key={field.key}
                field={field}
                currentProps={currentProps}
                onUpdate={onUpdate}
              />
            ))}
          </PropertySection>
        );
      })}
    </>
  );
});
