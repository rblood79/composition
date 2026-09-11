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
import { memo, useMemo, type ReactNode } from "react";

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
import { evaluateVisibility } from "./evaluateVisibility";
import { ItemsManager } from "./ItemsManager";
import {
  TEMPLATE_TEXT_KEYS,
  useOwnerCollectionFields,
  type OwnerField,
} from "../hooks/useOwnerCollectionColumns";
import { useCanonicalPropertyValue } from "../hooks/useCanonicalPropertyRead";

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
  /**
   * 선택 요소의 catalog 컴포넌트 이름 — 필드 아이콘의 컴포넌트 스코프 표
   * (`COMPONENT_KEY_ICONS`) 조회 키. 없으면 공유 key 표 → kind 기본만 본다.
   */
  componentType?: string;
}

interface GenericFieldRendererProps extends GenericFieldRouting {
  /** caller 가 origin 으로 필터한 필드 (Properties view = semantic / Style view = style). */
  fields: ResolvedField[];
  /** enum 옵션이 UI 문구가 아닌 원본 데이터 키인 필드. */
  literalOptionFields?: readonly string[];
  /**
   * "content" 그룹 선두에 끼워 넣을 비-catalog 컨트롤 (Button 의 Icon/Text 자식 편집 등).
   * catalog 계약으로 표현 불가한 **자식 element 축**이라 별도 컴포넌트가 공급하지만, 사용자에겐
   * 같은 Content 축이므로 섹션을 따로 만들지 않는다 (같은 제목 섹션 2개 방지).
   */
  contentExtras?: ReactNode;
  /**
   * section 별 **말미**에 끼워 넣을 비-catalog 컨트롤 (`{ series: <…>, appearance: <…> }`).
   * `contentExtras` 가 "content 선두" 한 슬롯인 것과 달리, 계약에 `editorHidden` 으로만 존재하는
   * 섹션 (Chart 의 `series`) 도 여기로 연다 — 섹션 순서는 hidden 필드를 포함한 **계약의 section
   * 첫 등장 순서**라 catalog 가 그대로 배치를 소유한다. 값이 `undefined`/`null` 인 키는 섹션을
   * 만들지 않는다 (시리즈 설정이 적용되지 않는 차트 종류에서 빈 Series 섹션 방지).
   */
  sectionExtras?: Partial<Record<string, ReactNode>>;
}

function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

interface GenericFieldProps extends GenericFieldRouting {
  field: ResolvedField;
  translateOptions?: boolean;
  /**
   * enum 값 해석 모드 — `literal` 은 옵션 값이 원본 데이터 키인 필드에 쓴다
   * (`PropertySelect.optionValueMode` 주석 참조). 라벨 번역 정책과 독립이다.
   */
  optionValueMode?: "legacy" | "literal";
  /** ADR-159 P4a: 소유 collection 컬럼 (없으면 null — 일반 입력). */
  ownerColumns?: string[] | null;
  /** ADR-152 1b: 소유 collection 필드 (key + id) — `{#id}` 저장형 변환. memo 는 ownerColumns 키로 판정 (id 는 key 에 종속). */
  ownerFields?: OwnerField[] | null;
}

function areOptionsEqual(
  previous: ResolvedField["options"],
  next: ResolvedField["options"],
): boolean {
  if (previous === next) return true;
  if (!previous || !next || previous.length !== next.length) return false;
  return previous.every(
    (option, index) =>
      option.value === next[index]?.value &&
      option.label === next[index]?.label,
  );
}

function areStringArraysEqual(
  previous: string[] | null | undefined,
  next: string[] | null | undefined,
): boolean {
  if (previous === next) return true;
  if (!previous || !next || previous.length !== next.length) return false;
  return previous.every((value, index) => value === next[index]);
}

/** currentValue/isOverridden는 leaf hook이 소유하므로 field metadata만 비교한다. */
function areGenericFieldPropsEqual(
  previous: GenericFieldProps,
  next: GenericFieldProps,
): boolean {
  const a = previous.field;
  const b = next.field;
  return (
    previous.elementId === next.elementId &&
    previous.componentType === next.componentType &&
    previous.onSemanticUpdate === next.onSemanticUpdate &&
    previous.onStyleUpdate === next.onStyleUpdate &&
    previous.translateOptions === next.translateOptions &&
    previous.optionValueMode === next.optionValueMode &&
    areStringArraysEqual(previous.ownerColumns, next.ownerColumns) &&
    a.key === b.key &&
    a.kind === b.kind &&
    a.label === b.label &&
    a.section === b.section &&
    a.origin === b.origin &&
    Object.is(a.baseValue, b.baseValue) &&
    a.min === b.min &&
    a.max === b.max &&
    a.step === b.step &&
    areOptionsEqual(a.options, b.options) &&
    a.itemsManager === b.itemsManager
  );
}

/** 단일 필드 — canonical scalar 구독 + kind switch + origin 라우팅. */
const GenericField = memo(function GenericField({
  field,
  onSemanticUpdate,
  onStyleUpdate,
  elementId,
  componentType,
  ownerColumns,
  ownerFields,
  translateOptions,
  optionValueMode,
}: GenericFieldProps) {
  const value = useCanonicalPropertyValue(
    elementId,
    field.origin,
    field.key,
    field.baseValue,
  );
  // origin 단일 진실로 write 분기 (semantic → props / style → props.style).
  const update = (v: unknown) => {
    if (field.origin === "style") onStyleUpdate(field.key, v);
    else onSemanticUpdate(field.key, v);
  };

  // 아이콘은 필드의 정체(key → kind)에서 파생한다 — catalog 계약에 icon 축이 없고,
  // key 73개가 contract 92% 를 덮으므로 binding 파일에 값을 복제할 이유가 없다.
  // 정본·근거: config/propertyFieldIcons.ts
  const icon = resolvePropertyFieldIcon(field.key, field.kind, componentType);

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
          translateOptions={translateOptions}
          optionValueMode={optionValueMode}
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
            fields={ownerFields}
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
}, areGenericFieldPropsEqual);

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
  componentType,
  contentExtras,
  sectionExtras,
  literalOptionFields,
}: GenericFieldRendererProps) {
  // ADR-159 P4a: 조상(또는 master 소비자) collection 소유자의 컬럼 — 필드 피커 소스.
  const ownerFields = useOwnerCollectionFields(elementId);
  const ownerColumns = useMemo(
    () => ownerFields?.map((f) => f.key) ?? null,
    [ownerFields],
  );

  const extraSections = Object.entries(sectionExtras ?? {}).filter(
    (entry): entry is [string, ReactNode] => entry[1] != null,
  );

  if (fields.length === 0) {
    // 계약 필드가 0 이어도 주입 컨트롤이 있으면 그것만 Content 로 렌더한다.
    if (contentExtras == null && extraSections.length === 0) return null;
    return (
      <>
        {contentExtras != null && (
          <PropertySection title="Content">{contentExtras}</PropertySection>
        )}
        {extraSections.map(([section, extras]) => (
          <PropertySection key={section} title={capitalize(section)}>
            {extras}
          </PropertySection>
        ))}
      </>
    );
  }

  /**
   * 조건 판정 입력 (ADR-208 P1ⓐ) — **`currentValue`(override ?? base)** 를 쓴다.
   *
   * 원시 `node.props[key]` 로 하면 기본값이 저장되지 않은 노드에서 조건 키가 `undefined`
   * 가 되어 `oneOf` 가 전부 거짓이 되고, 그 종류의 유효한 필드가 통째로 사라진다 (R7).
   * 계약이 이미 `override ?? default` 를 해소해 두었으므로 그것을 그대로 읽는다.
   *
   * 같은 계약 안의 형제 필드만 본다 — 조건 키가 계약 밖이면 `undefined` 로 판정되고,
   * `parentTag` 축은 이 경로에 입력이 없다(현재 선언 0건). 둘 다 생기면 조건을 추가하기
   * 전에 입력부터 잇는다.
   */
  const conditionValues: Record<string, unknown> = {};
  for (const field of fields) conditionValues[field.key] = field.currentValue;

  // section 순서 보존 그룹핑 (Map 삽입 순서 = 계약 순서).
  // 조건 미선언 필드는 `evaluateVisibility` 가 즉시 통과시킨다 — 결선의 노출면은
  //   `visibleWhen` 을 실제로 선언한 필드뿐이다.
  // 순서는 hidden 필드까지 포함해 잡는다 — `sectionExtras` 만으로 열리는 섹션 (필드가 전부
  //   `editorHidden`) 도 catalog 가 정한 자리에 선다. 빈 그룹은 extras 가 없으면 렌더하지 않는다.
  const groups = new Map<string, ResolvedField[]>();
  for (const field of fields) {
    const section = field.section || "content";
    const bucket = groups.get(section) ?? [];
    if (!groups.has(section)) groups.set(section, bucket);
    if (
      field.editorHidden ||
      !evaluateVisibility(field.visibleWhen, conditionValues)
    )
      continue;
    bucket.push(field);
  }
  const extrasBySection = new Map(extraSections);
  for (const [section] of extraSections) {
    if (!groups.has(section)) groups.set(section, []);
  }

  // 주입 컨트롤은 content 그룹 선두. content 그룹이 없으면 Content 섹션을 앞에 만든다.
  const hasContentGroup =
    groups.has("content") &&
    ((groups.get("content")?.length ?? 0) > 0 ||
      extrasBySection.has("content"));

  return (
    <>
      {contentExtras != null && !hasContentGroup && (
        <PropertySection title="Content">{contentExtras}</PropertySection>
      )}
      {Array.from(groups.entries()).map(([section, sectionFields]) => {
        const tail = extrasBySection.get(section);
        const head =
          section === "content" && hasContentGroup ? contentExtras : null;
        if (sectionFields.length === 0 && tail == null && head == null)
          return null;
        return (
          <PropertySection key={section} title={capitalize(section)}>
            {head}
            {sectionFields.map((field) => (
              <GenericField
                key={`${field.origin}:${field.key}`}
                field={field}
                onSemanticUpdate={onSemanticUpdate}
                onStyleUpdate={onStyleUpdate}
                elementId={elementId}
                componentType={componentType}
                ownerColumns={ownerColumns}
                ownerFields={ownerFields}
                translateOptions={!literalOptionFields?.includes(field.key)}
                optionValueMode={
                  literalOptionFields?.includes(field.key)
                    ? "literal"
                    : "legacy"
                }
              />
            ))}
            {tail}
          </PropertySection>
        );
      })}
    </>
  );
});
