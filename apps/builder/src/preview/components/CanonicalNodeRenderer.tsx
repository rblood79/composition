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
import { resolveTextSourceText } from "@composition/specs";
// catalog binding 이 RAC 컴포넌트 이름을 런타임에 고른다. 서브패스 정적 import 로는 대체할 수 없다.
import * as RAC from "react-aria-components";
import { rendererMap } from "@composition/shared/renderers";
import { useRuntimeStore } from "../store";
import {
  StateInstanceContext,
  useChildStateInstanceScope,
  useStateTemplateProps,
  type StateInstanceScope,
} from "./stateTemplate";
import {
  adaptElementStyle,
  componentTypeSet,
  getPrimitiveBinding,
  isBodyType,
  resolveAuthoredAriaLabel,
  resolveAuthoredDomId,
  resolveBodyDomClassName,
  resolveBodyDomPresentation,
  resolveSectionItemKey,
  resolveStaticItemKey,
  routeIndicatorFillStyle,
  toRacProps,
  toReactStyle,
  type EventHandlerMap,
} from "@composition/shared";
import {
  isSpecOrCatalogBacked,
  resolveBackedDefaultSize,
  resolveBackedDefaultVariant,
  resolveBackedRootClassName,
  usesButtonBaseUtility,
} from "../utils/specCatalogBacked";
import {
  DELEGATING_INTERNAL_RENDERERS,
  DELEGATING_RAC_RENDERERS,
  INTERNAL_RENDERERS,
  RENDER_PROPS_INTERNAL_RENDERERS,
} from "./canonicalRendererRegistry";
import type { ResolvedNode } from "@composition/shared";
import { ListBoxItemSelectionCheck } from "@composition/shared/components/listBoxItemSlotContent";
// `../types/index` 가 shared 렌더 타입을 그대로 재수출하므로 별칭 import 와
// `as unknown as` 이중 단언이 필요 없어졌다 (ADR 없이 타입 검사만 되살아난 자리).
import { extractCanonicalPropsFromResolved } from "../../resolvers/canonical/storeBridge";
import type { RenderContext } from "../types/index";
import type { PreviewElement } from "../types/index";
import {
  getFrameElementMirrorId,
  withFrameElementMirrorId,
} from "../../adapters/canonical/frameMirror";
import { readLegacyMetadataCustomId } from "../../adapters/canonical/legacyMetadata";
import type { FillItem } from "../../types/builder/fill.types";
import { normalizePresentationSpacingStyle } from "../../builder/presentation/editorPresentationStyleNormalization";
import {
  STATE_LAYERS_PROP,
  readForcedVariantStates,
  readStateLayerProjection,
} from "../../builder/components/stateVariantLayers";
import {
  StateLayerDescendantsContext,
  applyStateLayerToDescendant,
  hasDescendantStateLayers,
  resolveStateLayerStyle,
  staticActiveVariantStates,
  toActiveVariantStates,
  toStateLayerDescendantsValue,
  type RacStateRenderProps,
} from "../utils/stateLayerRender";
import {
  resolvePresentationLayoutProps,
  resolvePresentationPaintProps,
} from "./canonicalPresentationProps";
import { resolvePresentationTextMetricProps } from "./presentationTextMetricProps";

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
  // ADR-238 Phase 2 — Components 페이지의 단독 section origin (RAC section 도 collection 밖에서 못 그린다).
  listboxsection: "ListBox",
  gridlistsection: "GridList",
  menusection: "Menu",
  listboxitem: "ListBox",
  gridlistitem: "GridList",
  menuitem: "Menu",
  tag: "TagGroup",
  treeitem: "Tree",
  // ADR-237 Phase 3 — Components 페이지의 단독 Breadcrumb 항목 origin · 변형.
  breadcrumb: "Breadcrumbs",
};

/** ADR-233 — Radio 의 그룹 조상 type (소문자). 이 조상 밑 Radio 는 호스트를 만들지 않는다. */
const RADIO_GROUP_ANCESTOR = "radiogroup";

/**
 * ADR-234 Phase 3 — 자기 collection 안에서만 RAC item 으로 그리는 internal renderer → 그 collection 조상
 * type (소문자). 밖 (Components 페이지의 단독 Tab origin · 변형) 은 종전 경로 그대로 — RAC Tabs 는 빈
 * 선택을 허용하지 않아 단독 호스트를 씌우면 휴지 변형도 선택으로 그려진다.
 */
const COLLECTION_ONLY_INTERNAL_RENDERERS: Readonly<Record<string, string>> = {
  tab: "tabs",
  tag: "taggroup",
  listboxitem: "listbox",
  gridlistitem: "gridlist",
  breadcrumb: "breadcrumbs",
};

/** ADR-234 Phase 3 — RAC key 를 `props.id` (정적 항목 key) 로 내는 항목 type. */
const STATIC_ITEM_TYPES: ReadonlySet<string> = componentTypeSet(
  "staticCollectionItem",
);

/** ADR-234 Phase 3 — slot 자식 역할을 DOM `slot` 으로 내는 collection (소문자) · 역할. */
const ITEM_SLOT_COLLECTIONS: ReadonlySet<string> = componentTypeSet(
  "itemSlotCollection",
  { lowercase: true },
);
const ITEM_SLOT_ROLES: ReadonlySet<string> = new Set([
  "icon",
  "avatar",
  "label",
  "description",
]);

/**
 * ADR-238 Phase 2 — section type (소문자) → 그 section 이 속한 collection (소문자). section 자식 (Header · 항목) 에게는
 * collection 조상으로 내린다 (단독 section origin 은 호스트가 그 collection 을 씌운다).
 */
const SECTION_COLLECTION: Readonly<Record<string, string>> = {
  listboxsection: "listbox",
  gridlistsection: "gridlist",
  menusection: "menu",
};

/** ADR-238 Phase 2 — section 이 자식 항목에게 내리는 자기 정보 (상속 항목 RAC key — `resolveSectionItemKey`). */
const CollectionSectionContext = React.createContext<{
  id: string;
  props?: Record<string, unknown> | null;
  ref?: unknown;
} | null>(null);

/** 호스트가 될 수 있는 collection type(소문자) — 자손 item 은 이미 collection 안이다. */
const COLLECTION_HOST_TYPES: ReadonlySet<string> = new Set([
  ...Object.values(ORPHAN_ITEM_HOST).map((v) => v.toLowerCase()),
  RADIO_GROUP_ANCESTOR,
  ...Object.values(COLLECTION_ONLY_INTERNAL_RENDERERS),
]);

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
  forced?: { current?: boolean } | null,
): React.ReactElement {
  const host = ORPHAN_ITEM_HOST[type.toLowerCase()];
  if (!host || collectionAncestor === host.toLowerCase()) return rendered;
  const Host = (RAC as unknown as Record<string, React.ElementType>)[host];
  if (!Host) return rendered;
  // ADR-237 Phase 3 — RAC Breadcrumbs 는 마지막 항목을 현재 (current) 로 그린다. 단독 항목 origin (링크 모양) 은
  //   숨긴 뒤 항목을 하나 더 두어 현재가 아니게 하고, 현재 변형 (`--current`) 만 마지막으로 둔다 — Skia 는 단독
  //   항목을 링크 모양으로 · 현재 변형을 현재 모양으로 그린다.
  const trailing =
    type.toLowerCase() === "breadcrumb" && forced?.current !== true ? (
      <RAC.Breadcrumb id="__orphan-next" style={{ display: "none" }} />
    ) : null;
  return (
    <Host aria-label={`${type} sample`} style={{ display: "contents" }}>
      {rendered}
      {trailing}
    </Host>
  );
}

/**
 * ADR-233 R7 (리뷰 h1) — RadioGroup 조상이 없는 Radio 를 render-only RAC `RadioGroup` 으로 감싼다.
 *
 * RAC `Radio` 는 RadioGroup 문맥이 없으면 `state.isDisabled` 를 읽다 throw 해 Preview 전체가 죽는다.
 * Components 페이지의 `component-radio` 와 상태 변형 origin 은 body 직계에 단독으로 놓인다
 * (`ORPHAN_ITEM_HOST` 와 같은 쇼케이스 배치). 선택 표현은 RAC 계약 그대로 — 호스트 `value` = 유효
 * selected (자기 `isSelected` 또는 selected 변형) 면 그 Radio 의 value, 아니면 null. 비활성은 Radio
 * 자신의 `isDisabled`. `display: contents` 라 박스를 만들지 않고, 문서 (canonical · binding) 는
 * 건드리지 않는다. Skia 는 조상이 없으면 이미 자기 상태로 그린다 (`buildSpecNodeData` F15).
 */
function hostOrphanRadio(
  type: string,
  collectionAncestor: string | undefined,
  radio: { value: unknown; isSelected: boolean },
  rendered: React.ReactElement,
): React.ReactElement {
  if (type.toLowerCase() !== "radio") return rendered;
  if (collectionAncestor === RADIO_GROUP_ANCESTOR) return rendered;
  const value = radio.value == null ? "" : String(radio.value);
  return (
    <RAC.RadioGroup
      aria-label="Radio sample"
      value={radio.isSelected ? value : null}
      style={{ display: "contents" }}
    >
      {rendered}
    </RAC.RadioGroup>
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
 * canonical 최상위 page shell 판정.
 *
 * Page는 문서에서 `frame` 또는 frame binding을 가진 `ref` 노드로 존재하지만,
 * 실제 layout box는 그 자식 `body`가 소유한다. `type === "frame"`만 보면 사용자가
 * 추가한 Frame까지 평탄화되므로 page discriminator만 사용한다.
 */
function isCanonicalPageShell(node: ResolvedNode): boolean {
  const metadataType = (node.metadata as { type?: unknown } | undefined)?.type;
  return metadataType === "page" || metadataType === "legacy-page";
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
  nodeByElement?: WeakMap<PreviewElement, ResolvedNode>,
): Map<string, PreviewElement[]> {
  const map = new Map<string, PreviewElement[]>();
  const visit = (node: ResolvedNode): void => {
    const children = node.children ?? [];
    if (children.length > 0) {
      map.set(
        node.id,
        children.map((child) => {
          const element = toFlattenedPreviewElement(child, node.id);
          nodeByElement?.set(element, child);
          return element;
        }),
      );
    }
    for (const child of children) visit(child);
  };
  visit(root);
  return map;
}

function toFlattenedPreviewElement(
  child: ResolvedNode,
  parentId: string,
): PreviewElement {
  const type = resolveNodeType(child);
  const props = extractCanonicalPropsFromResolved(child);
  // ADR-237 Phase 2 — 래퍼가 자식을 직접 RAC 로 합성하는 경로 (Menu 정적 MenuItem) 도 상태 층을 겹치도록
  //   render props → style 함수를 싣는다 (기본 style 을 안 넘기면 층 키만).
  const projection = readStateLayerProjection(props[STATE_LAYERS_PROP]);
  const forced = readForcedVariantStates(child);
  return {
    id: child.id,
    type,
    props: props as PreviewElement["props"],
    parent_id: parentId,
    page_id: null,
    fills: child.fills,
    ...(child._resolvedFrom ? { _resolvedFrom: child._resolvedFrom } : {}),
    ...(projection
      ? {
          stateStyle: (
            renderProps: Record<string, unknown>,
            baseStyle: React.CSSProperties | undefined,
          ) =>
            resolveStateLayerStyle(
              type,
              baseStyle,
              projection,
              toActiveVariantStates(renderProps as RacStateRenderProps, forced),
            ),
        }
      : {}),
  };
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
/** 실행 override 병합 — `style` 만 얕게 합치고 나머지는 덮어쓴다. */
function mergeInteractionOverride(
  base: Record<string, unknown>,
  override: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!override) return base;
  const merged: Record<string, unknown> = { ...base, ...override };
  if (override.style && typeof override.style === "object") {
    merged.style = normalizePresentationSpacingStyle({
      ...((base.style as Record<string, unknown> | undefined) ?? {}),
      ...(override.style as Record<string, unknown>),
    });
  }
  return merged;
}

function resolvePresentationFills(
  canonicalFills: ResolvedNode["fills"],
  mutations:
    | readonly import("../../builder/presentation/editorPresentationTypes").EditorMutationDescriptor[]
    | undefined,
): ResolvedNode["fills"] {
  let fills = canonicalFills;
  for (const mutation of mutations ?? []) {
    if (mutation.type === "fills.replace") {
      fills = mutation.fills as readonly FillItem[] as ResolvedNode["fills"];
    }
  }
  return fills;
}

/**
 * ADR-214 Phase 3 — 상태 instanceKey scope 를 자식에게 내려 주는 껍질. 본문은
 * `CanonicalNodeRendererBody` (재귀 지점 3곳이 모두 이 껍질을 거치므로 scope 전달이 빠지지 않는다).
 */
export function CanonicalNodeRenderer(
  props: CanonicalNodeRendererProps,
): React.ReactElement | null {
  const scope = useChildStateInstanceScope(props.node);
  return (
    <StateInstanceContext.Provider value={scope}>
      <CanonicalNodeRendererBody {...props} stateScope={scope} />
    </StateInstanceContext.Provider>
  );
}

function CanonicalNodeRendererBody({
  node,
  renderContext,
  parentPath = "",
  cutoverPrimitives,
  collectionAncestor,
  stateScope,
}: CanonicalNodeRendererProps & {
  stateScope: StateInstanceScope;
}): React.ReactElement | null {
  const currentPath = parentPath ? `${parentPath}/${node.id}` : node.id;
  // ADR-238 Phase 2 — 가장 가까운 section (있으면) — 상속 항목 RAC key 접두.
  const itemSection = React.useContext(CollectionSectionContext);
  const editorPresentation = useRuntimeStore(
    (state) => state.editorPresentationOverrides[currentPath],
  );
  // ADR-214 G3 A/B (dev 전용): `window.__composition_STATE_INDEX_OFF__` 이면 의존 인덱스를 끄고
  //   모든 노드가 모든 상태 변경에 다시 렌더한다 — 성능 계측의 대조군 (breakdown §6). production 0.
  useRuntimeStore((state) =>
    import.meta.env.DEV &&
    (window as unknown as { __composition_STATE_INDEX_OFF__?: boolean })
      .__composition_STATE_INDEX_OFF__
      ? state.runtimeStateRevision
      : 0,
  );

  // ── canonical props 추출 ──────────────────────────────────────────────────
  //
  // ADR-158 Phase 3 — 인터랙션 실행 override 를 여기서 병합한다. 이 경로는 문서
  // 노드 props 를 읽으므로 `elements` 배열 patch 로는 화면이 바뀌지 않는다
  // (실측: dispatch 는 성공하는데 display 그대로). `style` 은 통째로 갈아치우면
  // 요소가 갖고 있던 나머지 스타일이 사라지므로 얕게 병합한다.
  // ADR-214 Phase 3 — 그 다음 `{{ }}` 를 런타임 값으로 해석한다 (string prop 만, 참조 없는
  // 노드는 같은 참조). Canvas 는 같은 해석기를 기본값 환경으로 돈다 (R2).
  const templateProps = useStateTemplateProps(
    mergeInteractionOverride(
      extractCanonicalPropsFromResolved(node),
      useRuntimeStore((s) => s.interactionOverrides[node.id]),
    ),
    node,
    stateScope,
  );
  // ADR-234 Phase 2 — 조상 instance 의 켜진 상태 층이 이 자손에 patch 를 가졌으면 겹친다 (RAC render
  //   props → children 함수 → context). 층이 `enabled: false` 면 이 자손은 그리지 않는다.
  const descendantStateLayer = applyStateLayerToDescendant(
    React.useContext(StateLayerDescendantsContext),
    currentPath,
    templateProps,
  );
  const canonicalProps = descendantStateLayer.props;
  const layoutPresentationProps = resolvePresentationLayoutProps(
    resolvePresentationTextMetricProps(
      canonicalProps,
      editorPresentation?.mutations,
      resolveNodeType(node),
      (node.children?.length ?? 0) > 0,
    ),
    editorPresentation?.mutations,
    (node.children?.length ?? 0) > 0,
  );
  const presentationProps = resolvePresentationPaintProps(
    layoutPresentationProps,
    editorPresentation?.mutations,
  );

  // **node 로부터 props 를 읽는 모든 소비자는 이것을 쓴다.** `node` 를 직접 넘기면
  // 실행 override 가 통째로 무시되는데, 그 실수를 소비처마다 따로 저지르기 쉽다 —
  // 실제로 `toRacProps`(Modal.isOpen 무반응)와 `toReactStyle`(hide/show 무반응)에서
  // 차례로 같은 형태로 드러났다. 병합 결과가 원본과 같으면 참조를 유지해 하위
  // 비교(===)가 종전대로 동작한다.
  const renderNode: ResolvedNode =
    presentationProps === node.props
      ? node
      : { ...node, props: presentationProps };

  if (descendantStateLayer.hidden) return null;

  // ── type 복원 ─────────────────────────────────────────────────────────────
  // node.type 이 canonical ComponentTag SSOT (예: "TextField", "Input", "frame").
  // type 은 _tag marker → metadata.originalTag → node.type 순으로 fallback.
  // ⚠️ `props.type` 은 읽지 않는다 — element ComponentTag 가 아니라 HTML `<input type>`
  //    속성(D2)이다. (2026-06-17: TextField/Input 의 `props.type="text"` 가 element type
  //    으로 오인되어 generic fallthrough 에서 `<text>` raw tag 로 렌더되던 버그 수정.
  //    resolveNodeType 과 동일 규칙.)
  const type =
    (presentationProps._tag as string | undefined) ??
    ((node.metadata as Record<string, unknown> | undefined)?.originalTag as
      string | undefined) ??
    String(node.type);

  // 자식에게 물려줄 collection 조상 — 자기 자신이 collection 이면 자기 type 으로 갱신.
  const nextCollectionAncestor =
    SECTION_COLLECTION[type.toLowerCase()] ??
    (COLLECTION_HOST_TYPES.has(type.toLowerCase())
      ? type.toLowerCase()
      : collectionAncestor);

  // Page FrameNode/RefNode는 canonical 문서·state scope의 소유 경계이지 DOM layout
  // container가 아니다. 실제 페이지 상자는 자식 body가 소유하므로 page shell의
  // `<div class="react-aria-frame|ref">`를 만들지 않는다. 바깥
  // StateInstanceContext.Provider는 그대로 남아 page scope와 canonical path를 보존한다.
  // 사용자 Frame/reusable Frame은 metadata discriminator가 달라 아래 정상 렌더 경로를 탄다.
  if (isCanonicalPageShell(node)) {
    return (
      <>
        {(node.children ?? []).map((child) => (
          <CanonicalNodeRenderer
            key={child.id}
            node={child}
            renderContext={renderContext}
            parentPath={currentPath}
            cutoverPrimitives={cutoverPrimitives}
            collectionAncestor={nextCollectionAncestor}
          />
        ))}
      </>
    );
  }

  // ── PreviewElement 재구성 (rendererMap 시그니처 맞춤) ────────────────────
  const elementId = node.id;

  const previewEl: PreviewElement = withFrameElementMirrorId(
    {
      id: elementId,
      type,
      props: presentationProps as PreviewElement["props"],
      parent_id: null,
      page_id: null,
      fills: resolvePresentationFills(
        node.fills,
        editorPresentation?.mutations,
      ),
    },
    getFrameElementMirrorId(presentationProps),
  );

  // fills + style 변환 (adaptElementStyle)
  // ADR-214 Phase 4 — 렌더 문맥 (instanceKey 맵) 과 상태 정의를 실어 createEventHandlerMap 이
  //   setState 스코프 · 암묵 상태 미러를 만든다 (cutover · rendererMap 두 경로 공통).
  const adaptedBase = adaptElementStyle(previewEl);
  // ADR-234 Phase 2 — 상태 변형 층 (render-only, canonical 불변):
  //   - instance: `_stateLayers` projection (origin 의 변형 층 + instance 소유 키) — RAC 경로는
  //     `style` · `children` 함수가 render props 로 켜진 층을 겹친다. RAC 밖 경로는 props 의 선언적
  //     상태 (selected · disabled) 만 (Canvas 와 같은 범위).
  //   - 변형 노드 자신 · 선택 상태 origin (Components 페이지): `metadata.variant` 를 강제 상태로 —
  //     selected/disabled 는 RAC 입력에도 실어 data-selected/data-disabled 를 낸다 (Skia 동형).
  const stateLayers = readStateLayerProjection(
    (adaptedBase.props as Record<string, unknown> | undefined)?.[
      STATE_LAYERS_PROP
    ],
  );
  const forcedStates = readForcedVariantStates(node);
  const stateAdjustedProps = (() => {
    const base = (adaptedBase.props ?? {}) as Record<string, unknown>;
    if (!stateLayers && !forcedStates) return base;
    const next: Record<string, unknown> = { ...base };
    if (stateLayers) {
      delete next[STATE_LAYERS_PROP];
    }
    if (forcedStates?.selected === true) next.isSelected = true;
    if (forcedStates?.selected === false) next.isSelected = false;
    if (forcedStates?.disabled === true) next.isDisabled = true;
    // ADR-237 — 접힘 변형 노드 (Components 페이지) 는 RAC 입력도 접힘.
    if (forcedStates?.expanded === false) next.isExpanded = false;
    return next;
  })();
  const adaptedEl: PreviewElement = {
    ...adaptedBase,
    ...(stateAdjustedProps !== adaptedBase.props
      ? { props: stateAdjustedProps as PreviewElement["props"] }
      : {}),
    stateInstanceScope: stateScope.ancestorKeys,
    ...(Array.isArray(node.state) && node.state.length > 0
      ? { stateDefs: node.state }
      : {}),
  }; // RAC 밖 경로 (rendererMap 위임 · internal renderer) — render props 가 없으니 선언적 상태
  //   (selected · disabled, Canvas 와 같은 범위) 로 층을 정적으로 겹친 style 을 쓴다.
  //   위임 렌더러 중 RAC render props 를 받는 것 (Checkbox · Switch · ToggleButton) 은 `stateStyle` 함수로
  //   hover · pressed · focus 까지 겹친다 (base style 은 렌더러가 넘기던 것 그대로).
  const staticStateEl: PreviewElement = stateLayers
    ? {
        ...adaptedEl,
        props: {
          ...(adaptedEl.props ?? {}),
          style: resolveStateLayerStyle(
            type,
            adaptedEl.props?.style as React.CSSProperties | undefined,
            stateLayers,
            staticActiveVariantStates(stateAdjustedProps, forcedStates),
          ),
        } as PreviewElement["props"],
        // 렌더러는 위 정적 적용본 (`props.style`) 을 기본으로 넘긴다 — 층이 두 번 얹히지 않게 층 적용
        //   전 style 로 바꿔 쓴다 (기본을 안 넘기는 렌더러는 층 키만).
        stateStyle: (renderProps, baseStyle) =>
          resolveStateLayerStyle(
            type,
            baseStyle === undefined
              ? undefined
              : (adaptedEl.props?.style as React.CSSProperties | undefined),
            stateLayers,
            toActiveVariantStates(
              renderProps as RacStateRenderProps,
              forcedStates,
            ),
          ),
      }
    : adaptedEl;

  // DOM 마커 props
  const markerProps = {
    "data-canonical-id": node.id,
    "data-element-id": elementId,
  };
  // ADR-234 Phase 3 — 목록 항목 (ListBoxItem · GridListItem · MenuItem · Tag) 의 slot 자식은 역할을 DOM `slot`
  //   으로 낸다 — 항목 CSS (`ListBox.css` `[slot="label"]` · `[slot="icon"]` · `TagGroup.css` leading 슬롯) 가 이관 전
  //   행 (`renderListBoxItemSlotContent` 의 `slot` 속성 · chip `.tag-leading-*`) 과 같은 규칙으로 닿는다.
  const itemSlotRole = (node.props as Record<string, unknown> | undefined)
    ?.slot;
  const itemSlotAttr =
    collectionAncestor !== undefined &&
    ITEM_SLOT_COLLECTIONS.has(collectionAncestor) &&
    typeof itemSlotRole === "string" &&
    ITEM_SLOT_ROLES.has(itemSlotRole)
      ? { slot: itemSlotRole }
      : {};

  // 사용자가 지정한 id (Properties > Attributes) — publish `ElementRenderer` 와 같은 규칙으로
  // DOM 에 싣는다. canonical 노드에서 customId 는 legacy metadata 에 격리돼 있고(props 아님),
  // 같은 파일이 이미 metadata.originalTag 를 읽는 것과 동일 층위의 식별자 읽기다.
  const authoredCustomId = readLegacyMetadataCustomId(node.metadata);

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
        // 요소 → 해석 노드는 **객체 동일성** 으로 먼저 잇는다. 해석 노드 id 는 instance 안에서 로컬
        //   (같은 origin 의 instance 두 개 = `component-checkbox__1` ×2) 이라 id map 은 마지막 것으로 덮인다 —
        //   CheckboxGroup 의 두 Checkbox 가 둘 다 마지막 Label 글자를 그렸다 (2026-09-24 Compare Mode 실측).
        //   renderer 가 요소를 복제해 넘기면 id map 폴백.
        const nodeByElement = new WeakMap<PreviewElement, ResolvedNode>();
        const delegatedChildrenByParent = flattenNodeChildrenByParent(
          node,
          nodeByElement,
        );
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
          const childNode = nodeByElement.get(el) ?? nodeById.get(el.id);
          if (childNode && childNode !== node) {
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
          // ADR-234 Phase 3 — 정적 목록 항목도 같은 재귀 (Tab → catalog internal `tab` = RAC Tab).
          renderCollectionItem: recursiveRenderElement,
          // ADR-233 round 3 m2 — Tab 항목 template 은 이 Tabs 의 slot 으로 (문서 전역 1개가 아니다).
          ...(type === "Tabs" && renderContext.resolveTabTemplate
            ? { tabTemplate: renderContext.resolveTabTemplate(node) }
            : {}),
          // ADR-162 Phase 1 — GridList 데이터 카드의 항목 origin 도 이 GridList 의 slot 으로 (Canvas
          //   `resolveGridListTemplateOriginId` 와 같은 규칙).
          ...(type === "GridList" && renderContext.resolveGridListTemplate
            ? {
                gridListTemplateSlotComposition:
                  renderContext.resolveGridListTemplate(node),
              }
            : {}),
        };
        return (
          <div key={node.id} {...markerProps} style={{ display: "contents" }}>
            {delegatedRenderer(staticStateEl, delegatedRenderContext)}
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
        : COLLECTION_ONLY_INTERNAL_RENDERERS[binding.source.renderer] !==
              undefined &&
            COLLECTION_ONLY_INTERNAL_RENDERERS[binding.source.renderer] !==
              collectionAncestor
          ? undefined
          : INTERNAL_RENDERERS[binding.source.renderer];
    if (binding && PrimitiveComponent) {
      // ADR-158 Phase 3 실측 — `node` 를 넘기면 Modal.isOpen patch 가 무반응이었다.
      // ADR-233 — 변형 origin 자신 (`metadata.variant`) 의 상태 prop (isSelected · isDisabled) 도
      //   RAC 입력에 싣는다 (ADR-230 계약: 캔버스처럼 변형 = 상태). 종전엔 `stateAdjustedProps` 가
      //   rendererMap 위임 경로에만 닿아 catalog 경로의 Disabled 변형이 data-disabled 를 못 냈다.
      const racSourceNode: ResolvedNode = forcedStates
        ? {
            ...renderNode,
            props: {
              ...(renderNode.props ?? {}),
              ...(stateAdjustedProps.isSelected === true
                ? { isSelected: true }
                : {}),
              ...(forcedStates?.selected === false
                ? { isSelected: false }
                : {}),
              ...(stateAdjustedProps.isDisabled === true
                ? { isDisabled: true }
                : {}),
            },
          }
        : renderNode;
      const { children: racChildren, ...racRest } = toRacProps(
        racSourceNode,
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
      // ADR-233 round 3 h1 — 선택 표시 컴포넌트 (Radio) 의 채움은 행 배경이 아니라 선택 표시 색
      //   (catalog `fill.selected` · Skia `radio` primitive 와 같은 곳). shared 표 하나가 정한다.
      const overrideStyle = routeIndicatorFillStyle(
        type,
        adaptedStyle
          ? { ...(resolvedStyle ?? {}), ...adaptedStyle }
          : resolvedStyle,
      );
      // ADR-913 slice 1 (2026-06-18): cssEmitMode "button-base" 컴포넌트(Button/ToggleButton/
      //   ToggleButtonGroup)는 generated CSS 가 `--button-color` 만 emit 하고 background 는
      //   `.button-base` utility 에 위임 → DOM 에 button-base 클래스 필수. toRacProps 는 className 을
      //   emit 하지 않아 RAC 가 default `react-aria-{Type}` 만 생성(button-base 누락 → background
      //   미적용 회색). RAC className prop 은 default 를 대체하므로 `react-aria-{Type} button-base`
      //   전체 명시. publish shared Button.tsx 와 정합 (cssEmitMode SSOT).
      const buttonBaseClassName = usesButtonBaseUtility(type)
        ? `react-aria-${type} button-base`
        : undefined;
      // 사용자가 지정한 class (Properties > Attributes) 를 실는다. `toRacProps` 는 accepts 계약만
      //   투영하므로 className 이 여기서 유실됐다 — publish 는 props 를 그대로 spread 해 실리는데
      //   Preview 만 빠져 두 consumer 가 비대칭이었다 (2026-08-29 실측: publish
      //   `react-aria-Button button-base hero-cta` ↔ preview `react-aria-Button button-base`).
      //   RAC className prop 은 default 를 대체하므로 base 클래스를 함께 명시한다. internal source
      //   (self-compose 렌더러)는 자체 root 클래스 규약이 있어 대상에서 제외 — 종전 동작 유지.
      const authoredClassName = adaptedEl.props?.className as
        string | undefined;
      // rac source 는 RAC 가 default className 을 **대체**하므로 base 를 함께 명시하고,
      //   internal source(composition wrapper)는 자기 root 에서 base 를 합성하므로
      //   (`react-aria-X ${className}` — Badge/Icon/ListBox/Table/Dialog… 전수 확인)
      //   사용자 class 만 그대로 넘긴다. base 를 여기서 덧붙이면 wrapper 가 중복 부여한다.
      const cutoverClassName = authoredClassName
        ? binding.source.kind === "rac"
          ? [
              buttonBaseClassName ?? `react-aria-${binding.source.component}`,
              authoredClassName,
            ].join(" ")
          : authoredClassName
        : buttonBaseClassName;
      // ADR-158 Phase 3 — 인터랙션 **트리거** 배선.
      //
      // `createEventHandlerMap` 을 부르는 곳이 `rendererMap` 계열 renderer 14곳뿐이라,
      // catalog cutover 116 타입(Button/Link/Checkbox/Switch/Select/ListBox …)은 규칙을
      // 등재해도 콜백이 컴포넌트에 아예 전달되지 않았다 (실측: Link 의 RAC fiber props 에
      // `on*` 0건). 대상 축의 `accepts` 결손과 같은 형태 — 등재는 됐는데 전달 경로가 없다.
      //
      // 규칙이 없는 요소에는 동결된 빈 객체가 돌아오므로 spread 비용이 0 이고 prop 도 붙지
      // 않는다. `racRest` **뒤**에 펼친다 — 트리거 콜백이 catalog prop 에 덮이면 안 된다.
      // ADR-214 Phase 4 — setState 규칙의 요소 변수 스코프 (instanceKey) 는 이 노드의 렌더 문맥
      // ADR-234 Phase 2 — 상태 변형 층. RAC 는 render props 로 켜진 상태를 알려 준다: root 는 `style`
      //   함수, 자손은 `children` 함수 → context. internal renderer 는 render props 가 없어 선언적
      //   상태 (selected · disabled) 로 정적 적용.
      const isRacSource =
        binding.source.kind === "rac" ||
        RENDER_PROPS_INTERNAL_RENDERERS.has(binding.source.renderer);
      const racStateStyle:
        | React.CSSProperties
        | ((
            renderProps: RacStateRenderProps,
          ) => React.CSSProperties | undefined)
        | undefined = !stateLayers
        ? overrideStyle
        : isRacSource
          ? (renderProps: RacStateRenderProps) =>
              resolveStateLayerStyle(
                type,
                overrideStyle,
                stateLayers,
                toActiveVariantStates(renderProps, forcedStates),
              )
          : resolveStateLayerStyle(
              type,
              overrideStyle,
              stateLayers,
              staticActiveVariantStates(stateAdjustedProps, forcedStates),
            );
      const childContent: React.ReactNode =
        childNodes.length > 0
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
          : (racChildren as React.ReactNode);
      const racStateChildren =
        stateLayers &&
        isRacSource &&
        childNodes.length > 0 &&
        hasDescendantStateLayers(stateLayers)
          ? (renderProps: RacStateRenderProps) => (
              <StateLayerDescendantsContext.Provider
                value={toStateLayerDescendantsValue(
                  currentPath,
                  stateLayers,
                  toActiveVariantStates(renderProps, forcedStates),
                )}
              >
                {childContent}
              </StateLayerDescendantsContext.Provider>
            )
          : childContent;
      // ADR-234 Phase 3 — 정적 ListBoxItem 은 이관 전 행처럼 선택 시 우측 체크 (조합 자식이 아닌 render-time
      //   표시, ADR-147). Skia `listbox_item` shell 이 `isSelected` 로 같은 체크를 그린다.
      const itemChildren =
        type === "ListBoxItem" && collectionAncestor === "listbox"
          ? (renderProps: RacStateRenderProps) => (
              <>
                {typeof racStateChildren === "function"
                  ? racStateChildren(renderProps)
                  : racStateChildren}
                {renderProps.isSelected ? <ListBoxItemSelectionCheck /> : null}
              </>
            )
          : racStateChildren;
      const eventHandlers =
        renderContext.services?.createEventHandlerMap?.(
          adaptedEl,
          renderContext,
        ) ?? EMPTY_EVENT_HANDLERS;
      // 자식 element 가 있으면 그것을 렌더, 없으면 string children(racChildren). icon Button 의
      //   label 은 RSP 공식대로 `<Text>` 자식 element 로 표현되므로(ButtonChildSection 이
      //   Button.children → Text 자식 element 이관) 이 배타로 충분 — string children 은 비고
      //   `<Text>` 자식이 label 을 보유. text-only leaf(Badge/Text/Checkbox/Link…)도 동일 배타.
      // ADR-238 Phase 2 — GridList 안의 Header 는 RAC `GridListHeader` (RAC 가 GridList collection 에서 요구).
      const RenderedComponent =
        type === "Header" && collectionAncestor === "gridlist"
          ? (RAC.GridListHeader as React.ElementType)
          : PrimitiveComponent;
      // ADR-238 Phase 2 — section 은 자식 항목에게 자기 정보를 내리고 (상속 항목 key), 단독 (Components 페이지)
      //   이면 그 collection 호스트를 씌운다.
      const isSection = SECTION_COLLECTION[type.toLowerCase()] !== undefined;
      const sectionValue = {
        id: node.id,
        props: adaptedEl.props as Record<string, unknown> | undefined,
        ref: node._resolvedFrom,
      };
      const sectionChildren = !isSection ? null : typeof itemChildren ===
        "function" ? (
        (renderProps: RacStateRenderProps) => (
          <CollectionSectionContext.Provider value={sectionValue}>
            {itemChildren(renderProps)}
          </CollectionSectionContext.Provider>
        )
      ) : (
        <CollectionSectionContext.Provider value={sectionValue}>
          {itemChildren as React.ReactNode}
        </CollectionSectionContext.Provider>
      );
      const primitive = hostOrphanRadio(
        type,
        collectionAncestor,
        {
          value: stateAdjustedProps.value,
          isSelected: stateAdjustedProps.isSelected === true,
        },
        <RenderedComponent
          key={node.id}
          {...markerProps}
          {...itemSlotAttr}
          {...racRest}
          {...(() => {
            const domId = resolveAuthoredDomId(
              type,
              authoredCustomId,
              racRest.id,
            );
            return domId ? { id: domId } : {};
          })()}
          {...(() => {
            // id 와 같은 전 타입 공통 축 — `toRacProps` allowlist 를 타지 않으므로
            // 여기가 유일한 emit 지점이다. 컴포넌트가 이미 이름을 냈으면 덮지 않는다.
            const ariaLabel = resolveAuthoredAriaLabel(
              adaptedEl.props as Record<string, unknown> | undefined,
              (racRest as Record<string, unknown>)["aria-label"],
            );
            return ariaLabel ? { "aria-label": ariaLabel } : {};
          })()}
          {...eventHandlers}
          {...(cutoverClassName ? { className: cutoverClassName } : {})}
          {...(STATIC_ITEM_TYPES.has(type)
            ? {
                // ADR-234 Phase 3 — 정적 항목 (Tab · Tag · ListBoxItem) 의 RAC key (TabPanel `itemId` 짝 · owner 선택 key).
                //   ADR-238 Phase 2 — section instance 가 상속한 항목은 section key 접두 (R4).
                id: resolveSectionItemKey(
                  adaptedEl.props as Record<string, unknown> | undefined,
                  node.id,
                  itemSection,
                ),
              }
            : {})}
          style={racStateStyle}
        >
          {isSection ? sectionChildren : itemChildren}
        </RenderedComponent>,
      );
      return isSection
        ? hostOrphanCollectionItem(type, collectionAncestor, primitive)
        : primitive;
    }
  }

  // ── rendererMap 위임 ──────────────────────────────────────────────────────
  const renderer = rendererMap[adaptedEl.type];
  if (renderer) {
    // shared renderer 는 RenderContext.renderElement 를 통해 자식을 렌더링하므로
    // 여기서는 rendererMap 에 그대로 위임. DOM 마커는 wrapper div 로 감쌈.
    return (
      <div key={node.id} {...markerProps} style={{ display: "contents" }}>
        {/* Radio 는 여기서 호스트를 붙이지 않는다 — `renderRadio` 가 그룹 밖이면 자체 RadioGroup 으로
            감싼다 (이중 그룹 방지). catalog 경로만 `hostOrphanRadio` (ADR-233). */}
        {hostOrphanCollectionItem(
          type,
          collectionAncestor,
          renderer(staticStateEl, renderContext) as React.ReactElement,
          forcedStates,
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
      ? `${resolveBackedRootClassName(type)} button-base`
      : resolveBackedRootClassName(type)
    : undefined;
  const userClassName = adaptedEl.props?.className as string | undefined;
  const mergedClassName = isBodyType(type)
    ? resolveBodyDomClassName(type, userClassName)
    : [specClassName, userClassName].filter(Boolean).join(" ") || undefined;
  const specDataAttrs: Record<string, string> = {};
  if (specBacked) {
    const sizeProp = adaptedEl.props?.size as string | undefined;
    specDataAttrs["data-size"] =
      sizeProp ?? resolveBackedDefaultSize(type) ?? "md";
    // 부재 = catalog defaultVariant (Skia 가 그리는 variant 와 같은 값 — resolveBackedDefaultVariant).
    const variantProp =
      (adaptedEl.props?.variant as string | undefined) ??
      resolveBackedDefaultVariant(type);
    if (variantProp) specDataAttrs["data-variant"] = variantProp;
    // ADR-912 InlineAlert slice (2026-06-04): catalog leaf binding 의 D1 static attr
    //   (role/aria-live 등)을 generic fallback 경로에서 부여. 컴포넌트별 if 가 아니라 binding
    //   데이터(no-classification) — RAC source 는 RAC primitive 가 role 자체 부여하지만,
    //   internal/native source(단순 styled div)는 부여처가 없어 spec.react() 의 role 이 누락된다.
    const staticAttrs = getPrimitiveBinding(type)?.staticAttrs;
    if (staticAttrs) Object.assign(specDataAttrs, staticAttrs);
  }

  // D3 대칭 정합: Body infrastructure 기본값은 inline이 아니라 generated CSS가 소유한다.
  // publish `ElementRenderer`도 같은 shared 정규화를 사용한다.
  const bodyPresentation = resolveBodyDomPresentation(
    adaptedEl.type,
    adaptedEl.props?.style as React.CSSProperties | undefined,
  );

  return React.createElement(
    resolveGenericHtmlTag(adaptedEl.type),
    {
      key: node.id,
      ...markerProps,
      ...itemSlotAttr,
      id: resolveAuthoredDomId(type, authoredCustomId),
      ...(() => {
        const ariaLabel = resolveAuthoredAriaLabel(
          adaptedEl.props as Record<string, unknown> | undefined,
        );
        return ariaLabel ? { "aria-label": ariaLabel } : {};
      })(),
      style: bodyPresentation.style,
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
      : resolveGenericLeafText(adaptedEl.type, adaptedEl.props),
  );
}

/**
 * ADR-923 r14m2 — generic leaf 의 텍스트: `children` (binding content) 이 비어 있으면 legacy `text`
 * (Pencil import writer — `collectPencilProps` 가 pencil text 노드의 `text` 를 그대로 canonical props
 * 에 쓴다). 종전엔 children 만 그려 import 문서의 Text/Heading/Paragraph 가 Preview 에서 비어
 * 있었다 (Skia·레이아웃은 text 를 읽음 — D3 비대칭).
 *
 * r15m1 — 순서·문자열화는 타입별 텍스트 원천 계약 (`@composition/specs` `resolveTextSourceText`,
 * Skia · 레이아웃과 같은 단일 지점) 에 위임. AI `create_element` 가 Text 에 `label` 을 써도 세 표면이
 * 함께 `children` 을 읽는다. 배열 children 은 계약의 문자열화 (string/number 항목 이어붙임) 로 —
 * React 가 `["a","b"]` 를 "ab" 로 그리는 것과 같은 결과.
 */
function resolveGenericLeafText(
  type: string,
  props: Record<string, unknown> | undefined,
): React.ReactNode {
  const text = resolveTextSourceText(type, props);
  return text === "" ? null : text;
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
