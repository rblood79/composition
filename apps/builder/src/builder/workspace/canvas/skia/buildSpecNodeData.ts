/**
 * buildSpecNodeData — Spec 기반 컴포넌트 SkiaNodeData 빌드 (ADR-100 Phase 8)
 *
 * ElementSprite의 Spec→shapes→specShapesToSkia 파이프라인을 순수 함수로 추출.
 * Button, Checkbox, Switch 등 TAG_SPEC_MAP에 등록된 모든 컴포넌트를 처리.
 *
 * Phase 8 추가:
 * - Parent→child value propagation (size delegation, progress, slider, date, icon, label)
 * - Column layout (rearrangeShapesForColumn)
 * - Text auto-height (measureSpecTextMinHeight)
 * - Accent override (withAccentOverride)
 * - Phantom indicator offset (padding/align-items)
 * - Disabled opacity, focus ring, text wrapping props
 *
 * PixiJS 의존성 없음. element.props + layout + theme + elementsMap에서 구축.
 */

import type { Element } from "../../../../types/core/store.types";
import type { SkiaNodeData } from "./nodeRendererTypes";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";
import {
  normalizeBreadcrumbRspSizeKey,
  type ComponentState,
  type PropagationRule,
} from "@composition/specs";
import { getSpecForTag } from "../sprites/tagSpecMap";
import { specShapesToSkia } from "./specShapeConverter";
import {
  withAccentOverride,
  type TintPreset,
} from "../../../../utils/theme/tintToSkiaColors";
import { sortElementsByOrderThenSource } from "../../../utils/elementOrdering";
import {
  getParentTagsForChild,
  getPropagationRules,
} from "../../../utils/propagationRegistry";
import { getNecessityIndicatorSuffix } from "@composition/shared/components";
import { formatProgressValue } from "../layout/engines/implicitStyles";
import {
  PHANTOM_INDICATOR_CONFIGS,
  parseLineHeight,
} from "../layout/engines/utils";
import {
  parseCSSSize,
  cssColorToHex,
  colorIntToFloat32,
  parseTextShadow,
  parseTextDecoration,
  parseDecorationColor,
} from "../sprites/styleConverter";
import {
  rearrangeShapesForColumn,
  measureSpecTextMinHeight,
  normalizeMiddleBaselineTextLineHeight,
} from "./specBuildHelpers";
import { findAncestorByTag } from "./ancestorLookup";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SpecBuildInput {
  element: Element;
  layout: ComputedLayout | undefined;
  theme: "light" | "dark";
  /** childrenMap에서 조회한 자식 Element 목록 */
  childElements?: Element[];
  /** 부모 체인 조회용 (Phase 8) */
  elementsMap: Map<string, Element>;
  /** 형제 조회용 — resolveBreadcrumbItemContext, resolveToggleGroupPosition */
  childrenMap?: Map<string, Element[]>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONTAINER_DIMENSION_TAGS = new Set([
  "Tag",
  "Breadcrumbs",
  "Tabs",
  "TabList",
  "Tab",
  "Toast",
  "ProgressBar",
  "ProgressBarTrack",
  "Meter",
  "MeterTrack",
  "TextField",
  "TextArea",
  "Input",
  "Select",
  "SelectTrigger",
  "ComboBox",
  "SearchField",
  "NumberField",
  "GridList",
  "Image",
  "Slider",
  "SliderTrack",
  "ListBox",
  "ColorField",
  "ColorSlider",
  "DateSegment",
  "Skeleton",
  "Switcher",
  // ADR-097 Phase 4A: TagList spec shapes 가 props.items 기반 chip 렌더 시 컨테이너
  //   폭 필수 (ListBox 선례 대칭). items 는 TagGroup.propagation 으로 TagList 전파 →
  //   TagList Skia node 좌표계에서 chip self-render. Label 은 TagGroup 의 형제 자식
  //   element 로 독립 렌더되므로 간섭 없음.
  "TagList",
]);

/**
 * Shell-only 컨테이너: factory가 자식을 자동 생성하며, 자식 Element가 독립
 * Skia 노드로 렌더링된다. 부모 spec shapes는 항상 shell(bg+border)만 반환해야 한다.
 * → `_hasChildren` 주입을 **자식 수와 무관하게** 수행한다
 *   (자식을 모두 삭제해도 standalone 렌더링으로 돌아가지 않음 —
 *    `COMPLEX_COMPONENT_TAGS`의 "자식 유무 무관 `_hasChildren=true`" 원칙).
 * → `incrementalSync` 부모 rebuild expansion 불필요 (부모 shape이 자식 props에 의존하지 않음).
 *
 * 확장 후보는 `SYNTHETIC_CHILD_PROP_MERGE_TAGS`에 과도기적으로 남아있으며
 * 개별 spec standalone 분기 감사 후 후속 ADR에서 재분류 예정.
 */
export const SHELL_ONLY_CONTAINER_TAGS = new Set([
  "Calendar",
  "RangeCalendar",
  // ADR-072 Phase 1: standalone 분기가 "bg+border + 빈 container placeholder" 형태임이
  // 확인된 태그들. factory가 자식 Element를 자동 생성하며, 자식 수 무관 _hasChildren=true 주입.
  "Card",
  "Dialog",
  "Section",
  "DisclosureGroup",
  // ADR-072 Phase 2-A: Group 컨테이너. factory가 자식 items 자동 생성.
  // ButtonGroup/ToggleButtonGroup: bg(+border) + 빈 container. CheckboxGroup/RadioGroup:
  // description text(옵션) + 빈 container — description은 hasChildren 무관 항상 렌더.
  "ButtonGroup",
  "CheckboxGroup",
  "RadioGroup",
  "ToggleButtonGroup",
  // ADR-072 Phase 2-B: factory가 자식 Element로 시각 콘텐츠 렌더링 대체.
  // Disclosure: DisclosureHeader/Content / Form: Heading/Description/FormField /
  // Popover: Heading/Description (arrow는 RAC OverlayArrow DOM 전용) /
  // Tooltip: Description / ColorPicker: ColorArea/ColorSlider/ColorField (각자 Spec).
  // standalone 실렌더는 레거시 fallback이며 factory 자식이 모두 대체 커버함.
  "Disclosure",
  "Form",
  "Popover",
  "Tooltip",
  "ColorPicker",
  // ADR-902 후속: Body 는 페이지 루트. factory 가 자식 Element 를 자동 생성하지
  // 않지만 빈 페이지에서도 배경이 렌더되어야 하므로 shell-only 규칙 필요.
  // Key 는 lowercase — element.type 가 "body" 이고 Set.has 는 정확 매칭.
  "body",
]);

/**
 * Synthetic child prop merge 컨테이너: 자식 props를 부모 spec shapes에 통합
 * 렌더링한다(Breadcrumbs `_crumbs`, GridList/ListBox `items`, Menu 등).
 * → `_hasChildren=true` 주입 **금지** (주입 시 shell만 남고 내용이 사라짐).
 * → 자식 변경 시 부모 rebuild 필요 → `StoreRenderBridge.incrementalSync`
 *    expansion 대상.
 */
export const SYNTHETIC_CHILD_PROP_MERGE_TAGS = new Set([
  "Breadcrumbs",
  "ComboBox",
  "GridList",
  "ListBox",
  // ADR-068: Menu는 items SSOT 전환 — _hasChildren 분기 제거, 더 이상 EXCLUDE 대상 아님
  // ADR-072 Phase 3: TabPanel/TabPanels는 shapes=[]로 자식 props를 사용하지 않아
  //   SYNTHETIC 멤버십의 두 효과(incrementalSync rebuild expansion + stale-ref 교체)
  //   모두 불필요. Shell-only도 의미 없음(shapes 자체가 빈 배열).
  "Select",
  "Table",
  "Tabs",
  "TagGroup",
  "Toolbar",
  "Tree",
]);

const NOWRAP_PARENTS = new Set([
  "Checkbox",
  "CheckBox",
  "CheckboxGroup",
  "Radio",
  "RadioGroup",
  "Switch",
  "Toggle",
  "ProgressBar",
  "Meter",
  "Slider",
]);

const FORM_INHERITANCE_TAGS = new Set([
  "TextField",
  "NumberField",
  "SearchField",
  "ColorField",
]);

const PARENT_LABEL_PROP_SOURCE_TAGS = new Set([
  "TextField",
  "TextArea",
  "NumberField",
  "SearchField",
  "ColorField",
]);

const DATE_INPUT_PARENT_TAGS = new Set([
  "DateField",
  "TimeField",
  "DatePicker",
  "DateRangePicker",
]);

// ---------------------------------------------------------------------------
// Parent Lookup Helpers (pure functions — no hooks)
// ---------------------------------------------------------------------------

function getProps(element: Element): Record<string, unknown> {
  return (element.props ?? {}) as Record<string, unknown>;
}

function resolveParentLabelText(
  element: Element,
  elementsMap: Map<string, Element>,
): string | null {
  if (element.type !== "Label" || !element.parent_id) return null;

  const parent = elementsMap.get(element.parent_id);
  if (!parent || !PARENT_LABEL_PROP_SOURCE_TAGS.has(parent.type)) return null;

  const label = getProps(parent).label;
  return typeof label === "string" ? label : null;
}

function propagationPathMatches(
  ancestor: Element,
  element: Element,
  childPath: PropagationRule["childPath"],
  elementsMap: Map<string, Element>,
): boolean {
  const expectedPath = Array.isArray(childPath) ? childPath : [childPath];
  const actualPath = [element.type];
  let parentId = element.parent_id;

  while (parentId) {
    const parent = elementsMap.get(parentId);
    if (!parent) return false;
    if (parent.id === ancestor.id) {
      if (actualPath.length !== expectedPath.length) return false;
      return actualPath.every((type, index) => type === expectedPath[index]);
    }
    actualPath.unshift(parent.type);
    parentId = parent.parent_id;
  }

  return false;
}

function getPropagationAncestors(
  element: Element,
  elementsMap: Map<string, Element>,
): Element[] {
  const ancestors: Element[] = [];
  let parentId = element.parent_id;
  while (parentId) {
    const parent = elementsMap.get(parentId);
    if (!parent) break;
    ancestors.push(parent);
    parentId = parent.parent_id;
  }
  return ancestors.reverse();
}

function shouldSkipStylePropagation(
  style: Record<string, unknown>,
  rule: PropagationRule,
): boolean {
  if (rule.override) return false;
  if (rule.childProp && style[rule.childProp] !== undefined) return true;
  return (rule.skipIfSet ?? []).some((key) => style[key] !== undefined);
}

function resolvePropagationValue(
  rule: PropagationRule,
  parentProps: Record<string, unknown>,
): unknown {
  let value =
    rule.parentProp !== undefined
      ? parentProps[rule.parentProp]
      : rule.styleValue;
  if (value === undefined) return undefined;

  if (rule.transform) {
    try {
      value = rule.transform(value, parentProps);
    } catch {
      return undefined;
    }
  }

  return value;
}

function applyParentPropagationProps(
  element: Element,
  props: Record<string, unknown>,
  elementsMap: Map<string, Element>,
): Record<string, unknown> {
  let nextProps = props;
  const ancestors = getPropagationAncestors(element, elementsMap);

  for (const ancestor of ancestors) {
    const rules = getPropagationRules(ancestor.type);
    if (!rules) continue;

    const parentProps = getProps(ancestor);
    for (const rule of rules) {
      if (
        !propagationPathMatches(ancestor, element, rule.childPath, elementsMap)
      ) {
        continue;
      }

      const childProp = rule.childProp ?? rule.parentProp;
      if (!childProp) continue;

      const value = resolvePropagationValue(rule, parentProps);
      if (value === undefined) continue;

      if (rule.asStyle) {
        const style = (nextProps.style ?? {}) as Record<string, unknown>;
        if (shouldSkipStylePropagation(style, rule)) continue;
        nextProps = {
          ...nextProps,
          style: {
            ...style,
            [childProp]: value,
          },
        };
        continue;
      }

      if (!rule.override && nextProps[childProp] !== undefined) continue;
      nextProps = { ...nextProps, [childProp]: value };
    }
  }

  return nextProps;
}

/** Registry 기반 부모 size delegation (0-3 level 조상 탐색) */
function resolveParentDelegatedSize(
  element: Element,
  elementsMap: Map<string, Element>,
): string | null {
  if (element.type === "Breadcrumb" && element.parent_id) {
    const parent = elementsMap.get(element.parent_id);
    if (parent?.type === "Breadcrumbs") {
      return (getProps(parent).size as string) ?? "M";
    }
  }

  const delegationParents = getParentTagsForChild(element.type);
  if (!delegationParents || !element.parent_id) return null;

  let currentId: string | null | undefined = element.parent_id;
  for (let depth = 0; depth < 3 && currentId; depth++) {
    const ancestor = elementsMap.get(currentId);
    if (!ancestor) break;
    if (delegationParents.has(ancestor.type.toLowerCase())) {
      return (getProps(ancestor).size as string) ?? null;
    }
    currentId = ancestor.parent_id;
  }
  return null;
}

/** Breadcrumb → 부모 Breadcrumbs의 구분자·마지막 여부·비활성 */
function resolveBreadcrumbItemContext(
  element: Element,
  elementsMap: Map<string, Element>,
  childrenMap?: Map<string, Element[]>,
): {
  _isLast: boolean;
  _separator: string;
  _parentIsDisabled: boolean;
} | null {
  if (element.type !== "Breadcrumb" || !element.parent_id) return null;
  const parent = elementsMap.get(element.parent_id);
  if (!parent || parent.type !== "Breadcrumbs") return null;

  const pp = getProps(parent);
  // childrenMap이 있으면 O(siblings)로 조회, 없으면 fallback O(n)
  const rawSiblings = childrenMap?.get(parent.id);
  const siblings = rawSiblings
    ? rawSiblings.filter((el) => el.type === "Breadcrumb")
    : (() => {
        const result: Element[] = [];
        for (const el of elementsMap.values()) {
          if (el.parent_id === parent.id && el.type === "Breadcrumb") {
            result.push(el);
          }
        }
        return result;
      })();
  siblings.splice(
    0,
    siblings.length,
    ...sortElementsByOrderThenSource(siblings),
  );
  const idx = siblings.findIndex((s) => s.id === element.id);
  if (idx === -1) return null;

  return {
    _isLast: idx === siblings.length - 1,
    _separator: String(pp.separator ?? "›"),
    _parentIsDisabled: Boolean(pp.isDisabled),
  };
}

/** ToggleButton group position + indicator mode */
function resolveToggleGroupContext(
  element: Element,
  elementsMap: Map<string, Element>,
  childrenMap: Map<string, Element[]> | null,
): {
  position: {
    orientation: string;
    isFirst: boolean;
    isLast: boolean;
    isOnly: boolean;
  } | null;
  indicatorMode: boolean;
} {
  if (element.type !== "ToggleButton" || !element.parent_id) {
    return { position: null, indicatorMode: false };
  }

  const parent = elementsMap.get(element.parent_id);
  if (!parent || parent.type !== "ToggleButtonGroup") {
    return { position: null, indicatorMode: false };
  }

  const parentProps = getProps(parent);
  const orientation = (parentProps.orientation as string) || "horizontal";
  const indicatorMode = Boolean(parentProps.indicator);

  const siblings = childrenMap?.get(parent.id);
  if (!siblings || siblings.length === 0) {
    return { position: null, indicatorMode };
  }

  const sorted = sortElementsByOrderThenSource(siblings);
  const index = sorted.findIndex((s) => s.id === element.id);
  if (index === -1) return { position: null, indicatorMode };

  return {
    position: {
      orientation,
      isFirst: index === 0,
      isLast: index === sorted.length - 1,
      isOnly: sorted.length === 1,
    },
    indicatorMode,
  };
}

/** DateInput parent type/granularity/hourCycle/locale */
function resolveDateInputParent(
  element: Element,
  elementsMap: Map<string, Element>,
): Record<string, unknown> | null {
  if (element.type !== "DateInput" || !element.parent_id) return null;

  const parent = elementsMap.get(element.parent_id);
  if (!parent || !DATE_INPUT_PARENT_TAGS.has(parent.type)) return null;

  const pp = getProps(parent);
  const result: Record<string, unknown> = { _parentTag: parent.type };
  if (pp.granularity != null) result._granularity = pp.granularity;
  if (pp.hourCycle != null) result._hourCycle = pp.hourCycle;
  if (pp.locale != null) result._locale = pp.locale;
  return result;
}

/** Label necessity indicator from parent field */
function resolveLabelNecessity(
  element: Element,
  elementsMap: Map<string, Element>,
): { indicator: string; isRequired: boolean } | null {
  if (element.type !== "Label" || !element.parent_id) return null;

  const parent = elementsMap.get(element.parent_id);
  if (!parent) return null;

  const pp = getProps(parent);
  const indicator = pp.necessityIndicator as string | undefined;
  if (!indicator) return null;

  return { indicator, isRequired: Boolean(pp.isRequired) };
}

/** Label alignment from Form ancestor chain */
function resolveLabelAlignment(
  element: Element,
  elementsMap: Map<string, Element>,
): string | null {
  if (element.type !== "Label" || !element.parent_id) return null;

  // Walk from parent → ancestors looking for Form
  let currentId: string | null | undefined = element.parent_id;
  while (currentId) {
    const ancestor = elementsMap.get(currentId);
    if (!ancestor) break;

    if (ancestor.type === "Form" || FORM_INHERITANCE_TAGS.has(ancestor.type)) {
      const pp = getProps(ancestor);
      if (pp.labelPosition === "side" && pp.labelAlign) {
        return pp.labelAlign as string;
      }
    }

    currentId = ancestor.parent_id;
  }
  return null;
}

/** ProgressBar/Meter → Track/Value value propagation */
function resolveProgressProps(
  element: Element,
  elementsMap: Map<string, Element>,
): Record<string, unknown> | null {
  const isTrack =
    element.type === "ProgressBarTrack" || element.type === "MeterTrack";
  const isValue =
    element.type === "ProgressBarValue" || element.type === "MeterValue";
  if (!isTrack && !isValue) return null;
  if (!element.parent_id) return null;

  const parent = elementsMap.get(element.parent_id);
  if (!parent) return null;

  const pp = getProps(parent);
  const rawVal = (pp.value as number) ?? 0;
  const minV = (pp.minValue as number) ?? 0;
  const maxV = (pp.maxValue as number) ?? 100;
  const normalizedValue =
    maxV > minV
      ? Math.max(0, Math.min(100, ((rawVal - minV) / (maxV - minV)) * 100))
      : 0;

  if (isTrack) {
    return {
      value: normalizedValue,
      isIndeterminate: Boolean(pp.isIndeterminate),
      variant: (pp.variant as string) ?? undefined,
      size: (pp.size as string) ?? undefined,
    };
  }

  // isValue
  const showValueLabel = pp.showValueLabel !== false;
  if (!showValueLabel) return null;

  const valueLabel = pp.valueLabel as string | undefined;
  const formatted =
    valueLabel && valueLabel.length > 0
      ? valueLabel
      : formatProgressValue(
          rawVal,
          minV,
          maxV,
          pp.formatOptions && typeof pp.formatOptions === "object"
            ? (pp.formatOptions as Record<string, unknown>)
            : null,
        );

  return {
    children: formatted,
    size: (pp.size as string) ?? undefined,
    _clearFontSize: true, // signal to clear fontSize from style
  };
}

/** Slider → SliderTrack value propagation */
function resolveSliderProps(
  element: Element,
  elementsMap: Map<string, Element>,
): Record<string, unknown> | null {
  if (element.type !== "SliderTrack" || !element.parent_id) return null;

  const parent = elementsMap.get(element.parent_id);
  if (!parent) return null;

  const pp = getProps(parent);
  return {
    value: pp.value ?? 50,
    minValue: (pp.minValue as number) ?? 0,
    maxValue: (pp.maxValue as number) ?? 100,
    variant: (pp.variant as string) ?? "default",
  };
}

/**
 * SelectIcon/ComboBoxTrigger → parent/grandparent iconName
 *
 * ADR-102: SelectIcon — RAC 공식 미존재 composition 고유 D3 시각 element.
 *   BC HIGH (factory 직렬화 type) → 정당화 유지. grandparent(Select) iconName 위임.
 * ADR-101: ComboBoxTrigger — Compositional Architecture 고유 element.
 */
function resolveIconDelegation(
  element: Element,
  elementsMap: Map<string, Element>,
): string | null {
  if (element.type !== "SelectIcon" && element.type !== "ComboBoxTrigger")
    return null;
  if (!element.parent_id) return null;

  const parent = elementsMap.get(element.parent_id);
  if (!parent) return null;

  const parentIcon = getProps(parent).iconName as string | undefined;
  if (parentIcon) return parentIcon;

  // Grandparent fallback (SelectIcon → SelectTrigger → Select)
  if (parent.parent_id) {
    const gp = elementsMap.get(parent.parent_id);
    if (gp) {
      const gpIcon = getProps(gp).iconName as string | undefined;
      if (gpIcon) return gpIcon;
    }
  }
  return null;
}

/** TagGroup allowsRemoving → Tag child */
function resolveTagGroupAllowsRemoving(
  element: Element,
  elementsMap: Map<string, Element>,
): boolean {
  if (element.type !== "Tag" || !element.parent_id) return false;

  const tagList = elementsMap.get(element.parent_id);
  if (!tagList?.parent_id) return false;

  const ancestor =
    tagList.type === "TagList"
      ? elementsMap.get(tagList.parent_id)
      : tagList.type === "TagGroup"
        ? tagList
        : null;
  if (!ancestor || ancestor.type !== "TagGroup") return false;

  return Boolean(getProps(ancestor).allowsRemoving);
}

/**
 * ADR-097 Phase 4A: TagList → 부모 TagGroup 의 items/variant/size/allowsRemoving 전파.
 *
 * TagList spec.shapes 는 `props.items` 기반 chip self-render. Skia 렌더 경로에서
 * TagList.props.items 가 비어 있으면 chip 이 렌더되지 않는다.
 * Inspector edit 경로는 `buildPropagationUpdates` 로 Store 갱신되지만, migration
 * short-circuit (이미 마이그레이션된 프로젝트 — Tag child 없음) / 순수 로드
 * 시점에는 Store 값이 없어 Canvas 가 빈 TagList 를 그린다.
 * 본 resolver 는 `resolveTagGroupAllowsRemoving` 과 대칭으로 TagGroup propagation
 * rule 을 Skia 시점에서 방어적으로 해석 — React/CSS 경로와 Canvas 경로의 SSOT 정합성 보장.
 */
function resolveTagListItemsFromParent(
  element: Element,
  elementsMap: Map<string, Element>,
): Record<string, unknown> | null {
  if (element.type !== "TagList" || !element.parent_id) return null;
  const parent = elementsMap.get(element.parent_id);
  if (!parent || parent.type !== "TagGroup") return null;

  const parentProps = getProps(parent);
  const patch: Record<string, unknown> = {};
  let hasPatch = false;

  const parentItems = parentProps.items;
  if (Array.isArray(parentItems) && parentItems.length > 0) {
    patch.items = parentItems;
    hasPatch = true;
  }

  const parentVariant = parentProps.variant;
  if (typeof parentVariant === "string" && !getProps(element).variant) {
    patch.variant = parentVariant;
    hasPatch = true;
  }

  const parentSize = parentProps.size;
  if (typeof parentSize === "string" && !getProps(element).size) {
    patch.size = parentSize;
    hasPatch = true;
  }

  if (parentProps.allowsRemoving === true) {
    patch.allowsRemoving = true;
    hasPatch = true;
  }

  // ADR-097 Phase 4A propagation rule `{ parentProp: "maxRows", childPath: "TagList" }`
  // 와 정합. Store 에 TagList.props.maxRows 가 누락된 경로 (legacy migration 직후 등)
  // 에서도 Skia chip 행 제한 + "Show all" 동작이 부모 TagGroup.maxRows 와 동일하게 적용되도록
  // 방어적 fallback. Inspector edit 경로는 buildPropagationUpdates 가 store 직접 갱신.
  const parentMaxRows = parentProps.maxRows;
  if (typeof parentMaxRows === "number" && parentMaxRows > 0) {
    patch.maxRows = parentMaxRows;
    hasPatch = true;
  }

  return hasPatch ? patch : null;
}

/** Label in nowrap parent detection */
function isLabelInNowrapParent(
  element: Element,
  elementsMap: Map<string, Element>,
): boolean {
  if (element.type !== "Label" || !element.parent_id) return false;
  const parent = elementsMap.get(element.parent_id);
  if (!parent) return false;
  return NOWRAP_PARENTS.has(parent.type);
}

/** Accent color from element or ancestor chain */
function resolveAccentColor(
  element: Element,
  elementsMap: Map<string, Element>,
): TintPreset | undefined {
  const elementAccent = getProps(element).accentColor as TintPreset | undefined;
  if (elementAccent) return elementAccent;

  let pid = element.parent_id;
  while (pid) {
    const p = elementsMap.get(pid);
    if (!p) break;
    const ac = getProps(p).accentColor as TintPreset | undefined;
    if (ac) return ac;
    pid = p.parent_id;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Main Builder
// ---------------------------------------------------------------------------

/**
 * Spec 기반 컴포넌트의 SkiaNodeData를 생성 (Phase 8 — 전체 기능).
 *
 * 1. TAG_SPEC_MAP에서 ComponentSpec 조회
 * 2. Parent→child value propagation
 * 3. spec.render.shapes() 호출
 * 4. Column layout / text auto-height 보정
 * 5. Accent override + specShapesToSkia() 변환
 * 6. Phantom indicator offset
 * 7. Disabled opacity / focus ring
 */
export function buildSpecNodeData(input: SpecBuildInput): SkiaNodeData | null {
  const { element, layout, theme, childElements, elementsMap } = input;
  const type = element.type;

  const spec = getSpecForTag(type);
  if (!spec) return null;

  const w = layout?.width ?? 0;
  const h = layout?.height ?? 0;

  // 엔진 미확정 + 크기 없음 → 렌더링 보류
  if (w <= 0 && h <= 0) return null;

  // ---------- variant / size spec 해석 ----------
  const props = getProps(element);
  const style = (props.style || {}) as Record<string, unknown>;

  // Parent-delegated size
  const delegatedSize = resolveParentDelegatedSize(element, elementsMap);
  const rawSize = (props.size as string) ?? delegatedSize ?? spec.defaultSize;
  const size =
    element.type === "Breadcrumb"
      ? normalizeBreadcrumbRspSizeKey(rawSize)
      : rawSize;
  const sizeSpec = spec.sizes[size] ?? spec.sizes[spec.defaultSize];
  if (!sizeSpec) return null;

  // ---------- flexDirection → column detection ----------
  // ADR-079 Phase 4: 블랙리스트 → 화이트리스트 전환.
  //   `rearrangeShapesForColumn` 은 Checkbox/Radio/Switch 의 indicator↔label 수직 재배치
  //   전용 후처리. 다른 column-based 컴포넌트가 `render.shapes` 에서 자체 배치를 수행하면
  //   rearrange 가 items text 를 indicator 아래로 강제 + 가운데 정렬 + maxWidth 부여하여
  //   파손. 블랙리스트 방식은 신규 column collection 추가 시 재발 위험 → 사용처 태그만 명시.
  const flexDir = (style.flexDirection as string) || "";
  const COLUMN_REARRANGE_TAGS = new Set(["Checkbox", "Radio", "Switch"]);
  const isColumn =
    COLUMN_REARRANGE_TAGS.has(element.type) &&
    (flexDir === "column" || flexDir === "column-reverse");

  // ---------- specProps 준비 ----------
  let specProps: Record<string, unknown> = { ...props };

  const parentLabelText = resolveParentLabelText(element, elementsMap);
  if (parentLabelText !== null) {
    specProps = { ...specProps, children: parentLabelText };
  }
  specProps = applyParentPropagationProps(element, specProps, elementsMap);

  // Size injection — Breadcrumb은 항상 RSP 키 S|M|L (Skia shapes·패딩·typography 토큰 정합)
  if (element.type === "Breadcrumb") {
    specProps = { ...specProps, size };
  } else if (delegatedSize && !props.size) {
    specProps = { ...specProps, size: delegatedSize };
  }

  // ToggleButton group position + indicator mode
  const toggleCtx = resolveToggleGroupContext(
    element,
    elementsMap,
    input.childrenMap ?? null,
  );
  if (toggleCtx.position) {
    specProps = { ...specProps, _groupPosition: toggleCtx.position };
  }
  if (toggleCtx.indicatorMode) {
    specProps = { ...specProps, _indicatorMode: true };
  }

  // DateInput parent delegation
  const dateProps = resolveDateInputParent(element, elementsMap);
  if (dateProps) {
    specProps = { ...specProps, ...dateProps };
  }

  const breadcrumbCtx = resolveBreadcrumbItemContext(
    element,
    elementsMap,
    input.childrenMap,
  );
  if (breadcrumbCtx) {
    specProps = {
      ...specProps,
      _isLast: breadcrumbCtx._isLast,
      _separator: breadcrumbCtx._separator,
    };
  }

  // Label necessity indicator
  const necessity = resolveLabelNecessity(element, elementsMap);
  if (necessity) {
    const originalText =
      (specProps.children as string) || (specProps.label as string) || "";
    const indicatorText = getNecessityIndicatorSuffix(
      necessity.indicator,
      necessity.isRequired,
    );
    if (indicatorText) {
      specProps = {
        ...specProps,
        children: originalText + indicatorText,
        _necessityIndicator: necessity.indicator,
        _isRequired: necessity.isRequired,
      };
    }
  }

  // Label alignment from Form ancestor
  const labelAlign = resolveLabelAlignment(element, elementsMap);
  if (labelAlign) {
    const existingStyle = (specProps.style || {}) as Record<string, unknown>;
    specProps = {
      ...specProps,
      style: {
        ...existingStyle,
        textAlign: existingStyle.textAlign ?? labelAlign,
      },
    };
  }

  // ProgressBar/Meter value propagation
  const progressProps = resolveProgressProps(element, elementsMap);
  if (progressProps) {
    const clearFontSize = progressProps._clearFontSize;
    const { _clearFontSize: _, ...rest } = progressProps;
    specProps = {
      ...specProps,
      ...Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== undefined),
      ),
      ...(specProps.value != null && !clearFontSize
        ? { value: specProps.value }
        : {}),
    };

    if (clearFontSize) {
      const existingStyle = (specProps.style || {}) as Record<string, unknown>;
      specProps = {
        ...specProps,
        style: { ...existingStyle, fontSize: undefined },
      };
    }
  }

  // Slider value propagation
  const sliderProps = resolveSliderProps(element, elementsMap);
  if (sliderProps) {
    specProps = { ...specProps, ...sliderProps };
  }

  // SelectIcon/ComboBoxTrigger icon delegation
  const delegatedIcon = resolveIconDelegation(element, elementsMap);
  if (delegatedIcon && !specProps.iconName) {
    specProps = { ...specProps, iconName: delegatedIcon };
  }

  // TagGroup allowsRemoving
  if (resolveTagGroupAllowsRemoving(element, elementsMap)) {
    specProps = { ...specProps, allowsRemoving: true };
  }

  // ADR-097 Phase 4A: TagList ← TagGroup items/variant/size/allowsRemoving propagation.
  //   자식 명시값 있으면 skip (items 는 override:true — 부모 우선). React/CSS 경로 대칭.
  const tagListParentPatch = resolveTagListItemsFromParent(
    element,
    elementsMap,
  );
  if (tagListParentPatch) {
    specProps = { ...specProps, ...tagListParentPatch };
  }

  // Tab/TabList: 조상 Tabs 1회 조회 → _isSelected, _showIndicator, orientation 주입
  if (element.type === "Tab" || element.type === "TabList") {
    const tabsAncestor = element.parent_id
      ? findAncestorByTag(element, "Tabs", elementsMap, 3)
      : undefined;

    if (tabsAncestor && element.type === "Tab") {
      const ap = getProps(tabsAncestor);
      // _isSelected
      const tabId = getProps(element).tabId as string | undefined;
      if (tabId) {
        const selectedKey =
          (ap.selectedKey as string | undefined) ??
          (ap.defaultSelectedKey as string | undefined);
        specProps = {
          ...specProps,
          _isSelected: selectedKey != null ? selectedKey === tabId : false,
        };
      }
      // _showIndicator
      specProps = { ...specProps, _showIndicator: ap.showIndicator !== false };
    }

    // orientation (Tab + TabList 모두)
    if (tabsAncestor && !specProps.orientation) {
      specProps = {
        ...specProps,
        orientation:
          (getProps(tabsAncestor).orientation as string) ?? "horizontal",
      };
    }
  }

  // _hasChildren injection
  //
  // Shell-only: factory가 자식을 자동 생성하는 complex 컴포넌트. 자식 수와
  //   무관하게 항상 주입하여 사용자가 자식을 모두 삭제해도 standalone 렌더링
  //   으로 돌아가지 않도록 한다.
  // Synthetic-merge: 자식 props를 spec shapes에 통합하므로 주입 차단
  //   (주입 시 shell만 남고 내용이 사라짐).
  // 그 외 일반 컨테이너: 자식이 있을 때만 주입.
  if (SHELL_ONLY_CONTAINER_TAGS.has(type)) {
    specProps = { ...specProps, _hasChildren: true };
  } else if (
    !SYNTHETIC_CHILD_PROP_MERGE_TAGS.has(type) &&
    childElements &&
    childElements.length > 0
  ) {
    specProps = { ...specProps, _hasChildren: true };
  }

  // Container dimension injection
  if (CONTAINER_DIMENSION_TAGS.has(type)) {
    specProps = {
      ...specProps,
      _containerWidth: w,
      _containerHeight: h,
    };
  }

  // ---------- component state ----------
  // Breadcrumb 마지막 항목: Preview CSS와 동일 — isDisabled·부모 isDisabled와 무관하게 비활성 opacity/톤 미적용
  const componentState: ComponentState = (() => {
    if (breadcrumbCtx?._isLast) return "default";
    if (specProps.isDisabled || specProps.disabled) return "disabled";
    if (breadcrumbCtx?._parentIsDisabled) return "disabled";
    return "default";
  })();

  // ---------- width/height injection ----------
  let specHeight = h;
  if (w > 0 || h > 0) {
    const existingStyle = (specProps.style || {}) as Record<string, unknown>;
    const existingW = existingStyle.width;
    const resolvedWidth =
      typeof existingW === "number" ? existingW : w > 0 ? w : undefined;
    specProps = {
      ...specProps,
      style: {
        ...existingStyle,
        width: resolvedWidth,
        height: existingStyle.height ?? (h > 0 ? h : undefined),
      },
    };
  }

  // ---------- shapes 생성 ----------
  const shapes = spec.render.shapes(specProps, sizeSpec, componentState);
  if (type === "Slot" && specProps._slotChrome === "hidden") {
    shapes.length = 0;
  }

  normalizeMiddleBaselineTextLineHeight(
    shapes,
    sizeSpec as unknown as Record<string, unknown>,
  );

  // ---------- Column layout ----------
  if (isColumn) {
    rearrangeShapesForColumn(shapes, w, sizeSpec.gap ?? 8);
  }

  // ---------- Text auto-height ----------
  const hasExplicitHeight =
    style.height !== undefined && style.height !== "auto";
  if (!hasExplicitHeight && w > 0) {
    const textMinHeight = measureSpecTextMinHeight(
      shapes,
      w,
      sizeSpec as unknown as Record<string, unknown>,
      style.whiteSpace as string | undefined,
      style.wordBreak as string | undefined,
      style.overflowWrap as string | undefined,
    );
    if (textMinHeight !== undefined && textMinHeight > specHeight) {
      specHeight = textMinHeight;
    }
  }

  // ---------- Accent override + specShapesToSkia ----------
  const resolvedAccent = resolveAccentColor(element, elementsMap);
  const specNode = withAccentOverride(resolvedAccent, () =>
    specShapesToSkia(shapes, theme, w, specHeight, element.id),
  );

  // ---------- Inline CSS border overlay ----------
  applyInlineBorderOverlay(specNode, style);

  // ---------- Phantom indicator offset ----------
  applyPhantomIndicatorOffset(specNode, type, size, style, specHeight);

  // ---------- Disabled opacity ----------
  if (componentState === "disabled") {
    const opacityVal =
      (spec.states?.disabled?.opacity as number | undefined) ?? 0.38;
    specNode.effects = [
      ...(specNode.effects ?? []),
      { type: "opacity" as const, value: opacityVal },
    ];
  }

  // Focus ring: componentState가 focusVisible/focused를 지원하게 되면 활성화
  // 현재 componentState는 "default" | "disabled"만 가능

  // ---------- Text style overrides (ADR-057 Phase A/B: style → child.text) ----------
  // 기존 whiteSpace-only override를 13개 필드로 일반화.
  // Phase A (Layout 영향 6): whiteSpace, wordBreak, overflowWrap, lineHeight, textIndent, clipText
  // Phase B (Paint 영향 7): textDecoration(+style/color), textOverflow, wordSpacing,
  //                        fontVariant, fontStretch, textShadow, verticalAlign
  // Tag/Badge 기본 nowrap + Label-in-nowrap-parent 특수 케이스 유지.
  if (specNode.children) {
    const labelNowrap = isLabelInNowrapParent(element, elementsMap);
    const isNowrapTag = type === "Tag" || type === "Badge";
    const hasOverflowClip =
      style.overflow === "hidden" || style.overflow === "clip";

    for (const child of specNode.children) {
      if (child.type !== "text" || !child.text) continue;

      // ===== Phase A — Layout 영향 =====

      // 1. whiteSpace — style 우선, 없으면 Tag/Badge/Label-in-nowrap-parent 기본값
      const effectiveWhiteSpace =
        (style.whiteSpace as string) ??
        (labelNowrap || isNowrapTag ? "nowrap" : undefined);
      if (effectiveWhiteSpace) {
        child.text.whiteSpace =
          effectiveWhiteSpace as typeof child.text.whiteSpace;
      }

      // 2. wordBreak
      if (style.wordBreak) {
        child.text.wordBreak = style.wordBreak as typeof child.text.wordBreak;
      }

      // 3. overflowWrap
      if (style.overflowWrap) {
        child.text.overflowWrap =
          style.overflowWrap as typeof child.text.overflowWrap;
      }

      // 4. lineHeight — style.lineHeight 명시 시 spec 기본값 override
      if (style.lineHeight != null && style.lineHeight !== "normal") {
        const parsed = parseLineHeight(style, child.text.fontSize);
        if (parsed != null && parsed > 0) {
          child.text.lineHeight = parsed;
        }
      }

      // 5. textIndent
      if (style.textIndent != null) {
        child.text.textIndent = parseCSSSize(
          style.textIndent as string | number,
          undefined,
          0,
        );
      }

      // 6. clipText — style.overflow: hidden | clip 파생
      if (hasOverflowClip) {
        child.text.clipText = true;
      }

      // ===== Phase B — Paint 영향 =====

      // 7. textDecoration — style 풀셋(underline/overline/line-through 조합) override
      if (style.textDecoration != null && style.textDecoration !== "none") {
        const mask = parseTextDecoration(style.textDecoration as string);
        if (mask > 0) {
          child.text.decoration = mask;
        }
      }
      // 7a. decorationStyle
      if (style.textDecorationStyle) {
        child.text.decorationStyle =
          style.textDecorationStyle as typeof child.text.decorationStyle;
      }
      // 7b. decorationColor
      if (style.textDecorationColor) {
        const dc = parseDecorationColor(style.textDecorationColor as string);
        if (dc) child.text.decorationColor = dc;
      }

      // 8. textOverflow
      if (style.textOverflow) {
        child.text.textOverflow =
          style.textOverflow as typeof child.text.textOverflow;
      }

      // 9. wordSpacing
      if (style.wordSpacing != null) {
        child.text.wordSpacing = parseCSSSize(
          style.wordSpacing as string | number,
          undefined,
          0,
        );
      }

      // 10. fontVariant (small-caps 등)
      if (style.fontVariant && style.fontVariant !== "normal") {
        child.text.fontVariant = style.fontVariant as string;
      }

      // 11. fontStretch (condensed 등)
      if (style.fontStretch && style.fontStretch !== "normal") {
        child.text.fontStretch = style.fontStretch as string;
      }

      // 12. textShadow — CSS text-shadow → TextShadow[] 배열
      if (style.textShadow && style.textShadow !== "none") {
        const shadows = parseTextShadow(style.textShadow as string);
        if (shadows.length > 0) {
          child.text.textShadows = shadows;
        }
      }

      // 13. verticalAlign
      if (style.verticalAlign) {
        child.text.verticalAlign =
          style.verticalAlign as typeof child.text.verticalAlign;
      }
    }
  }

  // ---------- layout 좌표 적용 ----------
  specNode.x = layout?.x ?? 0;
  specNode.y = layout?.y ?? 0;
  specNode.width = w;
  specNode.height = specHeight;
  specNode.elementId = element.id;

  return specNode;
}

// ---------------------------------------------------------------------------
// Phantom Indicator Offset
// ---------------------------------------------------------------------------

function applyPhantomIndicatorOffset(
  specNode: SkiaNodeData,
  type: string,
  size: string,
  style: Record<string, unknown>,
  specHeight: number,
): void {
  const tagLower = type.toLowerCase();
  const indicatorConfig = PHANTOM_INDICATOR_CONFIGS[tagLower];
  if (!indicatorConfig) return;

  const padFallback =
    style.padding !== undefined
      ? parseCSSSize(style.padding as string | number)
      : 0;
  const padTop =
    style.paddingTop !== undefined
      ? parseCSSSize(style.paddingTop as string | number)
      : padFallback;
  const padBottom =
    style.paddingBottom !== undefined
      ? parseCSSSize(style.paddingBottom as string | number)
      : padFallback;
  const padLeft =
    style.paddingLeft !== undefined
      ? parseCSSSize(style.paddingLeft as string | number)
      : padFallback;

  // content area 높이 = border-box - padding
  const contentH = specHeight - padTop - padBottom;

  // align-items 세로 정렬
  const s = (size as "sm" | "md" | "lg") || "md";
  const indicatorH = indicatorConfig.heights[s] ?? indicatorConfig.heights.md;
  const alignItems = style.alignItems as string | undefined;
  let alignOffsetY = 0;
  if (alignItems === "center" && contentH > indicatorH) {
    alignOffsetY = (contentH - indicatorH) / 2;
  } else if (alignItems === "flex-end" && contentH > indicatorH) {
    alignOffsetY = contentH - indicatorH;
  }

  // padding + align-items 합산 오프셋
  specNode.x = (specNode.x ?? 0) + padLeft;
  specNode.y = (specNode.y ?? 0) + padTop + alignOffsetY;
}

// ---------------------------------------------------------------------------
// Inline CSS Border Overlay
// ---------------------------------------------------------------------------

/**
 * 사용자가 스타일 패널에서 설정한 inline CSS border를 spec node 위에 오버레이.
 * Spec shapes는 컴포넌트 기본 외관을 정의하고, inline border는 사용자 커스터마이징.
 */
function applyInlineBorderOverlay(
  specNode: SkiaNodeData,
  style: Record<string, unknown>,
): void {
  const borderWidth = style.borderWidth;
  if (borderWidth == null) return;

  const bw = parseCSSSize(borderWidth as string | number);
  if (bw <= 0) return;

  const borderColorStr = style.borderColor as string | undefined;

  // borderColor가 명시되지 않으면 spec의 border(대부분 transparent)를 덮어쓰지 않음
  // Spec이 이미 transparent로 렌더링했다면 그대로 유지 (CSS currentColor 회색 fallback 방지)
  if (borderColorStr == null) return;

  // Skip fully transparent borders — matches CSS behavior
  const normalized = borderColorStr.trim().toLowerCase();
  if (
    normalized === "transparent" ||
    normalized === "rgba(0,0,0,0)" ||
    normalized === "rgba(0, 0, 0, 0)" ||
    normalized === "#0000" ||
    normalized === "#00000000"
  ) {
    return;
  }

  // box가 없으면 생성
  if (!specNode.box) {
    specNode.box = {
      fillColor: Float32Array.of(0, 0, 0, 0),
      borderRadius: 0,
    };
  }

  // borderColor
  const borderHex = cssColorToHex(borderColorStr, 0x808080);
  specNode.box.strokeColor = colorIntToFloat32(borderHex, 1);
  specNode.box.strokeWidth = bw;

  // borderStyle
  const borderStyle = style.borderStyle as string | undefined;
  if (borderStyle && borderStyle !== "solid" && borderStyle !== "none") {
    specNode.box.strokeStyle = borderStyle as "dashed" | "dotted";
  }

  // borderRadius (inline override)
  if (style.borderRadius != null) {
    specNode.box.borderRadius = parseCSSSize(
      style.borderRadius as string | number,
    );
  }
}
