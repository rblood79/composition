/**
 * ADR-912 단계 2 — generic field renderer (HC#1/#2).
 *
 * `resolveEditContract` 의 `ResolvedField[]` 를 `field.kind` 9종 switch 로 렌더하고,
 * `field.origin` 으로 write 를 라우팅한다. 컴포넌트별 분기 0 — 모든 노드가 동일 generic 경로.
 *
 * **origin 라우팅(write 단일 진실)**:
 * - `semantic` → `onSemanticUpdate(key, value)` (node.props, updateSelectedProperties)
 * - `style`    → `onStyleUpdate(key, value)` (node.props.style, updateSelectedStyle + distributeShorthand)
 *
 * **section 그룹핑**: 같은 `section` 필드를 `PropertySection` 으로 묶는다. caller 가
 * `fields` 를 origin 으로 필터(Properties view = semantic / Style view = style)해 넘긴다 —
 * 본 컴포넌트는 넘어온 필드 전부를 section 그룹으로 렌더(view 필터는 caller 책임).
 *
 * **kind dispatch**: `CatalogInspectorFields.CatalogField` 와 동일 9종(variant/enum/fillStyle/
 * size/boolean/string/string-array/number/icon). 단계 2 는 Properties view(semantic) 우선이라
 * style-origin number(unit 입력)는 후속(`PropertyUnitInput` 통합) — 현재는 number control 공용.
 */
import { memo, type ReactNode } from "react";

import type { ResolvedField } from "@composition/shared";
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
import { resolvePropertyFieldIcon } from "../../../config/propertyFieldIcons";
import { ItemsManager } from "./ItemsManager";
import {
  TEMPLATE_TEXT_KEYS,
  useOwnerCollectionColumns,
} from "../hooks/useOwnerCollectionColumns";

/**
 * ResolvedField.itemsManager(catalog self-contained schema) → specs `ItemsManagerField` 투영.
 * `ItemsManager` 가 specs 타입을 요구하므로 builder 레이어에서 변환한다(CatalogInspectorFields
 * 동일 패턴 — catalog types 는 specs 비의존 [[feedback-specs-shared-layer-not-absorption]]).
 */
function toItemsManagerField(field: ResolvedField): ItemsManagerField | null {
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

/** field.origin 별 write 경로. */
export interface GenericFieldRouting {
  /** origin:"semantic" → node.props[key] = value. */
  onSemanticUpdate: (key: string, value: unknown) => void;
  /** origin:"style" → node.props.style[key] = value (override-only). */
  onStyleUpdate: (key: string, value: unknown) => void;
  /** `kind:"items-manager"`(ItemsManager) 가 store action(addItem/removeItem)에 필요. */
  elementId?: string;
}

interface GenericFieldRendererProps extends GenericFieldRouting {
  /** caller 가 origin 으로 필터한 필드 (Properties view = semantic / Style view = style). */
  fields: ResolvedField[];
  /**
   * "content" 그룹 선두에 끼워 넣을 비-catalog 컨트롤 (Button 의 Icon/Text 자식 편집 등).
   * catalog 계약으로 표현 불가한 **자식 element 축**이라 별도 컴포넌트가 공급하지만, 사용자에겐
   * 같은 Content 축이므로 섹션을 따로 만들지 않는다 (같은 제목 섹션 2개 방지).
   */
  contentExtras?: ReactNode;
}

function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** 단일 필드 — kind switch + origin 라우팅. */
const GenericField = memo(function GenericField({
  field,
  onSemanticUpdate,
  onStyleUpdate,
  elementId,
  ownerColumns,
}: {
  field: ResolvedField;
  /** ADR-159 P4a: 소유 collection 컬럼 (없으면 null — 일반 입력). */
  ownerColumns?: string[] | null;
} & GenericFieldRouting) {
  const value = field.currentValue;
  // origin 단일 진실로 write 분기 (semantic → props / style → props.style).
  const update = (v: unknown) => {
    if (field.origin === "style") onStyleUpdate(field.key, v);
    else onSemanticUpdate(field.key, v);
  };

  // 아이콘은 필드의 정체(key → kind)에서 파생한다 — catalog 계약에 icon 축이 없고,
  // key 73개가 contract 92% 를 덮으므로 binding 파일에 값을 복제할 이유가 없다.
  // 정본·근거: config/propertyFieldIcons.ts
  const icon = resolvePropertyFieldIcon(field.key, field.kind);

  switch (field.kind) {
    // fillStyle 은 고정 옵션(fill/outline 등) visual-enum → select. 출력은 data-fill-style.
    case "variant":
    case "enum":
    case "fillStyle":
      return (
        <PropertySelect
          icon={icon}
          label={field.label}
          value={String(value ?? field.baseValue ?? "")}
          onChange={(v) => update(v)}
          options={field.options ?? []}
        />
      );

    case "size":
      return (
        <PropertySizeToggle
          label={field.label}
          value={String(value ?? field.baseValue ?? "")}
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
          icon={icon}
          label={field.label}
          isSelected={Boolean(value ?? field.baseValue)}
          onChange={(checked) => update(checked)}
        />
      );

    case "string":
      // ADR-159 P4a: 템플릿 대상 텍스트 키(semantic) + 소유 collection 컬럼 존재
      //   → `{field}` 필드 피커 입력. 그 외는 일반 입력 유지.
      if (
        field.origin !== "style" &&
        TEMPLATE_TEXT_KEYS.has(field.key) &&
        ownerColumns &&
        ownerColumns.length > 0
      ) {
        return (
          <PropertyFieldTemplateInput
            icon={icon}
            label={field.label}
            value={String(value ?? "")}
            onChange={(v) => update(v === "" ? undefined : v)}
            columns={ownerColumns}
          />
        );
      }
      return (
        <PropertyInput
          icon={icon}
          label={field.label}
          value={String(value ?? "")}
          onChange={(v) => update(v === "" ? undefined : v)}
        />
      );

    case "string-array": {
      const display = Array.isArray(value) ? value.join(", ") : "";
      return (
        <PropertyInput
          icon={icon}
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
          icon={icon}
          label={field.label}
          value={
            value != null
              ? Number(value)
              : field.baseValue != null
                ? Number(field.baseValue)
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
    //     UI(PropertyDataBinding)를 렌더 — ADR-912 catalog cutover 로 누락된 RSP Dynamic
    //     collections 진입점 복원. CatalogInspectorFields 와 동일 처리.
    //   그 외 binding(items 등): 의도적 Inspector no-op(toRacProps 통과 전용) → null.
    case "binding":
      if (field.key === "dataBinding") {
        return (
          <PropertyDataBinding
            icon={icon}
            label={field.label}
            value={(value as DataBindingValue | null | undefined) ?? null}
            onChange={(v) => update(v)}
          />
        );
      }
      return null;

    // "items-manager" — collection 정적 items 배열 추가/제거 UI(ItemsManager).
    //   ADR-912 catalog cutover 로 누락된 RSP Dynamic collections 정적 편집 진입점 복원.
    //   ItemsManager 는 store action(addItem/removeItem)에 elementId 필요.
    case "items-manager": {
      const imField = toItemsManagerField(field);
      if (!imField || !elementId) return null;
      return <ItemsManager elementId={elementId} field={imField} />;
    }

    default:
      return null;
  }
});

/**
 * ResolvedField[] → section 그룹 + kind dispatch 렌더.
 *
 * 같은 `section` 을 `PropertySection` 으로 묶되, 입력 순서(계약 순서)를 보존한다.
 */
export const GenericFieldRenderer = memo(function GenericFieldRenderer({
  fields,
  onSemanticUpdate,
  onStyleUpdate,
  elementId,
  contentExtras,
}: GenericFieldRendererProps) {
  // ADR-159 P4a: 조상(또는 master 소비자) collection 소유자의 컬럼 — 필드 피커 소스.
  const ownerColumns = useOwnerCollectionColumns(elementId);

  if (fields.length === 0) {
    // 계약 필드가 0 이어도 주입 컨트롤이 있으면 그것만 Content 로 렌더한다.
    return contentExtras != null ? (
      <PropertySection title="Content">{contentExtras}</PropertySection>
    ) : null;
  }

  // section 순서 보존 그룹핑 (Map 삽입 순서 = 계약 순서).
  const groups = new Map<string, ResolvedField[]>();
  for (const field of fields) {
    const section = field.section || "content";
    const bucket = groups.get(section);
    if (bucket) bucket.push(field);
    else groups.set(section, [field]);
  }

  // 주입 컨트롤은 content 그룹 선두. content 그룹이 없으면 Content 섹션을 앞에 만든다.
  const hasContentGroup = groups.has("content");

  return (
    <>
      {contentExtras != null && !hasContentGroup && (
        <PropertySection title="Content">{contentExtras}</PropertySection>
      )}
      {Array.from(groups.entries()).map(([section, sectionFields]) => (
        <PropertySection key={section} title={capitalize(section)}>
          {section === "content" && contentExtras}
          {sectionFields.map((field) => (
            <GenericField
              key={`${field.origin}:${field.key}`}
              field={field}
              onSemanticUpdate={onSemanticUpdate}
              onStyleUpdate={onStyleUpdate}
              elementId={elementId}
              ownerColumns={ownerColumns}
            />
          ))}
        </PropertySection>
      ))}
    </>
  );
});
