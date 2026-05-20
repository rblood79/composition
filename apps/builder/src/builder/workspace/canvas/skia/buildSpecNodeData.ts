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

import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import type { SkiaNodeData } from "./nodeRendererTypes";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";
import {
  getPrimitiveBinding,
  toBreadcrumbRacProps,
  toButtonRacProps,
  toCheckboxGroupRacProps,
  toCheckboxRacProps,
  toColorFieldRacProps,
  toDateFieldRacProps,
  toGridListRacProps,
  toLinkRacProps,
  toListBoxRacProps,
  toMenuRacProps,
  toNumberFieldRacProps,
  toRadioGroupRacProps,
  toRadioRacProps,
  toSearchFieldRacProps,
  toSeparatorRacProps,
  toSliderRacProps,
  toSwitchRacProps,
  toTagGroupRacProps,
  toTextFieldRacProps,
  toTimeFieldRacProps,
  toToggleButtonRacProps,
  type BreadcrumbRacProps,
  type ButtonRacProps,
  type CheckboxGroupRacProps,
  type CheckboxRacProps,
  type ColorFieldRacProps,
  type DateFieldRacProps,
  type GridListEntryDescriptor,
  type GridListItemDescriptor,
  type GridListRacProps,
  type LinkRacProps,
  type ListBoxEntryDescriptor,
  type ListBoxItemDescriptor,
  type ListBoxRacProps,
  type MenuItemDescriptor,
  type MenuRacProps,
  type NumberFieldRacProps,
  type RadioGroupRacProps,
  type RadioRacProps,
  type SearchFieldRacProps,
  type ResolvedNode,
  type SeparatorRacProps,
  type SliderRacProps,
  type SwitchRacProps,
  type TagGroupItemDescriptor,
  type TagGroupRacProps,
  type TextFieldRacProps,
  type TimeFieldRacProps,
  type ToggleButtonRacProps,
} from "@composition/shared";
import {
  fontFamily,
  getIconData,
  normalizeBreadcrumbRspSizeKey,
  parsePxValue,
  type ComponentState,
  type PropagationRule,
} from "@composition/specs";
import { getSpecForTag } from "../sprites/tagSpecMap";
import { specShapesToSkia } from "./specShapeConverter";
import {
  withAccentOverride,
  type TintPreset,
} from "../../../../utils/theme/tintToSkiaColors";
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
  element: CanvasSceneNode;
  layout: ComputedLayout | undefined;
  theme: "light" | "dark";
  /** childrenMap에서 조회한 자식 CanvasSceneNode 목록 */
  childElements?: CanvasSceneNode[];
  /** 부모 체인 조회용 (Phase 8) */
  elementsMap: Map<string, CanvasSceneNode>;
  /** 형제 조회용 — resolveBreadcrumbItemContext, resolveToggleGroupPosition */
  childrenMap?: Map<string, CanvasSceneNode[]>;
}

export interface GenericResolvedSkiaLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GenericResolvedSkiaBuildInput {
  node: ResolvedNode;
  theme: "light" | "dark";
  layout?: GenericResolvedSkiaLayout;
  layoutById?: ReadonlyMap<string, GenericResolvedSkiaLayout>;
}

export interface GenericResolvedSkiaFrameBudget {
  nodeCount: number;
  durationMs: number;
  estimatedFps: number;
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
 * Shell-only 컨테이너: factory가 자식을 자동 생성하며, 자식 CanvasSceneNode가 독립
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
  // 확인된 태그들. factory가 자식 CanvasSceneNode를 자동 생성하며, 자식 수 무관 _hasChildren=true 주입.
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
  // ADR-072 Phase 2-B: factory가 자식 CanvasSceneNode로 시각 콘텐츠 렌더링 대체.
  // Disclosure: DisclosureHeader/Content / Form: Heading/Description/FormField /
  // Popover: Heading/Description (arrow는 RAC OverlayArrow DOM 전용) /
  // Tooltip: Description / ColorPicker: ColorArea/ColorSlider/ColorField (각자 Spec).
  // standalone 실렌더는 레거시 fallback이며 factory 자식이 모두 대체 커버함.
  "Disclosure",
  "Form",
  "Popover",
  "Tooltip",
  "ColorPicker",
  // ADR-902 후속: Body 는 페이지 루트. factory 가 자식 CanvasSceneNode 를 자동 생성하지
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

function getProps(element: CanvasSceneNode): Record<string, unknown> {
  return (element.props ?? {}) as Record<string, unknown>;
}

function resolveParentLabelText(
  element: CanvasSceneNode,
  elementsMap: Map<string, CanvasSceneNode>,
): string | null {
  if (element.type !== "Label" || !element.parent_id) return null;

  const parent = elementsMap.get(element.parent_id);
  if (!parent || !PARENT_LABEL_PROP_SOURCE_TAGS.has(parent.type)) return null;

  const label = getProps(parent).label;
  return typeof label === "string" ? label : null;
}

function propagationPathMatches(
  ancestor: CanvasSceneNode,
  element: CanvasSceneNode,
  childPath: PropagationRule["childPath"],
  elementsMap: Map<string, CanvasSceneNode>,
): boolean {
  const expectedPath = Array.isArray(childPath) ? childPath : [childPath];
  const actualPath = [element.type];
  const visited = new Set<string>([element.id]);
  let parentId = element.parent_id;

  while (parentId) {
    if (visited.has(parentId)) return false;
    visited.add(parentId);
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
  element: CanvasSceneNode,
  elementsMap: Map<string, CanvasSceneNode>,
): CanvasSceneNode[] {
  const ancestors: CanvasSceneNode[] = [];
  const visited = new Set<string>([element.id]);
  let parentId = element.parent_id;
  while (parentId) {
    if (visited.has(parentId)) break;
    visited.add(parentId);
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
  element: CanvasSceneNode,
  props: Record<string, unknown>,
  elementsMap: Map<string, CanvasSceneNode>,
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
  element: CanvasSceneNode,
  elementsMap: Map<string, CanvasSceneNode>,
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
  element: CanvasSceneNode,
  elementsMap: Map<string, CanvasSceneNode>,
  childrenMap?: Map<string, CanvasSceneNode[]>,
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
        const result: CanvasSceneNode[] = [];
        for (const el of elementsMap.values()) {
          if (el.parent_id === parent.id && el.type === "Breadcrumb") {
            result.push(el);
          }
        }
        return result;
      })();
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
  element: CanvasSceneNode,
  elementsMap: Map<string, CanvasSceneNode>,
  childrenMap: Map<string, CanvasSceneNode[]> | null,
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

  const index = siblings.findIndex((s) => s.id === element.id);
  if (index === -1) return { position: null, indicatorMode };

  return {
    position: {
      orientation,
      isFirst: index === 0,
      isLast: index === siblings.length - 1,
      isOnly: siblings.length === 1,
    },
    indicatorMode,
  };
}

/** DateInput parent type/granularity/hourCycle/locale */
function resolveDateInputParent(
  element: CanvasSceneNode,
  elementsMap: Map<string, CanvasSceneNode>,
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
  element: CanvasSceneNode,
  elementsMap: Map<string, CanvasSceneNode>,
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
  element: CanvasSceneNode,
  elementsMap: Map<string, CanvasSceneNode>,
): string | null {
  if (element.type !== "Label" || !element.parent_id) return null;

  // Walk from parent → ancestors looking for Form
  let currentId: string | null | undefined = element.parent_id;
  const visited = new Set<string>([element.id]);
  while (currentId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);
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
  element: CanvasSceneNode,
  elementsMap: Map<string, CanvasSceneNode>,
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
  element: CanvasSceneNode,
  elementsMap: Map<string, CanvasSceneNode>,
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
  element: CanvasSceneNode,
  elementsMap: Map<string, CanvasSceneNode>,
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
  element: CanvasSceneNode,
  elementsMap: Map<string, CanvasSceneNode>,
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
  element: CanvasSceneNode,
  elementsMap: Map<string, CanvasSceneNode>,
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
  element: CanvasSceneNode,
  elementsMap: Map<string, CanvasSceneNode>,
): boolean {
  if (element.type !== "Label" || !element.parent_id) return false;
  const parent = elementsMap.get(element.parent_id);
  if (!parent) return false;
  return NOWRAP_PARENTS.has(parent.type);
}

/** Accent color from element or ancestor chain */
function resolveAccentColor(
  element: CanvasSceneNode,
  elementsMap: Map<string, CanvasSceneNode>,
): TintPreset | undefined {
  const elementAccent = getProps(element).accentColor as TintPreset | undefined;
  if (elementAccent) return elementAccent;

  let pid = element.parent_id;
  const visited = new Set<string>([element.id]);
  while (pid) {
    if (visited.has(pid)) break;
    visited.add(pid);
    const p = elementsMap.get(pid);
    if (!p) break;
    const ac = getProps(p).accentColor as TintPreset | undefined;
    if (ac) return ac;
    pid = p.parent_id;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// ADR-142 Phase 1a generic resolved-tree Skia proof
// ---------------------------------------------------------------------------

export function buildGenericResolvedSkiaNodeData(
  input: GenericResolvedSkiaBuildInput,
): SkiaNodeData | null {
  const layout = resolveGenericLayout(input);
  if (layout.width <= 0 || layout.height <= 0) return null;

  const binding = getPrimitiveBinding(String(input.node.type));
  if (binding?.skiaPrimitive?.kind === "button") {
    return buildGenericButtonNode(input.node, layout, input.theme);
  }
  if (binding?.skiaPrimitive?.kind === "breadcrumb") {
    return buildGenericBreadcrumbNode(input.node, layout, input.theme);
  }
  if (binding?.skiaPrimitive?.kind === "link") {
    return buildGenericLinkNode(input.node, layout, input.theme);
  }
  if (binding?.skiaPrimitive?.kind === "separator") {
    return buildGenericSeparatorNode(input.node, layout, input.theme);
  }
  if (binding?.skiaPrimitive?.kind === "text-field") {
    return buildGenericTextFieldNode(input.node, layout, input.theme);
  }
  if (binding?.skiaPrimitive?.kind === "number-field") {
    return buildGenericNumberFieldNode(input.node, layout, input.theme);
  }
  if (binding?.skiaPrimitive?.kind === "search-field") {
    return buildGenericSearchFieldNode(input.node, layout, input.theme);
  }
  if (binding?.skiaPrimitive?.kind === "date-field") {
    return buildGenericDateFieldNode(input.node, layout, input.theme);
  }
  if (binding?.skiaPrimitive?.kind === "time-field") {
    return buildGenericTimeFieldNode(input.node, layout, input.theme);
  }
  if (binding?.skiaPrimitive?.kind === "color-field") {
    return buildGenericColorFieldNode(input.node, layout, input.theme);
  }
  if (binding?.skiaPrimitive?.kind === "toggle-button") {
    return buildGenericToggleButtonNode(input.node, layout, input.theme);
  }
  if (binding?.skiaPrimitive?.kind === "switch") {
    return buildGenericSwitchNode(input.node, layout, input.theme);
  }
  if (binding?.skiaPrimitive?.kind === "checkbox") {
    return buildGenericCheckboxNode(input.node, layout, input.theme);
  }
  if (binding?.skiaPrimitive?.kind === "checkbox-group") {
    return buildGenericCheckboxGroupNode(input, layout, input.theme);
  }
  if (binding?.skiaPrimitive?.kind === "radio") {
    return buildGenericRadioNode(input.node, layout, input.theme);
  }
  if (binding?.skiaPrimitive?.kind === "radio-group") {
    return buildGenericRadioGroupNode(input, layout, input.theme);
  }
  if (binding?.skiaPrimitive?.kind === "slider") {
    return buildGenericSliderNode(input.node, layout, input.theme);
  }
  if (binding?.skiaPrimitive?.kind === "list-box") {
    return buildGenericListBoxNode(input.node, layout, input.theme);
  }
  if (binding?.skiaPrimitive?.kind === "grid-list") {
    return buildGenericGridListNode(input.node, layout, input.theme);
  }
  if (binding?.skiaPrimitive?.kind === "tag-group") {
    return buildGenericTagGroupNode(input.node, layout, input.theme);
  }
  if (binding?.skiaPrimitive?.kind === "menu") {
    return buildGenericMenuNode(input.node, layout, input.theme);
  }

  const style = readGenericStyle(input.node);
  const children = (input.node.children ?? [])
    .map((child) =>
      buildGenericResolvedSkiaNodeData({
        node: child,
        theme: input.theme,
        layoutById: input.layoutById,
      }),
    )
    .filter((child): child is SkiaNodeData => child !== null);

  return {
    type: "container",
    elementId: input.node.id,
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    visible: isGenericNodeVisible(style),
    box: {
      fillColor: colorIntToFloat32(
        cssColorToHex(
          typeof style.backgroundColor === "string"
            ? style.backgroundColor
            : undefined,
          input.theme === "dark" ? 0x111827 : 0xffffff,
        ),
        style.backgroundColor === "transparent" ? 0 : 1,
      ),
      borderRadius: readNumber(style.borderRadius, 0),
    },
    ...(children.length > 0 ? { children } : {}),
  };
}

export function measureGenericResolvedSkiaFrameBudget(
  input: GenericResolvedSkiaBuildInput,
): GenericResolvedSkiaFrameBudget {
  const startedAt = performance.now();
  const node = buildGenericResolvedSkiaNodeData(input);
  const durationMs = performance.now() - startedAt;
  const effectiveDuration = Math.max(durationMs, 0.001);
  return {
    nodeCount: countSkiaNodeData(node),
    durationMs,
    estimatedFps: 1000 / effectiveDuration,
  };
}

function buildGenericButtonNode(
  node: ResolvedNode,
  layout: GenericResolvedSkiaLayout,
  theme: "light" | "dark",
): SkiaNodeData {
  const props = toButtonRacProps(node.props ?? {}) as ButtonRacProps;
  const palette = resolveGenericButtonPalette(props, theme);
  const size = resolveGenericButtonSize(props.size);
  const style = readGenericStyle(node);
  const textContent = props.children;
  const iconData = props.iconName ? getIconData(props.iconName) : null;
  const iconSize = size.fontSize + 2;
  const iconInset = Math.max(size.gap, 8);
  const iconNode: SkiaNodeData | null = iconData
    ? {
        type: "icon_path",
        elementId: `${node.id}:icon`,
        x:
          props.iconPosition === "end"
            ? Math.max(layout.width - iconInset - iconSize, 0)
            : iconInset,
        y: Math.max((layout.height - iconSize) / 2, 0),
        width: iconSize,
        height: iconSize,
        visible: true,
        iconPath: {
          paths: iconData.paths,
          circles: iconData.circles,
          cx: iconSize / 2,
          cy: iconSize / 2,
          size: iconSize,
          strokeColor: palette.textColor,
          strokeWidth: props.iconStrokeWidth,
        },
      }
    : null;
  const textNode: SkiaNodeData = {
    type: "text",
    elementId: `${node.id}:text`,
    x: 0,
    y: 0,
    width: layout.width,
    height: layout.height,
    visible: true,
    text: {
      content: textContent,
      fontFamilies: [fontFamily.sans],
      fontSize: size.fontSize,
      fontWeight: 500,
      color: palette.textColor,
      align: "center",
      lineHeight: size.lineHeight,
      paddingLeft: 0,
      paddingTop: 0,
      maxWidth: layout.width,
      autoCenter: true,
    },
  };
  const children =
    iconNode && props.iconPosition !== "end"
      ? [iconNode, textNode]
      : iconNode
        ? [textNode, iconNode]
        : [textNode];

  return {
    type: "container",
    elementId: node.id,
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    visible: isGenericNodeVisible(style),
    box: {
      fillColor: palette.fillColor,
      borderRadius: readNumber(style.borderRadius, size.radius),
      strokeColor: palette.strokeColor,
      strokeWidth: palette.strokeWidth,
    },
    children,
  };
}

function buildGenericBreadcrumbNode(
  node: ResolvedNode,
  layout: GenericResolvedSkiaLayout,
  theme: "light" | "dark",
): SkiaNodeData {
  const props = toBreadcrumbRacProps(node.props ?? {}) as BreadcrumbRacProps;
  const style = readGenericStyle(node);
  const size = resolveGenericBreadcrumbSize(
    typeof node.props?.size === "string" ? node.props.size : "M",
  );
  const textColor =
    typeof style.color === "string"
      ? colorIntToFloat32(cssColorToHex(style.color), 1)
      : colorIntToFloat32(
          cssColorToHex(theme === "dark" ? "#d1d5db" : "#4b5563"),
          1,
        );

  return {
    type: "text",
    elementId: node.id,
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    visible: isGenericNodeVisible(style),
    text: {
      content: props.children,
      fontFamilies: [fontFamily.sans],
      fontSize: readNumber(style.fontSize, size.fontSize),
      fontWeight: 500,
      color: textColor,
      align: "left",
      lineHeight: size.lineHeight,
      paddingLeft: 0,
      paddingTop: 0,
      maxWidth: layout.width,
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
    },
  };
}

function buildGenericSeparatorNode(
  node: ResolvedNode,
  layout: GenericResolvedSkiaLayout,
  theme: "light" | "dark",
): SkiaNodeData {
  const props = toSeparatorRacProps(node.props ?? {}) as SeparatorRacProps;
  const style = readGenericStyle(node);
  const strokeWidth = readNumber(
    style.borderWidth,
    resolveGenericSeparatorStrokeWidth(props.size),
  );
  const strokeColor = colorIntToFloat32(
    cssColorToHex(
      typeof style.borderColor === "string" ? style.borderColor : undefined,
      theme === "dark" ? 0x4b5563 : 0xd1d5db,
    ),
    1,
  );
  const isVertical = props.orientation === "vertical";
  const halfStroke = strokeWidth / 2;

  return {
    type: "line",
    elementId: node.id,
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    visible: isGenericNodeVisible(style),
    line: {
      x1: isVertical ? layout.width / 2 : 0,
      y1: isVertical ? 0 : halfStroke,
      x2: isVertical ? layout.width / 2 : layout.width,
      y2: isVertical ? layout.height : halfStroke,
      strokeColor,
      strokeWidth,
      ...(resolveGenericSeparatorDasharray(props.variant)
        ? { strokeDasharray: resolveGenericSeparatorDasharray(props.variant) }
        : {}),
    },
  };
}

function buildGenericLinkNode(
  node: ResolvedNode,
  layout: GenericResolvedSkiaLayout,
  theme: "light" | "dark",
): SkiaNodeData {
  const props = toLinkRacProps(node.props ?? {}) as LinkRacProps;
  const style = readGenericStyle(node);
  const size = resolveGenericLinkSize(props.size);
  const textColor = resolveGenericLinkTextColor(props, style, theme);

  return {
    type: "text",
    elementId: node.id,
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    visible: isGenericNodeVisible(style),
    text: {
      content: props.children,
      fontFamilies: [fontFamily.sans],
      fontSize: readNumber(style.fontSize, size.fontSize),
      fontWeight: 500,
      color: textColor,
      align: "left",
      lineHeight: size.lineHeight,
      paddingLeft: 0,
      paddingTop: 0,
      maxWidth: layout.width,
      decoration: 1,
      decorationColor: textColor,
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
    },
  };
}

function buildGenericTextFieldNode(
  node: ResolvedNode,
  layout: GenericResolvedSkiaLayout,
  theme: "light" | "dark",
): SkiaNodeData {
  const props = toTextFieldRacProps(node.props ?? {}) as TextFieldRacProps;
  const style = readGenericStyle(node);
  const size = resolveGenericTextFieldSize(props.size);
  const isDark = theme === "dark";
  const labelColor = colorIntToFloat32(
    cssColorToHex(isDark ? "#e5e7eb" : "#374151"),
    1,
  );
  const inputTextColor = colorIntToFloat32(
    cssColorToHex(isDark ? "#f9fafb" : "#111827"),
    1,
  );
  const strokeColor = colorIntToFloat32(
    cssColorToHex(props.isInvalid ? "#dc2626" : isDark ? "#6b7280" : "#d1d5db"),
    1,
  );
  const inputY = props.label ? size.labelHeight + size.gap : 0;
  const inputHeight = Math.max(layout.height - inputY, size.inputHeight);
  const valueText = props.value ?? props.defaultValue ?? props.placeholder;
  const children: SkiaNodeData[] = [];

  if (props.label) {
    children.push({
      type: "text",
      elementId: `${node.id}:label`,
      x: 0,
      y: 0,
      width: layout.width,
      height: size.labelHeight,
      visible: true,
      text: {
        content: props.label,
        fontFamilies: [fontFamily.sans],
        fontSize: size.labelFontSize,
        fontWeight: 500,
        color: labelColor,
        align: "left",
        lineHeight: size.labelLineHeight,
        paddingLeft: 0,
        paddingTop: 0,
        maxWidth: layout.width,
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
      },
    });
  }

  children.push({
    type: "container",
    elementId: `${node.id}:input`,
    x: 0,
    y: inputY,
    width: layout.width,
    height: inputHeight,
    visible: true,
    box: {
      fillColor: colorIntToFloat32(
        cssColorToHex(isDark ? "#111827" : "#ffffff"),
        props.isQuiet ? 0 : 1,
      ),
      borderRadius: readNumber(style.borderRadius, 6),
      strokeColor,
      strokeWidth: props.isQuiet ? 0 : 1,
    },
    children: [
      {
        type: "text",
        elementId: `${node.id}:value`,
        x: 0,
        y: 0,
        width: layout.width,
        height: inputHeight,
        visible: true,
        text: {
          content: valueText,
          fontFamilies: [fontFamily.sans],
          fontSize: size.inputFontSize,
          color:
            props.value || props.defaultValue ? inputTextColor : labelColor,
          align: "left",
          lineHeight: size.inputLineHeight,
          paddingLeft: size.paddingX,
          paddingTop: 0,
          maxWidth: Math.max(layout.width - size.paddingX * 2, 0),
          verticalAlign: "middle",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        },
      },
    ],
  });

  return {
    type: "container",
    elementId: node.id,
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    visible: isGenericNodeVisible(style),
    box: {
      fillColor: colorIntToFloat32(
        cssColorToHex(
          typeof style.backgroundColor === "string"
            ? style.backgroundColor
            : "transparent",
        ),
        0,
      ),
      borderRadius: readNumber(style.borderRadius, 0),
    },
    children,
  };
}

function buildGenericNumberFieldNode(
  node: ResolvedNode,
  layout: GenericResolvedSkiaLayout,
  theme: "light" | "dark",
): SkiaNodeData {
  const props = toNumberFieldRacProps(node.props ?? {}) as NumberFieldRacProps;
  const style = readGenericStyle(node);
  const size = resolveGenericTextFieldSize(props.size);
  const isDark = theme === "dark";
  const labelColor = colorIntToFloat32(
    cssColorToHex(isDark ? "#e5e7eb" : "#374151"),
    1,
  );
  const inputTextColor = colorIntToFloat32(
    cssColorToHex(isDark ? "#f9fafb" : "#111827"),
    1,
  );
  const strokeColor = colorIntToFloat32(
    cssColorToHex(props.isInvalid ? "#dc2626" : isDark ? "#6b7280" : "#d1d5db"),
    1,
  );
  const inputY = props.label ? size.labelHeight + size.gap : 0;
  const inputHeight = Math.max(layout.height - inputY, size.inputHeight);
  const valueText =
    props.value !== undefined
      ? String(props.value)
      : props.defaultValue !== undefined
        ? String(props.defaultValue)
        : props.placeholder;
  const children: SkiaNodeData[] = [];

  if (props.label) {
    children.push({
      type: "text",
      elementId: `${node.id}:label`,
      x: 0,
      y: 0,
      width: layout.width,
      height: size.labelHeight,
      visible: true,
      text: {
        content: props.label,
        fontFamilies: [fontFamily.sans],
        fontSize: size.labelFontSize,
        fontWeight: 500,
        color: labelColor,
        align: "left",
        lineHeight: size.labelLineHeight,
        paddingLeft: 0,
        paddingTop: 0,
        maxWidth: layout.width,
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
      },
    });
  }

  children.push({
    type: "container",
    elementId: `${node.id}:input`,
    x: 0,
    y: inputY,
    width: layout.width,
    height: inputHeight,
    visible: true,
    box: {
      fillColor: colorIntToFloat32(
        cssColorToHex(isDark ? "#111827" : "#ffffff"),
        props.isQuiet ? 0 : 1,
      ),
      borderRadius: readNumber(style.borderRadius, 6),
      strokeColor,
      strokeWidth: props.isQuiet ? 0 : 1,
    },
    children: [
      {
        type: "text",
        elementId: `${node.id}:value`,
        x: 0,
        y: 0,
        width: layout.width,
        height: inputHeight,
        visible: true,
        text: {
          content: valueText,
          fontFamilies: [fontFamily.sans],
          fontSize: size.inputFontSize,
          color:
            props.value !== undefined || props.defaultValue !== undefined
              ? inputTextColor
              : labelColor,
          align: "left",
          lineHeight: size.inputLineHeight,
          paddingLeft: size.paddingX,
          paddingTop: 0,
          maxWidth: Math.max(layout.width - size.paddingX * 2, 0),
          verticalAlign: "middle",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        },
      },
    ],
  });

  return {
    type: "container",
    elementId: node.id,
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    visible: isGenericNodeVisible(style),
    box: {
      fillColor: colorIntToFloat32(
        cssColorToHex(
          typeof style.backgroundColor === "string"
            ? style.backgroundColor
            : "transparent",
        ),
        0,
      ),
      borderRadius: readNumber(style.borderRadius, 0),
    },
    children,
  };
}

function buildGenericSearchFieldNode(
  node: ResolvedNode,
  layout: GenericResolvedSkiaLayout,
  theme: "light" | "dark",
): SkiaNodeData {
  const props = toSearchFieldRacProps(node.props ?? {}) as SearchFieldRacProps;
  const style = readGenericStyle(node);
  const size = resolveGenericTextFieldSize(props.size);
  const isDark = theme === "dark";
  const labelColor = colorIntToFloat32(
    cssColorToHex(isDark ? "#e5e7eb" : "#374151"),
    1,
  );
  const inputTextColor = colorIntToFloat32(
    cssColorToHex(isDark ? "#f9fafb" : "#111827"),
    1,
  );
  const strokeColor = colorIntToFloat32(
    cssColorToHex(props.isInvalid ? "#dc2626" : isDark ? "#6b7280" : "#d1d5db"),
    1,
  );
  const iconColor = colorIntToFloat32(
    cssColorToHex(isDark ? "#9ca3af" : "#6b7280"),
    1,
  );
  const inputY = props.label ? size.labelHeight + size.gap : 0;
  const inputHeight = Math.max(layout.height - inputY, size.inputHeight);
  const valueText = props.value ?? props.defaultValue ?? props.placeholder;
  const iconSize = Math.max(size.inputFontSize, 14);
  const children: SkiaNodeData[] = [];
  const searchIcon = getIconData("search");

  if (props.label) {
    children.push({
      type: "text",
      elementId: `${node.id}:label`,
      x: 0,
      y: 0,
      width: layout.width,
      height: size.labelHeight,
      visible: true,
      text: {
        content: props.label,
        fontFamilies: [fontFamily.sans],
        fontSize: size.labelFontSize,
        fontWeight: 500,
        color: labelColor,
        align: "left",
        lineHeight: size.labelLineHeight,
        paddingLeft: 0,
        paddingTop: 0,
        maxWidth: layout.width,
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
      },
    });
  }

  children.push({
    type: "container",
    elementId: `${node.id}:input`,
    x: 0,
    y: inputY,
    width: layout.width,
    height: inputHeight,
    visible: true,
    box: {
      fillColor: colorIntToFloat32(
        cssColorToHex(isDark ? "#111827" : "#ffffff"),
        props.isQuiet ? 0 : 1,
      ),
      borderRadius: readNumber(style.borderRadius, 6),
      strokeColor,
      strokeWidth: props.isQuiet ? 0 : 1,
    },
    children: [
      ...(searchIcon
        ? [
            {
              type: "icon_path" as const,
              elementId: `${node.id}:search-icon`,
              x: size.paddingX,
              y: Math.max((inputHeight - iconSize) / 2, 0),
              width: iconSize,
              height: iconSize,
              visible: true,
              iconPath: {
                paths: searchIcon.paths,
                circles: searchIcon.circles,
                cx: iconSize / 2,
                cy: iconSize / 2,
                size: iconSize,
                strokeColor: iconColor,
                strokeWidth: 2,
              },
            },
          ]
        : []),
      {
        type: "text",
        elementId: `${node.id}:value`,
        x: 0,
        y: 0,
        width: layout.width,
        height: inputHeight,
        visible: true,
        text: {
          content: valueText,
          fontFamilies: [fontFamily.sans],
          fontSize: size.inputFontSize,
          color:
            props.value || props.defaultValue ? inputTextColor : labelColor,
          align: "left",
          lineHeight: size.inputLineHeight,
          paddingLeft: size.paddingX + iconSize + size.gap,
          paddingTop: 0,
          maxWidth: Math.max(
            layout.width - (size.paddingX * 2 + iconSize + size.gap),
            0,
          ),
          verticalAlign: "middle",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        },
      },
    ],
  });

  return {
    type: "container",
    elementId: node.id,
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    visible: isGenericNodeVisible(style),
    box: {
      fillColor: colorIntToFloat32(
        cssColorToHex(
          typeof style.backgroundColor === "string"
            ? style.backgroundColor
            : "transparent",
        ),
        0,
      ),
      borderRadius: readNumber(style.borderRadius, 0),
    },
    children,
  };
}

function buildGenericDateFieldNode(
  node: ResolvedNode,
  layout: GenericResolvedSkiaLayout,
  theme: "light" | "dark",
): SkiaNodeData {
  const props = toDateFieldRacProps(node.props ?? {}) as DateFieldRacProps;
  const style = readGenericStyle(node);
  const size = resolveGenericTextFieldSize(props.size);
  const isDark = theme === "dark";
  const labelColor = colorIntToFloat32(
    cssColorToHex(isDark ? "#e5e7eb" : "#374151"),
    1,
  );
  const inputTextColor = colorIntToFloat32(
    cssColorToHex(isDark ? "#f9fafb" : "#111827"),
    1,
  );
  const strokeColor = colorIntToFloat32(
    cssColorToHex(props.isInvalid ? "#dc2626" : isDark ? "#6b7280" : "#d1d5db"),
    1,
  );
  const inputY = props.label ? size.labelHeight + size.gap : 0;
  const inputHeight = Math.max(layout.height - inputY, size.inputHeight);
  const valueText = props.value ?? props.defaultValue ?? props.placeholderValue;
  const children: SkiaNodeData[] = [];

  if (props.label) {
    children.push({
      type: "text",
      elementId: `${node.id}:label`,
      x: 0,
      y: 0,
      width: layout.width,
      height: size.labelHeight,
      visible: true,
      text: {
        content: props.label,
        fontFamilies: [fontFamily.sans],
        fontSize: size.labelFontSize,
        fontWeight: 500,
        color: labelColor,
        align: "left",
        lineHeight: size.labelLineHeight,
        paddingLeft: 0,
        paddingTop: 0,
        maxWidth: layout.width,
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
      },
    });
  }

  children.push({
    type: "container",
    elementId: `${node.id}:input`,
    x: 0,
    y: inputY,
    width: layout.width,
    height: inputHeight,
    visible: true,
    box: {
      fillColor: colorIntToFloat32(
        cssColorToHex(isDark ? "#111827" : "#ffffff"),
        props.isQuiet ? 0 : 1,
      ),
      borderRadius: readNumber(style.borderRadius, 6),
      strokeColor,
      strokeWidth: props.isQuiet ? 0 : 1,
    },
    children: [
      {
        type: "text",
        elementId: `${node.id}:value`,
        x: 0,
        y: 0,
        width: layout.width,
        height: inputHeight,
        visible: true,
        text: {
          content: valueText,
          fontFamilies: [fontFamily.sans],
          fontSize: size.inputFontSize,
          color:
            props.value || props.defaultValue ? inputTextColor : labelColor,
          align: "left",
          lineHeight: size.inputLineHeight,
          paddingLeft: size.paddingX,
          paddingTop: 0,
          maxWidth: Math.max(layout.width - size.paddingX * 2, 0),
          verticalAlign: "middle",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        },
      },
    ],
  });

  return {
    type: "container",
    elementId: node.id,
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    visible: isGenericNodeVisible(style),
    box: {
      fillColor: colorIntToFloat32(
        cssColorToHex(
          typeof style.backgroundColor === "string"
            ? style.backgroundColor
            : "transparent",
        ),
        0,
      ),
      borderRadius: readNumber(style.borderRadius, 0),
    },
    children,
  };
}

function buildGenericTimeFieldNode(
  node: ResolvedNode,
  layout: GenericResolvedSkiaLayout,
  theme: "light" | "dark",
): SkiaNodeData {
  const props = toTimeFieldRacProps(node.props ?? {}) as TimeFieldRacProps;
  const style = readGenericStyle(node);
  const size = resolveGenericTextFieldSize(props.size);
  const isDark = theme === "dark";
  const labelColor = colorIntToFloat32(
    cssColorToHex(isDark ? "#e5e7eb" : "#374151"),
    1,
  );
  const inputTextColor = colorIntToFloat32(
    cssColorToHex(isDark ? "#f9fafb" : "#111827"),
    1,
  );
  const strokeColor = colorIntToFloat32(
    cssColorToHex(props.isInvalid ? "#dc2626" : isDark ? "#6b7280" : "#d1d5db"),
    1,
  );
  const inputY = props.label ? size.labelHeight + size.gap : 0;
  const inputHeight = Math.max(layout.height - inputY, size.inputHeight);
  const valueText = props.value ?? props.defaultValue ?? props.placeholderValue;
  const children: SkiaNodeData[] = [];

  if (props.label) {
    children.push({
      type: "text",
      elementId: `${node.id}:label`,
      x: 0,
      y: 0,
      width: layout.width,
      height: size.labelHeight,
      visible: true,
      text: {
        content: props.label,
        fontFamilies: [fontFamily.sans],
        fontSize: size.labelFontSize,
        fontWeight: 500,
        color: labelColor,
        align: "left",
        lineHeight: size.labelLineHeight,
        paddingLeft: 0,
        paddingTop: 0,
        maxWidth: layout.width,
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
      },
    });
  }

  children.push({
    type: "container",
    elementId: `${node.id}:input`,
    x: 0,
    y: inputY,
    width: layout.width,
    height: inputHeight,
    visible: true,
    box: {
      fillColor: colorIntToFloat32(
        cssColorToHex(isDark ? "#111827" : "#ffffff"),
        props.isQuiet ? 0 : 1,
      ),
      borderRadius: readNumber(style.borderRadius, 6),
      strokeColor,
      strokeWidth: props.isQuiet ? 0 : 1,
    },
    children: [
      {
        type: "text",
        elementId: `${node.id}:value`,
        x: 0,
        y: 0,
        width: layout.width,
        height: inputHeight,
        visible: true,
        text: {
          content: valueText,
          fontFamilies: [fontFamily.sans],
          fontSize: size.inputFontSize,
          color:
            props.value || props.defaultValue ? inputTextColor : labelColor,
          align: "left",
          lineHeight: size.inputLineHeight,
          paddingLeft: size.paddingX,
          paddingTop: 0,
          maxWidth: Math.max(layout.width - size.paddingX * 2, 0),
          verticalAlign: "middle",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        },
      },
    ],
  });

  return {
    type: "container",
    elementId: node.id,
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    visible: isGenericNodeVisible(style),
    box: {
      fillColor: colorIntToFloat32(
        cssColorToHex(
          typeof style.backgroundColor === "string"
            ? style.backgroundColor
            : "transparent",
        ),
        0,
      ),
      borderRadius: readNumber(style.borderRadius, 0),
    },
    children,
  };
}

function buildGenericColorFieldNode(
  node: ResolvedNode,
  layout: GenericResolvedSkiaLayout,
  theme: "light" | "dark",
): SkiaNodeData {
  const props = toColorFieldRacProps(node.props ?? {}) as ColorFieldRacProps;
  const style = readGenericStyle(node);
  const size = resolveGenericTextFieldSize(props.size);
  const isDark = theme === "dark";
  const labelColor = colorIntToFloat32(
    cssColorToHex(isDark ? "#e5e7eb" : "#374151"),
    1,
  );
  const inputTextColor = colorIntToFloat32(
    cssColorToHex(isDark ? "#f9fafb" : "#111827"),
    1,
  );
  const strokeColor = colorIntToFloat32(
    cssColorToHex(props.isInvalid ? "#dc2626" : isDark ? "#6b7280" : "#d1d5db"),
    1,
  );
  const inputY = props.label ? size.labelHeight + size.gap : 0;
  const inputHeight = Math.max(layout.height - inputY, size.inputHeight);
  const valueText = props.value ?? props.defaultValue ?? props.placeholder;
  const swatchSize = Math.max(size.inputFontSize + 4, 18);
  const children: SkiaNodeData[] = [];

  if (props.label) {
    children.push({
      type: "text",
      elementId: `${node.id}:label`,
      x: 0,
      y: 0,
      width: layout.width,
      height: size.labelHeight,
      visible: true,
      text: {
        content: props.label,
        fontFamilies: [fontFamily.sans],
        fontSize: size.labelFontSize,
        fontWeight: 500,
        color: labelColor,
        align: "left",
        lineHeight: size.labelLineHeight,
        paddingLeft: 0,
        paddingTop: 0,
        maxWidth: layout.width,
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
      },
    });
  }

  children.push({
    type: "container",
    elementId: `${node.id}:input`,
    x: 0,
    y: inputY,
    width: layout.width,
    height: inputHeight,
    visible: true,
    box: {
      fillColor: colorIntToFloat32(
        cssColorToHex(isDark ? "#111827" : "#ffffff"),
        props.isQuiet ? 0 : 1,
      ),
      borderRadius: readNumber(style.borderRadius, 6),
      strokeColor,
      strokeWidth: props.isQuiet ? 0 : 1,
    },
    children: [
      {
        type: "box",
        elementId: `${node.id}:swatch`,
        x: size.paddingX,
        y: Math.max((inputHeight - swatchSize) / 2, 0),
        width: swatchSize,
        height: swatchSize,
        visible: true,
        box: {
          fillColor: colorIntToFloat32(cssColorToHex(valueText, 0x000000), 1),
          borderRadius: 4,
          strokeColor,
          strokeWidth: 1,
        },
      },
      {
        type: "text",
        elementId: `${node.id}:value`,
        x: 0,
        y: 0,
        width: layout.width,
        height: inputHeight,
        visible: true,
        text: {
          content: valueText,
          fontFamilies: [fontFamily.sans],
          fontSize: size.inputFontSize,
          color:
            props.value || props.defaultValue ? inputTextColor : labelColor,
          align: "left",
          lineHeight: size.inputLineHeight,
          paddingLeft: size.paddingX + swatchSize + size.gap,
          paddingTop: 0,
          maxWidth: Math.max(
            layout.width - (size.paddingX * 2 + swatchSize + size.gap),
            0,
          ),
          verticalAlign: "middle",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        },
      },
    ],
  });

  return {
    type: "container",
    elementId: node.id,
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    visible: isGenericNodeVisible(style),
    box: {
      fillColor: colorIntToFloat32(
        cssColorToHex(
          typeof style.backgroundColor === "string"
            ? style.backgroundColor
            : "transparent",
        ),
        0,
      ),
      borderRadius: readNumber(style.borderRadius, 0),
    },
    children,
  };
}

function buildGenericToggleButtonNode(
  node: ResolvedNode,
  layout: GenericResolvedSkiaLayout,
  theme: "light" | "dark",
): SkiaNodeData {
  const props = toToggleButtonRacProps(
    node.props ?? {},
  ) as ToggleButtonRacProps;
  const palette = resolveGenericToggleButtonPalette(props, theme);
  const size = resolveGenericToggleButtonSize(props.size);
  const style = readGenericStyle(node);
  const textNode: SkiaNodeData = {
    type: "text",
    elementId: `${node.id}:text`,
    x: 0,
    y: 0,
    width: layout.width,
    height: layout.height,
    visible: true,
    text: {
      content: props.children,
      fontFamilies: [fontFamily.sans],
      fontSize: size.fontSize,
      fontWeight: 500,
      color: palette.textColor,
      align: "center",
      lineHeight: size.lineHeight,
      paddingLeft: 0,
      paddingTop: 0,
      maxWidth: layout.width,
      autoCenter: true,
    },
  };

  return {
    type: "container",
    elementId: node.id,
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    visible: isGenericNodeVisible(style),
    box: {
      fillColor: palette.fillColor,
      borderRadius: readNumber(style.borderRadius, size.radius),
      strokeColor: palette.strokeColor,
      strokeWidth: palette.strokeWidth,
    },
    children: [textNode],
  };
}

function buildGenericSwitchNode(
  node: ResolvedNode,
  layout: GenericResolvedSkiaLayout,
  theme: "light" | "dark",
): SkiaNodeData {
  const props = toSwitchRacProps(node.props ?? {}) as SwitchRacProps;
  const size = resolveGenericSwitchSize(props.size);
  const palette = resolveGenericSwitchPalette(props, theme);
  const style = readGenericStyle(node);
  const trackY = Math.max((layout.height - size.trackHeight) / 2, 0);
  const thumbX = props.isSelected
    ? size.trackWidth - size.thumbSize - size.thumbOffset
    : size.thumbOffset;
  const thumbY = trackY + Math.max((size.trackHeight - size.thumbSize) / 2, 0);
  const labelX = size.trackWidth + size.gap;
  const labelWidth = Math.max(layout.width - labelX, 0);

  const trackNode: SkiaNodeData = {
    type: "box",
    elementId: `${node.id}:track`,
    x: 0,
    y: trackY,
    width: size.trackWidth,
    height: size.trackHeight,
    visible: true,
    box: {
      fillColor: palette.trackColor,
      borderRadius: size.trackHeight / 2,
      strokeColor: palette.trackStrokeColor,
      strokeWidth: palette.trackStrokeWidth,
    },
  };

  const thumbNode: SkiaNodeData = {
    type: "box",
    elementId: `${node.id}:thumb`,
    x: thumbX,
    y: thumbY,
    width: size.thumbSize,
    height: size.thumbSize,
    visible: true,
    box: {
      fillColor: palette.thumbColor,
      borderRadius: size.thumbSize / 2,
    },
  };

  const textNode: SkiaNodeData = {
    type: "text",
    elementId: `${node.id}:text`,
    x: labelX,
    y: 0,
    width: labelWidth,
    height: layout.height,
    visible: labelWidth > 0,
    text: {
      content: props.children,
      fontFamilies: [fontFamily.sans],
      fontSize: size.fontSize,
      fontWeight: 400,
      color: palette.textColor,
      align: "left",
      lineHeight: size.lineHeight,
      paddingLeft: 0,
      paddingTop: 0,
      maxWidth: labelWidth,
      verticalAlign: "middle",
    },
  };

  return {
    type: "container",
    elementId: node.id,
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    visible: isGenericNodeVisible(style),
    children: [trackNode, thumbNode, textNode],
  };
}

function buildGenericCheckboxNode(
  node: ResolvedNode,
  layout: GenericResolvedSkiaLayout,
  theme: "light" | "dark",
): SkiaNodeData {
  const props = toCheckboxRacProps(node.props ?? {}) as CheckboxRacProps;
  const size = resolveGenericCheckboxSize(props.size);
  const palette = resolveGenericCheckboxPalette(props, theme);
  const style = readGenericStyle(node);
  const boxY = Math.max((layout.height - size.boxSize) / 2, 0);
  const labelX = size.boxSize + size.gap;
  const labelWidth = Math.max(layout.width - labelX, 0);

  const boxNode: SkiaNodeData = {
    type: "box",
    elementId: `${node.id}:box`,
    x: 0,
    y: boxY,
    width: size.boxSize,
    height: size.boxSize,
    visible: true,
    box: {
      fillColor: palette.boxFillColor,
      borderRadius: size.radius,
      strokeColor: palette.boxStrokeColor,
      strokeWidth: palette.boxStrokeWidth,
    },
  };

  const indicatorNode: SkiaNodeData = {
    type: "text",
    elementId: `${node.id}:indicator`,
    x: 0,
    y: boxY,
    width: size.boxSize,
    height: size.boxSize,
    visible: props.isSelected === true || props.isIndeterminate === true,
    text: {
      content: props.isIndeterminate ? "-" : "✓",
      fontFamilies: [fontFamily.sans],
      fontSize: size.indicatorFontSize,
      fontWeight: 700,
      color: palette.indicatorColor,
      align: "center",
      lineHeight: size.boxSize,
      paddingLeft: 0,
      paddingTop: 0,
      maxWidth: size.boxSize,
      verticalAlign: "middle",
    },
  };

  const textNode: SkiaNodeData = {
    type: "text",
    elementId: `${node.id}:text`,
    x: labelX,
    y: 0,
    width: labelWidth,
    height: layout.height,
    visible: labelWidth > 0,
    text: {
      content: props.children,
      fontFamilies: [fontFamily.sans],
      fontSize: size.fontSize,
      fontWeight: 400,
      color: palette.textColor,
      align: "left",
      lineHeight: size.lineHeight,
      paddingLeft: 0,
      paddingTop: 0,
      maxWidth: labelWidth,
      verticalAlign: "middle",
    },
  };

  return {
    type: "container",
    elementId: node.id,
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    visible: isGenericNodeVisible(style),
    children: [boxNode, indicatorNode, textNode],
  };
}

function buildGenericCheckboxGroupNode(
  input: GenericResolvedSkiaBuildInput,
  layout: GenericResolvedSkiaLayout,
  theme: "light" | "dark",
): SkiaNodeData {
  const props = toCheckboxGroupRacProps(
    input.node.props ?? {},
  ) as CheckboxGroupRacProps;
  const size = resolveGenericCheckboxSize(props.size);
  const style = readGenericStyle(input.node);
  const isDark = theme === "dark";
  const labelNode: SkiaNodeData = {
    type: "text",
    elementId: `${input.node.id}:label`,
    x: 0,
    y: 0,
    width: layout.width,
    height: size.lineHeight,
    visible: props.label.length > 0,
    text: {
      content: props.label,
      fontFamilies: [fontFamily.sans],
      fontSize: size.fontSize,
      fontWeight: 500,
      color: colorIntToFloat32(isDark ? 0xf9fafb : 0x111827, 1),
      align: props.labelAlign === "end" ? "right" : "left",
      lineHeight: size.lineHeight,
      paddingLeft: 0,
      paddingTop: 0,
      maxWidth: layout.width,
    },
  };
  const renderedChildren = (input.node.children ?? [])
    .map((child) =>
      buildGenericResolvedSkiaNodeData({
        node: child,
        theme,
        layoutById: input.layoutById,
      }),
    )
    .filter((child): child is SkiaNodeData => child !== null);

  return {
    type: "container",
    elementId: input.node.id,
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    visible: isGenericNodeVisible(style),
    children: [labelNode, ...renderedChildren],
  };
}

function buildGenericRadioNode(
  node: ResolvedNode,
  layout: GenericResolvedSkiaLayout,
  theme: "light" | "dark",
): SkiaNodeData {
  const props = toRadioRacProps(node.props ?? {}) as RadioRacProps;
  const size = resolveGenericRadioSize(props.size);
  const palette = resolveGenericRadioPalette(props, theme);
  const style = readGenericStyle(node);
  const boxY = Math.max((layout.height - size.boxSize) / 2, 0);
  const labelX = size.boxSize + size.gap;
  const labelWidth = Math.max(layout.width - labelX, 0);

  const ringNode: SkiaNodeData = {
    type: "box",
    elementId: `${node.id}:ring`,
    x: 0,
    y: boxY,
    width: size.boxSize,
    height: size.boxSize,
    visible: true,
    box: {
      fillColor: palette.ringFillColor,
      borderRadius: size.boxSize / 2,
      strokeColor: palette.ringStrokeColor,
      strokeWidth: palette.ringStrokeWidth,
    },
  };

  const dotOffset = (size.boxSize - size.dotSize) / 2;
  const dotNode: SkiaNodeData = {
    type: "box",
    elementId: `${node.id}:dot`,
    x: dotOffset,
    y: boxY + dotOffset,
    width: size.dotSize,
    height: size.dotSize,
    visible: props.isSelected === true,
    box: {
      fillColor: palette.dotColor,
      borderRadius: size.dotSize / 2,
    },
  };

  const textNode: SkiaNodeData = {
    type: "text",
    elementId: `${node.id}:text`,
    x: labelX,
    y: 0,
    width: labelWidth,
    height: layout.height,
    visible: labelWidth > 0,
    text: {
      content: props.children,
      fontFamilies: [fontFamily.sans],
      fontSize: size.fontSize,
      fontWeight: 400,
      color: palette.textColor,
      align: "left",
      lineHeight: size.lineHeight,
      paddingLeft: 0,
      paddingTop: 0,
      maxWidth: labelWidth,
      verticalAlign: "middle",
    },
  };

  return {
    type: "container",
    elementId: node.id,
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    visible: isGenericNodeVisible(style),
    children: [ringNode, dotNode, textNode],
  };
}

function buildGenericRadioGroupNode(
  input: GenericResolvedSkiaBuildInput,
  layout: GenericResolvedSkiaLayout,
  theme: "light" | "dark",
): SkiaNodeData {
  const props = toRadioGroupRacProps(
    input.node.props ?? {},
  ) as RadioGroupRacProps;
  const size = resolveGenericRadioSize(props.size);
  const style = readGenericStyle(input.node);
  const isDark = theme === "dark";
  const labelNode: SkiaNodeData = {
    type: "text",
    elementId: `${input.node.id}:label`,
    x: 0,
    y: 0,
    width: layout.width,
    height: size.lineHeight,
    visible: props.label.length > 0,
    text: {
      content: props.label,
      fontFamilies: [fontFamily.sans],
      fontSize: size.fontSize,
      fontWeight: 500,
      color: colorIntToFloat32(isDark ? 0xf9fafb : 0x111827, 1),
      align: props.labelAlign === "end" ? "right" : "left",
      lineHeight: size.lineHeight,
      paddingLeft: 0,
      paddingTop: 0,
      maxWidth: layout.width,
    },
  };
  const renderedChildren = (input.node.children ?? [])
    .map((child) =>
      buildGenericResolvedSkiaNodeData({
        node: child,
        theme,
        layoutById: input.layoutById,
      }),
    )
    .filter((child): child is SkiaNodeData => child !== null);

  return {
    type: "container",
    elementId: input.node.id,
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    visible: isGenericNodeVisible(style),
    children: [labelNode, ...renderedChildren],
  };
}

function buildGenericSliderNode(
  node: ResolvedNode,
  layout: GenericResolvedSkiaLayout,
  theme: "light" | "dark",
): SkiaNodeData {
  const props = toSliderRacProps(node.props ?? {}) as SliderRacProps;
  const size = resolveGenericSliderSize(props.size);
  const palette = resolveGenericSliderPalette(props, theme);
  const style = readGenericStyle(node);
  const value = firstSliderValue(props.value ?? props.defaultValue) ?? 0;
  const minValue = props.minValue;
  const maxValue = props.maxValue;
  const percent = normalizeSliderPercent(value, minValue, maxValue);
  const labelHeight = size.lineHeight;
  const outputWidth = props.showValueLabel ? 56 : 0;
  const trackY =
    labelHeight + size.gap + size.thumbSize / 2 - size.trackHeight / 2;
  const trackWidth = Math.max(layout.width, 0);
  const fillWidth = Math.max(trackWidth * percent, 0);
  const thumbX = Math.max(fillWidth - size.thumbSize / 2, 0);

  const labelNode: SkiaNodeData = {
    type: "text",
    elementId: `${node.id}:label`,
    x: 0,
    y: 0,
    width: Math.max(layout.width - outputWidth, 0),
    height: labelHeight,
    visible: props.label.length > 0,
    text: {
      content: props.label,
      fontFamilies: [fontFamily.sans],
      fontSize: size.fontSize,
      fontWeight: 500,
      color: palette.textColor,
      align: "left",
      lineHeight: size.lineHeight,
      paddingLeft: 0,
      paddingTop: 0,
      maxWidth: Math.max(layout.width - outputWidth, 0),
    },
  };

  const outputNode: SkiaNodeData = {
    type: "text",
    elementId: `${node.id}:output`,
    x: Math.max(layout.width - outputWidth, 0),
    y: 0,
    width: outputWidth,
    height: labelHeight,
    visible: props.showValueLabel,
    text: {
      content: formatGenericSliderValue(value),
      fontFamilies: [fontFamily.sans],
      fontSize: size.fontSize,
      fontWeight: 500,
      color: palette.textColor,
      align: "right",
      lineHeight: size.lineHeight,
      paddingLeft: 0,
      paddingTop: 0,
      maxWidth: outputWidth,
    },
  };

  const trackNode: SkiaNodeData = {
    type: "box",
    elementId: `${node.id}:track`,
    x: 0,
    y: trackY,
    width: trackWidth,
    height: size.trackHeight,
    visible: true,
    box: {
      fillColor: palette.trackColor,
      borderRadius: size.trackHeight / 2,
    },
  };

  const fillNode: SkiaNodeData = {
    type: "box",
    elementId: `${node.id}:fill`,
    x: 0,
    y: trackY,
    width: fillWidth,
    height: size.trackHeight,
    visible: fillWidth > 0,
    box: {
      fillColor: palette.fillColor,
      borderRadius: size.trackHeight / 2,
    },
  };

  const thumbNode: SkiaNodeData = {
    type: "box",
    elementId: `${node.id}:thumb`,
    x: thumbX,
    y: trackY - (size.thumbSize - size.trackHeight) / 2,
    width: size.thumbSize,
    height: size.thumbSize,
    visible: true,
    box: {
      fillColor: palette.thumbColor,
      borderRadius: size.thumbSize / 2,
      strokeColor: palette.thumbStrokeColor,
      strokeWidth: 1,
    },
  };

  return {
    type: "container",
    elementId: node.id,
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    visible: isGenericNodeVisible(style),
    children: [labelNode, outputNode, trackNode, fillNode, thumbNode],
  };
}

function buildGenericListBoxNode(
  node: ResolvedNode,
  layout: GenericResolvedSkiaLayout,
  theme: "light" | "dark",
): SkiaNodeData {
  const props = toListBoxRacProps(node.props ?? {}) as ListBoxRacProps;
  const style = readGenericStyle(node);
  const isDark = theme === "dark";
  const borderRadius = readNumber(style.borderRadius, 8);
  const padding = 4;
  const itemHeight = 28;
  const gap = 2;
  const items = flattenListBoxItems(props.items);
  const selectedKeys = new Set<string>([
    ...(props.selectedKeys ?? []),
    ...(props.selectedKey ? [props.selectedKey] : []),
    ...(props.defaultSelectedKeys ?? []),
    ...(props.defaultSelectedKey ? [props.defaultSelectedKey] : []),
  ]);
  const effectiveSelectedKeys =
    selectedKeys.size > 0
      ? selectedKeys
      : items[0]
        ? new Set<string>([items[0].id])
        : selectedKeys;

  const backgroundNode: SkiaNodeData = {
    type: "box",
    elementId: `${node.id}:background`,
    x: 0,
    y: 0,
    width: layout.width,
    height: layout.height,
    visible: true,
    box: {
      fillColor: colorIntToFloat32(isDark ? 0x1f2937 : 0xffffff, 1),
      borderRadius,
      strokeColor: colorIntToFloat32(isDark ? 0x374151 : 0xd1d5db, 1),
      strokeWidth: 1,
    },
  };

  const itemNodes = items.flatMap((item, index): SkiaNodeData[] => {
    const y = padding + index * (itemHeight + gap);
    const isSelected = effectiveSelectedKeys.has(item.id);
    const rowFill = isSelected
      ? props.variant === "accent"
        ? colorIntToFloat32(isDark ? 0x1e3a8a : 0xdbeafe, 1)
        : colorIntToFloat32(isDark ? 0x374151 : 0xf3f4f6, 1)
      : colorIntToFloat32(0x000000, 0);
    const textColor = item.isDisabled
      ? colorIntToFloat32(isDark ? 0x6b7280 : 0x9ca3af, 1)
      : colorIntToFloat32(isDark ? 0xf9fafb : 0x111827, 1);

    return [
      {
        type: "box",
        elementId: `${node.id}:item:${item.id}:bg`,
        x: padding,
        y,
        width: Math.max(layout.width - padding * 2, 0),
        height: itemHeight,
        visible: true,
        box: {
          fillColor: rowFill,
          borderRadius: 4,
        },
      },
      {
        type: "text",
        elementId: `${node.id}:item:${item.id}:text`,
        x: padding + 12,
        y,
        width: Math.max(layout.width - padding * 2 - 24, 0),
        height: itemHeight,
        visible: true,
        text: {
          content: item.label,
          fontFamilies: [fontFamily.sans],
          fontSize: 14,
          fontWeight: 600,
          color: textColor,
          align: "left",
          lineHeight: 20,
          paddingLeft: 0,
          paddingTop: 0,
          maxWidth: Math.max(layout.width - padding * 2 - 24, 0),
          verticalAlign: "middle",
        },
      },
    ];
  });

  return {
    type: "container",
    elementId: node.id,
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    visible: isGenericNodeVisible(style),
    children: [backgroundNode, ...itemNodes],
  };
}

function buildGenericGridListNode(
  node: ResolvedNode,
  layout: GenericResolvedSkiaLayout,
  theme: "light" | "dark",
): SkiaNodeData {
  const props = toGridListRacProps(node.props ?? {}) as GridListRacProps;
  const style = readGenericStyle(node);
  const isDark = theme === "dark";
  const gap = readNumber(style.gap, 12);
  const columns = props.layout === "grid" ? props.columns : 1;
  const padding = readNumber(style.padding, 0);
  const itemHeight = props.layout === "grid" ? 72 : 64;
  const availableWidth = Math.max(layout.width - padding * 2, 0);
  const itemWidth =
    props.layout === "grid"
      ? Math.max((availableWidth - gap * (columns - 1)) / columns, 0)
      : availableWidth;
  const items = flattenGridListItems(props.items);
  const selectedKeys = new Set<string>([
    ...(props.selectedKeys ?? []),
    ...(props.selectedKey ? [props.selectedKey] : []),
    ...(props.defaultSelectedKeys ?? []),
    ...(props.defaultSelectedKey ? [props.defaultSelectedKey] : []),
  ]);

  const backgroundNode: SkiaNodeData = {
    type: "box",
    elementId: `${node.id}:background`,
    x: 0,
    y: 0,
    width: layout.width,
    height: layout.height,
    visible: true,
    box: {
      fillColor: colorIntToFloat32(0x000000, 0),
      borderRadius: readNumber(style.borderRadius, 0),
    },
  };

  const itemNodes = items.flatMap((item, index): SkiaNodeData[] => {
    const column = props.layout === "grid" ? index % columns : 0;
    const row = props.layout === "grid" ? Math.floor(index / columns) : index;
    const x = padding + column * (itemWidth + gap);
    const y = padding + row * (itemHeight + gap);
    const isSelected = selectedKeys.has(item.id);
    const borderColor = isSelected
      ? colorIntToFloat32(isDark ? 0x93c5fd : 0x2563eb, 1)
      : colorIntToFloat32(isDark ? 0x374151 : 0xd1d5db, 1);
    const cardFill = colorIntToFloat32(isDark ? 0x1f2937 : 0xf9fafb, 1);
    const textColor = item.isDisabled
      ? colorIntToFloat32(isDark ? 0x6b7280 : 0x9ca3af, 1)
      : colorIntToFloat32(isDark ? 0xf9fafb : 0x111827, 1);
    const descriptionColor = colorIntToFloat32(
      isDark ? 0x9ca3af : 0x6b7280,
      item.isDisabled ? 0.6 : 1,
    );

    return [
      {
        type: "box",
        elementId: `${node.id}:item:${item.id}:bg`,
        x,
        y,
        width: itemWidth,
        height: itemHeight,
        visible: true,
        box: {
          fillColor: cardFill,
          borderRadius: 8,
          strokeColor: borderColor,
          strokeWidth: isSelected ? 2 : 1,
        },
      },
      {
        type: "text",
        elementId: `${node.id}:item:${item.id}:label`,
        x: x + 16,
        y: y + 12,
        width: Math.max(itemWidth - 32, 0),
        height: 22,
        visible: true,
        text: {
          content: item.label,
          fontFamilies: [fontFamily.sans],
          fontSize: 14,
          fontWeight: 600,
          color: textColor,
          align: "left",
          lineHeight: 20,
          paddingLeft: 0,
          paddingTop: 0,
          maxWidth: Math.max(itemWidth - 32, 0),
          verticalAlign: "middle",
        },
      },
      ...(item.description
        ? [
            {
              type: "text" as const,
              elementId: `${node.id}:item:${item.id}:description`,
              x: x + 16,
              y: y + 36,
              width: Math.max(itemWidth - 32, 0),
              height: 20,
              visible: true,
              text: {
                content: item.description,
                fontFamilies: [fontFamily.sans],
                fontSize: 12,
                fontWeight: 400,
                color: descriptionColor,
                align: "left" as const,
                lineHeight: 16,
                paddingLeft: 0,
                paddingTop: 0,
                maxWidth: Math.max(itemWidth - 32, 0),
                verticalAlign: "middle" as const,
              },
            },
          ]
        : []),
    ];
  });

  return {
    type: "container",
    elementId: node.id,
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    visible: isGenericNodeVisible(style),
    children: [backgroundNode, ...itemNodes],
  };
}

function buildGenericTagGroupNode(
  node: ResolvedNode,
  layout: GenericResolvedSkiaLayout,
  theme: "light" | "dark",
): SkiaNodeData {
  const props = toTagGroupRacProps(node.props ?? {}) as TagGroupRacProps;
  const style = readGenericStyle(node);
  const isDark = theme === "dark";
  const size = resolveGenericTagGroupSize(props.size);
  const items: TagGroupItemDescriptor[] = props.items ?? [];
  const padding = readNumber(style.padding, 0);
  const gap = readNumber(style.gap, 8);
  const labelHeight = props.label ? size.labelHeight : 0;
  const chipsStartY = padding + labelHeight + (props.label ? 8 : 0);
  const selectedKeys = new Set<string>([
    ...(props.selectedKeys ?? []),
    ...(props.selectedKey ? [props.selectedKey] : []),
    ...(props.defaultSelectedKeys ?? []),
    ...(props.defaultSelectedKey ? [props.defaultSelectedKey] : []),
  ]);

  const backgroundNode: SkiaNodeData = {
    type: "box",
    elementId: `${node.id}:background`,
    x: 0,
    y: 0,
    width: layout.width,
    height: layout.height,
    visible: true,
    box: {
      fillColor: colorIntToFloat32(0x000000, 0),
      borderRadius: readNumber(style.borderRadius, 0),
    },
  };

  const labelNode: SkiaNodeData[] = props.label
    ? [
        {
          type: "text",
          elementId: `${node.id}:label`,
          x: padding,
          y: padding,
          width: Math.max(layout.width - padding * 2, 0),
          height: size.labelHeight,
          visible: true,
          text: {
            content: props.label,
            fontFamilies: [fontFamily.sans],
            fontSize: size.labelFontSize,
            fontWeight: 600,
            color: colorIntToFloat32(isDark ? 0xf9fafb : 0x111827, 1),
            align: "left",
            lineHeight: size.labelLineHeight,
            paddingLeft: 0,
            paddingTop: 0,
            maxWidth: Math.max(layout.width - padding * 2, 0),
            verticalAlign: "middle",
          },
        },
      ]
    : [];

  let nextX = padding;
  let nextY = chipsStartY;
  const availableWidth = Math.max(layout.width - padding * 2, 0);
  const chipNodes = items.flatMap((item): SkiaNodeData[] => {
    const chipWidth = Math.min(
      Math.max(item.label.length * size.charWidth + size.paddingX * 2, 48),
      availableWidth,
    );
    if (nextX > padding && nextX + chipWidth > padding + availableWidth) {
      nextX = padding;
      nextY += size.chipHeight + gap;
    }
    const x = nextX;
    const y = nextY;
    nextX += chipWidth + gap;

    const isSelected = selectedKeys.has(item.id);
    const isNegative =
      props.variant === "negative" || props.variant === "error";
    const isAccent = props.variant === "accent" || props.variant === "primary";
    const fillColor = resolveTagGroupChipFill({
      isDark,
      isSelected,
      isAccent,
      isNegative,
    });
    const strokeColor = resolveTagGroupChipStroke({
      isDark,
      isSelected,
      isAccent,
      isNegative,
    });
    const textColor = item.isDisabled
      ? colorIntToFloat32(isDark ? 0x6b7280 : 0x9ca3af, 1)
      : colorIntToFloat32(isDark ? 0xf9fafb : 0x111827, 1);

    return [
      {
        type: "box",
        elementId: `${node.id}:tag:${item.id}:bg`,
        x,
        y,
        width: chipWidth,
        height: size.chipHeight,
        visible: true,
        box: {
          fillColor,
          borderRadius: size.radius,
          strokeColor,
          strokeWidth: isSelected ? 2 : 1,
        },
      },
      {
        type: "text",
        elementId: `${node.id}:tag:${item.id}:text`,
        x: x + size.paddingX,
        y,
        width: Math.max(chipWidth - size.paddingX * 2, 0),
        height: size.chipHeight,
        visible: true,
        text: {
          content: item.label,
          fontFamilies: [fontFamily.sans],
          fontSize: size.fontSize,
          fontWeight: 500,
          color: textColor,
          align: "left",
          lineHeight: size.lineHeight,
          paddingLeft: 0,
          paddingTop: 0,
          maxWidth: Math.max(chipWidth - size.paddingX * 2, 0),
          verticalAlign: "middle",
        },
      },
    ];
  });

  return {
    type: "container",
    elementId: node.id,
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    visible: isGenericNodeVisible(style),
    children: [backgroundNode, ...labelNode, ...chipNodes],
  };
}

function buildGenericMenuNode(
  node: ResolvedNode,
  layout: GenericResolvedSkiaLayout,
  theme: "light" | "dark",
): SkiaNodeData {
  const props = toMenuRacProps(node.props ?? {}) as MenuRacProps;
  const style = readGenericStyle(node);
  const isDark = theme === "dark";
  const size = resolveGenericButtonSize(props.size);
  const items: MenuItemDescriptor[] = props.items ?? [];
  const triggerHeight = Math.max(size.lineHeight + 12, 32);
  const itemHeight = resolveGenericMenuItemHeight(props.size);
  const menuY = triggerHeight + 8;
  const menuWidth = Math.max(layout.width, 160);
  const selectedKeys = new Set<string>([
    ...(props.selectedKeys ?? []),
    ...(props.defaultSelectedKeys ?? []),
  ]);
  const triggerPalette = resolveGenericButtonPalette(
    {
      children: props.children,
      variant: props.variant,
      fillStyle: "fill",
      size: props.size,
      type: "button",
      iconPosition: "start",
      iconStrokeWidth: 2,
      isDisabled: props.isDisabled,
    },
    theme,
  );

  const triggerNodes: SkiaNodeData[] = [
    {
      type: "box",
      elementId: `${node.id}:trigger:bg`,
      x: 0,
      y: 0,
      width: Math.min(layout.width, menuWidth),
      height: triggerHeight,
      visible: true,
      box: {
        fillColor: triggerPalette.fillColor,
        borderRadius: size.radius,
        strokeColor: triggerPalette.strokeColor,
        strokeWidth: triggerPalette.strokeWidth,
      },
    },
    {
      type: "text",
      elementId: `${node.id}:trigger:text`,
      x: 12,
      y: 0,
      width: Math.max(Math.min(layout.width, menuWidth) - 24, 0),
      height: triggerHeight,
      visible: true,
      text: {
        content: props.children,
        fontFamilies: [fontFamily.sans],
        fontSize: size.fontSize,
        fontWeight: 600,
        color: triggerPalette.textColor,
        align: "left",
        lineHeight: size.lineHeight,
        paddingLeft: 0,
        paddingTop: 0,
        maxWidth: Math.max(Math.min(layout.width, menuWidth) - 24, 0),
        verticalAlign: "middle",
      },
    },
  ];

  const menuBackground: SkiaNodeData = {
    type: "box",
    elementId: `${node.id}:menu:bg`,
    x: 0,
    y: menuY,
    width: menuWidth,
    height: Math.max(items.length * itemHeight + 8, itemHeight + 8),
    visible: true,
    box: {
      fillColor: colorIntToFloat32(isDark ? 0x1f2937 : 0xffffff, 1),
      borderRadius: readNumber(style.borderRadius, 8),
      strokeColor: colorIntToFloat32(isDark ? 0x374151 : 0xd1d5db, 1),
      strokeWidth: 1,
    },
  };

  const itemNodes = items.flatMap((item, index): SkiaNodeData[] => {
    const y = menuY + 4 + index * itemHeight;
    const isSelected = selectedKeys.has(item.id);
    const textColor = item.isDisabled
      ? colorIntToFloat32(isDark ? 0x6b7280 : 0x9ca3af, 1)
      : colorIntToFloat32(isDark ? 0xf9fafb : 0x111827, 1);

    return [
      {
        type: "box",
        elementId: `${node.id}:item:${item.id}:bg`,
        x: 4,
        y,
        width: Math.max(menuWidth - 8, 0),
        height: itemHeight,
        visible: true,
        box: {
          fillColor: isSelected
            ? colorIntToFloat32(isDark ? 0x1e3a8a : 0xdbeafe, 1)
            : colorIntToFloat32(0x000000, 0),
          borderRadius: 4,
        },
      },
      {
        type: "text",
        elementId: `${node.id}:item:${item.id}:label`,
        x: 16,
        y,
        width: item.shortcut ? Math.max(menuWidth - 92, 0) : menuWidth - 32,
        height: itemHeight,
        visible: true,
        text: {
          content: item.label,
          fontFamilies: [fontFamily.sans],
          fontSize: size.fontSize,
          fontWeight: 500,
          color: textColor,
          align: "left",
          lineHeight: size.lineHeight,
          paddingLeft: 0,
          paddingTop: 0,
          maxWidth: item.shortcut
            ? Math.max(menuWidth - 92, 0)
            : menuWidth - 32,
          verticalAlign: "middle",
        },
      },
      ...(item.shortcut
        ? [
            {
              type: "text" as const,
              elementId: `${node.id}:item:${item.id}:shortcut`,
              x: Math.max(menuWidth - 72, 16),
              y,
              width: 56,
              height: itemHeight,
              visible: true,
              text: {
                content: item.shortcut,
                fontFamilies: [fontFamily.sans],
                fontSize: Math.max(size.fontSize - 1, 10),
                fontWeight: 500,
                color: colorIntToFloat32(isDark ? 0x9ca3af : 0x6b7280, 1),
                align: "right" as const,
                lineHeight: size.lineHeight,
                paddingLeft: 0,
                paddingTop: 0,
                maxWidth: 56,
                verticalAlign: "middle" as const,
              },
            },
          ]
        : []),
    ];
  });

  return {
    type: "container",
    elementId: node.id,
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    visible: isGenericNodeVisible(style),
    children: [...triggerNodes, menuBackground, ...itemNodes],
  };
}

function flattenListBoxItems(
  entries: ListBoxRacProps["items"],
): ListBoxItemDescriptor[] {
  if (!entries) return [];
  const result: ListBoxItemDescriptor[] = [];
  for (const entry of entries) {
    if (isListBoxSectionDescriptor(entry)) {
      result.push(...entry.items);
    } else {
      result.push(entry);
    }
  }
  return result;
}

function isListBoxSectionDescriptor(
  entry: ListBoxEntryDescriptor,
): entry is Extract<ListBoxEntryDescriptor, { type: "section" }> {
  return entry.type === "section";
}

function flattenGridListItems(
  entries: GridListRacProps["items"],
): GridListItemDescriptor[] {
  if (!entries) return [];
  const result: GridListItemDescriptor[] = [];
  for (const entry of entries) {
    if (isGridListSectionDescriptor(entry)) {
      result.push(...entry.items);
    } else {
      result.push(entry);
    }
  }
  return result;
}

function isGridListSectionDescriptor(
  entry: GridListEntryDescriptor,
): entry is Extract<GridListEntryDescriptor, { type: "section" }> {
  return entry.type === "section";
}

function resolveGenericTagGroupSize(size: TagGroupRacProps["size"]): {
  labelFontSize: number;
  labelLineHeight: number;
  labelHeight: number;
  fontSize: number;
  lineHeight: number;
  chipHeight: number;
  paddingX: number;
  radius: number;
  charWidth: number;
} {
  switch (size) {
    case "sm":
      return {
        labelFontSize: 12,
        labelLineHeight: 16,
        labelHeight: 18,
        fontSize: 12,
        lineHeight: 16,
        chipHeight: 24,
        paddingX: 10,
        radius: 12,
        charWidth: 7,
      };
    case "lg":
      return {
        labelFontSize: 15,
        labelLineHeight: 22,
        labelHeight: 24,
        fontSize: 14,
        lineHeight: 20,
        chipHeight: 34,
        paddingX: 14,
        radius: 17,
        charWidth: 8,
      };
    case "md":
    default:
      return {
        labelFontSize: 13,
        labelLineHeight: 20,
        labelHeight: 22,
        fontSize: 13,
        lineHeight: 18,
        chipHeight: 30,
        paddingX: 12,
        radius: 15,
        charWidth: 7.5,
      };
  }
}

function resolveGenericMenuItemHeight(size: MenuRacProps["size"]): number {
  switch (size) {
    case "sm":
      return 28;
    case "lg":
      return 40;
    case "xl":
      return 48;
    case "md":
    default:
      return 32;
  }
}

function resolveTagGroupChipFill({
  isDark,
  isSelected,
  isAccent,
  isNegative,
}: {
  isDark: boolean;
  isSelected: boolean;
  isAccent: boolean;
  isNegative: boolean;
}): ReturnType<typeof colorIntToFloat32> {
  if (isSelected && isNegative) {
    return colorIntToFloat32(isDark ? 0x7f1d1d : 0xfee2e2, 1);
  }
  if (isSelected && isAccent) {
    return colorIntToFloat32(isDark ? 0x1e3a8a : 0xdbeafe, 1);
  }
  return colorIntToFloat32(isDark ? 0x1f2937 : 0xf9fafb, 1);
}

function resolveTagGroupChipStroke({
  isDark,
  isSelected,
  isAccent,
  isNegative,
}: {
  isDark: boolean;
  isSelected: boolean;
  isAccent: boolean;
  isNegative: boolean;
}): ReturnType<typeof colorIntToFloat32> {
  if (isSelected && isNegative) {
    return colorIntToFloat32(isDark ? 0xfca5a5 : 0xdc2626, 1);
  }
  if (isSelected && isAccent) {
    return colorIntToFloat32(isDark ? 0x93c5fd : 0x2563eb, 1);
  }
  return colorIntToFloat32(isDark ? 0x4b5563 : 0xd1d5db, 1);
}

function resolveGenericLayout(
  input: GenericResolvedSkiaBuildInput,
): GenericResolvedSkiaLayout {
  const style = readGenericStyle(input.node);
  const layout = input.layoutById?.get(input.node.id) ?? input.layout;
  return {
    x: layout?.x ?? readTranslateX(style.transform) ?? readNumber(style.x, 0),
    y: layout?.y ?? readTranslateY(style.transform) ?? readNumber(style.y, 0),
    width:
      layout?.width ?? readNumber(style.width, defaultGenericWidth(input.node)),
    height:
      layout?.height ??
      readNumber(style.height, defaultGenericHeight(input.node)),
  };
}

function readGenericStyle(node: ResolvedNode): Record<string, unknown> {
  const style = node.props?.style;
  return Boolean(style) && typeof style === "object" && !Array.isArray(style)
    ? (style as Record<string, unknown>)
    : {};
}

function isGenericNodeVisible(style: Record<string, unknown>): boolean {
  return (
    style.display !== "none" &&
    style.display !== "contents" &&
    style.visibility !== "hidden" &&
    style.visibility !== "collapse"
  );
}

function defaultGenericWidth(node: ResolvedNode): number {
  return getPrimitiveBinding(String(node.type)) ? 120 : 0;
}

function defaultGenericHeight(node: ResolvedNode): number {
  return getPrimitiveBinding(String(node.type)) ? 36 : 0;
}

function readNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = parsePxValue(value, fallback);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function readTranslateX(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const match = value.match(/translate\(\s*(-?\d+(?:\.\d+)?)px?/);
  return match ? Number(match[1]) : undefined;
}

function readTranslateY(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const match = value.match(
    /translate\(\s*-?\d+(?:\.\d+)?px?\s*,\s*(-?\d+(?:\.\d+)?)px?/,
  );
  return match ? Number(match[1]) : undefined;
}

function resolveGenericButtonSize(size: ButtonRacProps["size"]): {
  fontSize: number;
  lineHeight: number;
  radius: number;
  gap: number;
} {
  switch (size) {
    case "xs":
      return { fontSize: 11, lineHeight: 14, radius: 4, gap: 4 };
    case "sm":
      return { fontSize: 12, lineHeight: 16, radius: 4, gap: 6 };
    case "lg":
      return { fontSize: 16, lineHeight: 24, radius: 8, gap: 10 };
    case "xl":
      return { fontSize: 18, lineHeight: 28, radius: 8, gap: 12 };
    case "md":
    default:
      return { fontSize: 14, lineHeight: 20, radius: 6, gap: 8 };
  }
}

function resolveGenericBreadcrumbSize(size: unknown): {
  fontSize: number;
  lineHeight: number;
} {
  switch (size) {
    case "S":
      return { fontSize: 12, lineHeight: 16 };
    case "L":
      return { fontSize: 16, lineHeight: 24 };
    case "M":
    default:
      return { fontSize: 14, lineHeight: 20 };
  }
}

function resolveGenericTextFieldSize(size: TextFieldRacProps["size"]): {
  labelFontSize: number;
  labelLineHeight: number;
  labelHeight: number;
  inputFontSize: number;
  inputLineHeight: number;
  inputHeight: number;
  paddingX: number;
  gap: number;
} {
  switch (size) {
    case "xs":
      return {
        labelFontSize: 11,
        labelLineHeight: 14,
        labelHeight: 14,
        inputFontSize: 11,
        inputLineHeight: 14,
        inputHeight: 24,
        paddingX: 8,
        gap: 4,
      };
    case "sm":
      return {
        labelFontSize: 12,
        labelLineHeight: 16,
        labelHeight: 16,
        inputFontSize: 12,
        inputLineHeight: 16,
        inputHeight: 28,
        paddingX: 10,
        gap: 6,
      };
    case "lg":
      return {
        labelFontSize: 14,
        labelLineHeight: 20,
        labelHeight: 20,
        inputFontSize: 16,
        inputLineHeight: 24,
        inputHeight: 40,
        paddingX: 14,
        gap: 8,
      };
    case "xl":
      return {
        labelFontSize: 16,
        labelLineHeight: 24,
        labelHeight: 24,
        inputFontSize: 18,
        inputLineHeight: 28,
        inputHeight: 48,
        paddingX: 16,
        gap: 10,
      };
    case "md":
    default:
      return {
        labelFontSize: 13,
        labelLineHeight: 18,
        labelHeight: 18,
        inputFontSize: 14,
        inputLineHeight: 20,
        inputHeight: 34,
        paddingX: 12,
        gap: 6,
      };
  }
}

function resolveGenericButtonPalette(
  props: ButtonRacProps,
  theme: "light" | "dark",
): {
  fillColor: Float32Array;
  textColor: Float32Array;
  strokeColor: Float32Array;
  strokeWidth: number;
} {
  const isDark = theme === "dark";
  const token = (() => {
    if (props.fillStyle === "outline") {
      return {
        fill: "transparent",
        text:
          props.variant === "accent"
            ? "#2563eb"
            : isDark
              ? "#f9fafb"
              : "#111827",
        stroke: isDark ? "#6b7280" : "#d1d5db",
      };
    }
    switch (props.variant) {
      case "accent":
        return { fill: "#2563eb", text: "#ffffff", stroke: "#2563eb" };
      case "secondary":
        return {
          fill: isDark ? "#374151" : "#f3f4f6",
          text: isDark ? "#f9fafb" : "#111827",
          stroke: isDark ? "#4b5563" : "#d1d5db",
        };
      case "negative":
        return { fill: "#dc2626", text: "#ffffff", stroke: "#dc2626" };
      case "premium":
      case "genai":
        return { fill: "#7c3aed", text: "#ffffff", stroke: "#7c3aed" };
      case "ghost":
        return {
          fill: "transparent",
          text: isDark ? "#f9fafb" : "#111827",
          stroke: "transparent",
        };
      case "primary":
      default:
        return {
          fill: isDark ? "#f9fafb" : "#111827",
          text: isDark ? "#111827" : "#ffffff",
          stroke: isDark ? "#f9fafb" : "#111827",
        };
    }
  })();

  return {
    fillColor:
      token.fill === "transparent"
        ? Float32Array.of(0, 0, 0, 0)
        : colorIntToFloat32(cssColorToHex(token.fill), 1),
    textColor: colorIntToFloat32(cssColorToHex(token.text), 1),
    strokeColor:
      token.stroke === "transparent"
        ? Float32Array.of(0, 0, 0, 0)
        : colorIntToFloat32(cssColorToHex(token.stroke), 1),
    strokeWidth: token.stroke === "transparent" ? 0 : 1,
  };
}

function resolveGenericLinkSize(size: LinkRacProps["size"]): {
  fontSize: number;
  lineHeight: number;
} {
  switch (size) {
    case "xs":
      return { fontSize: 11, lineHeight: 14 };
    case "sm":
      return { fontSize: 12, lineHeight: 16 };
    case "lg":
      return { fontSize: 16, lineHeight: 24 };
    case "xl":
      return { fontSize: 18, lineHeight: 28 };
    case "md":
    default:
      return { fontSize: 14, lineHeight: 20 };
  }
}

function resolveGenericLinkTextColor(
  props: LinkRacProps,
  style: Record<string, unknown>,
  theme: "light" | "dark",
): Float32Array {
  if (typeof style.color === "string") {
    return colorIntToFloat32(cssColorToHex(style.color), 1);
  }
  if (props.staticColor === "white") {
    return colorIntToFloat32(0xffffff, 1);
  }
  if (props.staticColor === "black") {
    return colorIntToFloat32(0x111827, 1);
  }
  if (props.variant === "secondary") {
    return colorIntToFloat32(theme === "dark" ? 0xd1d5db : 0x4b5563, 1);
  }
  return colorIntToFloat32(theme === "dark" ? 0x93c5fd : 0x2563eb, 1);
}

function resolveGenericToggleButtonSize(size: ToggleButtonRacProps["size"]): {
  fontSize: number;
  lineHeight: number;
  radius: number;
} {
  switch (size) {
    case "sm":
      return { fontSize: 12, lineHeight: 16, radius: 4 };
    case "lg":
      return { fontSize: 16, lineHeight: 24, radius: 8 };
    case "md":
    default:
      return { fontSize: 14, lineHeight: 20, radius: 6 };
  }
}

function resolveGenericToggleButtonPalette(
  props: ToggleButtonRacProps,
  theme: "light" | "dark",
): {
  fillColor: Float32Array;
  textColor: Float32Array;
  strokeColor: Float32Array;
  strokeWidth: number;
} {
  const isDark = theme === "dark";
  if (props.isQuiet) {
    return {
      fillColor: Float32Array.of(0, 0, 0, 0),
      textColor: colorIntToFloat32(isDark ? 0xf9fafb : 0x111827, 1),
      strokeColor: Float32Array.of(0, 0, 0, 0),
      strokeWidth: 0,
    };
  }
  if (props.isSelected && props.isEmphasized) {
    return {
      fillColor: colorIntToFloat32(0x2563eb, 1),
      textColor: colorIntToFloat32(0xffffff, 1),
      strokeColor: colorIntToFloat32(0x2563eb, 1),
      strokeWidth: 1,
    };
  }
  if (props.isSelected) {
    return {
      fillColor: colorIntToFloat32(isDark ? 0xf9fafb : 0x111827, 1),
      textColor: colorIntToFloat32(isDark ? 0x111827 : 0xffffff, 1),
      strokeColor: colorIntToFloat32(isDark ? 0xf9fafb : 0x111827, 1),
      strokeWidth: 1,
    };
  }
  return {
    fillColor: colorIntToFloat32(isDark ? 0x374151 : 0xf3f4f6, 1),
    textColor: colorIntToFloat32(isDark ? 0xf9fafb : 0x111827, 1),
    strokeColor: colorIntToFloat32(isDark ? 0x4b5563 : 0xd1d5db, 1),
    strokeWidth: 1,
  };
}

function resolveGenericSwitchSize(size: SwitchRacProps["size"]): {
  fontSize: number;
  lineHeight: number;
  trackWidth: number;
  trackHeight: number;
  thumbSize: number;
  thumbOffset: number;
  gap: number;
} {
  switch (size) {
    case "sm":
      return {
        fontSize: 12,
        lineHeight: 16,
        trackWidth: 32,
        trackHeight: 18,
        thumbSize: 14,
        thumbOffset: 2,
        gap: 8,
      };
    case "lg":
      return {
        fontSize: 16,
        lineHeight: 24,
        trackWidth: 44,
        trackHeight: 24,
        thumbSize: 20,
        thumbOffset: 2,
        gap: 12,
      };
    case "md":
    default:
      return {
        fontSize: 14,
        lineHeight: 20,
        trackWidth: 36,
        trackHeight: 20,
        thumbSize: 16,
        thumbOffset: 2,
        gap: 10,
      };
  }
}

function resolveGenericCheckboxSize(size: CheckboxRacProps["size"]): {
  fontSize: number;
  lineHeight: number;
  boxSize: number;
  radius: number;
  indicatorFontSize: number;
  gap: number;
} {
  switch (size) {
    case "sm":
      return {
        fontSize: 12,
        lineHeight: 16,
        boxSize: 16,
        radius: 4,
        indicatorFontSize: 13,
        gap: 8,
      };
    case "lg":
      return {
        fontSize: 16,
        lineHeight: 24,
        boxSize: 24,
        radius: 6,
        indicatorFontSize: 18,
        gap: 12,
      };
    case "md":
    default:
      return {
        fontSize: 14,
        lineHeight: 20,
        boxSize: 20,
        radius: 4,
        indicatorFontSize: 16,
        gap: 10,
      };
  }
}

function resolveGenericRadioSize(size: RadioRacProps["size"]): {
  fontSize: number;
  lineHeight: number;
  boxSize: number;
  dotSize: number;
  gap: number;
} {
  switch (size) {
    case "sm":
      return { fontSize: 12, lineHeight: 16, boxSize: 16, dotSize: 6, gap: 8 };
    case "lg":
      return {
        fontSize: 16,
        lineHeight: 24,
        boxSize: 24,
        dotSize: 10,
        gap: 12,
      };
    case "xl":
      return {
        fontSize: 18,
        lineHeight: 28,
        boxSize: 28,
        dotSize: 12,
        gap: 14,
      };
    case "md":
    default:
      return { fontSize: 14, lineHeight: 20, boxSize: 20, dotSize: 8, gap: 10 };
  }
}

function resolveGenericSliderSize(size: SliderRacProps["size"]): {
  fontSize: number;
  lineHeight: number;
  trackHeight: number;
  thumbSize: number;
  gap: number;
} {
  switch (size) {
    case "sm":
      return {
        fontSize: 12,
        lineHeight: 16,
        trackHeight: 4,
        thumbSize: 14,
        gap: 6,
      };
    case "lg":
      return {
        fontSize: 16,
        lineHeight: 24,
        trackHeight: 12,
        thumbSize: 22,
        gap: 8,
      };
    case "md":
    default:
      return {
        fontSize: 14,
        lineHeight: 20,
        trackHeight: 8,
        thumbSize: 18,
        gap: 8,
      };
  }
}

function resolveGenericSwitchPalette(
  props: SwitchRacProps,
  theme: "light" | "dark",
): {
  trackColor: Float32Array;
  trackStrokeColor: Float32Array;
  trackStrokeWidth: number;
  thumbColor: Float32Array;
  textColor: Float32Array;
} {
  const isDark = theme === "dark";
  const selectedTrack = props.isEmphasized
    ? 0x2563eb
    : isDark
      ? 0xf9fafb
      : 0x111827;
  return {
    trackColor: props.isSelected
      ? colorIntToFloat32(selectedTrack, 1)
      : colorIntToFloat32(isDark ? 0x374151 : 0xe5e7eb, 1),
    trackStrokeColor: colorIntToFloat32(isDark ? 0x4b5563 : 0xd1d5db, 1),
    trackStrokeWidth: props.isSelected ? 0 : 1,
    thumbColor: colorIntToFloat32(0xffffff, 1),
    textColor: colorIntToFloat32(isDark ? 0xf9fafb : 0x111827, 1),
  };
}

function resolveGenericCheckboxPalette(
  props: CheckboxRacProps,
  theme: "light" | "dark",
): {
  boxFillColor: Float32Array;
  boxStrokeColor: Float32Array;
  boxStrokeWidth: number;
  indicatorColor: Float32Array;
  textColor: Float32Array;
} {
  const isDark = theme === "dark";
  const selectedColor = props.isEmphasized
    ? 0x2563eb
    : isDark
      ? 0xf9fafb
      : 0x111827;
  const isChecked = props.isSelected === true || props.isIndeterminate === true;

  return {
    boxFillColor: isChecked
      ? colorIntToFloat32(selectedColor, 1)
      : colorIntToFloat32(isDark ? 0x111827 : 0xffffff, 1),
    boxStrokeColor: isChecked
      ? colorIntToFloat32(selectedColor, 1)
      : colorIntToFloat32(isDark ? 0x6b7280 : 0xd1d5db, 1),
    boxStrokeWidth: 1,
    indicatorColor: colorIntToFloat32(
      props.isEmphasized || !isDark ? 0xffffff : 0x111827,
      1,
    ),
    textColor: colorIntToFloat32(isDark ? 0xf9fafb : 0x111827, 1),
  };
}

function resolveGenericRadioPalette(
  props: RadioRacProps,
  theme: "light" | "dark",
): {
  ringFillColor: Float32Array;
  ringStrokeColor: Float32Array;
  ringStrokeWidth: number;
  dotColor: Float32Array;
  textColor: Float32Array;
} {
  const isDark = theme === "dark";
  const selectedColor =
    props.isEmphasized || props.variant === "accent"
      ? 0x2563eb
      : props.variant === "negative"
        ? 0xdc2626
        : props.variant === "neutral"
          ? isDark
            ? 0xd1d5db
            : 0x4b5563
          : isDark
            ? 0xf9fafb
            : 0x111827;

  return {
    ringFillColor: colorIntToFloat32(isDark ? 0x111827 : 0xffffff, 1),
    ringStrokeColor: colorIntToFloat32(
      props.isSelected ? selectedColor : isDark ? 0x6b7280 : 0xd1d5db,
      1,
    ),
    ringStrokeWidth: 2,
    dotColor: colorIntToFloat32(selectedColor, 1),
    textColor: colorIntToFloat32(isDark ? 0xf9fafb : 0x111827, 1),
  };
}

function resolveGenericSliderPalette(
  props: SliderRacProps,
  theme: "light" | "dark",
): {
  trackColor: Float32Array;
  fillColor: Float32Array;
  thumbColor: Float32Array;
  thumbStrokeColor: Float32Array;
  textColor: Float32Array;
} {
  const isDark = theme === "dark";
  return {
    trackColor: colorIntToFloat32(isDark ? 0x374151 : 0xe5e7eb, 1),
    fillColor: colorIntToFloat32(
      props.isEmphasized ? 0x2563eb : isDark ? 0xf9fafb : 0x111827,
      1,
    ),
    thumbColor: colorIntToFloat32(isDark ? 0x111827 : 0xffffff, 1),
    thumbStrokeColor: colorIntToFloat32(isDark ? 0xf9fafb : 0xd1d5db, 1),
    textColor: colorIntToFloat32(isDark ? 0xf9fafb : 0x111827, 1),
  };
}

function firstSliderValue(value: SliderRacProps["value"]): number | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function normalizeSliderPercent(
  value: number,
  minValue: number,
  maxValue: number,
): number {
  const range = maxValue - minValue;
  if (!Number.isFinite(range) || range <= 0) return 0;
  return Math.max(0, Math.min(1, (value - minValue) / range));
}

function formatGenericSliderValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function resolveGenericSeparatorStrokeWidth(
  size: SeparatorRacProps["size"],
): number {
  switch (size) {
    case "sm":
      return 1;
    case "lg":
      return 4;
    case "md":
    default:
      return 2;
  }
}

function resolveGenericSeparatorDasharray(
  variant: SeparatorRacProps["variant"],
): number[] | undefined {
  switch (variant) {
    case "dashed":
      return [6, 4];
    case "dotted":
      return [1, 3];
    case "default":
    case "solid":
    default:
      return undefined;
  }
}

function countSkiaNodeData(node: SkiaNodeData | null): number {
  if (!node) return 0;
  return (
    1 +
    (node.children ?? []).reduce(
      (count, child) => count + countSkiaNodeData(child),
      0,
    )
  );
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
