/**
 * ADR-912 단계 2 — generic field renderer (HC#1/#2).
 *
 * `resolveEditContract` 의 `ResolvedField[]` 를 `field.kind` 9종 switch 로 렌더하고,
 * `field.origin` 으로 write 를 라우팅한다. 컴포넌트별 분기 0 — 모든 노드가 동일 generic 경로.
 *
 * **origin 라우팅(write 단일 진실)**:
 * - `semantic` → `onSemanticUpdate(key, value)` — catalog Properties 는 `catalogPropertiesPatchCommand`
 *   한 step (`CatalogPropertiesPanel.components.tsx`)
 * - `style`    → `onStyleUpdate(key, value)` — catalog Properties 는 semantic 필드만 넘기므로
 *   부르지 않는다 (style 은 Styles 탭 — `catalogStylesHost.ts`, ADR-248)
 *
 * **section 그룹핑**: 같은 `section` 필드를 `PropertySection` 으로 묶는다. caller 가
 * `fields` 를 origin 으로 필터(Properties view = semantic / Style view = style)해 넘긴다 —
 * 본 컴포넌트는 넘어온 필드 전부를 section 그룹으로 렌더(view 필터는 caller 책임).
 *
 * **kind dispatch**: `CatalogInspectorFields.CatalogField` 와 동일 9종(variant/enum/fillStyle/
 * size/boolean/string/string-array/number/icon). 단계 2 는 Properties view(semantic) 우선이라
 * style-origin number(unit 입력)는 후속(`PropertyUnitInput` 통합) — 현재는 number control 공용.
 */
import {
  Fragment,
  lazy,
  memo,
  Suspense,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";

import type { ResolvedField } from "@composition/shared";
import type {
  ItemsManagerField,
  VisibilityCondition,
} from "@composition/rendering";

import { PropertyChipGroup } from "../../../components/property/PropertyChipGroup";
import {
  CollectionBinding,
  CollectionBindingActions,
  CollectionBindingCreateAction,
} from "../../../components/property/CollectionBinding";
import { PropertyFieldTemplateInput } from "../../../components/property/PropertyFieldTemplateInput";
import { PropertyIconPicker } from "../../../components/property/PropertyIconPicker";
import { PropertyInput } from "../../../components/property/PropertyInput";
import { useSelectionState } from "../../../components/property/propertySelection";
import {
  catalogCalendarDurationFits,
  catalogColumnSizeFits,
  isPropVar,
  isPropWhen,
} from "../../../../../../../packages/shared/src/catalog/document/valueType";
import { PropertyFieldset } from "../../../components/property/PropertyFieldset";
import { isRacColorString } from "../../../../../../../packages/shared/src/catalog/document/colorValue";
import { NumberFormatField } from "./NumberFormatField";
import { NumberRangeField } from "./NumberRangeField";
import { catalogColumnTrack } from "../../../../../../../packages/shared/src/catalog/runtime/tableTracks";
import { PropertyNumberInput } from "../../../components/property/PropertyNumberInput";
import { PropertyPlacementPicker } from "../../../components/property/PropertyPlacementPicker";
import { Section as PropertySection } from "../../../components/panel/Section";
import { PropertySegment } from "../../../components/property/PropertySegment";
import { PropertySelect } from "../../../components/property/PropertySelect";
import { PropertySlider } from "../../../components/property/PropertySlider";
import type { PropertyChip } from "../../../components/property/PropertyChipGroup";
import { ActionTooltipTrigger, SwatchIconButton } from "../../../components/ui";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { iconProps } from "../../../../utils/ui/uiConstants";
import {
  capitalize,
  packHalfRows,
  resolveFieldEditor,
  sizeSegOptions,
  VARIANT_SWATCH,
  variantGridSections,
  type ChipGroup,
  type FieldEditor,
} from "./fieldEditor";
import { useI18n } from "../../../../i18n";
import type { DataBindingValue } from "../../../components/property/CollectionBinding";
import { evaluateVisibility } from "./evaluateVisibility";
import { sameStringArray } from "../../../../utils/data/sameStringArray";
import { AvatarSizeField } from "./AvatarSizeField";
import { GlyphSizeAction, useGlyphSize } from "./glyphSizeAction";
import { LabeledValueField } from "./LabeledValueField";
import { SelectionCountField } from "./SelectionCountField";
import { SelectionKeysField } from "./SelectionKeysField";
import { AutoFocusField } from "./AutoFocusField";
import { ItemsManager } from "./ItemsManager";
import {
  TEMPLATE_TEXT_KEYS,
  type OwnerField,
} from "../hooks/useOwnerCollectionColumns";
import {
  useFieldOwnerFields,
  useFieldVariableName,
  useFieldVariableNames,
  useFieldValue,
  useSiblingValue,
  useFieldValuesSnapshot,
} from "./fieldValueSource";

/**
 * ResolvedField.itemsManager(catalog self-contained schema) → specs `ItemsManagerField` 투영.
 * `ItemsManager` 가 specs 타입을 요구하므로 builder 레이어에서 변환한다(CatalogInspectorFields
 * 동일 패턴 — catalog types 는 specs 비의존 [[feedback-specs-shared-layer-not-absorption]]).
 */
// 필드 객체당 1회 — 값 구독으로 `GenericField` 가 다시 그려져도 같은 객체를 넘겨 `ItemsManager` memo 가 산다.
const itemsManagerFieldCache = new WeakMap<
  ResolvedField,
  ItemsManagerField | null
>();
function toItemsManagerField(field: ResolvedField): ItemsManagerField | null {
  let cached = itemsManagerFieldCache.get(field);
  if (cached === undefined) {
    cached = buildItemsManagerField(field);
    itemsManagerFieldCache.set(field, cached);
  }
  return cached;
}
function buildItemsManagerField(
  field: ResolvedField,
): ItemsManagerField | null {
  const im = field.itemsManager;
  if (!im) return null;
  return {
    key: field.key,
    type: "items-manager",
    label: field.label,
    itemsKey: im.itemsKey,
    itemTypeName: im.itemTypeName,
    itemLabel: im.itemLabel,
    defaultItem: im.defaultItem,
    itemSchema: im.itemSchema,
    labelKey: im.labelKey,
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

/** 필드 한 개 쓰기 — origin 이 write 경로를 고르는 한 곳. */
function writeField(
  routing: Pick<GenericFieldRouting, "onSemanticUpdate" | "onStyleUpdate">,
  field: Pick<ResolvedField, "origin" | "key">,
  value: unknown,
): void {
  if (field.origin === "style") routing.onStyleUpdate(field.key, value);
  else routing.onSemanticUpdate(field.key, value);
}

/**
 * 패널이 받는 필드 — 계약 필드에 패널 쪽 표시를 더할 수 있다. `optionsFromData`: 옵션이 문서 데이터의
 * 원본 키라 (Chart 의 컬럼 매핑) 번역하지 않고 값 그대로 쓰는 셀렉트 (`literal` 모드).
 */
export type PanelField = ResolvedField & { optionsFromData?: boolean };

function isOptionsFromData(field: ResolvedField): boolean {
  return "optionsFromData" in field && field.optionsFromData === true;
}

interface GenericFieldRendererProps extends GenericFieldRouting {
  /** caller 가 origin 으로 필터한 필드 (Properties view = semantic / Style view = style). */
  fields: readonly PanelField[];
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
  /**
   * section 별 **앞머리**에 끼워 넣을 비-catalog 컨트롤 — 섹션의 데이터 원천 행 (`dataBinding` —
   * Collection 의 Data source) 바로 뒤, 계약 행 앞. Chart 의 모드 · 값 필드 목록 · 시간축은 축 필드
   * (Category · Value · Series) 를 고르기 전에 정하는 것이라 꼬리 (`sectionExtras`) 가 아니라 여기 선다
   * (사용자 결정 2026-11-12 「Property 탭 섹션 병합」 5단계 — Collection = Data source → 매핑 → 필터).
   */
  sectionLeads?: Partial<Record<string, ReactNode>>;
}

interface GenericFieldProps extends GenericFieldRouting {
  field: ResolvedField;
  translateOptions?: boolean;
  /**
   * enum 값 해석 모드 — `literal` 은 옵션 값이 원본 데이터 키인 필드에 쓴다
   * (`PropertySelect.optionValueMode` 주석 참조). 라벨 번역 정책과 독립이다.
   */
  optionValueMode?: "legacy" | "literal";
  /**
   * A glyph's Size seg sized off its step (box · font size) — no step is drawn, the row's action
   * cell's number is (`glyphSizeAction.tsx`). The renderer reads the glyph context once and hands
   * the flag to size fields only, so a glyph size change re-renders no other field.
   */
  glyphCustom?: boolean;
  /** ADR-159 P4a: 소유 collection 컬럼 (없으면 null — 일반 입력). */
  ownerColumns?: string[] | null;
  /** ADR-152 1b: 소유 collection 필드 (key + id) — `{#id}` 저장형 변환. memo 는 ownerColumns 키로 판정 (id 는 key 에 종속). */
  ownerFields?: OwnerField[] | null;
  /**
   * ADR-214 Phase 3 — `{{` 자동완성 후보 (이 요소에서 보이는 변수 이름). 렌더러가 한 번 구독해
   * 내려준다 (참조 안정) — 필드마다 문서를 구독하면 어느 요소의 편집이든 모든 필드가 재렌더된다.
   */
  stateNames: readonly string[];
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

/** currentValue/isOverridden는 leaf hook이 소유하므로 field metadata만 비교한다. */
function areGenericFieldPropsEqual(
  previous: GenericFieldProps,
  next: GenericFieldProps,
): boolean {
  const a = previous.field;
  const b = next.field;
  return (
    previous.elementId === next.elementId &&
    previous.stateNames === next.stateNames &&
    previous.onSemanticUpdate === next.onSemanticUpdate &&
    previous.onStyleUpdate === next.onStyleUpdate &&
    previous.translateOptions === next.translateOptions &&
    previous.optionValueMode === next.optionValueMode &&
    previous.glyphCustom === next.glyphCustom &&
    sameStringArray(previous.ownerColumns, next.ownerColumns) &&
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
 * 글자 폭 (px) — 반폭 칸에 값이 들어가는지 판정. canvas measureText (패널 글꼴 12) 가 있으면
 * 그것, 없으면 (jsdom) 글자당 7. 값 자리는 셀렉트 55 (87 − pad 8 − chevron 20 − gap 4).
 */
let measureCtx: CanvasRenderingContext2D | null | undefined;
// 상한 — 옵션 라벨에는 사용자 항목 글자도 온다 (그룹 선택 필드). 넘치면 비우고 다시 잰다.
const TEXT_WIDTH_CACHE_LIMIT = 512;
const textWidthCache = new Map<string, number>();
function textWidth(text: string): number {
  const cached = textWidthCache.get(text);
  if (cached !== undefined) return cached;
  const width = measureTextWidth(text);
  if (textWidthCache.size >= TEXT_WIDTH_CACHE_LIMIT) textWidthCache.clear();
  textWidthCache.set(text, width);
  return width;
}
function measureTextWidth(text: string): number {
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

/** 조건부 필드의 게이트 키 (`visibleWhen.key`) — `oneOf`/`equals` 조건만, 없으면 undefined. */
function gateKey(field: ResolvedField): string | undefined {
  return field.visibleWhen && "key" in field.visibleWhen
    ? field.visibleWhen.key
    : undefined;
}

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

/**
 * 필드가 차지하는 폭 — `wide` 는 1·2열 합침 (값이 긴 텍스트 · 목록), `half` 는 한 열 (셀렉트 ·
 * 숫자 · 스위치) 로 두 개가 한 행에 선다 (panel-ui 07, Styles 패널의 「W | H」 행과 같은 격자).
 * 필드 객체당 1회 — 정렬 (fieldRank) · 행 패킹 · `data-wide` 가 같은 필드를 거듭 묻는다.
 */
const spanCache = new WeakMap<ResolvedField, "wide" | "half">();
function fieldSpan(field: ResolvedField): "wide" | "half" {
  const cached = spanCache.get(field);
  if (cached) return cached;
  const span = computeFieldSpan(field);
  spanCache.set(field, span);
  return span;
}
function computeFieldSpan(field: ResolvedField): "wide" | "half" {
  const editor = resolveFieldEditor(field);
  switch (editor.type) {
    // seg 는 매핑표가 폭을 정한다 (2~3 반폭 · 4~5 전폭 · 라벨이 칸에 안 들어가면 전폭)
    case "seg":
      return editor.span;
    // 셀렉트는 반폭 — legend (「Necessity Indicator」) 나 옵션 라벨 (「Categorical」) 이 반폭 칸에
    //   안 들어갈 때만 전폭 (2026-09-15 live 전수 대조)
    case "select": {
      // 격자 셀렉트 (Badge · StatusLight 25/19) 는 전폭 — 팝오버 216 이 반폭 87 트리거에서 열리면
      //   트리거보다 2.5 배 넓어 어디서 열렸는지 흐려진다
      if (editor.grid) return "wide";
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
 * 화면 섹션 표 — 순서 · 제목 · 분류 묶음을 한 곳에 둔다.
 *
 * - **분류 묶음 (`members`)**: 계약의 `section` 은 필드의 뜻 (분류) 이고, 패널은 함께 편집하는 것을 한
 *   섹션에 모은다 (사용자 결정 2026-11-12 「Property 탭 섹션 병합」): Content = 글자 + 모양 (Appearance),
 *   Behavior = 동작 (`state`) · 검증 · 폼 · 오버레이 · Interaction · 접근성. 행은 이 분류 순서로 묶음마다
 *   서고 (묶음 안은 한 key 순서 `KEY_ORDER`), 주입 컨트롤 (`sectionExtras`) 도 같은 분류 순서로 섹션 끝에
 *   선다. Validation · Forms · Overlay 는 섹션이 아니라 분류다 — 필드 하나짜리 접기 헤더를 만들지 않는다.
 * - **순서**: 계약의 등장 순서가 컴포넌트마다 달라 (Pagination 은 Appearance → Content, Disclosure 는
 *   State 가 Appearance 앞) 한 순서로 세운다: Content (글자 · 모양) → Value → Collection → Series (차트) →
 *   Layout → Behavior → Locale. 표 밖 섹션은 그 뒤에 계약 순서대로. Value 는 컴포넌트가 지금 담고 있는
 *   것 (값 · 선택 · 열림 · 펼침 — 사용자 결정 2026-11-12 「재배치」) 이라 Content 바로 뒤.
 * - **제목**: 없으면 key 의 첫 글자만 대문자. `state` (isDisabled · selectionMode · href …) 는 「Behavior」 —
 *   같은 패널의 ADR-214 상태 변수 절이 「State」 라 제목이 둘 겹쳤다 (2026-09-15).
 */
const DISPLAY_SECTIONS: readonly {
  key: string;
  title?: string;
  members: readonly string[];
}[] = [
  { key: "content", members: ["content", "appearance"] },
  { key: "value", members: ["value"] },
  { key: "collection", members: ["collection"] },
  { key: "series", members: ["series"] },
  { key: "layout", members: ["layout"] },
  {
    key: "state",
    title: "Behavior",
    members: [
      "state",
      "validation",
      "forms",
      "overlay",
      "interaction",
      "accessibility",
    ],
  },
  { key: "locale", members: ["locale"] },
];
const DISPLAY_SECTION_BY_KEY = new Map(
  DISPLAY_SECTIONS.map((entry, rank) => [entry.key, { ...entry, rank }]),
);
const DISPLAY_SECTION_OF_MEMBER: ReadonlyMap<string, string> = new Map(
  DISPLAY_SECTIONS.flatMap(({ key, members }) =>
    members.map((member) => [member, key] as const),
  ),
);
/** 분류 → 화면 섹션 (표 밖 분류는 그대로 자기 섹션). */
function displaySection(section: string): string {
  return DISPLAY_SECTION_OF_MEMBER.get(section) ?? section;
}
/** 화면 섹션의 분류 순서 — 표 밖 섹션은 없음 (계약 순서 그대로). */
function sectionMembers(section: string): readonly string[] | undefined {
  return DISPLAY_SECTION_BY_KEY.get(section)?.members;
}
function sectionRank(section: string): number {
  return DISPLAY_SECTION_BY_KEY.get(section)?.rank ?? DISPLAY_SECTIONS.length;
}
function sectionTitle(section: string): string {
  return DISPLAY_SECTION_BY_KEY.get(section)?.title ?? capitalize(section);
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
/** A typed Column width: "" → none, "120" · "120px" → 120, otherwise the trimmed text. */
function parseColumnSizeInput(text: string): number | string | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return undefined;
  const px = /^(\d+(?:\.\d+)?)(?:px)?$/.exec(trimmed);
  return px ? Number(px[1]) : trimmed;
}
/**
 * 섹션 안 순서 — prop key 하나의 순서 (2026-10-13 사용자 「순서도 맞춰」: 계약 선언 순서와 kind 묶음을
 * 따라 Checkbox 는 Error Message 가 Name 앞, TextField 는 뒤였고, 날짜의 Min Value (글자) 와
 * NumberField 의 Min (숫자) 이 Name 앞뒤로 갈렸고, 칩도 Disabled · Required 순서가 달랐다). 표의
 * key 가 먼저 표 순서로, 표에 없는 key 는 그 뒤에 kind 묶음 · 계약 순서로. `LAST_KEYS` 는 맨 끝.
 */
const KEY_ORDER: readonly string[] = [
  // What it says, then its help texts.
  "children",
  "label",
  "title",
  "description",
  "errorMessage",
  "placeholder",
  // Its glyph.
  "iconName",
  "icon",
  // The value it holds, its range, its form name.
  "value",
  "defaultValue",
  "defaultInputValue",
  "placeholderValue",
  "defaultSelectedKey",
  "minValue",
  "maxValue",
  "step",
  "name",
  // Its link.
  "href",
  "target",
  "rel",
  // What its input takes.
  "type",
  "inputMode",
  "enterKeyHint",
  "autoComplete",
  // How it looks and is laid out (the 「Variant | Size」 first row).
  "variant",
  "fillStyle",
  "size",
  "orientation",
  "density",
  "labelPosition",
  "labelAlign",
  "align",
  "direction",
  "necessityIndicator",
  "staticColor",
  // How it selects and validates.
  "selectionMode",
  "selectionStyle",
  "validationBehavior",
  "menuTrigger",
  // Chips: the value's, the look's, then availability and validation.
  "isSelected",
  "isIndeterminate",
  "autoCorrect",
  "spellCheck",
  "isQuiet",
  "isEmphasized",
  "isDisabled",
  "isReadOnly",
  "isRequired",
  "isInvalid",
];
const LAST_KEYS: readonly string[] = ["autoFocus"];
function keyRank(key: string): number {
  const last = LAST_KEYS.indexOf(key);
  if (last !== -1) return KEY_ORDER.length + 1 + last;
  const i = KEY_ORDER.indexOf(key);
  return i === -1 ? KEY_ORDER.length : i;
}
/** Fields in the one key order (stable — keys outside the table keep the contract's order). */
function byKeyOrder(fields: readonly ResolvedField[]): ResolvedField[] {
  return fields
    .map((field, index) => ({ field, index, rank: keyRank(field.key) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.field);
}
function sortFields(fields: readonly ResolvedField[]): ResolvedField[] {
  // The table's keys in its order; the others after them, grouped by kind (contract order inside).
  const ranked = fields
    .map((field, index) => ({
      field,
      index,
      key: keyRank(field.key),
      kind: fieldRank(field),
    }))
    .sort((a, b) => a.key - b.key || a.kind - b.kind || a.index - b.index)
    .map((entry) => entry.field);
  // 조건부 필드는 자기 조건 키 바로 뒤에 — 「Show Value Label」 스위치와 「Value Label」 입력,
  //   「Label Position」 과 「Label Align」 처럼 켜는 쪽과 켜지는 쪽이 한 자리에 (2026-09-15 사용자
  //   지적 — kind 묶음만 따르면 둘이 갈라진다). 조건 키가 다른 섹션이면 그대로.
  const out: ResolvedField[] = [];
  const dependents = new Map<string, ResolvedField[]>();
  for (const field of ranked) {
    const gate = gateKey(field);
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
    const gate = gateKey(field);
    if (gate && dependents.get(gate)?.includes(field)) continue; // 게이트가 넣는다
    push(field);
  }
  return out;
}

/**
 * 행 끝 28 열의 「기본값으로」 액션 (2026-09-16 사용자 지시 — 옵션 편의성). 행의 필드 중
 * catalog 기본값 (`baseValue`) 이 있고 현재 값이 그와 다른 것이 하나라도 있으면 서고, 누르면
 * 그 필드들을 기본값으로 되돌린다 (쓰기는 다른 편집과 같은 `onSemanticUpdate`/`onStyleUpdate`).
 * 기본값이 없는 필드 (`children` · `name` 처럼 계약에 default 가 없는 것) 는 되돌릴 기준이
 * 없으므로 대상이 아니다 — 새 요소의 행마다 아이콘이 서는 잡음을 막는다. boolean 은 칩 묶음이라
 * 행이 없고, binding · items 는 값이 구조라 여기 두지 않는다.
 *
 * 행은 최대 2 필드 — 훅은 두 슬롯을 무조건 부른다 (조건부 금지).
 */
const NON_RESETTABLE_KINDS: ReadonlySet<string> = new Set([
  "binding",
  "items-manager",
  "boolean",
]);

function isResettable(field: ResolvedField): boolean {
  return field.baseValue !== undefined && !NON_RESETTABLE_KINDS.has(field.kind);
}

function differs(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return false;
  if (typeof a === "object" && typeof b === "object" && a && b) {
    return JSON.stringify(a) !== JSON.stringify(b);
  }
  return true;
}

const ResetIcon = ACTION_ICONS.reset;

// memo — 행 배열은 `layoutSections` memo 안에서 같은 참조라 렌더러가 다시 그려도 건너뛴다.
const FieldRowResetAction = memo(function FieldRowResetAction({
  row,
  elementId,
  onSemanticUpdate,
  onStyleUpdate,
}: {
  row: readonly ResolvedField[];
  elementId: string | undefined;
  onSemanticUpdate: GenericFieldRouting["onSemanticUpdate"];
  onStyleUpdate: GenericFieldRouting["onStyleUpdate"];
}) {
  const { t } = useI18n();
  const first = row[0]!;
  const second = row[1] ?? first;
  const v0 = useFieldValue(elementId, first.origin, first.key, first.baseValue);
  const v1 = useFieldValue(
    elementId,
    second.origin,
    second.key,
    second.baseValue,
  );
  const values = [v0, row[1] ? v1 : undefined];
  const dirty = row.filter(
    (field, i) => isResettable(field) && differs(values[i], field.baseValue),
  );
  if (dirty.length === 0) return null;
  const labels = dirty.map((f) => f.label).join(" · ");
  const label = t("propertiesPanel.resetField", { labels });
  const reset = () => {
    for (const field of dirty) {
      writeField({ onSemanticUpdate, onStyleUpdate }, field, field.baseValue);
    }
  };
  return (
    <div className="fieldset-actions actions-reset">
      <ActionTooltipTrigger tooltip={label}>
        <SwatchIconButton aria-label={label} onPress={reset}>
          <ResetIcon
            aria-hidden="true"
            size={iconProps.size}
            strokeWidth={iconProps.strokeWidth}
          />
        </SwatchIconButton>
      </ActionTooltipTrigger>
    </div>
  );
});

const isHalfField = (field: ResolvedField) => fieldSpan(field) === "half";
/** 연속한 half 필드 둘을 한 행으로 묶는다. wide 는 행 하나를 혼자 쓴다. */
function packFieldRows(fields: readonly ResolvedField[]): ResolvedField[][] {
  return packHalfRows(fields, isHalfField);
}

/**
 * 형제 prop 에 묶인 값 슬라이더 (Slider/Meter/ProgressBar `value`) — 양끝이 곧 `minKey`~`maxKey`
 * 형제 (없으면 0~100), 눈금은 `stepKey` 형제. min ≥ max 같은 역전은 슬라이더가 못 그리므로 스텝퍼.
 * 형제 3개의 구독은 이 leaf 에만 — 다른 필드 (수십 개) 가 같이 구독하지 않는다.
 */
function BoundValueSlider({
  field,
  editor,
  elementId,
  numeric,
  onChange,
}: {
  field: ResolvedField;
  editor: Extract<FieldEditor, { type: "slider-bound" }>;
  elementId: string | undefined;
  numeric: number | undefined;
  onChange: (value: unknown) => void;
}) {
  const boundMin = useSiblingValue(elementId, field, editor.minKey);
  const boundMax = useSiblingValue(elementId, field, editor.maxKey);
  const boundStep = useSiblingValue(elementId, field, editor.stepKey);
  const min = typeof boundMin === "number" ? boundMin : 0;
  const max = typeof boundMax === "number" ? boundMax : 100;
  const step = typeof boundStep === "number" && boundStep > 0 ? boundStep : 1;
  if (max > min) {
    return (
      <PropertySlider
        label={field.label}
        value={numeric ?? min}
        onChange={() => {}}
        onChangeEnd={(val) => onChange(val)}
        editable
        min={min}
        max={max}
        step={step}
        formatValue={(val) => String(val)}
      />
    );
  }
  return <FieldStepper field={field} value={numeric} onChange={onChange} />;
}

/** 숫자 필드의 스텝퍼 — 계약의 min · max · step. */
function FieldStepper({
  field,
  value,
  onChange,
}: {
  field: ResolvedField;
  value: number | undefined;
  onChange: (value: unknown) => void;
}) {
  return (
    <PropertyNumberInput
      label={field.label}
      value={value}
      onChange={(val) => onChange(val)}
      min={field.min}
      max={field.max}
      step={field.step}
    />
  );
}

/**
 * ADR-257 — a Column width field. A value that is not a column size is not written (the field
 * shows the stored value again). A bound the column's track cannot express with its width
 * (`Nfr` + max, a px width with a `%` bound, a `%` width with a px max — 사용자 결정 3 (a)) is
 * kept and named as not applied.
 */
const ColumnSizeField = memo(function ColumnSizeField({
  field,
  value,
  elementId,
  onChange,
  notApplied,
}: {
  field: ResolvedField;
  value: unknown;
  elementId: string | undefined;
  onChange: (value: unknown) => void;
  notApplied: string;
}) {
  const width = useSiblingValue(elementId, field, "width");
  const minWidth = useSiblingValue(elementId, field, "minWidth");
  const maxWidth = useSiblingValue(elementId, field, "maxWidth");
  const ignored =
    catalogColumnTrack({ props: { width, minWidth, maxWidth } }).ignored ?? [];
  return (
    <PropertyInput
      label={field.label}
      value={value == null ? "" : String(value)}
      onChange={(text) => {
        const parsed = parseColumnSizeInput(text);
        if (parsed === undefined) return onChange(undefined);
        if (catalogColumnSizeFits(parsed, field.kind === "column-static-size"))
          onChange(parsed);
      }}
      afterControl={
        (ignored as readonly string[]).includes(field.key) ? (
          <span
            slot="description"
            role="status"
            data-column-size-not-applied=""
          >
            {notApplied}
          </span>
        ) : undefined
      }
    />
  );
});

/**
 * ADR-258 Decision 1 — a Color control's color value. The text is a draft until it commits (blur ·
 * Enter); only a color RAC accepts (`isRacColorString` — `#rrggbb` · `rgb(r, g, b)` · `hsl(…)` ·
 * `hsb(…)`, comma syntax) is written. Anything else (`red` · `rgb(255 0 0)` · a half-typed value)
 * writes nothing and names the error in the field; empty clears to the binding default.
 */
const RacColorField = memo(function RacColorField({
  field,
  value,
  onChange,
  invalidMessage,
}: {
  field: ResolvedField;
  value: unknown;
  onChange: (value: unknown) => void;
  invalidMessage: string;
}) {
  // The refusal belongs to the element it was typed on: another selection clears it (the fields
  // stay mounted across a selection of the same type).
  const [invalid, setInvalid] = useSelectionState(false);
  return (
    <PropertyInput
      label={field.label}
      value={value == null ? "" : String(value)}
      onChange={(text) => {
        const next = text.trim();
        if (next === "") {
          setInvalid(false);
          return onChange(undefined);
        }
        if (!isRacColorString(next)) return setInvalid(true);
        setInvalid(false);
        onChange(next);
      }}
      afterControl={
        invalid ? (
          <span slot="description" role="alert" data-rac-color-invalid="">
            {invalidMessage}
          </span>
        ) : undefined
      }
    />
  );
});

const DURATION_UNITS = ["days", "weeks", "months"] as const;
type DurationUnit = (typeof DURATION_UNITS)[number];
const DURATION_OPTIONS = DURATION_UNITS.map((unit) => ({
  value: unit,
  label: capitalize(unit),
}));

/**
 * ADR-256 Phase 9 — a Calendar's `visibleDuration` (RAC, the reference's Display options): a count
 * and its Days · Weeks · Months unit, one editor. Either change writes the whole duration once
 * (`{weeks: 2}` — a unit change leaves no old key); a count that is not a whole ≥ 1 is not written.
 */
const CalendarDurationField = memo(function CalendarDurationField({
  field,
  value,
  onChange,
  unitLabel,
}: {
  field: ResolvedField;
  value: unknown;
  onChange: (value: unknown) => void;
  unitLabel: string;
}) {
  const duration = catalogCalendarDurationFits(value)
    ? (value as Readonly<Record<string, number>>)
    : catalogCalendarDurationFits(field.baseValue)
      ? (field.baseValue as Readonly<Record<string, number>>)
      : { months: 1 };
  const unit = (DURATION_UNITS.find((key) => key in duration) ??
    "months") as DurationUnit;
  const count = duration[unit] ?? 1;
  const write = (next: Record<string, number>) => {
    if (catalogCalendarDurationFits(next)) onChange(next);
  };
  return (
    <>
      <PropertyNumberInput
        label={field.label}
        value={count}
        onChange={(next) => {
          if (next !== undefined) write({ [unit]: next });
        }}
        min={1}
        step={1}
      />
      <PropertySelect
        label={unitLabel}
        value={unit}
        onChange={(next) => {
          if ((DURATION_UNITS as readonly string[]).includes(next))
            write({ [next]: count });
        }}
        options={DURATION_OPTIONS}
      />
    </>
  );
});

/**
 * ADR-309 — the date family's fields (`DateKindField` — `DateValueInput`) load with their first
 * use: the date input is not on the panel's first screen (Builder initial bundle, G3 c).
 */
const DateKindField = lazy(() => import("./DateKindField"));

/** A prop value that reads a variable (ADR-284 Phase 6 — `{ kind: "var" }` · `{ kind: "when" }`). */
const isVariableFollow = (value: unknown): boolean =>
  isPropVar(value) || isPropWhen(value);

/**
 * A prop that follows a variable (a filter control's state prop · 「변수로 정하기」): the variable,
 * not an editor — an editor reads the reference as a number or text (a Slider's NaN looped its
 * render, 2026-10-27) and its first write would cut the link. The link is edited where it is made
 * (the list's filter · 「변수로 정하기」).
 */
function VariableFollowField({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  const { t } = useI18n();
  const ref = isPropVar(value)
    ? value.ref
    : isPropWhen(value)
      ? value.subject
      : "";
  const name = useFieldVariableName(ref);
  return (
    <PropertyFieldset legend={label}>
      <span className="property-variable-follow">
        {t("dataView.follow_field", { name })}
      </span>
    </PropertyFieldset>
  );
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
  glyphCustom,
  stateNames,
}: GenericFieldProps) {
  const value = useFieldValue(
    elementId,
    field.origin,
    field.key,
    field.baseValue,
  );
  // origin 단일 진실로 write 분기 (semantic → props / style → props.style).
  const update = (v: unknown) =>
    writeField({ onSemanticUpdate, onStyleUpdate }, field, v);

  const { t } = useI18n();

  if (isVariableFollow(value))
    return <VariableFollowField label={field.label} value={value} />;

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
            value={glyphCustom ? "" : current}
            onChange={(v) => update(v)}
            outOfRangeHint={
              field.kind === "size" && !glyphCustom
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
          grid={editor.type === "select" && editor.grid === true}
          gridSections={
            editor.type === "select" && editor.grid
              ? variantGridSections(options)
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

    // ADR-257 — S2 Column widths: a px number ("120" · "120px"), "Nfr" or "N%".
    case "column-size":
    case "column-static-size":
      return (
        <ColumnSizeField
          field={field}
          value={value}
          elementId={elementId}
          onChange={update}
          notApplied={t("propertiesPanel.columnSizeNotApplied")}
        />
      );

    // ADR-258 — a RAC color string, written only when RAC accepts it.
    case "rac-color":
      return (
        <RacColorField
          field={field}
          value={value}
          onChange={update}
          invalidMessage={t("propertiesPanel.racColorInvalid")}
        />
      );

    // S2 · RAC formatOptions — style + its keys, one object write (rows of its own).
    case "labeled-value":
    case "labeled-format":
      return (
        <LabeledValueField
          label={field.label}
          value={value}
          format={field.kind === "labeled-format"}
          onChange={update}
        />
      );
    case "number-format":
      return (
        <NumberFormatField field={field} value={value} onChange={update} />
      );
    case "selection-keys":
      return (
        <SelectionKeysField
          label={field.label}
          value={value}
          // (ADR-308 — a group's items: a check list.)
          options={field.options?.map((option) => ({
            value: String(option.value),
            label: String(option.label),
          }))}
          onChange={update}
        />
      );
    case "auto-focus":
      return (
        <AutoFocusField label={field.label} value={value} onChange={update} />
      );
    case "selection-count":
      return (
        <SelectionCountField
          label={field.label}
          value={value}
          onChange={update}
        />
      );
    case "number-range":
      return (
        <NumberRangeField label={field.label} value={value} onChange={update} />
      );

    // ADR-309 Decision 5 — the date family's value · bounds · placeholder (`DateValueInput`).
    case "date":
    case "time":
    case "date-range":
    case "date-list":
      return (
        <Suspense fallback={null}>
          <DateKindField
            field={field}
            value={value}
            elementId={elementId}
            onChange={update}
          />
        </Suspense>
      );

    // ADR-256 Phase 9 — a count + Days · Weeks · Months, one object write.
    case "calendar-duration":
      return (
        <CalendarDurationField
          field={field}
          value={value}
          onChange={update}
          unitLabel={t("propertiesPanel.durationUnit")}
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

    case "avatar-size":
    case "avatar-group-size":
      return (
        <AvatarSizeField
          label={field.label}
          value={value ?? field.baseValue}
          options={field.options ?? []}
          isGroup={field.kind === "avatar-group-size"}
          onChange={update}
        />
      );

    case "number": {
      const stored =
        value != null
          ? Number(value)
          : field.baseValue != null
            ? Number(field.baseValue)
            : undefined;
      // (A value that is not a number is shown as none — NaN never equals itself, and the
      //   slider's prop sync looped on it.)
      const numeric =
        stored !== undefined && Number.isFinite(stored) ? stored : undefined;
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
      // `value` 는 형제 minValue~maxValue 에 묶인다 — 형제 구독은 leaf 가 (`BoundValueSlider`)
      if (editor.type === "slider-bound") {
        return (
          <BoundValueSlider
            field={field}
            editor={editor}
            elementId={elementId}
            numeric={numeric}
            onChange={update}
          />
        );
      }
      return <FieldStepper field={field} value={numeric} onChange={update} />;
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

    // "binding" — collection data binding (`dataBinding` — catalog 의 binding 선언은 이것 하나):
    //   외부 데이터 소스(dataTable/api/variable/route) 연결 UI(CollectionBinding) — ADR-912
    //   catalog cutover 로 누락된 RSP Dynamic collections 진입점 복원.
    case "binding":
      // fieldset (1·2열) + 행 끝 28 열의 연결 해제 · 새 테이블 아이콘 — 같은 `.fieldset-row` 의
      // 형제라 fragment 로 둘을 낸다 (Attributes ID 행의 복사 아이콘과 같은 자리).
      return (
        <>
          <CollectionBinding
            label={field.label}
            value={(value as DataBindingValue | null | undefined) ?? null}
            onChange={(v) => update(v)}
            elementId={elementId}
          />
          <CollectionBindingActions
            elementId={elementId}
            onClear={value ? () => update(null) : undefined}
            showCreate={!createsInHeader(displaySection(fieldCategory(field)))}
          />
        </>
      );

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
/** 묶음 legend — 기본 묶음 (Options) 은 legend 없이 섹션 제목이 이름 (`PropertyChipGroup`). */
const CHIP_GROUP_LABEL_KEY = {
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
  sectionLabel,
  fields,
  onSemanticUpdate,
  onStyleUpdate,
  elementId,
}: GenericFieldRouting & {
  group: ChipGroup;
  sectionLabel: string;
  fields: ResolvedField[];
}) {
  const { t } = useI18n();
  const editors = useMemo(
    () => fields.map((f) => resolveFieldEditor(f) as ChipEditor),
    [fields],
  );
  const keys = useMemo(() => fields.map((f) => f.key), [fields]);
  const bases = useMemo(() => fields.map((f) => f.baseValue), [fields]);
  // 묶음의 origin 은 같다 (semantic) — 첫 필드 기준
  const origin = fields[0]?.origin ?? "semantic";
  const snapshot = useFieldValuesSnapshot(elementId, origin, keys, bases);
  const values = useMemo(() => JSON.parse(snapshot) as unknown[], [snapshot]);
  const chips = useMemo<PropertyChip[]>(() => {
    return fields.flatMap((field, index) => {
      const editor = editors[index]!;
      const raw = values[index];
      // (A prop that follows a variable is shown by its variable below, not as a chip.)
      if (isVariableFollow(raw)) return [];
      const on = editor.onValue != null ? raw === editor.onValue : Boolean(raw);
      return [
        {
          key: field.key,
          label: editor.label,
          selected: editor.negate ? !on : on,
        },
      ];
    });
  }, [editors, fields, values]);
  const handleToggle = useCallback(
    (key: string, selected: boolean) => {
      const index = fields.findIndex((f) => f.key === key);
      const editor = editors[index];
      const field = fields[index];
      if (!editor || !field) return;
      const on = editor.negate ? !selected : selected;
      // A boolean with no base (overlay `isOpen` has no default) shows off when absent — turning it
      // off removes the own write, not `false` (≠ base → an instance override left behind).
      const next =
        editor.onValue != null
          ? on
            ? editor.onValue
            : editor.offValue
          : on || field.baseValue !== undefined
            ? on
            : undefined;
      writeField({ onSemanticUpdate, onStyleUpdate }, field, next);
    },
    [editors, fields, onSemanticUpdate, onStyleUpdate],
  );
  return (
    <>
      {chips.length > 0 && (
        <PropertyChipGroup
          label={
            group === "Options" ? undefined : t(CHIP_GROUP_LABEL_KEY[group])
          }
          ariaLabel={sectionLabel}
          chips={chips}
          onToggle={handleToggle}
        />
      )}
      {fields.map((field, index) =>
        isVariableFollow(values[index]) ? (
          <VariableFollowField
            key={field.key}
            label={editors[index]!.label}
            value={values[index]}
          />
        ) : null,
      )}
    </>
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
  for (const field of byKeyOrder(fields)) {
    const editor = resolveFieldEditor(field);
    if (editor.type !== "chip") continue;
    chipKeys.add(field.key);
    byGroup.set(editor.group, [...(byGroup.get(editor.group) ?? []), field]);
  }
  const rows: ResolvedField[] = [];
  const dependents: ResolvedField[] = [];
  for (const field of fields) {
    if (chipKeys.has(field.key)) continue;
    const gate = gateKey(field);
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
 * 주입 컨트롤만으로 열린 섹션 — 그 컨트롤이 이 요소에서 아무것도 그리지 않으면 (항목 역할 없음 ·
 * 넣을 부품 없음) 섹션째 숨는다 (`PropertiesPanel.css` `:has(> .section-content:empty)`). 고정 섹션
 * (Slot · Item roles · Accessibility …) 이 Content · Collection · Behavior 안으로 들어와 (사용자 결정
 * 2026-11-12) 빈 제목만 남는 자리를 막는다.
 */
const EXTRAS_ONLY_SECTION = "section-when-filled";

/** `sectionExtras` (분류 key) → 화면 섹션별 주입 컨트롤. 한 섹션에 여럿이면 분류 순서로 잇는다. */
function mergeSectionExtras(
  sectionExtras: Partial<Record<string, ReactNode>> | undefined,
): Array<[string, ReactNode]> {
  const bySection = new Map<string, Array<[string, ReactNode]>>();
  for (const [section, extras] of Object.entries(sectionExtras ?? {})) {
    if (extras == null) continue;
    const display = displaySection(section);
    const entries = bySection.get(display);
    if (entries) entries.push([section, extras]);
    else bySection.set(display, [[section, extras]]);
  }
  // 한 개여도 같은 모양 (keyed Fragment 목록) — 같은 섹션에 둘째 분류가 붙었다 떨어져도 첫 컨트롤이
  //   remount 되지 않는다.
  return Array.from(bySection.entries()).map(([display, entries]) => {
    const members = sectionMembers(display) ?? [];
    const ordered = [...entries].sort(
      ([a], [b]) => members.indexOf(a) - members.indexOf(b),
    );
    return [
      display,
      ordered.map(([section, extras]) => (
        <Fragment key={section}>{extras}</Fragment>
      )),
    ];
  });
}

/**
 * 행 배치가 기본 (`.fieldset-row` · 전폭이면 `data-wide`) 과 다른 kind:
 * - `bare` — 행 래퍼 없이 스스로 행을 그린다. 목록 (items) 은 전폭 217 에 행의 액션 그룹이 28 열을
 *   쓰고 (Fill 행과 같음), 숫자 형식은 형식 · 그 형식의 키를 제 행들로 낸다.
 * - `pair` — 한 필드가 두 칸을 제 반쪽 둘로 채운다 (기간 = 개수 · 단위) — 행은 전폭이되 `data-wide` 없음.
 */
const ROW_LAYOUT: Partial<Record<ResolvedField["kind"], "bare" | "pair">> = {
  "items-manager": "bare",
  "number-format": "bare",
  "calendar-duration": "pair",
};

/**
 * 「새 테이블」 을 섹션 머리에 두는 화면 섹션 — Collection 은 Data source 가 섹션 첫 행이라 머리에, 그 밖
 * (Form 의 Content) 은 원천 행 끝 28 열에 둔다. 필드 (`showCreate`) 와 섹션 (`actions`) 이 이 한 판정을 읽는다.
 */
function createsInHeader(section: string): boolean {
  return section === "collection";
}

/** 데이터 원천 (Data source) — catalog 의 binding 선언은 `dataBinding` 하나다. */
function isDataSourceField(field: ResolvedField): boolean {
  return field.kind === "binding";
}

/** 필드의 분류 (계약 `section`) — 화면 섹션은 `displaySection` 이 이것을 모은다. */
function fieldCategory(field: ResolvedField): string {
  return field.section || "content";
}

interface SectionLayout {
  section: string;
  /** The section's Data source row(s) — they stand first; `sectionLeads` follow them. */
  sourceRows: ResolvedField[][];
  /** The rest of the section's rows. */
  rows: ResolvedField[][];
  chipGroups: Array<{ group: ChipGroup; fields: ResolvedField[] }>;
  dependents: ResolvedField[][];
}

/** 섹션에 계약 필드가 그리는 본문이 있는가 (원천 · 행 · 칩 · 종속 행). */
function hasContractRows(layout: SectionLayout): boolean {
  return (
    layout.sourceRows.length > 0 ||
    layout.rows.length > 0 ||
    layout.chipGroups.length > 0 ||
    layout.dependents.length > 0
  );
}

/** `visibleWhen` 이 읽는 키 (`a.b` 는 `a`) — 이 키의 값이 바뀌면 배치가 바뀐다. */
function collectGateKeys(
  condition: VisibilityCondition | undefined,
  out: Set<string>,
): void {
  if (!condition) return;
  if (condition.key) out.add(condition.key.split(".")[0]!);
  for (const part of condition.all ?? []) collectGateKeys(part, out);
}

/**
 * 배치가 읽는 것만 담은 필드 목록의 서명 — 메타데이터 (`areGenericFieldPropsEqual` 이 보는 축 +
 * `visibleWhen` · `editorHidden`) 와 게이트 키의 현재 값. 계약은 편집마다 새 배열이라 참조로 memo 하면
 * 매 commit 정렬 · 패킹 · 칩 분리를 다시 돌리고 칩 묶음 배열이 바뀌어 `ChipGroupField` memo 가 죽는다.
 * 서명이 같으면 앞 배치 (앞 필드 객체) 를 그대로 쓴다 — 값 (`currentValue` · `isOverridden`) 은
 * 필드 leaf 의 구독이 소유하므로 앞 객체로 충분하다.
 */
function layoutSignature(fields: readonly ResolvedField[]): string {
  const gateKeys = new Set<string>();
  for (const field of fields) collectGateKeys(field.visibleWhen, gateKeys);
  return JSON.stringify(
    fields.map((field) => [
      field.key,
      field.kind,
      field.label,
      field.section,
      field.origin,
      field.baseValue,
      field.min,
      field.max,
      field.step,
      field.options,
      field.itemsManager,
      field.visibleWhen,
      field.editorHidden,
      isOptionsFromData(field),
      gateKeys.has(field.key) ? field.currentValue : null,
    ]),
  );
}

/**
 * 계약 필드 → 섹션별 행 배치. 순수 함수 — 렌더러가 `layoutSignature` · extras 섹션 키로 memo 한다
 * (배치 축이 같은 편집에서는 정렬·패킹·칩 분리를 다시 돌리지 않고, 칩 묶음 배열 참조가 유지돼
 * `ChipGroupField` memo 가 산다).
 */
function layoutSections(
  fields: readonly ResolvedField[],
  extraSectionKeys: readonly string[],
): SectionLayout[] {
  /**
   * 조건 판정 입력 (ADR-208 P1ⓐ) — **`currentValue`(override ?? base)** 를 쓴다.
   *
   * 원시 `node.props[key]` 로 하면 기본값이 저장되지 않은 노드에서 조건 키가 `undefined`
   * 가 되어 `oneOf` 가 전부 거짓이 되고, 그 종류의 유효한 필드가 통째로 사라진다 (R7).
   * 계약이 이미 `override ?? default` 를 해소해 두었으므로 그것을 그대로 읽는다.
   *
   * 같은 계약 안의 형제 필드만 본다 — 조건 키가 계약 밖이면 `undefined` 로 판정된다. 계약 밖
   * 입력 (부모 종류 등) 으로 가르는 조건이 필요해지면 조건 축을 더하기 전에 입력부터 잇는다.
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
    const section = displaySection(fieldCategory(field));
    const bucket = groups.get(section) ?? [];
    if (!groups.has(section)) groups.set(section, bucket);
    if (
      field.editorHidden ||
      !evaluateVisibility(field.visibleWhen, conditionValues) ||
      isSingleChoice(field)
    )
      continue;
    bucket.push(field);
  }
  for (const section of extraSectionKeys) {
    if (!groups.has(section)) groups.set(section, []);
  }
  // 표 밖 섹션의 2차 키 — 계약 등장 순서
  const sectionOrder = Array.from(groups.keys());
  const pack = (list: readonly ResolvedField[]) =>
    packFieldRows(sortFields(list));
  return Array.from(groups.entries())
    .sort(
      ([a], [b]) =>
        sectionRank(a) - sectionRank(b) ||
        sectionOrder.indexOf(a) - sectionOrder.indexOf(b),
    )
    .map(([section, sectionFields]) => {
      const { rows, chipGroups, dependents } = splitChipFields(sectionFields);
      // 병합 섹션의 행은 분류 묶음 순서 (Behavior: 동작 → 검증 → 폼 → 오버레이 → Interaction → 접근성) 로,
      //   묶음 안은 한 key 순서. 반폭 짝은 묶음을 넘지 않는다. 칩은 섹션당 한 묶음 그대로.
      const members = sectionMembers(section);
      const packed = members
        ? members.flatMap((member) =>
            pack(rows.filter((field) => fieldCategory(field) === member)),
          )
        : pack(rows);
      // 데이터 원천 (Data source) 이 섹션 첫 행 — 매핑 · 필터가 그 원천을 읽는다.
      const sourceRows: ResolvedField[][] = [];
      const restRows: ResolvedField[][] = [];
      for (const row of packed)
        (row.some(isDataSourceField) ? sourceRows : restRows).push(row);
      return {
        section,
        sourceRows,
        rows: restRows,
        chipGroups,
        dependents: pack(dependents),
      };
    });
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
  contentExtras,
  sectionExtras,
  sectionLeads,
}: GenericFieldRendererProps) {
  // ADR-159 P4a: 조상(또는 master 소비자) collection 소유자의 컬럼 — 필드 피커 소스.
  const ownerFields = useFieldOwnerFields(elementId);
  const ownerColumns = useMemo(
    () => ownerFields?.map((f) => f.key) ?? null,
    [ownerFields],
  );
  // ADR-214 Phase 3 — `{{` 자동완성 후보. 필드가 아니라 렌더러가 한 번 구독한다.
  const stateNames = useFieldVariableNames(elementId);
  // A glyph's drawn px — its Size row's action cell (`glyphSizeAction.tsx`).
  const glyphSize = useGlyphSize();

  // 주입 컨트롤은 화면 섹션 단위로 모은다 — 병합된 분류 (appearance → Content) 는 표의 분류 순서로.
  const extraSections = mergeSectionExtras(sectionExtras);
  // 앞머리 컨트롤도 꼬리와 같이 분류 key → 화면 섹션으로 모으고, 그것만으로 섹션을 연다.
  const leadSections = mergeSectionExtras(sectionLeads);
  const extraSectionsKey = [
    ...new Set([...extraSections, ...leadSections].map(([section]) => section)),
  ].join("|");
  const signature = layoutSignature(fields);
  const sections = useMemo(
    () =>
      layoutSections(
        fields,
        extraSectionsKey === "" ? [] : extraSectionsKey.split("|"),
      ),
    // fields 는 계약마다 새 배열 — 실제 의존은 배치 서명이다 (`layoutSignature`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature, extraSectionsKey],
  );

  // 계약 필드가 0 이어도 주입 컨트롤이 있으면 그것만 섹션 순서대로 렌더한다 (frame — 고정 섹션의
  //   Slot · Accessibility 가 Content · Behavior 에 선다) — `layoutSections` 가 extras 키만으로
  //   빈 섹션을 세우므로 같은 경로다.
  const extrasBySection = new Map(extraSections);
  const leadsBySection = new Map(leadSections);
  // 주입 컨트롤은 content 그룹 선두. content 그룹이 없으면 Content 섹션을 앞에 만든다.
  const contentLayout = sections.find((s) => s.section === "content");
  const hasContentGroup =
    contentLayout != null &&
    (hasContractRows(contentLayout) || extrasBySection.has("content"));

  const renderField = (
    field: ResolvedField,
    literal = isOptionsFromData(field),
  ) => (
    <GenericField
      key={`${field.origin}:${field.key}`}
      field={field}
      onSemanticUpdate={onSemanticUpdate}
      onStyleUpdate={onStyleUpdate}
      elementId={elementId}
      ownerColumns={ownerColumns}
      ownerFields={ownerFields}
      stateNames={stateNames}
      translateOptions={!literal}
      optionValueMode={literal ? "literal" : "legacy"}
      glyphCustom={field.kind === "size" && glyphSize?.custom === true}
    />
  );

  const renderRows = (packed: readonly ResolvedField[][]) =>
    packed.map((row) =>
      row.length === 1 && ROW_LAYOUT[row[0]!.kind] === "bare" ? (
        renderField(row[0]!)
      ) : (
        // 행 key 는 첫 필드 — 게이트가 종속 필드를 드러내 행 구성이 바뀌어도
        //   (Label Position → Label Align 이 옆 칸에 합류) 행과 게이트 seg 가 살아
        //   남아 SelectionIndicator 가 이전 위치에서 미끄러진다. 종전엔 행의 필드
        //   키를 전부 이어 key 로 써서 합류 순간 행이 remount 되고 인디케이터가
        //   점프했다 — Styles 패널과 같은 ToggleButtonGroup 인데 Properties 만
        //   애니메이션이 없던 원인 (2026-09-16 사용자 지적, live 실측).
        <div
          key={`${row[0]!.origin}:${row[0]!.key}`}
          className="fieldset-row"
          data-wide={
            row.length === 1 &&
            fieldSpan(row[0]!) === "wide" &&
            ROW_LAYOUT[row[0]!.kind] !== "pair"
              ? "true"
              : undefined
          }
        >
          {row.map((field) => renderField(field))}
          {glyphSize && row.some((field) => field.kind === "size") ? (
            <GlyphSizeAction source={glyphSize} />
          ) : (
            <FieldRowResetAction
              row={row}
              elementId={elementId}
              onSemanticUpdate={onSemanticUpdate}
              onStyleUpdate={onStyleUpdate}
            />
          )}
        </div>
      ),
    );

  return (
    <>
      {contentExtras != null && !hasContentGroup && (
        <PropertySection title="Content">{contentExtras}</PropertySection>
      )}
      {sections.map((layout) => {
        const { section, sourceRows, rows, chipGroups, dependents } = layout;
        const tail = extrasBySection.get(section);
        const lead = leadsBySection.get(section) ?? null;
        const head =
          section === "content" && hasContentGroup ? contentExtras : null;
        // 계약 행 · 앞머리 · 머리가 없으면 꼬리 (주입 컨트롤) 만 든 섹션이다.
        const extrasOnly =
          !hasContractRows(layout) && lead == null && head == null;
        if (extrasOnly && tail == null) return null;
        return (
          <PropertySection
            key={section}
            title={sectionTitle(section)}
            className={extrasOnly ? EXTRAS_ONLY_SECTION : undefined}
            actions={
              createsInHeader(section) && sourceRows.length > 0 ? (
                <CollectionBindingCreateAction elementId={elementId} inHeader />
              ) : undefined
            }
          >
            {head}
            {renderRows(sourceRows)}
            {lead}
            {renderRows(rows)}
            {/* boolean 은 섹션당 칩 묶음 (Options → Show → Fill) — 전폭 217, 행 래퍼 없음.
                칩이 게이트인 종속 필드 (Value Label · Legend Position) 는 묶음 바로 아래 */}
            {chipGroups.map(({ group, fields: chipFields }) => (
              <ChipGroupField
                key={`chips:${group}`}
                group={group}
                sectionLabel={sectionTitle(section)}
                fields={chipFields}
                onSemanticUpdate={onSemanticUpdate}
                onStyleUpdate={onStyleUpdate}
                elementId={elementId}
              />
            ))}
            {renderRows(dependents)}
            {tail}
          </PropertySection>
        );
      })}
    </>
  );
});
