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
import { useRuntimeStore } from "../store";
import {
  adaptElementStyle,
  getPrimitiveBinding,
  resolveBodyArtboardStyle,
  toRacProps,
  toReactStyle,
  type EventHandlerMap,
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
  usesButtonBaseUtility,
} from "../utils/specCatalogBacked";
import {
  deriveDelegatingInternalRenderers,
  deriveDelegatingRacRenderers,
} from "./renderFacetDeclaration";
import type { ResolvedNode } from "@composition/shared";
// `../types/index` 가 shared 렌더 타입을 그대로 재수출하므로 별칭 import 와
// `as unknown as` 이중 단언이 필요 없어졌다 (ADR 없이 타입 검사만 되살아난 자리).
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
  /**
   * 가장 가까운 collection 조상 type(소문자). 비어 있으면 collection item 이 **컬렉션 밖**
   * 이라는 뜻이라 최소 호스트를 씌운다 (§ORPHAN_ITEM_HOST). 재귀 지점 **전부**에서 전달해야
   * 한 단계에서 끊기지 않는다.
   */
  collectionAncestor?: string;
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
// ADR-914 Phase 1: entryUniverseContract 가 render facet 의 internal membership 을
//   mirror 검증하도록 export (값/동작 불변, 가시성만 확장).
export const INTERNAL_RENDERERS: Readonly<
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
 *
 * ADR-914 Phase 3-A (2026-06-20): SSOT 를 `renderFacetDeclaration.ts` 로 역전했다. 기존
 * hardcoded 28종(internal 18 + rac 10) membership + 위임 사유는 declaration 으로 1:1 이전됐고,
 * 본 set 은 `deriveDelegatingInternalRenderers()` 로 파생된다 (값 byte-identical, insertion
 * order 보존 — `renderFacetDeclarationContract.test.ts` parity A 가 무손실 검증). 소비처
 * 분기 위치(L467-471)는 불변. 삭제 0 (rendererMap dead row 삭제는 dead 확증 후 별도 slice).
 */
export const DELEGATING_INTERNAL_RENDERERS: ReadonlySet<string> =
  deriveDelegatingInternalRenderers();

/**
 * ADR-912 — rac source compound 중 rendererMap self-compose 렌더러로 위임할 type 집합.
 *
 * DELEGATING_INTERNAL_RENDERERS 는 binding.source.kind==="internal" 전용인데, Slider 등은
 * source.kind==="rac" 라 그 경로를 못 탄다. RAC[component] 로 직접 렌더하면 canonical 자식
 * sub-part(SliderTrack/Output/Thumb 등)를 generic 재귀 → 소문자 raw tag 누수 + RAC 의미 깨짐.
 * render{Type} wrapper 가 자기완결 렌더하므로 rendererMap 위임 + 자식 재귀 skip 한다.
 *
 * ADR-914 Phase 3-A (2026-06-20): SSOT 를 `renderFacetDeclaration.ts` 로 역전 (위 internal
 * set 동형). membership + 위임 사유는 declaration 으로 1:1 이전, 본 set 은
 * `deriveDelegatingRacRenderers()` 파생 (값 byte-identical, parity A 검증).
 */
export const DELEGATING_RAC_RENDERERS: ReadonlySet<string> =
  deriveDelegatingRacRenderers();

/**
 * collection item type → **호스트 collection type** (orphan item 크래시 차단).
 *
 * RAC 는 collection item 을 자기 collection 안에서만 렌더할 수 있다 (D1 계약) — 밖에서 그리면
 * `"<X> cannot be rendered outside a collection"` 로 **preview 전체가 죽는다**. 그런데 컴포넌트
 * 쇼케이스 페이지는 item variant 를 **body 직계에 단독 배치**한다 (실측 `page-components`:
 * ListBoxItem ×2 / GridListItem / MenuItem). Skia 는 RAC 를 안 쓰므로 그대로 그리고 DOM 만
 * 죽어서, **D3 대칭이 "한쪽은 그림 / 한쪽은 크래시" 로 깨진다.**
 *
 * 그래서 orphan item 을 만나면 **최소 RAC collection 을 즉석에서 씌워** D1 계약을 만족시킨다.
 * 호스트는 RAC raw 를 쓴다 — composition wrapper 는 `useCollectionData` 로 데이터를 채우므로
 * 호스트 용도에 부적합하다. `display: contents` 라 박스를 만들지 않아, Skia 가 그리는 단독
 * item 과 시각 결과가 같다. **문서(데이터)는 건드리지 않는다** — 단독 배치는 쇼케이스 의도다.
 */
const ORPHAN_ITEM_HOST: Readonly<Record<string, string>> = {
  listboxitem: "ListBox",
  gridlistitem: "GridList",
  menuitem: "Menu",
  tag: "TagGroup",
  treeitem: "Tree",
};

/** 호스트가 될 수 있는 collection type(소문자) — 자손 item 은 이미 collection 안이다. */
const COLLECTION_HOST_TYPES: ReadonlySet<string> = new Set(
  Object.values(ORPHAN_ITEM_HOST).map((v) => v.toLowerCase()),
);

/** `services` 미공급(publish 등) 일 때의 안정 참조 — 매 렌더 새 객체를 만들지 않는다. */
const EMPTY_EVENT_HANDLERS: EventHandlerMap = Object.freeze({});

/**
 * orphan collection item 이면 최소 RAC collection 으로 감싼다. 아니면 그대로 통과.
 * `collectionAncestor` 가 **호스트 type 과 일치**할 때만 "안에 있다" 로 본다 — ListBox 안의
 * GridListItem 처럼 어긋난 조합은 여전히 RAC 가 거부하므로 감싸는 편이 맞다.
 */
function hostOrphanCollectionItem(
  type: string,
  collectionAncestor: string | undefined,
  rendered: React.ReactElement,
): React.ReactElement {
  const host = ORPHAN_ITEM_HOST[type.toLowerCase()];
  if (!host || collectionAncestor === host.toLowerCase()) return rendered;
  const Host = (RAC as unknown as Record<string, React.ElementType>)[host];
  if (!Host) return rendered;
  return (
    <Host aria-label={`${type} sample`} style={{ display: "contents" }}>
      {rendered}
    </Host>
  );
}

/**
 * ResolvedNode 의 복원 type 추출 (CanonicalNodeRenderer 본문 type 복원과 동일 규칙).
 *
 * `props.type` 은 element ComponentTag 가 아니라 HTML `<input type>` 속성(D2)이므로
 * type 복원에서 읽지 않는다. `node.type` 이 canonical ComponentTag SSOT.
 * (2026-06-17: TextField/Input 의 `props.type="text"` 가 element type 으로 오인되어
 *  generic fallthrough 에서 `<text>` raw tag 로 렌더되던 버그 수정.)
 */
function resolveNodeType(node: ResolvedNode): string {
  const cp = extractCanonicalPropsFromResolved(node);
  return (
    (cp._tag as string | undefined) ??
    ((node.metadata as Record<string, unknown> | undefined)?.originalTag as
      string | undefined) ??
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
          fills: child.fills,
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
/** 발화 override 병합 — `style` 만 얕게 합치고 나머지는 덮어쓴다. */
function mergeInteractionOverride(
  base: Record<string, unknown>,
  override: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!override) return base;
  const merged: Record<string, unknown> = { ...base, ...override };
  if (override.style && typeof override.style === "object") {
    merged.style = {
      ...((base.style as Record<string, unknown> | undefined) ?? {}),
      ...(override.style as Record<string, unknown>),
    };
  }
  return merged;
}

export function CanonicalNodeRenderer({
  node,
  renderContext,
  parentPath = "",
  cutoverPrimitives,
  collectionAncestor,
}: CanonicalNodeRendererProps): React.ReactElement | null {
  const currentPath = parentPath ? `${parentPath}/${node.id}` : node.id;

  // ── canonical props 추출 ──────────────────────────────────────────────────
  //
  // ADR-158 Phase 3 — 인터랙션 발화 override 를 여기서 병합한다. 이 경로는 문서
  // 노드 props 를 읽으므로 `elements` 배열 patch 로는 화면이 바뀌지 않는다
  // (실측: dispatch 는 성공하는데 display 그대로). `style` 은 통째로 갈아치우면
  // 요소가 갖고 있던 나머지 스타일이 사라지므로 얕게 병합한다.
  const canonicalProps = mergeInteractionOverride(
    extractCanonicalPropsFromResolved(node),
    useRuntimeStore((s) => s.interactionOverrides[node.id]),
  );

  // **node 로부터 props 를 읽는 모든 소비자는 이것을 쓴다.** `node` 를 직접 넘기면
  // 발화 override 가 통째로 무시되는데, 그 실수를 소비처마다 따로 저지르기 쉽다 —
  // 실제로 `toRacProps`(Modal.isOpen 무반응)와 `toReactStyle`(hide/show 무반응)에서
  // 차례로 같은 형태로 드러났다. 병합 결과가 원본과 같으면 참조를 유지해 하위
  // 비교(===)가 종전대로 동작한다.
  const renderNode: ResolvedNode =
    canonicalProps === node.props ? node : { ...node, props: canonicalProps };

  // ── type 복원 ─────────────────────────────────────────────────────────────
  // node.type 이 canonical ComponentTag SSOT (예: "TextField", "Input", "frame").
  // type 은 _tag marker → metadata.originalTag → node.type 순으로 fallback.
  // ⚠️ `props.type` 은 읽지 않는다 — element ComponentTag 가 아니라 HTML `<input type>`
  //    속성(D2)이다. (2026-06-17: TextField/Input 의 `props.type="text"` 가 element type
  //    으로 오인되어 generic fallthrough 에서 `<text>` raw tag 로 렌더되던 버그 수정.
  //    resolveNodeType 과 동일 규칙.)
  const type =
    (canonicalProps._tag as string | undefined) ??
    ((node.metadata as Record<string, unknown> | undefined)?.originalTag as
      string | undefined) ??
    String(node.type);

  // 자식에게 물려줄 collection 조상 — 자기 자신이 collection 이면 자기 type 으로 갱신.
  const nextCollectionAncestor = COLLECTION_HOST_TYPES.has(type.toLowerCase())
    ? type.toLowerCase()
    : collectionAncestor;

  // ── PreviewElement 재구성 (rendererMap 시그니처 맞춤) ────────────────────
  const elementId = node.id;

  const previewEl: PreviewElement = withFrameElementMirrorId(
    {
      id: elementId,
      type,
      props: canonicalProps as PreviewElement["props"],
      parent_id: null,
      page_id: null,
      fills: node.fills,
    },
    getFrameElementMirrorId(canonicalProps),
  );

  // fills + style 변환 (adaptElementStyle)
  const adaptedEl = adaptElementStyle(previewEl);

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
          el: PreviewElement,
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
                collectionAncestor={nextCollectionAncestor}
              />
            );
          }
          // node 트리에 없는 경우(예외) 원본 경로 fallback.
          return renderContext.renderElement(el, key);
        };
        const delegatedRenderContext: RenderContext = {
          ...renderContext,
          childrenByParent: delegatedChildrenByParent,
          renderElement: recursiveRenderElement,
        };
        return (
          <div key={node.id} {...markerProps} style={{ display: "contents" }}>
            {delegatedRenderer(adaptedEl, delegatedRenderContext)}
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
      // ADR-158 Phase 3 실측 — `node` 를 넘기면 Modal.isOpen patch 가 무반응이었다.
      const { children: racChildren, ...racRest } = toRacProps(
        renderNode,
        binding,
      );
      const childNodes = node.children ?? [];
      // ADR-912 1A-(b): catalog generic(cutover) 경로의 props.style override 상실 seam 닫기.
      // base 색/size 는 generated CSS(react-aria-{Type}[data-*])가 적용 — toReactStyle 은
      // override(props.style) 전용. data-* 변형/사이즈는 racRest(toRacProps)가 emit.
      // ADR-158 Phase 3 실측 — `node` 를 넘기면 공통 show/hide/toggle 이 무반응이었다
      // (`style.display` patch 가 여기서 버려진다).
      const resolvedStyle = toReactStyle(renderNode) as
        React.CSSProperties | undefined;
      const adaptedStyle = adaptedEl.props?.style as
        React.CSSProperties | undefined;
      const overrideStyle = adaptedStyle
        ? { ...(resolvedStyle ?? {}), ...adaptedStyle }
        : resolvedStyle;
      // ADR-913 slice 1 (2026-06-18): cssEmitMode "button-base" 컴포넌트(Button/ToggleButton/
      //   ToggleButtonGroup)는 generated CSS 가 `--button-color` 만 emit 하고 background 는
      //   `.button-base` utility 에 위임 → DOM 에 button-base 클래스 필수. toRacProps 는 className 을
      //   emit 하지 않아 RAC 가 default `react-aria-{Type}` 만 생성(button-base 누락 → background
      //   미적용 회색). RAC className prop 은 default 를 대체하므로 `react-aria-{Type} button-base`
      //   전체 명시. publish shared Button.tsx 와 정합 (cssEmitMode SSOT).
      const buttonBaseClassName = usesButtonBaseUtility(type)
        ? `react-aria-${type} button-base`
        : undefined;
      // ADR-158 Phase 3 — 인터랙션 **트리거** 배선.
      //
      // `createEventHandlerMap` 을 부르는 곳이 `rendererMap` 계열 renderer 14곳뿐이라,
      // catalog cutover 116 타입(Button/Link/Checkbox/Switch/Select/ListBox …)은 규칙을
      // 등재해도 콜백이 컴포넌트에 아예 전달되지 않았다 (실측: Link 의 RAC fiber props 에
      // `on*` 0건). 대상 축의 `accepts` 결손과 같은 형태 — 등재는 됐는데 전달 경로가 없다.
      //
      // 규칙이 없는 요소에는 동결된 빈 객체가 돌아오므로 spread 비용이 0 이고 prop 도 붙지
      // 않는다. `racRest` **뒤**에 펼친다 — 트리거 콜백이 catalog prop 에 덮이면 안 된다.
      const eventHandlers =
        renderContext.services?.createEventHandlerMap?.(
          adaptedEl,
          renderContext,
        ) ?? EMPTY_EVENT_HANDLERS;
      // 자식 element 가 있으면 그것을 렌더, 없으면 string children(racChildren). icon Button 의
      //   label 은 RSP 공식대로 `<Text>` 자식 element 로 표현되므로(ButtonChildSection 이
      //   Button.children → Text 자식 element 이관) 이 배타로 충분 — string children 은 비고
      //   `<Text>` 자식이 label 을 보유. text-only leaf(Badge/Text/Checkbox/Link…)도 동일 배타.
      return (
        <PrimitiveComponent
          key={node.id}
          {...markerProps}
          {...racRest}
          {...eventHandlers}
          {...(buttonBaseClassName ? { className: buttonBaseClassName } : {})}
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
                  collectionAncestor={nextCollectionAncestor}
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
        {hostOrphanCollectionItem(
          type,
          collectionAncestor,
          renderer(adaptedEl, renderContext) as React.ReactElement,
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
  // ADR-913 slice 1 (2026-06-18): cssEmitMode "button-base" 컴포넌트(Button/ToggleButton/
  //   ToggleButtonGroup)는 generated CSS 가 `--button-color` 만 emit 하고 background 는
  //   `.button-base` utility 에 위임 → DOM 에 `button-base` 클래스 필수. publish shared 컴포넌트는
  //   부여하나 generic Preview 렌더는 누락 → background 미적용(회색). cssEmitMode SSOT 와 정합.
  const specClassName = specBacked
    ? usesButtonBaseUtility(type)
      ? `react-aria-${type} button-base`
      : `react-aria-${type}`
    : undefined;
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

  // D3 대칭 정합: canonical body 노드를 Skia 아트보드 높이에 맞춘다(shared 단일 소스 —
  //   publish `ElementRenderer` 와 동일 로직). 근거·메커니즘은 resolveBodyArtboardStyle 참조.
  const resolvedStyle = resolveBodyArtboardStyle(
    adaptedEl.type,
    adaptedEl.props?.style as React.CSSProperties | undefined,
  );

  return React.createElement(
    resolveGenericHtmlTag(adaptedEl.type),
    {
      key: node.id,
      ...markerProps,
      style: resolvedStyle,
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
            collectionAncestor={nextCollectionAncestor}
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
    // RAC Text 기본 elementType = "span" (react-aria-components/src/Text.tsx:
    //   `let {elementType = 'span', ...domProps} = props;`). RSP S2 Text 도 RAC TextAria
    //   wrap + elementType 미지정 → 동일 span 상속. 직전 "p" 는 D1(RAC) 권위와 어긋났고
    //   `<p>` in `<button>` 은 invalid HTML(button=phrasing content only) 이었음 (2026-06-26).
    //   Description 은 별도 — slot="description" 단락 시맨틱이라 "p" 유지.
    Text: "span",
    Description: "p",
    Icon: "span",
    Group: "div",
    FormField: "div",
    FieldError: "span",
    InlineAlert: "div",
    // ADR-912 childSpec→catalog cutover (2026-06-15): Dialog 액션 영역 슬롯. 미정의 시
    //   toLowerCase fallback 이 `<dialogfooter>` raw tag(React unknown-tag 경고) → footer
    //   시맨틱 명시(선재 이슈 동시 해소). builder 메인 Preview(App.tsx resolveHtmlTag)와 일치.
    DialogFooter: "footer",
    frame: "div",
    ref: "div",
  };
  return KNOWN_HTML[type] ?? type.toLowerCase();
}
