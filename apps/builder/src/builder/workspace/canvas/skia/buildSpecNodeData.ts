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
 * element.props + layout + theme + elementsMap에서 구축한다.
 */

import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import type { SkiaNodeData } from "./nodeRendererTypes";
import { buildScrollNodeFields } from "./buildBoxNodeData";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";
import {
  buildCatalogShapes,
  composeCatalogShapes,
  getSkiaPrimitive,
  getSkiaPrimitiveMode,
  normalizeBreadcrumbRspSizeKey,
  racStateAttrs,
  type BorderStyleValue,
  type ComponentState,
  type ComponentSpec,
  type PropagationRule,
  type Shape,
  type SizeSpec,
} from "@composition/specs";
import {
  isCatalogCutover,
  getPrimitiveBinding,
  isDisclosureExpandedInContext,
  resolveSelectionCheckboxVisible,
  toSkiaStyle,
  usesButtonBaseUtility,
} from "@composition/shared";
import {
  fillsToSkiaFillColor,
  fillsToSkiaFallbackColor,
  fillsToSkiaFillStyle,
} from "../../../panels/styles/utils/fillToSkia";
import {
  resolveSkiaVisualRule,
  resolveSkiaRule,
  ruleSizeToSizeSpec,
} from "./resolveSkiaVisualRule";
import { getSpecForTag } from "../styleConversion/tagSpecMap";
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
import {
  formatProgressValue,
  resolveEffectiveOverflow,
  resolveEffectiveBoxShadow,
} from "../layout/engines/implicitStyles";
import {
  PHANTOM_INDICATOR_CONFIGS,
  parseLineHeight,
  phantomIndicatorSizeKey,
} from "../layout/engines/utils";
import {
  parseCSSSize,
  cssColorToHex,
  colorIntToFloat32,
  parseTextShadow,
  parseTextDecoration,
  parseDecorationColor,
  buildSkiaEffects,
} from "../styleConversion/styleConverter";
import {
  rearrangeShapesForColumn,
  measureSpecTextMinHeight,
  normalizeMiddleBaselineTextLineHeight,
} from "./specBuildHelpers";
import { findAncestorByTag } from "./ancestorLookup";
import { isRenderProjectionId } from "../../../projection/renderProjectionIds";

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
  /**
   * overflow:scroll/auto 스크롤 상태 (useScrollState.scrollMap 조회 결과).
   * box 경로(buildBoxNodeData)와 동일 계약으로 scrollOffset/scrollbar 를 산출한다.
   */
  scrollState?: {
    scrollTop: number;
    scrollLeft: number;
    maxScrollTop: number;
    maxScrollLeft: number;
  } | null;
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
  // ADR-912 6 registry collapse (2026-06-11) — "ColorSlider" 제거 (color leaf box-only cutover).
  //   catalog generic box(buildCatalogShapes)는 layout.width 직접 사용 → `_containerWidth` 주입 불요.
  "Skeleton",
  // ADR-151 후속 (2026-07-17): illustrated_message escape 가 placeholder/heading/description
  //   가로 중앙 배치에 컨테이너 폭 필요 (DOM flex alignItems:center 대칭).
  "IllustratedMessage",
  // ADR-912 Switcher cleanup — "Switcher" 제거 (ToggleButtonGroup 은 auto-width SHELL → 폭 주입 불필요).
  // ADR-097 Phase 4A: TagList spec shapes 가 props.items 기반 chip 렌더 시 컨테이너
  //   폭 필수 (ListBox 선례 대칭). items 는 TagGroup.propagation 으로 TagList 전파 →
  //   TagList Skia node 좌표계에서 chip self-render. Label 은 TagGroup 의 형제 자식
  //   element 로 독립 렌더되므로 간섭 없음.
  "TagList",
  // ADR-912 (B+icon): CalendarHeader inline_icon_text replace 의 우측 chevron(x=width-cellSize/2)
  //   + center text(maxWidth=width-cellSize*2)가 컨테이너 폭 의존 → `_containerWidth` 주입 필요.
  "CalendarHeader",
  // DateInput 버그(2026-06-23): datefieldSegments escape 가 box(input-bg) + segment text +
  //   (picker)calendar icon 을 그릴 때 containerWidth 로 좌표(우측 icon x=width-padRight-...,
  //   text maxWidth=width-...)를 잡는다. `_containerWidth` 미주입 시 escape 폴백 200 을 쓰는데
  //   실제 Taffy box width(w=layout.width, calculateContentWidth 산출 콘텐츠 자연폭)와 달라
  //   escape 좌표가 box 밖으로 어긋난다. `_containerWidth` 주입으로 escape 가 실제 box 폭을 받아
  //   "한 노드에 box+text+icon 을 다 그리는" Skia 좌표계가 box 와 일치(ListBox/GridList 동형).
  "DateInput",
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
  // Tooltip: Description / ColorPicker: ColorArea/ColorSlider/ColorField / ColorSwatchPicker:
  // ColorSwatch[] (각자 독립 렌더).
  // standalone 실렌더는 레거시 fallback이며 factory 자식이 모두 대체 커버함.
  "Disclosure",
  "Form",
  "Popover",
  "Tooltip",
  "ColorPicker",
  "ColorSwatchPicker",
  // ADR-902 후속: Body 는 페이지 루트. factory 가 자식 CanvasSceneNode 를 자동 생성하지
  // 않지만 빈 페이지에서도 배경이 렌더되어야 하므로 shell-only 규칙 필요.
  // Key 는 lowercase — element.type 가 "body" 이고 Set.has 는 정확 매칭.
  "body",
]);

/**
 * Synthetic child prop merge 컨테이너: 자식 props를 부모 spec shapes에 통합
 * 렌더링한다(Breadcrumbs `_crumbs`, GridList `items`, Menu 등).
 * → `_hasChildren=true` 주입 **금지** (주입 시 shell만 남고 내용이 사라짐).
 * → 자식 변경 시 부모 rebuild 필요 → `StoreRenderBridge.incrementalSync`
 *    expansion 대상.
 *
 * **ADR-914 Phase 6 (childRuntime facet membership SSOT, 2026-06-21)**: 본 set 은
 * entry universe childRuntime facet 의 `syntheticPropMerge` 권한 source 다.
 * `entry.childRuntime.syntheticPropMerge` 가 true 인 것과 본 set membership 은
 * **양방향 1:1** 이며, `entryUniverseContract.test.ts` 가
 * `syntheticPropMerge ⟺ SYNTHETIC_CHILD_PROP_MERGE_TAGS.has(type)` parity 로 facet 이
 * 이 membership 을 소유함을 증명한다.
 *
 * 사용자 결정 (2026-06-21): Phase 4-C(COMPLEX) 와 동일하게 별도 declaration 파일로
 * 역전하지 않는다 — 소비처가 이미 본 set 단일 SSOT 를 공유하고(아래), facet 은 import
 * 로 mirror 한다. declaration 신설은 surface 만 늘릴 뿐 실질 가치가 없다(collapse 목적
 * = 손등록 surface 감소). 따라서 본 set 자체를 childRuntime facet 의 SSOT 로 명문화하고
 * contract 가 facet ⟺ membership 정합을 검증한다.
 *
 * 소비처 (전부 단순 `set.has(type)` boolean 분기 — adapter 로직 0):
 * - buildSpecNodeData.ts:915 — `shellOnlyProps` (SYNTHETIC 면 children/text/label 억제).
 * - buildSpecNodeData.ts:1243 — `_hasChildren` 주입 가드 (SYNTHETIC 면 skip).
 * - StoreRenderBridge.ts:315/320 — `incrementalSync` rebuild expansion (부모/자식).
 * - StoreRenderBridge.ts:549 — stale 자식 ref 교체.
 * - entryUniverse.ts:140 — childRuntime.syntheticPropMerge facet mirror.
 */
export const SYNTHETIC_CHILD_PROP_MERGE_TAGS = new Set([
  "Breadcrumbs",
  "ComboBox",
  "GridList",
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

/**
 * `rearrangeShapesForColumn` 대상 화이트리스트 (ADR-079 Phase 4) —
 * indicator↔label 수직 재배치 전용. 다른 column 컴포넌트에 적용하면 파손.
 */
const COLUMN_REARRANGE_TAGS = new Set(["Checkbox", "Radio", "Switch"]);

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

/**
 * side 라벨 컬럼을 가진 field 패밀리 (2026-08-21, design-data 감사 §1-2 축①).
 *
 * 이 집합 = **Skia layout 이 Label 에 `FORM_SIDE_LABEL_WIDTH`(176px) 고정폭을 주입하는
 * 패밀리**(implicitStyles 의 injectSideLabelLabelAndWrapperStyles / ...AndContentStyles
 * 호출 대상)와 동일하고, DOM 도 같은 10종에만 catalog nested rule
 * (`[data-label-position="side"] > .react-aria-Label { width: var(--form-label-width,11rem) }`)
 * 을 emit 한다 — 세 지점이 같은 목록이어야 대칭이 성립한다.
 *
 * CheckboxGroup/RadioGroup 은 의도적으로 제외 — 그 패밀리는 side 에서도 라벨 자연폭을
 * 쓰기로 이미 정리됐다(implicitStyles "width 강제 없음" 주석). 라벨 박스가 텍스트 폭이면
 * 정렬은 시각적으로 무의미하므로 labelAlign 대상도 아니다.
 */
const SIDE_LABEL_COLUMN_TAGS = new Set([
  "TextField",
  "TextArea",
  "NumberField",
  "SearchField",
  "Select",
  "ComboBox",
  "DateField",
  "TimeField",
  "DatePicker",
  "DateRangePicker",
]);

/**
 * 그 중 **Form 조상에서 label 관련 prop 을 상속받는** 패밀리 (DOM 과 목록 일치 필수).
 *
 * DOM 은 `FormRenderers` 의 4종만 `element.props.X ?? inheritedProps.X`(가장 가까운 Form)
 * 로 상속하고, Date/Selection 렌더러의 6종은 자기 prop 만 쓴다. Skia 가 전 패밀리에서
 * Form 까지 올라가면 그 6종에서 DOM 에 없는 정렬이 캔버스에만 생긴다 — 렌더러별 상속 범위를
 * 그대로 복제해 둔다. (labelPosition 자체의 상속 범위 불일치는 본 축 밖 관찰 항목.)
 */
const FORM_INHERITING_FIELD_TAGS = new Set([
  "TextField",
  "TextArea",
  "NumberField",
  "SearchField",
]);

/**
 * RSP `labelAlign`(start|center|end) → Skia text shape align(left|center|right).
 *
 * **Why (2026-08-21)**: shape.align 타입은 left|center|right 뿐인데 resolveLabelAlignment 이
 * labelAlign 원문("start"/"end")을 그대로 style.textAlign 에 실어, converter 의
 * `align === "right"` 분기에 걸리지 않아 **end 정렬이 조용히 좌측으로** 그려졌다. CSS 는
 * text-align 이 start/end 를 그대로 이해하므로 DOM 만 정상 — 값 어휘 불일치가 만든 비대칭.
 */
function labelAlignToTextAlign(
  value: unknown,
): "left" | "center" | "right" | null {
  if (value === "center") return "center";
  if (value === "end") return "right";
  if (value === "start") return "left";
  return null;
}

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

/**
 * TreeItem depth(중첩 레벨) 계산 — parent 체인의 TreeItem 조상 수 + 1 (1-based).
 *
 * ADR-912 R1 후속 (TreeItem catalog cutover): DOM 은 RAC 가 `--tree-item-level` CSS
 * 변수를 자동 주입하지만 Skia 는 RAC 를 거치지 않으므로 buildSpecNodeData 가 직접 계산해
 * `_treeLevel` 로 주입한다. buildCatalogShapes 가 `paddingX + (level - 1) * indentPerLevel`
 * 로 들여쓰기를 그려 DOM `Tree.css` 와 D3 시각 대칭. nested TreeItem(TreeItem 안의 TreeItem)
 * 은 canonical element 재귀로 존재 → parent 체인을 타며 TreeItem 만 카운트(Tree 컨테이너는 제외).
 *
 * @returns 1-based level (최상위 TreeItem = 1). 무한 루프 방지 상한 32.
 */
function resolveTreeItemLevel(
  element: CanvasSceneNode,
  elementsMap: Map<string, CanvasSceneNode>,
): number {
  let level = 1;
  let currentId: string | null | undefined = element.parent_id;
  for (let guard = 0; guard < 32 && currentId; guard++) {
    const ancestor = elementsMap.get(currentId);
    if (!ancestor) break;
    if (ancestor.type === "TreeItem") {
      level++;
      currentId = ancestor.parent_id;
    } else if (ancestor.type === "Tree") {
      break; // Tree 컨테이너 도달 → 종료 (Tree 는 depth 미포함)
    } else {
      // TreeItem 조상 체인 밖 (예: Tree 가 아닌 일반 컨테이너 중첩) → 종료
      break;
    }
  }
  return level;
}

/**
 * TreeItem 행에 선택 체크박스를 그릴지 — 부모 Tree 의 selection 축에서 산출 (2026-08-21).
 *
 * DOM(`TreeItemContent`)은 RAC renderProps 로 `selectionBehavior === "toggle" &&
 * selectionMode !== "none"` 를 본다. Skia 는 RAC 를 거치지 않으므로 같은 식을 부모 Tree 의
 * props 에서 재현한다 — `selectionBehavior` 산출은 DOM 렌더러와 **같은 helper**
 * (`resolveSelectionBehavior`, fallback 도 renderTree 와 동일한 `"replace"`)를 써야
 * 두 표면의 판정이 갈리지 않는다.
 *
 * `_treeLevel` 과 같은 자리에서 주입되며, 소비는 rule 의 `selectionCheckbox.showProp` 이다
 * (generic 렌더러가 Tree 를 알 필요 없음 — ADR-142 §3).
 */
function resolveTreeSelectionCheckboxVisible(
  element: CanvasSceneNode,
  elementsMap: Map<string, CanvasSceneNode>,
): boolean {
  let currentId: string | null | undefined = element.parent_id;
  for (let guard = 0; guard < 32 && currentId; guard++) {
    const ancestor: CanvasSceneNode | undefined = elementsMap.get(currentId);
    if (!ancestor) return false;
    if (ancestor.type === "Tree") {
      const p = ancestor.props as Record<string, unknown>;
      return resolveSelectionCheckboxVisible({
        selectionMode: p.selectionMode,
        selectionStyle: p.selectionStyle,
        selectionBehavior: p.selectionBehavior,
        // renderTree 의 기본값과 동일 — 미지정 Tree 는 "single" / "replace".
        defaultSelectionMode: "single",
        // Tree.tsx 게이트 = `selectionMode !== "none"` (RAC starter 원본) → single 포함.
        checkboxModes: ["single", "multiple"],
        fallback: "replace",
      });
    }
    if (ancestor.type !== "TreeItem") return false;
    currentId = ancestor.parent_id;
  }
  return false;
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

/** ToggleButton group position + indicator mode + staticColor 상속 */
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
    density: string;
  } | null;
  indicatorMode: boolean;
  staticColor: string | null;
} {
  if (element.type !== "ToggleButton" || !element.parent_id) {
    return { position: null, indicatorMode: false, staticColor: null };
  }

  const parent = elementsMap.get(element.parent_id);
  if (!parent || parent.type !== "ToggleButtonGroup") {
    return { position: null, indicatorMode: false, staticColor: null };
  }

  const parentProps = getProps(parent);
  const orientation = (parentProps.orientation as string) || "horizontal";
  const indicatorMode = Boolean(parentProps.indicator);
  // staticColor (2026-08-21): RSP S2 ActionButtonGroup 은 staticColor 를 그룹 자체 시각이
  //   아니라 **자식 상속**으로 정의한다. 그룹의 fill 은 transparent 라 그릴 것이 없고,
  //   흑백 스킴은 자식 ToggleButton 의 bg/text/border 에서 성립한다.
  //   propagation rule(override:true, 자식 props 로 materialize)이 아니라 orientation/
  //   density 와 같은 **주입 채널**로 두는 이유: (a) 자식이 자기 staticColor 를 명시한
  //   경우를 덮어쓰지 않는다(DOM 은 context 해석에서 자식 우선 — 같은 우선순위),
  //   (b) 문서를 변형하지 않으므로 그룹 값 변경이 즉시 반영된다.
  const groupStatic = parentProps.staticColor as string | undefined;
  const staticColor =
    groupStatic && groupStatic !== "auto" ? groupStatic : null;
  // density (2026-08-21): Spectrum ActionGroup 규칙상 **연결 여부가 density 의 성질**이다
  //   (compact = 연결, regular = 분리). 코너 radius 를 산출하는 resolveSegmentedRadius 는
  //   ToggleButton 자신의 props 만 보므로, 부모의 density 를 여기서 실어 보낸다
  //   (orientation 과 같은 이유·같은 경로). 기본값은 catalog `defaultDensity` 와 같은 regular.
  const density = (parentProps.density as string) || "regular";

  const siblings = childrenMap?.get(parent.id);
  if (!siblings || siblings.length === 0) {
    return { position: null, indicatorMode, staticColor };
  }

  const index = siblings.findIndex((s) => s.id === element.id);
  if (index === -1) return { position: null, indicatorMode, staticColor };

  return {
    position: {
      orientation,
      isFirst: index === 0,
      isLast: index === siblings.length - 1,
      isOnly: siblings.length === 1,
      density,
    },
    indicatorMode,
    staticColor,
  };
}

/**
 * DateInput parent type/granularity/hourCycle/locale
 *
 * **SelectTrigger 경유 조회 (2026-07-14)**: picker(DatePicker/DateRangePicker) 는
 *   factory canonical 자식 통일(2026-06-23) 이후 `DatePicker > SelectTrigger > DateInput`
 *   구조다 — DateInput 의 **직계 부모가 SelectTrigger** 라 한 단계만 보던 기존 조회는
 *   `DATE_INPUT_PARENT_TAGS` 에 걸리지 않아 `null` 을 반환했다. 결과: **Skia 그리기 경로**의
 *   picker DateInput 에 `_parentTag/_granularity/_hourCycle/_locale` 이 전부 미주입 →
 *   escape(`datefieldSegments`)가 `_parentTag` 기본값 "DateField" 로 fallback 하여
 *   **picker 인데도 box/border 를 그리는** 분기를 탄다(SelectTrigger box 와 이중 렌더).
 *   granularity/locale 도 무시돼 시간 세그먼트/로케일 placeholder 가 반영되지 않는다.
 *   DateField/TimeField(standalone)는 직계 부모가 그대로라 기존 경로 유지.
 *
 * NOTE: **layout 경로**(implicitStyles selecttrigger 분기)는 별도로 `_locale` 을 주입하지만,
 *   DFS post-order 상 자식(DateInput)의 `enrichWithIntrinsicSize` 가 부모(SelectTrigger)의
 *   주입보다 **먼저** 실행돼 폭 측정에는 아직 반영되지 않는다 — locale 별 placeholder 폭
 *   정합은 본 수정 범위 밖(사전 존재 결함, baseline 에서도 동일).
 */
function resolveDateInputParent(
  element: CanvasSceneNode,
  elementsMap: Map<string, CanvasSceneNode>,
): Record<string, unknown> | null {
  if (element.type !== "DateInput" || !element.parent_id) return null;

  let parent = elementsMap.get(element.parent_id);
  // picker 는 SelectTrigger 래퍼를 한 단계 건너뛴다.
  if (parent?.type === "SelectTrigger" && parent.parent_id) {
    parent = elementsMap.get(parent.parent_id);
  }
  if (!parent || !DATE_INPUT_PARENT_TAGS.has(parent.type)) return null;

  const pp = getProps(parent);
  const result: Record<string, unknown> = { _parentTag: parent.type };
  if (pp.granularity != null) result._granularity = pp.granularity;
  if (pp.hourCycle != null) result._hourCycle = pp.hourCycle;
  if (pp.locale != null) result._locale = pp.locale;
  return result;
}

/**
 * DisclosureHeader → 부모 Disclosure 의 isExpanded 전파 (chevron 방향 결정).
 *
 * ADR-912 Disclosure 버그 수정 (2026-06-10): RAC 공식(react-aria.adobe.com/Disclosure)
 *   CSS 는 `&[data-expanded] svg { rotate: 90deg }` 로 chevron-right(collapsed) →
 *   90° 회전(expanded ⌄). Skia 는 transient rotate 미지원(Disclosure.spec.ts:89) →
 *   isExpanded 에 따라 leadingIcon glyph 자체를 chevron-down(expanded)/chevron-right
 *   (collapsed)로 전환한다. DisclosureHeader 자식은 isExpanded 를 자기 props 로 안 가지므로
 *   부모 Disclosure 에서 전파. leadingIcon draw fn(skiaPrimitives.ts)이 props.isExpanded 소비.
 */
function resolveDisclosureHeaderParent(
  element: CanvasSceneNode,
  elementsMap: Map<string, CanvasSceneNode>,
  childrenMap?: Map<string, CanvasSceneNode[]>,
): Record<string, unknown> | null {
  if (element.type !== "DisclosureHeader" || !element.parent_id) return null;

  const parent = elementsMap.get(element.parent_id);
  if (!parent || parent.type !== "Disclosure") return null;

  // isExpanded 기본값 true (binding default) — 명시 false 일 때만 collapsed.
  // **그룹 제약 반영 (2026-07-14)**: 조부모가 DisclosureGroup 이면 RAC 그룹 상태머신이 개별
  //   isExpanded 를 override 한다(allowsMultipleExpanded=false → 후보 중 첫 번째만 펼침).
  //   이를 모르면 그룹이 접은 Disclosure 의 chevron 이 펼침 방향으로 남아 CSS 와 발산.
  //   판정은 DOM(defaultExpandedKeys) / layout(implicitStyles) 과 **같은 SSOT helper** 경유.
  const grandParent = parent.parent_id
    ? elementsMap.get(parent.parent_id)
    : undefined;
  const groupChildren =
    grandParent?.type === "DisclosureGroup"
      ? (childrenMap?.get(grandParent.id) ??
        [...elementsMap.values()].filter((n) => n.parent_id === grandParent.id))
      : undefined;

  return {
    isExpanded: isDisclosureExpandedInContext(
      parent,
      grandParent,
      groupChildren,
    ),
  };
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

/**
 * side 라벨 컬럼 안에서의 Label 정렬 (RSP `labelAlign`).
 *
 * **nearest-wins 2축 합성**: 부모 field 의 `labelPosition`/`labelAlign` 을 먼저 읽고,
 * 그 field 가 Form 상속 패밀리(`FORM_INHERITING_FIELD_TAGS`)일 때만 조상 Form 까지 올라가
 * 비어 있는 값을 채운다 — DOM 렌더러의 `element.props.X ?? inheritedProps.X` 와 같은 규칙,
 * 같은 범위다. field 가 자기 labelAlign 만 갖고 labelPosition 은 Form 에서 받는 조합이
 * 실제 사용형이라, 한 조상에서 두 값이 **동시에** 잡혀야 했던 구 조건은 그 조합을 놓쳤다.
 *
 * 정렬은 `labelPosition === "side"` 일 때만 적용한다 — top 모드의 Label 은 자연폭
 * (fit-content, 3경로 계약)이라 정렬이 시각적으로 나타나지 않는다.
 */
function resolveLabelAlignment(
  element: CanvasSceneNode,
  elementsMap: Map<string, CanvasSceneNode>,
): "left" | "center" | "right" | null {
  if (element.type !== "Label" || !element.parent_id) return null;

  const field = elementsMap.get(element.parent_id);
  if (!field || !SIDE_LABEL_COLUMN_TAGS.has(field.type)) return null;

  const fieldProps = getProps(field);
  let labelPosition: unknown = fieldProps.labelPosition;
  let labelAlign: unknown = fieldProps.labelAlign;

  if (FORM_INHERITING_FIELD_TAGS.has(field.type)) {
    let currentId: string | null | undefined = field.parent_id;
    const visited = new Set<string>([element.id, field.id]);
    while (
      currentId &&
      (labelPosition === undefined || labelAlign === undefined)
    ) {
      if (visited.has(currentId)) break;
      visited.add(currentId);
      const ancestor = elementsMap.get(currentId);
      if (!ancestor) break;
      if (ancestor.type === "Form") {
        const pp = getProps(ancestor);
        if (labelPosition === undefined) labelPosition = pp.labelPosition;
        if (labelAlign === undefined) labelAlign = pp.labelAlign;
        break;
      }
      currentId = ancestor.parent_id;
    }
  }

  if (labelPosition !== "side") return null;
  return labelAlignToTextAlign(labelAlign);
}

// `.button-base` membership 은 catalog `structure.cssEmitMode`/`structure.buttonBase` 파생의
//   shared `usesButtonBaseUtility` 단일 진입점 — 구 로컬 `BUTTON_BASE_PARENT_TAGS` 미러
//   ("동시 갱신" 주석 의존) 는 2026-08-14 삭제. preview generic 경로와 같은 predicate 공유.

/** Button color 를 상속할 직계 자식 leaf 태그 (Text/Icon/Label). */
const BUTTON_CHILD_INHERIT_TAGS = new Set(["Text", "Icon", "Label"]);

/**
 * Button 조합 자식 color 상속 (RSP 정합, 2026-06-26) — CSS `.button-base > * { color: inherit }`
 *   (Button.css) 와 시각 대칭.
 *
 * `<Button><Icon/><Text/></Button>` 조합 시 자식 Icon/Text 는 leaf 기본 color
 *   (`{color.neutral}` = --fg)를 버리고 Button 의 variant text 색(primary→{color.base}
 *   = 흰색 등)을 상속해야 한다(검은 배경 위 흰색). RSP 는 `<Button>` color 1회 설정 →
 *   자식 텍스트/SVG(currentColor) 자동 상속.
 *
 * 반환: 부모가 button-base 이고 자식이 inherit 대상 leaf 일 때 부모 variant 의 text TokenRef
 *   (`{color.base}` 등). 그 외 null. TokenRef 그대로 반환 — `buildCatalogShapes` 의
 *   `textColor = style?.color ?? ... ?? visual.text` 가 소비(style.color 최우선) 후
 *   specShapesToSkia 가 theme 별 resolve. context-aware: standalone(부모≠button-base)은 null.
 *
 * fillStyle 분기 (2026-06-27) — `buildCatalogShapes.textColor` 와 동일 우선순위로
 *   outline→outlineText / subtle→subtleText / selected→selectedText 를 따라간다.
 *   누락 시 outline Button(투명 배경)의 자식이 `visual.text`(예: accent→흰색)를 상속해
 *   투명/밝은 배경 위 흰색으로 사라졌다(Skia↔CSS 발산, CSS 는 `--button-text` outline override
 *   로 정상). catalog `outlineText` 미정의 variant 는 `visual.text` fallback.
 */
export function resolveButtonChildColor(
  element: CanvasSceneNode,
  elementsMap: Map<string, CanvasSceneNode>,
): string | null {
  if (!BUTTON_CHILD_INHERIT_TAGS.has(element.type) || !element.parent_id) {
    return null;
  }

  const parent = elementsMap.get(element.parent_id);
  if (!parent || !usesButtonBaseUtility(parent.type)) return null;

  const parentProps = getProps(parent);
  const parentVariant = parentProps.variant as string | undefined;
  const visual = resolveSkiaVisualRule(parent.type, parentVariant);
  if (!visual) return null;

  const fillStyle = parentProps.fillStyle as string | undefined;
  const isSelected = parentProps.isSelected === true;
  const isEmphasized = parentProps.isEmphasized === true;

  // staticColor 분기 (2026-08-20 Button 채택) — buildCatalogShapes 의 static 스킴과 동일:
  //   opaque bg + fill 이면 역상(흑↔백), outline/subtle 또는 bg 시각 부재면 static 자체.
  //   CSS 는 [data-static-color] 가 --button-text 재지정 → `.button-base > * { color: inherit }`
  //   전파 — Skia 자식도 동일 값 상속. 자식 자신의 style.color 는 소비처
  //   (`textColor = style?.color ?? ...`)에서 여전히 최우선.
  const staticRaw = parentProps.staticColor as string | undefined;
  if (staticRaw === "black" || staticRaw === "white") {
    const staticHex = staticRaw === "black" ? "#000000" : "#ffffff";
    const base = visual.fill?.default?.base;
    const staticOnOpaqueBg =
      fillStyle !== "outline" &&
      fillStyle !== "subtle" &&
      base != null &&
      base !== "{color.transparent}" &&
      (visual.fill?.alpha ?? 1) !== 0;
    return staticOnOpaqueBg
      ? staticRaw === "black"
        ? "#ffffff"
        : "#000000"
      : staticHex;
  }

  // buildCatalogShapes.textColor 와 동일 분기: selected → outline → subtle → text.
  const text = isSelected
    ? isEmphasized
      ? (visual.emphasizedSelectedText ?? visual.selectedText ?? visual.text)
      : (visual.selectedText ?? visual.text)
    : fillStyle === "outline"
      ? (visual.outlineText ?? visual.text)
      : fillStyle === "subtle"
        ? (visual.subtleText ?? visual.text)
        : visual.text;
  return typeof text === "string" ? text : null;
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

/**
 * SelectIcon → parent/grandparent iconName
 *
 * ADR-102: SelectIcon — RAC 공식 미존재 composition 고유 D3 시각 element.
 *   grandparent(Select/ComboBox/NumberField/SearchField) iconName 위임.
 * (ADR-912 R1 2026-06-12: ComboBoxTrigger 는 factory retype 으로 SelectIcon 에 합류 — 조건 제거.)
 *
 * 기본값 fallback (2026-06-25): Select/ComboBox 의 SelectIcon 은 factory 에서 iconName 미지정
 *   (FormComponents 의 SearchField=search/x, NumberField=minus/plus 는 명시) → 자기/조부모
 *   iconName 모두 비면 본 함수가 null 을 반환했고, 그러면 skiaPrimitives.iconFont 의 generic
 *   fallback(`?? "circle"`)으로 떨어져 **Skia 가 동그라미(○)를 그렸다**. 반면 DOM Select 컴포넌트
 *   (packages/shared/src/components/Select.tsx:335)는 iconName 미지정 시 `chevron-down` 을 그린다
 *   → CSS↔Skia 시각 발산(사용자 보고 2026-06-25: Select/ComboBox 아이콘이 Skia 에 chevron 으로
 *   안 나옴). SelectIcon 의 보편 기본값을 DOM 과 동일하게 `chevron-down` 으로 맞춘다. 자기 또는
 *   조부모 iconName 이 있으면 그 값이 우선(사용자 설정 보존) → 본 기본값은 미설정 시에만 적용.
 */
function resolveIconDelegation(
  element: CanvasSceneNode,
  elementsMap: Map<string, CanvasSceneNode>,
): string | null {
  if (element.type !== "SelectIcon") return null;
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

  // 보편 기본값: DOM Select 의 chevron-down 과 정합 (iconFont 의 "circle" generic fallback 회피).
  // NumberField/SearchField 의 SelectIcon 은 factory 에서 자기 iconName 을 명시하므로 위 분기에서
  // 이미 반환됨 → 본 기본값은 Select/ComboBox 의 미설정 SelectIcon 에만 적용.
  return "chevron-down";
}

/**
 * InlineAlert → Heading/Description font 위임 (render-time).
 *
 * 구 StoreRenderBridge 인라인 분기 이관 (2026-08-14) — 부모→자식 위임의 거처는 registry
 * (applyParentPropagationProps) 또는 본 resolver 층 둘로 한정한다 (bridge 라우팅 함수가
 * 세 번째 레이어가 되던 것을 해소). registry rule 화하지 않는 이유: Inspector
 * buildPropagationUpdates 가 자식 store style 에 fontSize 를 기록해 시스템 주입이
 * "사용자 수정" 으로 읽히는 축이 열린다 — 렌더 시점 주입(store 미기록) 의미 보존.
 *
 * catalog `InlineAlert.sizes` 의 headingFontSize/headingFontWeight/descFontSize/
 * descFontWeight 4필드(숫자 — `.alert-heading`/desc 자식 CSS 대응) read-through.
 */
function resolveInlineAlertChildFont(
  element: CanvasSceneNode,
  elementsMap: Map<string, CanvasSceneNode>,
): { fontSize?: unknown; fontWeight?: unknown } | null {
  if (
    (element.type !== "Heading" && element.type !== "Description") ||
    !element.parent_id
  ) {
    return null;
  }
  const parent = elementsMap.get(element.parent_id);
  if (parent?.type !== "InlineAlert") return null;

  const parentSize = (getProps(parent).size as string) ?? "md";
  const rule = resolveSkiaRule("InlineAlert");
  const sizeSpec = (rule?.sizes[parentSize] ??
    rule?.sizes[rule.defaultSize ?? "md"] ??
    {}) as unknown as Record<string, unknown>;
  const isHeading = element.type === "Heading";
  return {
    fontSize: isHeading ? sizeSpec.headingFontSize : sizeSpec.descFontSize,
    fontWeight: isHeading
      ? sizeSpec.headingFontWeight
      : sizeSpec.descFontWeight,
  };
}

/**
 * Tab/TabList ← 조상 Tabs 투영 (render-time).
 *
 * ADR-912 영역 B (A): render-space projection Tab(appendTabRowProjection)은 이미
 * _isSelected/_showIndicator/(orientation 은 rowsGroup 가 담당)를 projection props 로
 * 주입받았다 → projection props 가 SSOT. 여기서 재주입(중복)을 skip 하여 단일 진입점
 * 유지. non-projection Tab/TabList(혹시 잔존)만 ancestor lookup 으로 보강.
 *
 * 반환: null = 미개입 (Tab/TabList 아님 | projection id | 조상 Tabs 없음).
 * - tabProps: Tab 한정 — _isSelected(tabId 있을 때만: selectedKey ?? defaultSelectedKey
 *   매칭, 부모 키 미설정이면 false 강제) + _showIndicator. TabList 는 빈 객체.
 * - orientation: 조상 orientation ?? "horizontal" — 호출부에서 자기 명시값 우선 게이트.
 */
function resolveTabsAncestorProjection(
  element: CanvasSceneNode,
  elementsMap: Map<string, CanvasSceneNode>,
): { tabProps: Record<string, unknown>; orientation: string } | null {
  if (element.type !== "Tab" && element.type !== "TabList") return null;
  if (isRenderProjectionId(element.id)) return null;
  const tabsAncestor = element.parent_id
    ? findAncestorByTag(element, "Tabs", elementsMap, 3)
    : undefined;
  if (!tabsAncestor) return null;

  const ap = getProps(tabsAncestor);
  const tabProps: Record<string, unknown> = {};
  if (element.type === "Tab") {
    const tabId = getProps(element).tabId as string | undefined;
    if (tabId) {
      const selectedKey =
        (ap.selectedKey as string | undefined) ??
        (ap.defaultSelectedKey as string | undefined);
      tabProps._isSelected =
        selectedKey != null ? selectedKey === tabId : false;
    }
    tabProps._showIndicator = ap.showIndicator !== false;
  }
  return {
    tabProps,
    orientation: (ap.orientation as string) ?? "horizontal",
  };
}

/**
 * Radio ← 조상 RadioGroup value 매칭 (render-time, 2026-06-30).
 *
 * **Why**: RadioGroup 의 selection SSOT 는 그룹 `value`(RAC 모델 — 자식 Radio 의
 * isSelected 는 RAC 가 안 봄). CSS preview(renderRadioGroup)는 RAC 에 `defaultValue`
 * 를 넘겨 RAC 가 value↔자식 `<Radio value>` 매칭으로 selected 를 그린다. 반면 Skia radio
 * primitive 는 `props.isSelected === true` 만 읽는데, 패널에서 RadioGroup.value 만 바꾸면
 * 자식 Radio.isSelected 는 그대로(undefined) → Skia 미선택 → CSS↔Skia drift.
 * Tabs selectedKey → Tab._isSelected 투영과 동형으로, 부모 value 를 자식 Skia
 * isSelected 로 투영해 D3 시각 대칭을 복원한다. group value 미설정 시 자식 자기
 * isSelected 보존(boolean 정규화) — 부모-주도 선택과 자식 직접 isSelected 양립.
 *
 * 반환: null = 미개입 (Radio 아님 | 조상 RadioGroup 없음).
 */
function resolveRadioGroupSelection(
  element: CanvasSceneNode,
  elementsMap: Map<string, CanvasSceneNode>,
  currentIsSelected: unknown,
): boolean | null {
  if (element.type !== "Radio") return null;
  const groupAncestor = element.parent_id
    ? findAncestorByTag(element, "RadioGroup", elementsMap, 3)
    : undefined;
  if (!groupAncestor) return null;

  const groupValue = getProps(groupAncestor).value as string | undefined;
  const radioValue = getProps(element).value as string | undefined;
  return groupValue != null && groupValue !== ""
    ? groupValue === radioValue
    : currentIsSelected === true;
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

/**
 * ADR-142 §3 — catalog cutover 된 type 의 shape 생성 dispatch.
 *
 * 정본(데이터 분기): 해당 type 의 `PrimitiveBinding.skiaPrimitive` 가 있으면(원/선/아이콘 등
 * 비-DOM-trivial primitive) 그 draw module 이 shape 를 만들고, 없으면 `buildCatalogShapes`
 * (모든 frame 공유 보편 box+text 시각)가 만든다. 컴포넌트 식별 분기를 buildCatalogShapes
 * 안에 인라인하지 않는다 — N++ 복제 방지. skiaPrimitive draw fn 은 spec.variants 에서 뽑은
 * variant + style 을 받는다(전환기엔 spec 데이터 직접 소비, 목표는 theme/tokens).
 */
function buildCatalogShapesOrPrimitive(
  type: string,
  specProps: Record<string, unknown>,
  sizeSpec: SizeSpec,
  componentState: ComponentState,
  theme: "light" | "dark",
): Shape[] {
  // ADR-142 G2(b) B: variant 색상은 rule 테이블(resolveSkiaVisualRule)에서 해소해 주입한다
  // (buildCatalogShapes / skiaPrimitive 모두 spec 미참조). variant 이름은 props 우선, 없으면
  // rule.defaultVariant. skiaPrimitive(checkbox/radio/switch)의 selected 시각도 보편 상태축
  // (visual.fill.default.selected / selectedBorder)에서 읽는다(이전 *_COLORS 상수 흡수).
  const rule = resolveSkiaRule(type);
  const variantName =
    (specProps.variant as string | undefined) ?? rule?.defaultVariant;
  const visual = resolveSkiaVisualRule(type, variantName);
  const textDecoration = rule?.textDecoration;

  // binding.skiaPrimitive 는 단일 키 또는 키 배열(overlays 는 shadow/arrow 등 복수 패턴 합성).
  const primitiveBinding = getPrimitiveBinding(type)?.skiaPrimitive;
  const primitiveKeys: string[] = primitiveBinding
    ? Array.isArray(primitiveBinding)
      ? primitiveBinding
      : [primitiveBinding]
    : [];

  // ADR-912 1B — size 시각 채널 단일 진입점 수렴: toSkiaStyle(node) 가 theme rule base
  //   (ComponentRuleSize: fontSize/borderRadius/borderWidth/height 등, token 해소됨) ⊕
  //   override(props.style) 를 merged map 으로 산출한다. 이 map 을 ctx.style 로 넘기면
  //   buildCatalogShapes 의 `style?.X ?? size.X` 산재 병합 중 **size 채널이 toSkiaStyle 단일
  //   진입점으로 수렴**한다(이전엔 size.X[sizeSpec] / style.X[override] 가 갈렸다).
  //   - **same-source**: toSkiaStyle 의 base = resolveComponentRule(type)(shared COMPONENT_RULES_TABLE),
  //     resolveSkiaRule(visual) 도 동일 table → size base 일관.
  //   - **token 이중 해소 0**: merged map 은 이미 구체값(숫자). 하류 parsePxValue/resolveSpecFontSize
  //     는 숫자 idempotent passthrough(`isFiniteNumber→return value`) → specShapesToSkia 재해소 무영향.
  //   - **색상 채널 미수렴(사용자 결정 2026-06-03)**: backgroundColor/color/borderColor 의 base 는
  //     state/selected/outline 조건 로직(stateBg/visual) — toSkiaStyle merged map 미포함(1A scope:
  //     색상 same-source 는 1A-(a) visual 경로가 이미 담당). 색상 override 만 merged map 에 들어오고,
  //     없으면 buildCatalogShapes 의 visual 조건 로직이 그대로 base 제공.
  // toSkiaStyle 은 node.type(string 으로 resolveComponentRule/getCatalogEntry 소비) + node.props
  //   만 읽는다 → CanvasSceneNode 의 type/props 를 그대로 minimal proxy 로 넘긴다. type 은
  //   CanonicalNode.type(ComponentTag literal union)과 런타임 동형 → narrow 캐스팅
  //   (resolveSkiaVisualRule.ts 의 spec↔shared TokenRef 동형 캐스팅과 같은 경계 패턴).
  const fauxNode = { id: type, type, props: specProps } as Parameters<
    typeof toSkiaStyle
  >[0];
  const mergedStyle = toSkiaStyle(fauxNode, theme);

  const ctx = {
    props: specProps,
    size: sizeSpec,
    visual,
    style: mergedStyle,
  };

  // replace 우선: 하나라도 replace 결과(non-null)를 내면 box+text 를 대체한다(기존 6 leaf
  // primitive — indicator 만 렌더). null = primitive 미적용(예: Badge non-dot) → 다음 단계.
  for (const key of primitiveKeys) {
    if (getSkiaPrimitiveMode(key) !== "replace") continue;
    const replaceShapes = getSkiaPrimitive(key)?.(ctx);
    if (replaceShapes) return replaceShapes;
  }

  // ADR-912 단계 4 C3 (text 중복 방지, shell-only 강제, 2026-06-03): SYNTHETIC 컨테이너
  //   (Select/ComboBox/Tabs/TagGroup 등 — 자식 element/projection 이 내용 담당)는 발효 시
  //   `_hasChildren` 주입이 차단(line 1110-1116)되므로 buildCatalogShapes 의 text 분기
  //   (`:171 if(text)`)가 컨테이너 노드의 value/label 을 그린다. 동시에 자식 trigger element
  //   (SelectValue/ComboBoxInput)도 같은 value text 를 그려 **중복**된다. 컨테이너는 shell
  //   (bg+border)만 그리도록 text 입력(children/text/label/placeholder)을 차단한 propsView 로 호출한다.
  //   - 판정 = `SYNTHETIC_CHILD_PROP_MERGE_TAGS` 멤버십(데이터 분기 — 컴포넌트별 if 아님).
  //     이 set 은 "자식 props 통합 또는 자식 element 가 내용 담당" = 컨테이너 text 금지 type.
  //   - buildCatalogShapes 자체는 변경 0 — text 가 undefined 면 `:171 if(text)` false → 자연히
  //     shell-only(`:169 _hasChildren` early return 과 직교, 둘 중 하나만 성립해도 shell-only).
  //   - placeholder 차단(2026-06-25): buildCatalogShapes `:217 text` 가
  //     `label || text || children || placeholder` 순으로 fallback 하므로(placeholder 는
  //     2026-06-12 R1 에서 value-empty field leaf 표시용으로 추가됨), Select/ComboBox 처럼
  //     컨테이너 자신과 자식 SelectValue 가 같은 placeholder 를 보유하면 children/text/label 만
  //     차단해도 컨테이너가 placeholder 로 text 를 그려 **중복**된다(사용자 보고 2026-06-25:
  //     placeholder 가 SelectValue 입력 영역 + 컴포넌트 자체에 이중 렌더). placeholder 도 함께
  //     undefined 처리해야 컨테이너가 순수 shell 로 떨어진다. 자식 SelectValue/ComboBoxInput 은
  //     SYNTHETIC 비멤버라 본 차단 미적용 → placeholder 정상 단일 렌더 유지.
  //   - Menu 는 발효(2026-06-04)됐으나 SYNTHETIC 아님(items SSOT, factory children:[]) → 본 차단
  //     미적용. trigger 버튼이라 text "Menu" 를 그려야 정상(Button 동형) → shellOnlyProps 제외 정합.
  const shellOnlyProps = SYNTHETIC_CHILD_PROP_MERGE_TAGS.has(type)
    ? {
        ...specProps,
        children: undefined,
        text: undefined,
        label: undefined,
        placeholder: undefined,
      }
    : specProps;

  // base box+text + prepend/append 패턴(backdrop/shadow/arrow) 합성 (ADR-142 Inc3 overlays).
  const base = buildCatalogShapes(
    visual,
    shellOnlyProps,
    sizeSpec,
    componentState,
    textDecoration,
  );
  const prepend: Shape[] = [];
  const append: Shape[] = [];
  for (const key of primitiveKeys) {
    const mode = getSkiaPrimitiveMode(key);
    if (mode === "replace") continue;
    const shapes = getSkiaPrimitive(key)?.(ctx);
    if (!shapes) continue;
    if (mode === "prepend") prepend.push(...shapes);
    else append.push(...shapes);
  }
  return composeCatalogShapes(base, prepend, append);
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
  const { element, layout, theme, childElements, elementsMap, scrollState } =
    input;
  const type = element.type;

  // ADR-912 단계 5 step 4 (TEXT_LEAF spec 삭제 후속, 2026-06-09): catalog Skia cutover type 은
  //   spec 파일이 삭제되어 getSpecForTag → null 일 수 있다. 이때도 generic 경로
  //   (buildCatalogShapesOrPrimitive)는 rule 테이블만으로 그릴 수 있으므로 spec 없이 진행한다.
  //   비-cutover(catalog 미등록 native 3종 Group/frame/Slot)는 여전히 spec.render.shapes
  //   fallback 이 유일 경로 → spec 필수. **Why**: 이전 게이트(`if (!spec) return null`)가
  //   spec 삭제된 catalog type 의 Skia 노드 생성을 차단 → 측정(specTextStyle, spec-free)은
  //   작동(크기 변함)하나 그리기 누락.
  const spec = getSpecForTag(type);
  if (!spec && !isCatalogCutover(type)) return null;

  const w = layout?.width ?? 0;
  const h = layout?.height ?? 0;

  // 엔진 미확정 + 크기 없음 → 렌더링 보류
  if (w <= 0 && h <= 0) return null;

  // ---------- variant / size spec 해석 ----------
  const props = getProps(element);
  const style = (props.style || {}) as Record<string, unknown>;

  // ---------- size source: catalog cutover 는 theme rule table, 그 외 spec.sizes ----------
  // ADR-912 1C — Button 등 catalog Skia cutover type 은 size 시각값을 **theme rule table**
  //   (resolveSkiaRule = resolveComponentRule, shared COMPONENT_RULES_TABLE)에서 가져온다.
  //   → ButtonSpec.sizes(spec seam) 의존 제거: Button 이 ButtonSpec 없이도 size 정상. paddingX
  //   포함(1C 에서 table 에 이전). 비-cutover family 는 단계 5 까지 spec.sizes 경로 유지.
  //   defaultSize 도 catalog 우선(spec.defaultSize fallback) — size 해석 전체가 table 파생.
  const catalogRule = isCatalogCutover(type)
    ? resolveSkiaRule(type)
    : undefined;
  const defaultSize = catalogRule?.defaultSize ?? spec?.defaultSize;

  // Parent-delegated size
  const delegatedSize = resolveParentDelegatedSize(element, elementsMap);
  const rawSize = (props.size as string) ?? delegatedSize ?? defaultSize;
  const size =
    element.type === "Breadcrumb"
      ? normalizeBreadcrumbRspSizeKey(rawSize)
      : rawSize;

  // catalog cutover: theme rule table size → SizeSpec 투영(ruleSizeToSizeSpec). 미존재 시
  //   spec.sizes fallback(전환 누락 안전망). 비-cutover: 기존 spec.sizes 경로.
  const catalogSize =
    catalogRule?.sizes[size] ??
    (defaultSize ? catalogRule?.sizes[defaultSize] : undefined);
  const sizeSpec = (
    catalogSize
      ? ruleSizeToSizeSpec(catalogSize)
      : spec
        ? (spec.sizes[size] ??
          (spec.defaultSize ? spec.sizes[spec.defaultSize] : undefined))
        : undefined
  ) as SizeSpec | undefined;
  if (!sizeSpec) return null;

  // ---------- flexDirection → column detection ----------
  // ADR-079 Phase 4: 블랙리스트 → 화이트리스트 전환.
  //   `rearrangeShapesForColumn` 은 Checkbox/Radio/Switch 의 indicator↔label 수직 재배치
  //   전용 후처리. 다른 column-based 컴포넌트가 `render.shapes` 에서 자체 배치를 수행하면
  //   rearrange 가 items text 를 indicator 아래로 강제 + 가운데 정렬 + maxWidth 부여하여
  //   파손. 블랙리스트 방식은 신규 column collection 추가 시 재발 위험 → 사용처 태그만 명시.
  const flexDir = (style.flexDirection as string) || "";
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
  // 그룹 staticColor 상속 — 자식 명시값(auto 아님)이 있으면 자식 우선 (DOM
  //   ToggleButtonGroupStaticColorContext 해석과 같은 규칙).
  if (
    toggleCtx.staticColor &&
    (specProps.staticColor == null || specProps.staticColor === "auto")
  ) {
    specProps = { ...specProps, staticColor: toggleCtx.staticColor };
  }

  // DateInput parent delegation
  const dateProps = resolveDateInputParent(element, elementsMap);
  if (dateProps) {
    specProps = { ...specProps, ...dateProps };
  }

  // DisclosureHeader → 부모 Disclosure isExpanded 전파 (chevron 방향).
  //   조부모가 DisclosureGroup 이면 그룹 제약(allowsMultipleExpanded) 까지 반영 → childrenMap 전달.
  const disclosureHeaderProps = resolveDisclosureHeaderParent(
    element,
    elementsMap,
    input.childrenMap,
  );
  if (disclosureHeaderProps) {
    specProps = { ...specProps, ...disclosureHeaderProps };
  }

  // ADR-912 영역 B (A): render-space projection crumb(appendBreadcrumbRowProjection)은 이미
  //   _isLast/_separator 를 projection props 로 주입받았다 → projection props 가 SSOT.
  //   여기서 element-tree sibling 기반 재주입(중복)을 skip 하여 단일 진입점 유지(Tab 패턴 동형).
  //   non-projection Breadcrumb(pre-migration 기존 문서의 자식 element)만 ancestor lookup 보강.
  const breadcrumbCtx = isRenderProjectionId(element.id)
    ? null
    : resolveBreadcrumbItemContext(element, elementsMap, input.childrenMap);
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

  // Button 조합 자식 color 상속 (RSP 정합) — CSS `.button-base > * { color: inherit }` 와 대칭.
  //   부모가 button-base 이고 자식이 Icon/Text/Label 이면 Button variant text 색 상속.
  //   사용자 명시 style.color 가 있으면 보존(?? fallback) — context-aware.
  const buttonChildColor = resolveButtonChildColor(element, elementsMap);
  if (buttonChildColor) {
    const existingStyle = (specProps.style || {}) as Record<string, unknown>;
    specProps = {
      ...specProps,
      style: {
        ...existingStyle,
        color: existingStyle.color ?? buttonChildColor,
      },
    };
  }

  // InlineAlert → Heading/Description font 위임 — 사용자 명시 style 우선 (?? fallback).
  const inlineAlertFont = resolveInlineAlertChildFont(element, elementsMap);
  if (inlineAlertFont) {
    const existingStyle = (specProps.style || {}) as Record<string, unknown>;
    specProps = {
      ...specProps,
      style: {
        ...existingStyle,
        fontSize: existingStyle.fontSize ?? inlineAlertFont.fontSize,
        fontWeight: existingStyle.fontWeight ?? inlineAlertFont.fontWeight,
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

  // SelectIcon/ComboBoxTrigger icon delegation
  const delegatedIcon = resolveIconDelegation(element, elementsMap);
  if (delegatedIcon && !specProps.iconName) {
    specProps = { ...specProps, iconName: delegatedIcon };
  }

  // 구 Slider/TagGroup 수동 전파 resolver(resolveSliderProps/resolveTagGroupAllowsRemoving/
  //   resolveTagListItemsFromParent)는 registry 중복으로 삭제 (2026-08-14) — 위
  //   applyParentPropagationProps 가 같은 규칙을 이미 적용한다: sliderPropagationRules
  //   (value/minValue/maxValue → SliderTrack) + tagGroupPropagationRules(items/variant/
  //   size/maxRows/allowsRemoving → TagList, allowsRemoving → Tag 직계+["TagList","Tag"]
  //   손자). Slider 기본값(50/0/100)은 소비처 slider_fill_bar escape 내장값과 동일해 불요,
  //   variant 전파는 Slider catalog variants:{} + SliderTrack default 단일 variant 라 사어.

  // Tab/TabList ← 조상 Tabs 투영 (_isSelected/_showIndicator/orientation)
  const tabsProjection = resolveTabsAncestorProjection(element, elementsMap);
  if (tabsProjection) {
    specProps = { ...specProps, ...tabsProjection.tabProps };
    // orientation 은 자기 명시값 우선 (Tab + TabList 모두)
    if (!specProps.orientation) {
      specProps = { ...specProps, orientation: tabsProjection.orientation };
    }
  }

  // Radio ← 조상 RadioGroup value 매칭 (isSelected)
  const radioSelection = resolveRadioGroupSelection(
    element,
    elementsMap,
    specProps.isSelected,
  );
  if (radioSelection !== null) {
    specProps = { ...specProps, isSelected: radioSelection };
  }

  // TreeItem depth(_treeLevel) + chevron 조건(_hasTreeChildren) injection — ADR-912 R1
  //   후속 (TreeItem catalog cutover).
  //   - _treeLevel: Skia 는 RAC `--tree-item-level` 을 못 쓰므로 parent 체인 depth 직접 주입.
  //     buildCatalogShapes 가 `paddingX + (_treeLevel - 1) * indentPerLevel` 로 들여쓰기.
  //   - _hasTreeChildren: 자식 TreeItem 존재 여부(chevron 표시 조건). leading_icon
  //     skiaPrimitive 가 이 신호일 때만 chevron 을 그린다(leaf TreeItem 은 chevron 없음).
  //     일반 `_hasChildren`(shell-only 신호)과 분리한다 — 자식 TreeItem 은 독립 행으로
  //     렌더되므로 부모 TreeItem 은 자식 유무와 무관하게 자기 행(chevron+label)을 그려야 한다.
  let treeItemHasChildren = false;
  if (element.type === "TreeItem") {
    treeItemHasChildren = !!(childElements && childElements.length > 0);
    specProps = {
      ...specProps,
      _treeLevel: resolveTreeItemLevel(element, elementsMap),
      _hasTreeChildren: treeItemHasChildren,
      // 선택 체크박스 가시성(2026-08-21) — DOM 은 RAC renderProps 로 같은 판정을 한다
      //   (`selectionBehavior === "toggle" && selectionMode !== "none"`). Skia 는 부모
      //   Tree 의 props 를 직접 읽어 같은 식을 재현한다. rule 의 `selectionCheckbox.showProp`
      //   이 이 값을 읽으므로, 여기서 컴포넌트를 식별하는 대신 **데이터로** 전달한다.
      _showSelectionCheckbox: resolveTreeSelectionCheckboxVisible(
        element,
        elementsMap,
      ),
    };
  }

  // _hasChildren injection
  //
  // Shell-only: factory가 자식을 자동 생성하는 complex 컴포넌트. 자식 수와
  //   무관하게 항상 주입하여 사용자가 자식을 모두 삭제해도 standalone 렌더링
  //   으로 돌아가지 않도록 한다.
  // Synthetic-merge: 자식 props를 spec shapes에 통합하므로 주입 차단
  //   (주입 시 shell만 남고 내용이 사라짐).
  // 그 외 일반 컨테이너: 자식이 있을 때만 주입.
  //
  // TreeItem 예외 (ADR-912 R1 후속): TreeItem 은 자식 TreeItem 이 있어도 자기 행
  //   (chevron+label)을 그려야 한다(자식은 독립 행). `_hasChildren=true` 면
  //   buildCatalogShapes 가 shell-only(line 186)로 떨어져 label 이 소실되므로 제외.
  //   chevron 조건은 위 `_hasTreeChildren` 으로 분리 처리.
  if (SHELL_ONLY_CONTAINER_TAGS.has(type)) {
    specProps = { ...specProps, _hasChildren: true };
  } else if (
    type !== "TreeItem" &&
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

  // ---------- component state (ADR-912 단계 3: racStateAttrs) ----------
  // RAC data-* vocabulary → ComponentState 단일 변환점(DOM/Skia state parity).
  // Breadcrumb 마지막 항목: Preview CSS와 동일 — isDisabled·부모 isDisabled와 무관하게
  //   비활성 opacity/톤 미적용 → isDisabled=false 로 평탄화(breadcrumb 예외는 builder 측 선판정).
  // 단계 3 scope: disabled 만 실효. hover/pressed/focusVisible 는 interaction threading 후속
  //   (매 pointermove 가 sceneVersion signature 유발하는 ADR-136 §9 충돌 + frame cadence 정밀화 필요).
  //   selection(props.isSelected)은 buildCatalogShapes 직교 차원 — racStateAttrs 밖.
  const isNodeDisabled = breadcrumbCtx?._isLast
    ? false
    : Boolean(
        specProps.isDisabled ||
        specProps.disabled ||
        breadcrumbCtx?._parentIsDisabled,
      );
  const componentState: ComponentState = racStateAttrs({
    isDisabled: isNodeDisabled,
  });

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

  // ---------- Background fills → catalog 배경 채널 (2026-07-15) ----------
  // canonical 1차 필드 fills 를 catalog 경로(buildCatalogShapes)의 배경 채널에 주입.
  // 우선순위: fills > style.backgroundColor — 커밋 시 sanitizeFillDerivedStylePatch 가
  //   backgroundColor 를 제거해 통상 상호배타이나, 공존 시 fills 가 이긴다 (buildCatalogShapes
  //   의 bgColor 1순위가 style.backgroundColor 이므로 여기서 덮어써 계약 고정).
  // alpha 분해: catalog 색 문자열 채널은 hex6 전용 (hex8 은 hexStringToNumber
  //   채널 시프트가 어긋남) — fillsToSkiaFillColor(alpha = hex alpha × opacity)
  //   결과를 hex6 + `_fillBgAlpha` 로 나눠 싣는다. DOM 은 fillsToCssBackgroundStyle
  //   의 rgba() 출력이 동일 합성 alpha 를 표현 (대칭).
  // 비-color fill(gradient/mesh)만 있으면 fillsToSkiaFallbackColor(첫 stop/point 색)
  //   로 주입한다 — bg box 방출(border-radius 해소)을 유도하기 위함. 실제 페인트는
  //   변환 뒤 box.fill(FillStyle) shader 가 덮으므로, 이 색은 shader 실패(이미지
  //   로딩 중 등)에만 노출된다.
  if (Array.isArray(element.fills) && element.fills.length > 0) {
    const skiaFill =
      fillsToSkiaFillColor(element.fills) ??
      fillsToSkiaFallbackColor(element.fills);
    if (skiaFill) {
      const toHexByte = (v: number): string =>
        Math.round(Math.max(0, Math.min(1, v)) * 255)
          .toString(16)
          .padStart(2, "0");
      const hex6 =
        `#${toHexByte(skiaFill[0])}${toHexByte(skiaFill[1])}${toHexByte(skiaFill[2])}`.toUpperCase();
      specProps = {
        ...specProps,
        _fillBgAlpha: skiaFill[3],
        style: {
          ...((specProps.style as Record<string, unknown> | undefined) ?? {}),
          backgroundColor: hex6,
        },
      };
    }
  }

  // ---------- shapes 생성 ----------
  // ADR-142 #5(b): catalog cutover 된 type 은 Skia generic 경로.
  // **ADR-912 단계 5 step 1/2 — 게이트 통합 (skiaLegacy 0건)**: skiaLegacy 제거로
  //   `isCatalogSkiaCutover === isCatalogCutover` (collapse). catalog cutover entry 는 전부
  //   buildCatalogShapesOrPrimitive(generic) 경로로 그려진다. Skia cutover 된 type 은
  //   binding.skiaPrimitive 유무로 갈린다(정본 — 데이터 분기, ADR-142 §3):
  //   - skiaPrimitive 있음(원/선/아이콘 등 비-DOM-trivial) → 그 draw module 이 shape 생성.
  //   - 없음 → buildCatalogShapes(모든 frame 공유 보편 box+text 시각).
  //   컴포넌트 식별 분기(isDot/divider/iconName)를 buildCatalogShapes 안에 인라인하지 않는다.
  //
  // **fallback = catalog 미등록 type 전용 경로 (단계 5 step 2, 사용자 결정 2026-06-04)**:
  //   `: spec.render.shapes(...)` 는 catalog 미등록 type 의 **유일한** Skia 렌더 경로다.
  //   ADR-912 P1-B (2026-06-17): isCatalogSkiaCutover deprecated 게이트 collapse 완료 —
  //   단일 게이트(isCatalogCutover)로 치환. 게이트 위임 동치였으므로 비동치 회귀 검출
  //   DEV warn 은 영구 dead 가 되어 제거. catalog 미등록 = native 3종(Group/frame/Slot)
  //   뿐이며, 이들만 spec.render.shapes 경로에 도달한다(frame/Slot=metadata-only native,
  //   Group=RAC ARIA semantic). catalog 등록 type 은 항상 첫 분기(usesGeneric=true).
  const usesGeneric = isCatalogCutover(type);
  // usesGeneric=false(비-cutover)면 진입 게이트(`!spec && !cutover → return`)가 spec 을 보장.
  //   타입 시스템은 이를 추론 못 하므로 `?? []` 안전망(도달 시 spec non-null).
  const shapes = usesGeneric
    ? buildCatalogShapesOrPrimitive(
        type,
        specProps,
        sizeSpec,
        componentState,
        theme,
      )
    : (spec?.render.shapes(specProps, sizeSpec, componentState) ?? []);
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

  // ---------- Background fills → bg box FillStyle (gradient/image/mesh) ----------
  // top enabled fill 이 비-color 면 box 경로(buildBoxNodeData)와 동일 계약으로 최상위
  // box 의 FillStyle 채널에 싣는다 — renderBox 가 applyFill(shader) 성공 시 fillColor
  // 를 무시하므로, 위에서 주입한 hex6 fallback 은 shader 실패 시에만 노출된다.
  // 기하(각도/center/radius)는 w × specHeight 박스 기준 — DOM CSS gradient 와 동일 기준.
  if (
    Array.isArray(element.fills) &&
    element.fills.length > 0 &&
    specNode.box
  ) {
    const fillStyle = fillsToSkiaFillStyle(element.fills, w, specHeight);
    if (fillStyle && fillStyle.type !== "color") {
      specNode.box.fill = fillStyle;
    }
  }

  // ---------- Inline CSS border overlay ----------
  applyInlineBorderOverlay(specNode, style);

  // ---------- Phantom indicator offset ----------
  applyPhantomIndicatorOffset(specNode, type, size, style, specHeight);

  // ---------- CSS effects (boxShadow / filter / opacity / backdropFilter) ----------
  // box 경로(buildBoxNodeData:68) 와 동일 파서(buildSkiaEffects)로 공급하여 D3 시각 대칭
  // 복원. boxShadow → drop-shadow, filter → blur/color-matrix, opacity, backdropFilter →
  // background-blur. renderCommands.ts:502/865 가 CMD_ELEMENT_BEGIN.effects → beginRenderEffects
  // 로 소비한다. spec/catalog 경로는 그동안 이 배선이 없어 캔버스에서 boxShadow 등이 무반응이었다.
  // transform 은 transform-origin 보정(box 경로 155-162)이 별도로 필요하고 본 배선의 대상이
  // 아니므로 제외 — effects/blendMode 만 접붙인다.
  // ADR-166 Phase 3: catalog containerStyles 에만 elevation 을 둔 컴포넌트도 포괄 (box 경로와
  //   동형 — raw props.style 우선, TokenRef 는 theme 별 rgba 로 전개).
  // ADR-166 후속: raw 도 정규화 대상(패널 프리셋 리터럴 → 현재 theme)이라 부재 조건이 아니라
  //   결과가 달라졌을 때만 갈아끼운다 (box 경로와 동일 규칙).
  const effectiveBoxShadow = resolveEffectiveBoxShadow(type, style, theme);
  const cssEffectsStyle =
    effectiveBoxShadow != null && effectiveBoxShadow !== style.boxShadow
      ? { ...style, boxShadow: effectiveBoxShadow }
      : style;
  const cssEffects = buildSkiaEffects(
    cssEffectsStyle as Parameters<typeof buildSkiaEffects>[0],
  );
  if (cssEffects.effects && cssEffects.effects.length > 0) {
    specNode.effects = [...(specNode.effects ?? []), ...cssEffects.effects];
  }
  if (cssEffects.blendMode && !specNode.blendMode) {
    specNode.blendMode = cssEffects.blendMode;
  }

  // ---------- Disabled opacity ----------
  if (componentState === "disabled") {
    // D3 정본: catalog `structure.states.disabled.opacity` (DOM generated CSS 의
    //   `[data-disabled] { opacity }` 와 동일 source — Breadcrumbs 는 1 로 dim 없음).
    //   잔존 spec 3개는 spec.states 우선. 테이블 값은 number/string("0.38") 혼재라 coerce.
    //   구 코드는 spec 만 읽어 catalog 컴포넌트 전부가 0.38 리터럴로 떨어졌다 (Breadcrumbs 발산).
    const rawOpacity =
      (spec?.states?.disabled?.opacity as number | string | undefined) ??
      (catalogRule?.structure?.states?.disabled?.opacity as
        number | string | undefined);
    const parsed =
      typeof rawOpacity === "string"
        ? Number.parseFloat(rawOpacity)
        : rawOpacity;
    const opacityVal =
      parsed != null && Number.isFinite(parsed) ? parsed : 0.38;
    // opacity 1 = 시각 no-op — effect 를 아예 얹지 않아 save layer 를 피한다 (DOM 도 dim 없음).
    if (opacityVal < 1) {
      specNode.effects = [
        ...(specNode.effects ?? []),
        { type: "opacity" as const, value: opacityVal },
      ];
    }
  }

  // ---------- Overflow: clipChildren (컨테이너 요소 자식 클리핑) ----------
  // box 경로(buildBoxNodeData:169-173)와 동일 계약. overflow hidden/clip/scroll/auto →
  // renderCommands.ts:519-536 CMD_CHILDREN_BEGIN 이 clip rect 를 적용해 요소 자식을 클리핑.
  // 아래 clipText(specNode.children 텍스트)는 spec 내부 텍스트만 자르므로 catalog 컨테이너의
  // 요소 자식 클리핑에는 이 node-level clipChildren 이 별도로 필요하다 (그동안 spec 경로에
  // 미설정이라 overflow:hidden 컨테이너의 자식이 캔버스에서 넘쳐 보였다).
  {
    // overflow 를 catalog containerStyles 에만 둔 컨테이너(Card/DisclosureGroup/Meter/
    //   ProgressBar 의 hidden · ListBox/Menu/Select/Tree 의 auto)도 clip/scrollbar 가 발화하도록
    //   catalog fallback 포괄. raw props.style 우선. type 은 이미 resolved scene tag.
    const overflow = resolveEffectiveOverflow(type, style);
    if (
      overflow === "hidden" ||
      overflow === "clip" ||
      overflow === "scroll" ||
      overflow === "auto"
    ) {
      specNode.clipChildren = true;
    }

    // ---------- Overflow: scroll (scrollOffset / scrollbar) ----------
    // box 경로(buildBoxNodeData)와 공유 helper (동일 계약). scrollState 는
    // StoreRenderBridge 가 useScrollState.scrollMap 에서 조회해 주입.
    // renderCommands 가 scrollOffset 으로 자식 좌표를 이동하고 scrollbar 를
    // 그린다. 컨테이너 폭/높이는 spec 노드 기준 (w × specHeight) — DOM
    // overflow 컨테이너와 동일 기준.
    if (scrollState && (overflow === "scroll" || overflow === "auto")) {
      const scrollFields = buildScrollNodeFields(w, specHeight, scrollState);
      specNode.scrollOffset = scrollFields.scrollOffset;
      if (scrollFields.scrollbar) specNode.scrollbar = scrollFields.scrollbar;
    }
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
  const s = phantomIndicatorSizeKey(size);
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
  // (1) border-radius inline override — 테두리(width/color) 유무와 독립.
  //     radius 단독 편집도 반영해야 한다 (기존엔 아래 width/color gate 뒤에 있어
  //     radius 단독이 무반응이었다 — catalog/box 경로는 이미 독립 반영).
  if (style.borderRadius != null) {
    if (!specNode.box) {
      specNode.box = {
        fillColor: Float32Array.of(0, 0, 0, 0),
        borderRadius: 0,
      };
    }
    specNode.box.borderRadius = parseCSSSize(
      style.borderRadius as string | number,
    );
  }

  // (2) border-style="none" — 테두리 숨김 의도(DOM border-style:none 대칭).
  //     radius 는 위에서 이미 적용됐으므로 여기서 종료.
  const borderStyle = style.borderStyle as string | undefined;
  if (borderStyle === "none") return;

  // (3) border(width+color). Phase 1 편집기 계약으로 width/color 는 항상 동반
  //     기록되므로 단독 케이스는 store 단에서 소멸하지만, 방어적으로 둘 다 유효할
  //     때만 그린다 (spec 자체 border transparent 를 회색으로 덮지 않기 위함).
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

  // box가 없으면 생성 (radius branch 에서 이미 생성됐을 수 있음)
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

  // border-style → strokeStyle. solid 는 렌더러 기본값이라 키 생략, 그 외 7종은
  //   nodeRendererBorders 가 전부 렌더(dashed/dotted/double/groove/ridge/inset/outset).
  if (borderStyle && borderStyle !== "solid") {
    specNode.box.strokeStyle = borderStyle as BorderStyleValue;
  }
}
