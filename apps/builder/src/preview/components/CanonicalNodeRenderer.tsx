/**
 * @fileoverview Canonical Node Renderer — ADR-903 P2 옵션 C
 *
 * `resolveCanonicalDocument` 가 반환하는 `ResolvedNode` 트리를
 * DOM/CSS 요소로 렌더링하는 React 컴포넌트.
 *
 * 역할:
 * - ResolvedNode.props 에서 canonical props 추출
 * - canonical props 에서 type + props 복원 → 기존 rendererMap 위임
 * - 재귀 children 렌더링
 * - DOM 마커: data-canonical-id + data-element-id
 *
 * feature flag `?canonical=1` 시에만 활성화됨.
 * legacy 경로(App.tsx hybrid 분기)는 feature flag 기본 false 상태에서 무변경 보존.
 *
 * @see docs/adr/903-ref-descendants-slot-composition-format-migration-plan.md
 */

import React from "react";
import * as RAC from "react-aria-components";
import { rendererMap } from "@composition/shared/renderers";
import {
  adaptElementFillStyle,
  getPrimitiveBinding,
  toRacProps,
  toReactStyle,
} from "@composition/shared";
import { Badge } from "@composition/shared/components/Badge";
import { Calendar } from "@composition/shared/components/Calendar";
import { ComboBox } from "@composition/shared/components/ComboBox";
import { DatePicker } from "@composition/shared/components/DatePicker";
import { DateRangePicker } from "@composition/shared/components/DateRangePicker";
import { Dialog } from "@composition/shared/components/Dialog";
import { DropZone } from "@composition/shared/components/DropZone";
import { GridList } from "@composition/shared/components/GridList";
import { Icon } from "@composition/shared/components/Icon";
import { IllustratedMessage } from "@composition/shared/components/IllustratedMessage";
import { StatusLight } from "@composition/shared/components/StatusLight";
import { Avatar } from "@composition/shared/components/Avatar";
import { ProgressCircle } from "@composition/shared/components/ProgressCircle";
import { ListBox } from "@composition/shared/components/ListBox";
import { MenuButton } from "@composition/shared/components/Menu";
import { Modal } from "@composition/shared/components/Modal";
import { Breadcrumbs } from "@composition/shared/components/Breadcrumbs";
import { Popover } from "@composition/shared/components/Popover";
import { RangeCalendar } from "@composition/shared/components/RangeCalendar";
import { Select } from "@composition/shared/components/Select";
import { Skeleton } from "@composition/shared/components/Skeleton";
import Table from "@composition/shared/components/Table";
import { Tabs } from "@composition/shared/components/Tabs";
import { TagGroup } from "@composition/shared/components/TagGroup";
import { Tooltip } from "@composition/shared/components/Tooltip";
import { Tree } from "@composition/shared/components/Tree";
import {
  isSpecOrCatalogBacked,
  resolveBackedDefaultSize,
} from "../utils/specCatalogBacked";
import type { ResolvedNode } from "@composition/shared";
import type {
  RenderContext as SharedRenderContext,
  PreviewElement as SharedPreviewElement,
} from "@composition/shared/types";
import { extractCanonicalPropsFromResolved } from "../../resolvers/canonical/storeBridge";
import type { RenderContext } from "../types/index";
import type { PreviewElement } from "../types/index";
import {
  getFrameElementMirrorId,
  withFrameElementMirrorId,
} from "../../adapters/canonical/frameMirror";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CanonicalNodeRendererProps {
  /** resolve 완료된 단일 노드 */
  node: ResolvedNode;
  /** Preview RenderContext — rendererMap 위임 시 전달 */
  renderContext: RenderContext;
  /** 부모 경로 (디버그 + DOM 마커용) */
  parentPath?: string;
  /**
   * ADR-142 — catalog generic 렌더 경로로 cutover 된 component type 집합.
   * 포함된 type 은 per-component `rendererMap` 대신 `toRacProps`→RAC primitive 로 렌더.
   * 기본 미지정(undefined) → 전부 legacy `rendererMap` 경로 (live 회귀 0, G2 fallback 규율).
   * family cutover(Phase 6) 가 type 을 catalog 로 옮기면 caller 가 이 집합에 추가한다.
   */
  cutoverPrimitives?: ReadonlySet<string>;
}

/**
 * ADR-142 — internal source primitive(RAC raw 가 아닌 composition wrapper)의 DOM 렌더러.
 * `PrimitiveBinding.source.renderer` 식별자 → shared 컴포넌트.
 *
 * - leaf(Icon=Lucide SVG, Badge=styled span): RAC controller 없는 D1 탈출구.
 * - collection(ListBox/Menu/Select/ComboBox/Tabs/TagGroup/GridList, family ④): RAC raw 가 아니라
 *   composition wrapper 가 D1 담당 — wrapper 가 `useCollectionData`(dataBinding → items, ADR-132)로
 *   데이터를 채우고 RAC collection + Item 을 자체 합성한다. cutover DOM 경로가 `toRacProps` 로
 *   dataBinding 등 wrapper props 를 통과시키면 wrapper 가 items 를 렌더(자식 재귀 불필요). Skia 는
 *   skiaLegacy(render.shapes 유지) — items 순회 Skia generic 미지원(전 family 후 일괄).
 */
const INTERNAL_RENDERERS: Readonly<
  Record<string, React.ElementType | undefined>
> = {
  icon: Icon,
  badge: Badge,
  // ADR-912 단계 5 선행-1: loading placeholder internal leaf
  skeleton: Skeleton,
  // ADR-912 진로 1번: 빈 상태(empty state) internal leaf (heading/description props 직접 소비)
  illustrated: IllustratedMessage,
  // ADR-912 진로 1번: 상태 표시 dot+label internal leaf (variant/size/children props 직접 소비)
  statuslight: StatusLight,
  // ADR-912 진로 1번: 사용자 아바타 internal leaf (src/initials/size props 직접 소비, image generic 불가)
  avatar: Avatar,
  // ADR-912 진로 1번: 원형 진행률 internal leaf (value/size/isIndeterminate props 직접 소비, SVG ring generic 불가)
  progresscircle: ProgressCircle,
  // family ④ collections — composition wrapper (useCollectionData 포함)
  listbox: ListBox,
  menu: MenuButton,
  select: Select,
  combobox: ComboBox,
  tabs: Tabs,
  taggroup: TagGroup,
  gridlist: GridList,
  // ADR-912 영역 B (A): Breadcrumbs — items SSOT + crumb projection (delegating renderBreadcrumbs)
  breadcrumbs: Breadcrumbs,
  // family ⑤ Tree·Table — composition wrapper (재귀/2D collection, useCollectionData)
  tree: Tree,
  table: Table,
  // family ⑥ overlays — composition wrapper (portal/overlay, skiaLegacy)
  dialog: Dialog,
  modal: Modal,
  popover: Popover,
  tooltip: Tooltip,
  dropzone: DropZone,
  // family ⑦ date — composition wrapper (날짜 grid/portal, skiaLegacy). color 는 사용자 지시 제외.
  calendar: Calendar,
  rangecalendar: RangeCalendar,
  datepicker: DatePicker,
  daterangepicker: DateRangePicker,
};

/**
 * ADR-912 — rendererMap(element, context) 함수에 위임하는 internal renderer 키 집합.
 *
 * 이 집합의 renderer 는 자식 element-tree context(childrenByParent)가 필요한 self-compose
 * 컴포넌트라, INTERNAL_RENDERERS 의 React.ElementType + generic 자식 재귀로는 표현 불가하다.
 * cutover DOM 경로가 rendererMap[type](LayoutRenderers)로 위임하고 generic 자식 재귀는 skip한다.
 * - tabs: renderTabs (TabPanels→TabPanel itemId 페어링)
 * - progressbar: renderProgressBar (자식 Label children 추출 → 자기완결 RAC ProgressBar)
 * - meter: renderMeter (ProgressBar 동형 — 자식 Label children 추출 → 자기완결 RAC Meter)
 */
export const DELEGATING_INTERNAL_RENDERERS: ReadonlySet<string> = new Set([
  "tabs",
  "progressbar",
  "meter",
  // ADR-912 영역 B (A): breadcrumbs — renderBreadcrumbs 가 items 를 useResolvedCollectionItems
  //   로 RAC Breadcrumb/Link 합성. generic 자식 재귀(`<Breadcrumbs>{children}`)로는 빈 nav 만
  //   렌더되므로 rendererMap 위임(자식 재귀 skip). Skia 는 appendBreadcrumbRowProjection.
  "breadcrumbs",
  // ADR-912 §2-5 collapse proof (2026-06-10): disclosure — renderDisclosure 가 childrenByParent
  //   에서 자식 DisclosureHeader/Heading 의 children 을 title 로 추출 + 나머지를 contentChildren 으로
  //   분리해 RAC `<Disclosure title defaultExpanded>` self-compose(expand/collapse 동작). generic
  //   자식 재귀로는 title 추출/콘텐츠 분리가 깨지므로 rendererMap 위임(자식 재귀 skip). Skia 는
  //   SHELL_ONLY generic 빈 shell(자식 DisclosureHeader/Content 가 각자 렌더).
  "disclosure",
  // ADR-912 Disclosure 군 cutover 후속 (2026-06-10): disclosuregroup — renderDisclosureGroup 이
  //   `context.childrenByParent.get(id)` 로 자식 Disclosure 들을 받아 `<DisclosureGroup>` 안에 재귀
  //   렌더한다. INTERNAL_RENDERERS 에 "disclosuregroup" 키가 없고 generic 일반 rendererMap 위임은
  //   childrenByParent 보강(flattenNodeChildrenByParent) 없이 위임하므로, canonical 렌더 경로에서
  //   renderContext.childrenByParent 가 비어 있어 DisclosureGroup 이 자식 0개 빈 컨테이너로 렌더됐다
  //   (CSS preview 미표시). disclosure 와 동일하게 DELEGATING 등록 → flattenNodeChildrenByParent
  //   보강 위임으로 자식 Disclosure 정상 렌더. Skia 는 SHELL_ONLY generic shell(자식 각자 렌더).
  "disclosuregroup",
  // ADR-912 Disclosure 군 cutover 후속 sweep (2026-06-10): nav — renderNav 가
  //   `context.childrenByParent.get(id)` 로 자식을 받아 `<nav>` 안에 재귀 렌더한다(fallback 없음).
  //   disclosuregroup 동형 — INTERNAL_RENDERERS 미등록 + generic 위임은 childrenByParent 보강 없어
  //   canonical 경로에서 자식 0개 빈 nav 로 렌더된다. DELEGATING 등록으로 flatten 보강 위임.
  "nav",
  // ADR-912 Disclosure 군 cutover 후속 sweep (2026-06-10): disclosurecontent — renderDisclosureContent
  //   가 `childrenByParent.get(id)` 로 자식 element 를 렌더한다. props.children 텍스트 fallback 이 있어
  //   순수 텍스트 콘텐츠는 generic 위임으로도 표시되지만, **자식 element(중첩 컴포넌트)가 있으면**
  //   childrenByParent 가 비어 누락된다. 안전망 차원 DELEGATING 등록 — 텍스트만일 땐 flatten map 이
  //   비어 fallback(String(props.children)) 으로 자연 동작, 자식 element 시엔 flatten 보강으로 렌더.
  //   (부모 Disclosure(DELEGATING)의 contentChildren 재귀가 1차 경로지만, 독립 진입 시에도 안전.)
  "disclosurecontent",
  // ADR-912 6 registry collapse T1 (catalog cutover 첫 slice, 2026-06-11): field — renderDataField 가
  //   self-compose(부모 element value lookup + `childrenByParent.get(id)` 자식 렌더 + DataField label/
  //   value 합성). INTERNAL_RENDERERS 의 단순 ElementType + generic 자식 재귀로는 부모 데이터 추출/자식
  //   렌더가 깨지므로 rendererMap.Field=renderDataField 위임(자식 재귀 skip). Skia 는 shapes []→빈 노드.
  "field",
  // ADR-912 R1 Select family rebuild (2026-06-12): select / combobox — renderSelect/renderComboBox
  //   가 childrenByParent 로 SelectTrigger→SelectValue 를 찾아 자기완결 RAC `<Select>`/`<ComboBox>`
  //   self-compose. 자식(SelectTrigger/SelectValue/SelectIcon)은 spec 삭제 + catalog cutover 라
  //   generic 자식 재귀 시 `<selecttrigger>` 등 소문자 raw tag 로 떨어져 React unknown-tag 경고 +
  //   RAC controller 깨짐 → rendererMap 위임 + 자식 재귀 skip (Slider/progressbar 동형). Skia 는
  //   자식 box/text/icon_font generic 으로 자기 노드 렌더(시각 결과 대칭, 구현 비대칭 의도).
  "select",
  "combobox",
  // ADR-912 R1 후속 (TreeItem catalog cutover, 2026-06-12): tree — renderTree
  //   (CollectionRenderers.tsx)가 자식 TreeItem 을 renderTreeItemsRecursively 로 RAC
  //   `<Tree>`/`<TreeItem>` self-compose 재귀 렌더(--tree-item-level 자동 들여쓰기). 자식
  //   TreeItem 이 catalog cutover 라 generic 자식 재귀 시 `<treeitem>` 소문자 raw tag 로
  //   떨어져 React unknown-tag 경고 + RAC Tree 의미 깨짐 → rendererMap 위임 + 자식 재귀 skip
  //   (select/combobox/disclosure 동형). Skia 는 자식 TreeItem 이 box+text+chevron generic
  //   으로 자기 노드 렌더(시각 결과 대칭, 구현 비대칭 의도 — depth indent 는 _treeLevel).
  "tree",
]);

/**
 * ADR-912 — rac source compound 중 rendererMap self-compose 렌더러로 위임할 type 집합.
 *
 * DELEGATING_INTERNAL_RENDERERS 는 binding.source.kind==="internal" 전용인데, Slider 는
 * source.kind==="rac" 라 그 경로를 못 탄다. Slider(rac compound)를 RAC[component] 로 직접
 * 렌더하면 canonical 자식(SliderTrack/SliderOutput/SliderThumb)을 generic 재귀 → INTERNAL_RENDERERS
 * 미매핑 sub-part 가 `<slidertrack>`/`<slideroutput>`/`<sliderthumb>` 소문자 태그로 떨어져
 * React 경고 + RAC 의미 깨짐. renderSlider 는 Slider.tsx 로 Label/Output/Track/Thumb 자기완결
 * 렌더하므로 progressbar 와 동일하게 rendererMap 위임 + 자식 재귀 skip 한다.
 * (SliderTrack.binding 주석대로 sub-part 자식은 DOM 미도달이 설계 의도.)
 */
export const DELEGATING_RAC_RENDERERS: ReadonlySet<string> = new Set([
  "Slider",
  // ADR-912 R1 Select family rebuild (2026-06-12): NumberField / SearchField — rac source
  //   self-compose (renderNumberField/renderSearchField 가 RAC `<NumberField>`/`<SearchField>`
  //   controller 를 자기완결 렌더). 자식 SelectTrigger/SelectValue/SelectIcon 은 spec 삭제 +
  //   catalog cutover → generic 재귀 시 소문자 raw tag 로 떨어짐 → rendererMap 위임 + 자식 재귀
  //   skip (Slider 동형, SelectTrigger sub-part 는 DOM 미도달이 설계 의도).
  "NumberField",
  "SearchField",
  // ADR-912 CheckboxItems/RadioItems 폐기 후속 (2026-06-15): CheckboxGroup / RadioGroup —
  //   등록 동기가 위 Slider 군과 다르다. 자식 Checkbox/Radio 는 spec 이 살아있어 generic
  //   재귀로도 raw tag 안 떨어진다(vertical 은 generic 경로로도 그룹 자체 flex column 으로
  //   정상). 문제는 horizontal — generated CSS 가 `[data-orientation="horizontal"]
  //   .checkbox-items`/`.radio-items` wrapper 를 타겟하는데 generic 경로는 wrapper 를 합성
  //   안 하고(L452 자식 직속 재귀), toRacProps 가 orientation(kind:"enum")을 data-* 로 emit
  //   안 한다(DATA_ATTR_KINDS=variant/size/fillStyle 한정). renderCheckboxGroup/
  //   renderRadioGroup 은 `<div className="checkbox-items">`/`.radio-items` wrapper +
  //   orientation prop 전달(→ CheckboxGroup.tsx 명시 data-orientation / RadioGroup 은 RAC
  //   자동 emit)을 자기완결로 처리 → rendererMap 위임으로 vertical 보존 + horizontal 대칭.
  "CheckboxGroup",
  "RadioGroup",
]);

/**
 * ResolvedNode 의 복원 type 추출 (CanonicalNodeRenderer 본문 type 복원과 동일 규칙).
 */
function resolveNodeType(node: ResolvedNode): string {
  const cp = extractCanonicalPropsFromResolved(node);
  return (
    (cp._tag as string | undefined) ??
    (cp.type as string | undefined) ??
    ((node.metadata as Record<string, unknown> | undefined)?.originalTag as
      | string
      | undefined) ??
    String(node.type)
  );
}

/**
 * ADR-912 영역 B (Tabs 축 ① DOM): canonical node 서브트리를 `Map<parentId, PreviewElement[]>`
 * 로 평탄화. canonical 렌더 경로에서 renderContext.childrenByParent(preview elements state
 * 기반)가 비어 있어, renderTabs 가 TabPanels→TabPanel itemId 페어링을 찾도록 node 트리에서
 * 직접 childrenByParent 를 구성한다. 각 child 는 type 복원 + canonical props 추출로 PreviewElement
 * 화(renderTabs 가 읽는 id/type/props.itemId/props.style/props.className 보존).
 */
function flattenNodeChildrenByParent(
  root: ResolvedNode,
): Map<string, PreviewElement[]> {
  const map = new Map<string, PreviewElement[]>();
  const visit = (node: ResolvedNode): void => {
    const children = node.children ?? [];
    if (children.length > 0) {
      map.set(
        node.id,
        children.map((child) => ({
          id: child.id,
          type: resolveNodeType(child),
          props: extractCanonicalPropsFromResolved(
            child,
          ) as PreviewElement["props"],
          parent_id: node.id,
          page_id: null,
          fills: [],
        })),
      );
    }
    for (const child of children) visit(child);
  };
  visit(root);
  return map;
}

/**
 * ADR-912 Disclosure 군 cutover 후속 (2026-06-10): 서브트리의 id → ResolvedNode lookup.
 *
 * delegating renderer(renderDisclosureGroup 등)가 자식을 `context.renderElement(child)` 로
 * 렌더할 때, 그 자식을 다시 CanonicalNodeRenderer 로 재귀시켜 **각 자식이 자기 서브트리의
 * flattenNodeChildrenByParent 보강을 받도록** 하기 위한 매핑. childrenByParent 보강이 1단계
 * (DisclosureGroup→Disclosure)에서만 작동하고 2단계(Disclosure→Header/Content)에서 끊기던
 * 결함(그룹 내 Disclosure title="Section" fallback + panel 빈 내용)을 해소한다.
 */
function buildNodeByIdMap(root: ResolvedNode): Map<string, ResolvedNode> {
  const map = new Map<string, ResolvedNode>();
  const visit = (node: ResolvedNode): void => {
    map.set(node.id, node);
    for (const child of node.children ?? []) visit(child);
  };
  visit(root);
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// CanonicalNodeRenderer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 단일 `ResolvedNode` 를 DOM 요소로 렌더링한다.
 *
 * 렌더링 순서:
 * 1. `extractCanonicalPropsFromResolved` 로 canonical props 추출
 * 2. props 에서 `type` 복원 (metadata.type → node.type fallback)
 * 3. rendererMap 위임 (기존 shared renderer 재사용)
 * 4. rendererMap 미등록 시 generic div 렌더링 + children 재귀
 * 5. DOM 마커: `data-canonical-id` + `data-element-id`
 */
export function CanonicalNodeRenderer({
  node,
  renderContext,
  parentPath = "",
  cutoverPrimitives,
}: CanonicalNodeRendererProps): React.ReactElement | null {
  const currentPath = parentPath ? `${parentPath}/${node.id}` : node.id;

  // ── canonical props 추출 ──────────────────────────────────────────────────
  const canonicalProps = extractCanonicalPropsFromResolved(node);

  // ── type 복원 ─────────────────────────────────────────────────────────────
  // node.type 이 ComponentTag (예: "button", "text", "frame") 이므로
  // type 은 canonical props marker → metadata.originalTag → node.type 순으로 fallback
  const type =
    (canonicalProps._tag as string | undefined) ??
    (canonicalProps.type as string | undefined) ??
    ((node.metadata as Record<string, unknown> | undefined)?.originalTag as
      | string
      | undefined) ??
    String(node.type);

  // ── PreviewElement 재구성 (rendererMap 시그니처 맞춤) ────────────────────
  const elementId = node.id;

  const previewEl: PreviewElement = withFrameElementMirrorId(
    {
      id: elementId,
      type,
      props: canonicalProps as PreviewElement["props"],
      parent_id: null,
      page_id: null,
      fills: [],
    },
    getFrameElementMirrorId(canonicalProps),
  );

  // fills + style 변환 (adaptElementFillStyle)
  const adaptedEl = adaptElementFillStyle(previewEl);

  // DOM 마커 props
  const markerProps = {
    "data-canonical-id": node.id,
    "data-element-id": elementId,
  };

  // ── ADR-142: catalog generic 렌더 경로 (cutover 된 primitive 한정) ────────
  // per-component rendererMap 대신 generic toRacProps → primitive 로 렌더.
  // cutoverPrimitives 에 포함된 type 만 해당 — 미지정 시 아래 legacy 경로 보존(회귀 0).
  // source.kind 분기: rac → RAC[component] / internal → INTERNAL_RENDERERS[renderer].
  if (cutoverPrimitives?.has(type)) {
    const binding = getPrimitiveBinding(type);

    // ADR-912 — rendererMap 위임 internal renderer 집합(child element-tree context 가 필요한
    //   self-compose 컴포넌트). generic 자식 재귀(`<RAC.X>{children}`) 로는 표현 불가 →
    //   rendererMap 의 (element, context) 계약 함수에 위임한다(generic child 재귀 skip).
    //   - tabs(영역 B Tabs 축 ① DOM): renderTabs 가 childrenByParent 로 TabPanels→TabPanel itemId
    //     페어링 + Tabs.props.items 로 RACTab/RACTabPanel 합성. items 미소비 wrapper 라 generic 으로는
    //     빈 TabList 만 렌더됨.
    //   - progressbar(value-fill compound): renderProgressBar 가 childrenByParent 에서 자식 Label
    //     children 문자열만 추출 → 자기완결 RAC `<ProgressBar label value min max>` 렌더(render-prop
    //     내부 self-compose). 자식 Value/Track 은 DOM 미렌더(RAC 자체 bar). Skia 는 shell-only +
    //     자식 ProgressBarTrack value_fill_bar escape(선행-2 발효) — 시각 결과 대칭(구현 비대칭 의도).
    //   marker 는 wrapper div 보존. canonical 렌더 경로의 renderContext.childrenByParent 는
    //   preview elements state 기반이라 비어있어, canonical node 서브트리 평탄화로 보강해 전달.
    // internal self-compose(progressbar/meter/tabs/breadcrumbs) 또는 rac self-compose
    //   compound(Slider) → rendererMap 위임 + generic 자식 재귀 skip.
    const isDelegatingInternal =
      binding?.source.kind === "internal" &&
      DELEGATING_INTERNAL_RENDERERS.has(binding.source.renderer);
    const isDelegatingRac =
      binding?.source.kind === "rac" && DELEGATING_RAC_RENDERERS.has(type);
    if (isDelegatingInternal || isDelegatingRac) {
      const delegatedRenderer = rendererMap[adaptedEl.type];
      if (delegatedRenderer) {
        const delegatedChildrenByParent = flattenNodeChildrenByParent(node);
        // ADR-912 Disclosure 군 cutover 후속 (2026-06-10): child-context 재귀 전파.
        //   delegating renderer 가 자식을 `context.renderElement(child)` 로 렌더할 때, 그 자식을
        //   CanonicalNodeRenderer 로 되돌려 **각 자식이 자기 서브트리 flatten 보강을 받도록** 한다.
        //   childrenByParent 보강만으로는 1단계(부모→자식)에서만 효과 있고 2단계(자식→손주)에서
        //   끊긴다(원본 renderElement 는 보강 안 된 context 를 캡처). DisclosureGroup→Disclosure→
        //   Header/Content 의 title 추출/콘텐츠 분리가 깨지던 결함 해소(renderDisclosure 가 자기
        //   childrenByParent.get 으로 Header/Content 를 찾아야 하므로 자식도 canonical 재귀 필요).
        const nodeById = buildNodeByIdMap(node);
        const recursiveRenderElement = (
          el: SharedPreviewElement,
          key?: string,
        ): React.ReactNode => {
          const childNode = nodeById.get(el.id);
          if (childNode && childNode.id !== node.id) {
            return (
              <CanonicalNodeRenderer
                key={key ?? childNode.id}
                node={childNode}
                renderContext={renderContext}
                parentPath={currentPath}
                cutoverPrimitives={cutoverPrimitives}
              />
            );
          }
          // node 트리에 없는 경우(예외) 원본 경로 fallback.
          return (
            renderContext as unknown as SharedRenderContext
          ).renderElement(el, key);
        };
        const delegatedRenderContext = {
          ...(renderContext as unknown as SharedRenderContext),
          childrenByParent: delegatedChildrenByParent,
          renderElement: recursiveRenderElement,
        } as SharedRenderContext;
        return (
          <div key={node.id} {...markerProps} style={{ display: "contents" }}>
            {delegatedRenderer(
              adaptedEl as unknown as SharedPreviewElement,
              delegatedRenderContext,
            )}
          </div>
        );
      }
    }

    const PrimitiveComponent: React.ElementType | undefined = !binding
      ? undefined
      : binding.source.kind === "rac"
        ? (RAC as unknown as Record<string, React.ElementType | undefined>)[
            binding.source.component
          ]
        : INTERNAL_RENDERERS[binding.source.renderer];
    if (binding && PrimitiveComponent) {
      const { children: racChildren, ...racRest } = toRacProps(node, binding);
      const childNodes = node.children ?? [];
      // ADR-912 1A-(b): catalog generic(cutover) 경로의 props.style override 상실 seam 닫기.
      // base 색/size 는 generated CSS(react-aria-{Type}[data-*])가 적용 — toReactStyle 은
      // override(props.style) 전용. data-* 변형/사이즈는 racRest(toRacProps)가 emit.
      const overrideStyle = toReactStyle(node) as
        | React.CSSProperties
        | undefined;
      return (
        <PrimitiveComponent
          key={node.id}
          {...markerProps}
          {...racRest}
          style={overrideStyle}
        >
          {childNodes.length > 0
            ? childNodes.map((child) => (
                <CanonicalNodeRenderer
                  key={child.id}
                  node={child}
                  renderContext={renderContext}
                  parentPath={currentPath}
                  cutoverPrimitives={cutoverPrimitives}
                />
              ))
            : (racChildren as React.ReactNode)}
        </PrimitiveComponent>
      );
    }
  }

  // ── rendererMap 위임 ──────────────────────────────────────────────────────
  const renderer = rendererMap[adaptedEl.type];
  if (renderer) {
    // shared renderer 는 RenderContext.renderElement 를 통해 자식을 렌더링하므로
    // 여기서는 rendererMap 에 그대로 위임. DOM 마커는 wrapper div 로 감쌈.
    return (
      <div key={node.id} {...markerProps} style={{ display: "contents" }}>
        {renderer(
          adaptedEl as unknown as SharedPreviewElement,
          renderContext as unknown as SharedRenderContext,
        )}
      </div>
    );
  }

  // ── generic 렌더링 (rendererMap 미등록 태그) ─────────────────────────────
  const children = node.children ?? [];

  // spec-backed 컴포넌트(Text/Heading/Paragraph/Description 등 rendererMap 미등록 leaf)는
  // legacy App.tsx fallback 과 동일하게 `react-aria-{Type}` className + data-size/variant 를
  // 주입해야 한다. 누락 시 generated CSS selector(`.react-aria-Text[data-size="lg"]`)가
  // 매칭되지 않아 Preview 가 size/variant 변화를 전혀 반영하지 못한다(브라우저 기본 폰트 고정).
  // ADR-912 선행-6(2026-06-04): catalog 등록 type 도 spec-backed 로 간주(isSpecOrCatalogBacked).
  //   spec 삭제(step 4) 후에도 className/data-size 가 catalog 기준으로 유지되어 컴포넌트 CSS
  //   selector(generated 또는 수동 .react-aria-Label) 매칭 보존.
  const specBacked = isSpecOrCatalogBacked(type);
  const specClassName = specBacked ? `react-aria-${type}` : undefined;
  const userClassName = adaptedEl.props?.className as string | undefined;
  const mergedClassName =
    [specClassName, userClassName].filter(Boolean).join(" ") || undefined;
  const specDataAttrs: Record<string, string> = {};
  if (specBacked) {
    const sizeProp = adaptedEl.props?.size as string | undefined;
    specDataAttrs["data-size"] =
      sizeProp ?? resolveBackedDefaultSize(type) ?? "md";
    const variantProp = adaptedEl.props?.variant as string | undefined;
    if (variantProp) specDataAttrs["data-variant"] = variantProp;
    // ADR-912 InlineAlert slice (2026-06-04): catalog leaf binding 의 D1 static attr
    //   (role/aria-live 등)을 generic fallback 경로에서 부여. 컴포넌트별 if 가 아니라 binding
    //   데이터(no-classification) — RAC source 는 RAC primitive 가 role 자체 부여하지만,
    //   internal/native source(단순 styled div)는 부여처가 없어 spec.react() 의 role 이 누락된다.
    const staticAttrs = getPrimitiveBinding(type)?.staticAttrs;
    if (staticAttrs) Object.assign(specDataAttrs, staticAttrs);
  }

  return React.createElement(
    resolveGenericHtmlTag(adaptedEl.type),
    {
      key: node.id,
      ...markerProps,
      style: adaptedEl.props?.style as React.CSSProperties | undefined,
      className: mergedClassName,
      ...specDataAttrs,
    },
    children.length > 0
      ? children.map((child) => (
          <CanonicalNodeRenderer
            key={child.id}
            node={child}
            renderContext={renderContext}
            parentPath={currentPath}
            cutoverPrimitives={cutoverPrimitives}
          />
        ))
      : (adaptedEl.props?.children as React.ReactNode),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 커스텀 태그를 표준 HTML 태그로 변환한다.
 * rendererMap 미등록 태그에 대한 최소 fallback 경로.
 */
function resolveGenericHtmlTag(type: string): string {
  const KNOWN_HTML: Record<string, string> = {
    body: "div",
    Slot: "div",
    Section: "section",
    Heading: "h2",
    Text: "p",
    Description: "p",
    Icon: "span",
    Group: "div",
    FormField: "div",
    FieldError: "span",
    // ADR-912 childSpec→catalog cutover (2026-06-15): Dialog 액션 영역 슬롯. 미정의 시
    //   toLowerCase fallback 이 `<dialogfooter>` raw tag(React unknown-tag 경고) → footer
    //   시맨틱 명시(선재 이슈 동시 해소). builder 메인 Preview(App.tsx resolveHtmlTag)와 일치.
    DialogFooter: "footer",
    frame: "div",
    ref: "div",
  };
  return KNOWN_HTML[type] ?? type.toLowerCase();
}
