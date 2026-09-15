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
import { memo, useCallback, useMemo, type ReactNode } from "react";

import type { ResolvedField } from "@composition/shared";
import type { ItemsManagerField } from "@composition/specs";
import { useVisibleVariableNames } from "../hooks/useVisibleVariableNames";

import {
  PropertyChipGroup,
  PropertyDataBinding,
  PropertyDataBindingCreateAction,
  PropertyFieldTemplateInput,
  PropertyIconPicker,
  PropertyInput,
  PropertyNumberInput,
  PropertyPlacementPicker,
  PropertySection,
  PropertySegment,
  PropertySelect,
  PropertySlider,
} from "../../../components";
import type { PropertyChip } from "../../../components/property/PropertyChipGroup";
import {
  resolveFieldEditor,
  sizeSegOptions,
  VARIANT_SWATCH,
  type ChipGroup,
  type FieldEditor,
} from "./fieldEditor";
import { useI18n } from "../../../../i18n";
import type { DataBindingValue } from "../../../components/property/PropertyDataBinding";
import { evaluateVisibility } from "./evaluateVisibility";
import { ItemsManager } from "./ItemsManager";
import {
  TEMPLATE_TEXT_KEYS,
  useOwnerCollectionFields,
  type OwnerField,
} from "../hooks/useOwnerCollectionColumns";
import {
  useCanonicalPropertyValue,
  useCanonicalPropertyValuesSnapshot,
} from "../hooks/useCanonicalPropertyRead";

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

/**
 * 계약 section → 섹션 제목. `state` (isDisabled · selectionMode · href …) 는 「Behavior」 — 같은
 * 패널의 ADR-214 상태 변수 절이 「State」 라 제목이 둘 겹쳤다 (2026-09-15). 나머지는 첫 글자만.
 */
function sectionTitle(section: string): string {
  return section === "state" ? "Behavior" : capitalize(section);
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

/**
 * 필드가 차지하는 폭 — `wide` 는 1·2열 합침 (값이 긴 텍스트 · 목록), `half` 는 한 열 (셀렉트 ·
 * 숫자 · 스위치) 로 두 개가 한 행에 선다 (panel-ui 07, Styles 패널의 「W | H」 행과 같은 격자).
 */
/**
 * 글자 폭 (px) — 반폭 칸에 값이 들어가는지 판정. canvas measureText (패널 글꼴 12) 가 있으면
 * 그것, 없으면 (jsdom) 글자당 7. 값 자리는 셀렉트 55 (87 − pad 8 − chevron 20 − gap 4).
 */
let measureCtx: CanvasRenderingContext2D | null | undefined;
function textWidth(text: string): number {
  if (measureCtx === undefined) {
    try {
      measureCtx =
        typeof document === "undefined"
          ? null
          : document.createElement("canvas").getContext("2d");
      if (measureCtx) {
        measureCtx.font = `12px ${getComputedStyle(document.body).fontFamily || "system-ui"}`;
      }
    } catch {
      measureCtx = null;
    }
  }
  if (!measureCtx) return text.length * 7;
  return measureCtx.measureText(text).width;
}
const HALF_LEGEND = 87;
/** 반폭 셀렉트의 값 자리 — 87 − 상자 pad 8 − chevron 20 (값 ↔ chevron gap 0) */
const HALF_SELECT_VALUE = 59;

/**
 * variant · size 가 하나뿐인 필드 (「Size: M」 · 「Variant: Default」 — theme rule 의 dimension 이 한
 * 단계) 는 고를 게 없다 — 행을 만들지 않는다. enum 은 대상이 아니다 (Chart 의 매핑 셀렉트는
 * collection 컬럼이 하나여도 무엇이 매핑됐는지 보여야 한다).
 */
function isSingleChoice(field: ResolvedField): boolean {
  return (
    (field.kind === "variant" || field.kind === "size") &&
    field.options?.length === 1
  );
}

function fieldSpan(field: ResolvedField): "wide" | "half" {
  const editor = resolveFieldEditor(field);
  switch (editor.type) {
    // seg 는 매핑표가 폭을 정한다 (2~3 반폭 · 4~5 전폭 · 라벨이 칸에 안 들어가면 전폭)
    case "seg":
      return editor.span;
    // 셀렉트는 반폭 — legend (「Necessity Indicator」) 나 옵션 라벨 (「Categorical」) 이 반폭 칸에
    //   안 들어갈 때만 전폭 (2026-09-15 live 전수 대조)
    case "select": {
      if (textWidth(field.label) > HALF_LEGEND) return "wide";
      // 색 점 (12 + 여백 4) 이 값 자리를 먹는다
      const valueRoom = editor.swatch
        ? HALF_SELECT_VALUE - 16
        : HALF_SELECT_VALUE;
      if ((field.options ?? []).some((o) => textWidth(o.label) > valueRoom))
        return "wide";
      return "half";
    }
    // 스텝퍼는 반폭 — 「Min Length | Max Length」 두 개가 한 행
    case "stepper":
      return textWidth(field.label) > HALF_LEGEND ? "wide" : "half";
    // 슬라이더 (트랙 + 값) · 9-위치 피커 · 텍스트 · icon · 목록 · 칩 묶음은 전폭
    default:
      return "wide";
  }
}

/**
 * 섹션 순서 — 계약의 등장 순서가 컴포넌트마다 달라 (Pagination 은 Appearance → Content, Disclosure 는
 * State 가 Appearance 앞) 한 순서로 세운다: 정체 (Content) → 모양 (Appearance · Layout) → 동작
 * (State · Interaction) → Locale. 표 밖 섹션은 그 뒤에 계약 순서대로.
 */
const SECTION_ORDER: readonly string[] = [
  "content",
  "appearance",
  "layout",
  "state",
  "interaction",
  "locale",
];
function sectionRank(section: string): number {
  const i = SECTION_ORDER.indexOf(section);
  return i === -1 ? SECTION_ORDER.length : i;
}

/**
 * 섹션 안 필드 순서 — kind 로 묶는다 (안정 정렬이라 같은 묶음 안은 계약 순서): Variant · Size
 * (「Variant | Size」 첫 행) → 텍스트 (label · placeholder · name …) → 셀렉트 (반폭 먼저, 전폭
 * 뒤) → 숫자 → 스위치 → 목록 (data binding · items). 같은 컨트롤이 모여 반폭 짝이 비지 않고,
 * 컴포넌트마다 다르던 계약 순서 (TextField 는 Type 이 Label 과 Value 사이, Popover 는 스위치가
 * 숫자 사이) 가 한 규칙이 된다.
 */
function fieldRank(field: ResolvedField): number {
  // 반폭 묶음 (seg · 셀렉트 · 스텝퍼) 은 반폭 먼저 전폭 뒤 — 전폭이 사이에 끼어 반폭 짝을 깨지 않게
  const wide = fieldSpan(field) === "wide" ? 1 : 0;
  switch (field.kind) {
    case "variant":
      return 0;
    case "size":
      return 1;
    case "string":
    case "string-array":
    case "icon":
      return 2;
    case "enum":
    case "fillStyle":
      return 3 + wide;
    case "number":
      return 5 + wide;
    case "boolean":
      return 7;
    default:
      return 9;
  }
}
function sortFields(fields: readonly ResolvedField[]): ResolvedField[] {
  const ranked = fields
    .map((field, index) => ({ field, index, rank: fieldRank(field) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.field);
  // 조건부 필드는 자기 조건 키 바로 뒤에 — 「Show Value Label」 스위치와 「Value Label」 입력,
  //   「Label Position」 과 「Label Align」 처럼 켜는 쪽과 켜지는 쪽이 한 자리에 (2026-09-15 사용자
  //   지적 — kind 묶음만 따르면 둘이 갈라진다). 조건 키가 다른 섹션이면 그대로.
  const out: ResolvedField[] = [];
  const dependents = new Map<string, ResolvedField[]>();
  for (const field of ranked) {
    const gate =
      field.visibleWhen && "key" in field.visibleWhen
        ? field.visibleWhen.key
        : undefined;
    if (gate && gate !== field.key && ranked.some((f) => f.key === gate)) {
      dependents.set(gate, [...(dependents.get(gate) ?? []), field]);
    }
  }
  const placed = new Set<ResolvedField>();
  const push = (field: ResolvedField) => {
    if (placed.has(field)) return;
    placed.add(field);
    out.push(field);
    for (const dep of dependents.get(field.key) ?? []) push(dep);
  };
  for (const field of ranked) {
    const gate =
      field.visibleWhen && "key" in field.visibleWhen
        ? field.visibleWhen.key
        : undefined;
    if (gate && dependents.get(gate)?.includes(field)) continue; // 게이트가 넣는다
    push(field);
  }
  return out;
}

/** 연속한 half 필드 둘을 한 행으로 묶는다. wide 는 행 하나를 혼자 쓴다. */
function packFieldRows(fields: readonly ResolvedField[]): ResolvedField[][] {
  const rows: ResolvedField[][] = [];
  for (const field of fields) {
    const last = rows[rows.length - 1];
    if (
      fieldSpan(field) === "half" &&
      last &&
      last.length === 1 &&
      fieldSpan(last[0]!) === "half"
    ) {
      last.push(field);
    } else {
      rows.push([field]);
    }
  }
  return rows;
}

/** 단일 필드 — canonical scalar 구독 + kind switch + origin 라우팅. */
const GenericField = memo(function GenericField({
  field,
  onSemanticUpdate,
  onStyleUpdate,
  elementId,
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

  const stateNames = useVisibleVariableNames(elementId);
  const { t } = useI18n();
  // 형제에 묶인 값 슬라이더 (Slider/Meter/ProgressBar `value`) 의 양끝 — 형제 prop 을 같이 읽는다.
  //   훅은 무조건 부른다 (조건부 금지); 해당 없는 필드는 읽은 값을 쓰지 않는다.
  const boundMin = useCanonicalPropertyValue(
    elementId,
    field.origin,
    "minValue",
    undefined,
  );
  const boundMax = useCanonicalPropertyValue(
    elementId,
    field.origin,
    "maxValue",
    undefined,
  );
  const boundStep = useCanonicalPropertyValue(
    elementId,
    field.origin,
    "step",
    undefined,
  );

  // 라벨은 전부 legend (상자 위) — Styles 패널과 같은 어법 (2026-09-15 사용자 판정; 종전 전폭
  //   행의 상자 안 suffix 라벨 · 스위치 inline 행은 폐기). 아이콘 prefix 는 legend 가 정체를
  //   말하므로 두지 않는다.

  // 옵션이 데이터에서 오는 필드 (Chart 의 컬럼 매핑 — `literal` 모드) 는 셀렉트 — 값 집합이 문서마다
  //   달라 seg 판정의 대상이 아니다
  const editor: FieldEditor =
    optionValueMode === "literal"
      ? { type: "select" }
      : resolveFieldEditor(field);

  switch (field.kind) {
    // 선택지 (variant · size · fillStyle · enum) — 매핑표 (fieldEditor.ts) 가 컨트롤을 정한다:
    //   seg (글자 · 아이콘 · 색 점) / 9-위치 피커 / 스와치 seg / 셀렉트 (+색 점). 2026-09-15 사용자
    //   판정 — 옵션 수·글자 폭이 아니라 필드 의미로, 같은 키는 어느 컴포넌트에서든 같은 컨트롤.
    case "variant":
    case "enum":
    case "fillStyle":
    case "size": {
      const current = String(value ?? field.baseValue ?? "");
      const options = field.options ?? [];
      if (editor.type === "placement") {
        return (
          <PropertyPlacementPicker
            label={field.label}
            value={current}
            onChange={(v) => update(v)}
            options={options}
          />
        );
      }
      if (editor.type === "swatch-seg") {
        // staticColor — Auto 는 글자, White/Black 은 색 점만
        return (
          <PropertySegment
            label={field.label}
            value={current}
            onChange={(v) => update(v)}
            swatchOnly
            options={options.map((o) => ({
              value: o.value,
              label: o.label,
              swatch:
                o.value === "white"
                  ? "#fff"
                  : o.value === "black"
                    ? "#000"
                    : undefined,
            }))}
          />
        );
      }
      if (editor.type === "seg") {
        // size 는 5단까지 — 초과 단계 (Text 의 2XL/3XL) 는 Styles 패널 font-size 로. 값이 그 밖이면
        //   seg 는 선택 없음 + legend 뒤 「3XL · set in Styles」
        const segOptions =
          field.kind === "size" ? sizeSegOptions(options) : options;
        const currentLabel =
          options.find((o) => o.value === current)?.label ?? current;
        return (
          <PropertySegment
            label={field.label}
            value={current}
            onChange={(v) => update(v)}
            outOfRangeHint={
              field.kind === "size"
                ? `${currentLabel} · ${t("propertiesPanel.sizeOutOfRange")}`
                : undefined
            }
            options={segOptions.map((o) => ({
              value: o.value,
              label: o.label,
              icon: editor.icons?.[o.value],
              swatch: editor.swatch ? VARIANT_SWATCH[o.value] : undefined,
            }))}
          />
        );
      }
      return (
        <PropertySelect
          label={field.label}
          value={current}
          onChange={(v) => update(v)}
          options={options}
          translateOptions={translateOptions}
          optionValueMode={optionValueMode}
          swatches={
            editor.type === "select" && editor.swatch
              ? VARIANT_SWATCH
              : undefined
          }
        />
      );
    }

    // boolean 은 섹션 단위 칩 묶음 (`ChipGroupField`) 이 그린다 — 여기로 오면 묶음 밖 (없어야 한다)
    case "boolean":
      return null;

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
          label={field.label}
          value={String(value ?? "")}
          onChange={(v) => update(v === "" ? undefined : v)}
          // ADR-214 Phase 3 — `{{` 자동완성 (가시성 사슬의 변수 이름), style 축은 제외
          stateNames={field.origin === "style" ? undefined : stateNames}
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

    case "number": {
      const numeric =
        value != null
          ? Number(value)
          : field.baseValue != null
            ? Number(field.baseValue)
            : undefined;
      // 상한 있는 수 (strokeWidth · 각도 · 반지름 · 지속시간 …) 는 슬라이더 + 직접 입력 값 칸 —
      //   「어디쯤」 이 보인다 (Styles 「Width ──●── 1 px」 와 같은 행). 나머지는 스텝퍼.
      if (editor.type === "slider") {
        return (
          <PropertySlider
            label={field.label}
            value={numeric ?? editor.min}
            onChange={() => {}}
            onChangeEnd={(val) => update(val)}
            editable
            unit={editor.unit}
            min={editor.min}
            max={editor.max}
            step={editor.step}
            formatValue={(val) => String(val)}
          />
        );
      }
      // `value` 는 형제 minValue~maxValue 에 묶인다 — 양끝이 곧 min/max (없으면 0~100), 눈금은 step.
      //   min > max 같은 역전은 슬라이더가 못 그리므로 스텝퍼로 내려간다.
      if (editor.type === "slider-bound") {
        const min = typeof boundMin === "number" ? boundMin : 0;
        const max = typeof boundMax === "number" ? boundMax : 100;
        const step =
          typeof boundStep === "number" && boundStep > 0 ? boundStep : 1;
        if (max > min) {
          return (
            <PropertySlider
              label={field.label}
              value={numeric ?? min}
              onChange={() => {}}
              onChangeEnd={(val) => update(val)}
              editable
              min={min}
              max={max}
              step={step}
              formatValue={(val) => String(val)}
            />
          );
        }
      }
      return (
        <PropertyNumberInput
          label={field.label}
          value={numeric}
          onChange={(val) => update(val)}
          min={field.min}
          max={field.max}
          step={field.step}
        />
      );
    }

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
        // fieldset (1·2열) + 행 끝 28 열의 「새 테이블」 아이콘 — 같은 `.fieldset-row` 의
        // 형제라 fragment 로 둘을 낸다 (Attributes ID 행의 복사 아이콘과 같은 자리).
        return (
          <>
            <PropertyDataBinding
              label={field.label}
              value={(value as DataBindingValue | null | undefined) ?? null}
              onChange={(v) => update(v)}
            />
            <PropertyDataBindingCreateAction />
          </>
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

const CHIP_GROUP_ORDER: readonly ChipGroup[] = ["Options", "Show", "Fill"];
const CHIP_GROUP_LABEL_KEY = {
  Options: "propertiesPanel.chipGroupOptions",
  Show: "propertiesPanel.chipGroupShow",
  Fill: "propertiesPanel.chipGroupFill",
} as const;

type ChipEditor = Extract<FieldEditor, { type: "chip" }>;

/**
 * 같은 섹션의 boolean (+ On/Off enum) 을 한 묶음으로 — 섹션당 그룹 (Options / Show / Fill) 하나씩.
 * 각 칩은 자기 prop 하나를 쓴다 (부정형은 반전 · On/Off enum 은 on/off 문자열).
 */
const ChipGroupField = memo(function ChipGroupField({
  group,
  fields,
  onSemanticUpdate,
  onStyleUpdate,
  elementId,
}: GenericFieldRouting & { group: ChipGroup; fields: ResolvedField[] }) {
  const { t } = useI18n();
  const editors = useMemo(
    () => fields.map((f) => resolveFieldEditor(f) as ChipEditor),
    [fields],
  );
  const keys = useMemo(() => fields.map((f) => f.key), [fields]);
  const bases = useMemo(() => fields.map((f) => f.baseValue), [fields]);
  // 묶음의 origin 은 같다 (semantic) — 첫 필드 기준
  const origin = fields[0]?.origin ?? "semantic";
  const snapshot = useCanonicalPropertyValuesSnapshot(
    elementId,
    origin,
    keys,
    bases,
  );
  const chips = useMemo<PropertyChip[]>(() => {
    const values = JSON.parse(snapshot) as unknown[];
    return fields.map((field, index) => {
      const editor = editors[index]!;
      const raw = values[index];
      const on = editor.onValue != null ? raw === editor.onValue : Boolean(raw);
      return {
        key: field.key,
        label: editor.label,
        selected: editor.negate ? !on : on,
      };
    });
  }, [editors, fields, snapshot]);
  const handleToggle = useCallback(
    (key: string, selected: boolean) => {
      const index = fields.findIndex((f) => f.key === key);
      const editor = editors[index];
      const field = fields[index];
      if (!editor || !field) return;
      const on = editor.negate ? !selected : selected;
      const next =
        editor.onValue != null
          ? on
            ? editor.onValue
            : editor.offValue
          : on;
      if (field.origin === "style") onStyleUpdate(key, next);
      else onSemanticUpdate(key, next);
    },
    [editors, fields, onSemanticUpdate, onStyleUpdate],
  );
  return (
    <PropertyChipGroup
      label={t(CHIP_GROUP_LABEL_KEY[group])}
      chips={chips}
      onToggle={handleToggle}
    />
  );
});

/** 섹션 필드를 칩 묶음 / 칩에 종속된 필드 / 나머지로 나눈다. */
function splitChipFields(fields: readonly ResolvedField[]): {
  rows: ResolvedField[];
  chipGroups: Array<{ group: ChipGroup; fields: ResolvedField[] }>;
  dependents: ResolvedField[];
} {
  const chipKeys = new Set<string>();
  const byGroup = new Map<ChipGroup, ResolvedField[]>();
  for (const field of fields) {
    const editor = resolveFieldEditor(field);
    if (editor.type !== "chip") continue;
    chipKeys.add(field.key);
    byGroup.set(editor.group, [...(byGroup.get(editor.group) ?? []), field]);
  }
  const rows: ResolvedField[] = [];
  const dependents: ResolvedField[] = [];
  for (const field of fields) {
    if (chipKeys.has(field.key)) continue;
    const gate =
      field.visibleWhen && "key" in field.visibleWhen
        ? field.visibleWhen.key
        : undefined;
    // 게이트가 칩이면 (Show Value Label → Value Label) 묶음 바로 아래
    if (gate && chipKeys.has(gate)) dependents.push(field);
    else rows.push(field);
  }
  const chipGroups = CHIP_GROUP_ORDER.filter((g) => byGroup.has(g)).map(
    (group) => ({ group, fields: byGroup.get(group)! }),
  );
  return { rows, chipGroups, dependents };
}

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
          <PropertySection key={section} title={sectionTitle(section)}>
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
      !evaluateVisibility(field.visibleWhen, conditionValues) ||
      // binding(items 등) 은 Inspector no-op — 행을 만들면 빈 8px 간격만 남는다
      (field.kind === "binding" && field.key !== "dataBinding") ||
      isSingleChoice(field)
    )
      continue;
    bucket.push(field);
  }
  const extrasBySection = new Map(extraSections);
  for (const [section] of extraSections) {
    if (!groups.has(section)) groups.set(section, []);
  }
  // 표 밖 섹션의 2차 키 — 계약 등장 순서
  const sectionOrder = Array.from(groups.keys());

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
      {Array.from(groups.entries())
        .sort(
          ([a], [b]) =>
            sectionRank(a) - sectionRank(b) ||
            sectionOrder.indexOf(a) - sectionOrder.indexOf(b),
        )
        .map(([section, sectionFields]) => {
          const tail = extrasBySection.get(section);
          const head =
            section === "content" && hasContentGroup ? contentExtras : null;
          if (sectionFields.length === 0 && tail == null && head == null)
            return null;
          return (
            <PropertySection key={section} title={sectionTitle(section)}>
              {head}
              {(() => {
                const { rows, chipGroups, dependents } =
                  splitChipFields(sectionFields);
                const renderRows = (list: readonly ResolvedField[]) =>
                  packFieldRows(sortFields(list)).map((row) =>
                    // 목록 (items) 은 행 래퍼 없이 전폭 217 — 행의 액션 그룹이 28 열을 쓴다 (Fill 행과 같음)
                    row.length === 1 && row[0]!.kind === "items-manager" ? (
                      <GenericField
                        key={`${row[0]!.origin}:${row[0]!.key}`}
                        field={row[0]!}
                        onSemanticUpdate={onSemanticUpdate}
                        onStyleUpdate={onStyleUpdate}
                        elementId={elementId}
                        componentType={componentType}
                        ownerColumns={ownerColumns}
                        ownerFields={ownerFields}
                      />
                    ) : (
                      <div
                        key={row.map((f) => `${f.origin}:${f.key}`).join("|")}
                        className="fieldset-row"
                        data-wide={
                          row.length === 1 && fieldSpan(row[0]!) === "wide"
                            ? "true"
                            : undefined
                        }
                      >
                        {row.map((field) => (
                          <GenericField
                            key={`${field.origin}:${field.key}`}
                            field={field}
                            onSemanticUpdate={onSemanticUpdate}
                            onStyleUpdate={onStyleUpdate}
                            elementId={elementId}
                            componentType={componentType}
                            ownerColumns={ownerColumns}
                            ownerFields={ownerFields}
                            translateOptions={
                              !literalOptionFields?.includes(field.key)
                            }
                            optionValueMode={
                              literalOptionFields?.includes(field.key)
                                ? "literal"
                                : "legacy"
                            }
                          />
                        ))}
                      </div>
                    ),
                  );
                return (
                  <>
                    {renderRows(rows)}
                    {/* boolean 은 섹션당 칩 묶음 (Options → Show → Fill) — 전폭 217, 행 래퍼 없음.
                        칩이 게이트인 종속 필드 (Value Label · Legend Position) 는 묶음 바로 아래 */}
                    {chipGroups.map(({ group, fields: chipFields }) => (
                      <ChipGroupField
                        key={`chips:${group}`}
                        group={group}
                        fields={chipFields}
                        onSemanticUpdate={onSemanticUpdate}
                        onStyleUpdate={onStyleUpdate}
                        elementId={elementId}
                      />
                    ))}
                    {renderRows(dependents)}
                  </>
                );
              })()}
              {tail}
            </PropertySection>
          );
        })}
    </>
  );
});
