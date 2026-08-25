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
import type { ItemsManagerField } from "@composition/specs";

import {
  PropertyDataBinding,
  PropertyFieldTemplateInput,
  PropertyIconPicker,
  PropertyInput,
  PropertyNumberInput,
  PropertySection,
  PropertySelect,
  PropertySizeToggle,
  PropertySwitch,
} from "../../../components";
import type { DataBindingValue } from "../../../components/property/PropertyDataBinding";
import { evaluateVisibility } from "./evaluateVisibility";
import { ItemsManager } from "./ItemsManager";
import {
  TEMPLATE_TEXT_KEYS,
  useOwnerCollectionColumns,
} from "../hooks/useOwnerCollectionColumns";

/**
 * catalog `InspectorField.itemsManager`(self-contained schema) → specs `ItemsManagerField`
 * 투영. `ItemsManager` 가 specs 타입을 요구하므로 builder 레이어에서 변환한다(catalog types
 * 는 specs 비의존 원칙 유지 — [[feedback-specs-shared-layer-not-absorption]]).
 */
function toItemsManagerField(field: InspectorField): ItemsManagerField | null {
  const im = field.itemsManager;
  if (!im) return null;
  return {
    key: field.key,
    type: "items-manager",
    label: field.label,
    itemsKey: im.itemsKey,
    itemTypeName: im.itemTypeName,
    defaultItem: im.defaultItem,
    itemSchema: im.itemSchema,
    labelKey: im.labelKey,
    allowSections: im.allowSections,
    allowSeparators: im.allowSeparators,
  };
}

interface CatalogInspectorFieldsProps {
  componentType: string;
  contracts: Record<string, PropContract>;
  theme: InspectorFieldTheme;
  currentProps: Record<string, unknown>;
  onUpdate: (updated: Record<string, unknown>) => void;
  parentTag?: string;
  /** `kind:"items-manager"` 필드(ItemsManager)가 store action(addItem/removeItem)에 필요. */
  elementId?: string;
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
  elementId,
  ownerColumns,
}: {
  field: InspectorField;
  currentProps: Record<string, unknown>;
  onUpdate: (updated: Record<string, unknown>) => void;
  elementId?: string;
  /** ADR-159 P4a: 소유 collection 컬럼 (없으면 null — 일반 입력). */
  ownerColumns?: string[] | null;
}) {
  const value = currentProps[field.key];
  const update = (v: unknown) => onUpdate({ [field.key]: v });

  switch (field.kind) {
    // fillStyle 은 고정 옵션(fill/outline 등) visual-enum → select. 출력은 data-fill-style.
    case "variant":
    case "enum":
    case "fillStyle":
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
      // ADR-159 P4a: 템플릿 대상 텍스트 키 + 소유 collection 컬럼 존재 → 필드 피커 입력.
      if (
        TEMPLATE_TEXT_KEYS.has(field.key) &&
        ownerColumns &&
        ownerColumns.length > 0
      ) {
        return (
          <PropertyFieldTemplateInput
            label={field.label}
            value={String(value ?? "")}
            onChange={(v) => update(v === "" ? undefined : v)}
            columns={ownerColumns}
          />
        );
      }
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

    // "binding" — collection data binding.
    //   field.key === "dataBinding": 외부 데이터 소스(dataTable/api/variable/route) 연결
    //     UI(PropertyDataBinding)를 렌더한다. ADR-912 catalog cutover 가 per-type editor →
    //     generic Inspector 로 전환하면서 누락된 RSP Dynamic collections 진입점 복원.
    //   그 외 binding(items 등): 의도적 Inspector no-op(toRacProps 통과 전용, 정적 items 는
    //     collections root/useResolvedCollectionItems 소유) → null 유지.
    case "binding":
      if (field.key === "dataBinding") {
        return (
          <PropertyDataBinding
            label={field.label}
            value={(value as DataBindingValue | null | undefined) ?? null}
            onChange={(v) => update(v)}
          />
        );
      }
      return null;

    // "items-manager" — collection 정적 items 배열 추가/제거 UI(ItemsManager).
    //   ADR-912 catalog cutover 로 누락된 RSP Dynamic collections 정적 편집 진입점 복원.
    //   ItemsManager 는 store action(addItem/removeItem) 에 elementId 가 필요.
    case "items-manager": {
      const imField = toItemsManagerField(field);
      if (!imField || !elementId) return null;
      return <ItemsManager elementId={elementId} field={imField} />;
    }

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
  elementId,
  customIdControl,
}: CatalogInspectorFieldsProps) {
  const groups = buildInspectorFields(componentType, contracts, theme);
  const contentIndex = groups.findIndex((g) => g.section === "content");
  // ADR-159 P4a: 조상 collection 소유자의 컬럼 — 템플릿 텍스트 키 편집 시 필드 피커.
  const ownerColumns = useOwnerCollectionColumns(elementId);

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
                elementId={elementId}
                ownerColumns={ownerColumns}
              />
            ))}
          </PropertySection>
        );
      })}
    </>
  );
});
