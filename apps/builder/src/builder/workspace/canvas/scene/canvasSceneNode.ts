import type {
  CanonicalNode,
  CollectionWindow,
  CompositionDocument,
  DescendantOverride,
  RefNode,
} from "@composition/shared";
// ADR-148 Phase 0 — slotRole 공용 vocabulary (설계도 §2-1, builder-local 상수 re-home).
import { getSlotRole, resolveSlotComposition } from "@composition/shared";

import { readLegacyMetadataCustomId } from "../../../../adapters/canonical/legacyMetadata";
import type { FillItem } from "../../../../types/builder/fill.types";
import type { PageElementIndex } from "../../../stores/utils/elementIndexer";
import { normalizeFrameLayoutId } from "../../../../adapters/canonical/frameMirror";
import {
  detectListBoxAuthoringMode,
  isListBoxTemplateAnchor,
  LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
  LISTBOX_ORIGIN_ID,
} from "../../../components/listbox/listBoxTemplateOrigins";
import {
  getListBoxProjectionRows,
  type ListBoxCollectionDataSource,
  type ListBoxProjectionRow,
} from "../../../components/listbox/listBoxRowProjectionModel";
import { GRIDLIST_ITEM_DEFAULT_ORIGIN_ID } from "../../../components/gridlist/gridListTemplateOrigins";
// ADR-907 Layer D: chip gap 정본 = TagList catalog rule. projection 배치와 layout
//   height 계산이 동일 resolver(resolveTagListGap)를 공유해 size 별 gap(lg=6) 을 정합.
import { resolveTagListGap } from "../layout/engines/utils";
import {
  getTableProjectionRows,
  type TableColumnDef,
  type TableProjectionRow,
} from "../../../components/collection/collectionRowProjectionModel";
import {
  toListBoxRowProjectionId,
  toListBoxRowsGroupProjectionId,
  toListBoxSpacerProjectionId,
  toCollectionRowProjectionId,
  toCollectionRowsGroupProjectionId,
  toCollectionCellProjectionId,
} from "../../../projection/renderProjectionIds";
import { getElementDataBinding } from "../../../../adapters/canonical/compositionExtensionFields";

type SceneScopeContext = {
  pageId: string | null;
  layoutId: string | null;
};

type SceneScopeMetadata = {
  customId?: unknown;
  type?: unknown;
  pageId?: unknown;
  layoutId?: unknown;
  slotName?: unknown;
  originRef?: unknown;
  templateRole?: unknown;
};

export type CanvasProjectionMetadata =
  | {
      kind: "page-frame-element";
      pageId: string;
      sourceElementId: string;
      renderElementId: string;
      renderParentId: string | null;
      canonicalParentId: string | null;
      slotName?: string;
      descendantPath?: string;
    }
  | {
      kind: "page-slot-fill";
      pageId: string;
      sourceElementId: string;
      renderElementId: string;
      renderParentId: string;
      canonicalParentId: string | null;
      slotName: string;
      descendantPath: string;
    }
  | {
      kind: "listbox-rows";
      listBoxId: string;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  | {
      kind: "listbox-row";
      listBoxId: string;
      itemKey: string;
      rowIndex: number;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  // ADR-150 A2 (ListBox 가상화): leading/trailing spacer — window 밖 행이 차지했을 높이를
  //   채우는 layout-only 노드(비-hit, 비-render 시각). row/rows-group/cell kind 가 아니라
  //   isCollectionRow(sGroup/Cell)ProjectionKind 가 모두 false → interaction/write handler 가
  //   자동 skip. 총 content height(스크롤바) + window 행 절대 위치를 보존.
  | {
      kind: "listbox-spacer";
      listBoxId: string;
      position: "lead" | "trail";
    }
  // ADR-912 단계 4 C1 (GridList projection): listbox-row/rows 동형 메타.
  //   `listBoxId` 는 collection owner id 의미로 일반화(GridList node id). GridList 는 origin/anchor
  //   인프라 부재(factory children:[])라 templateAnchorId/templateOriginId 는 항상 null.
  //   downstream(write-target/interaction) 은 generic helper `isCollectionRowProjectionKind` 로
  //   listbox/gridlist 를 같은 handler 로 처리(본문 복제 0, OR 판정만 단일 진입점).
  | {
      kind: "gridlist-rows";
      listBoxId: string;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  | {
      kind: "gridlist-row";
      listBoxId: string;
      itemKey: string;
      rowIndex: number;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  // ADR-912 단계 4 C1 (Table 2D projection): RowsGroup → Row[i] → Cell[i][j] 2D.
  //   listbox/gridlist 의 row 1단 대비 cell 차원이 추가됨(table-cell). `listBoxId` 는
  //   collection owner(Table node id)로 의미 일반화. table-rows/row 는 downstream generic
  //   helper(isCollectionRow(sGroup)ProjectionKind) 가 listbox/gridlist 와 같은 handler 로
  //   처리, table-cell 은 columnId write-target 라우팅을 위해 별도 kind.
  | {
      kind: "table-rows";
      listBoxId: string;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  | {
      kind: "table-row";
      listBoxId: string;
      itemKey: string;
      rowIndex: number;
      isHeader: boolean;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  | {
      kind: "table-cell";
      listBoxId: string;
      itemKey: string;
      rowIndex: number;
      columnId: string;
      isHeader: boolean;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  // ADR-912 영역 B (A) — TagGroup chip projection: chip = collection row 동형(1단 row).
  //   listbox/gridlist row 와 동형 메타(listBoxId=collection owner=TagList scene node id /
  //   itemKey / rowIndex). origin/anchor 인프라 부재(TagGroup factory TagList children:[],
  //   items propagation) → templateAnchorId/templateOriginId 항상 null(GridList 동형).
  //   chip 본체(tag-row)는 deep hit 시 owner(TagGroup) select redirect.
  | {
      kind: "tag-rows";
      listBoxId: string;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  | {
      kind: "tag-row";
      listBoxId: string;
      itemKey: string;
      rowIndex: number;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  // ADR-912 영역 B (A) — TabList tab projection: tab = collection row 동형(1단 row).
  //   tag-row 와 동형 메타(listBoxId=collection owner=TabList scene node id / itemKey / rowIndex).
  //   items SSOT(Tabs.props.items → propagation → TabList.props.items) → templateAnchorId/
  //   templateOriginId 항상 null(GridList/Tag 동형). tab 본체(tab-row)는 deep hit 시 owner(Tabs)
  //   select redirect. 이전 implicitStyles virtual Tab(layout-synthetic)을 render-space 로 이전.
  | {
      kind: "tab-rows";
      listBoxId: string;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  | {
      kind: "tab-row";
      listBoxId: string;
      itemKey: string;
      rowIndex: number;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  | {
      kind: "breadcrumb-rows";
      listBoxId: string;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  | {
      kind: "breadcrumb-row";
      listBoxId: string;
      itemKey: string;
      rowIndex: number;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    };

export interface CanvasSceneNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  parentId: string | null;
  pageId: string | null;
  layoutId: string | null;
  /**
   * @deprecated ADR-126 transition alias. Prefer `parentId` in new Skia code.
   */
  parent_id?: string | null;
  /**
   * @deprecated ADR-126 transition alias. Prefer `pageId` in new Skia code.
   */
  page_id?: string | null;
  /**
   * Canonical scene nodes are omitted instead of marked deleted. Legacy
   * bootstrap adapters may still pass falsey deleted markers during transition.
   */
  deleted?: boolean;
  customId?: string;
  /**
   * @deprecated ADR-126 transition alias. Prefer `name`.
   */
  componentName?: string;
  name?: string;
  metadata?: CanonicalNode["metadata"];
  /**
   * Background fill 스택 — canonical 1차 필드 `CanonicalNode.fills` 운반.
   * Skia 소비: buildBoxNodeData(전체 fill 모델) / buildSpecNodeData catalog
   * 배경 채널(color fill). 빈 배열 대신 필드 생략. canonical boundary 는
   * unknown[] — Element 구조 호환을 위해 여기서 FillItem[] 로 narrow.
   */
  fills?: FillItem[];
  reusable?: true;
  projection?: CanvasProjectionMetadata;
  ref?: string;
  descendants?: Record<string, DescendantOverride>;
  slot?: false | string[];
  /**
   * ADR-154 반응형 override. layout/render resolve 경로(useLayoutPublisher /
   * renderCommands)가 activeBreakpoint 기준 base⊕override merge 에 사용.
   * canonical `CanonicalNode.responsive` 에서 복사.
   */
  responsive?: CanonicalNode["responsive"];
  sourceNode: CanonicalNode;
}

/**
 * ADR-150 A2 (ListBox 선행 proof): 가상화된 collection owner 의 window 해석.
 * BuilderCanvas 가 scrollState + 측정 metric 으로 precompute 하여 scene 빌드에 주입하는 단일
 * 소스 — draw/hit tree 가 **동일 window** 를 공유(R2). 미제공 owner 는 legacy 정적 cap 투영.
 */
export interface CollectionWindowResolution {
  /** 절대 index [startIndex, endIndex) — 이 구간 행만 투영. */
  window: CollectionWindow;
  /** 균일 행 높이(px) — leading/trailing spacer 높이 산출. */
  rowHeight: number;
  /** window 전 원본 전체 행 수 — 총 content height(스크롤바) + trailing spacer. */
  totalRows: number;
}

interface BuildCanvasSceneGraphOptions {
  collections?: readonly ListBoxCollectionDataSource[];
  includeReusableFrames?: boolean;
  /**
   * ADR-150 A2: collection owner id → 가상화 window. bounded height + overflow scroll/auto
   * ListBox 만 등재(BuilderCanvas 판정). 미등재 owner 는 legacy `[0, cap)` 투영(BC).
   */
  collectionWindows?: ReadonlyMap<string, CollectionWindowResolution>;
}

export interface CanvasSceneGraph {
  childrenByParent: Map<string, CanvasSceneNode[]>;
  nodes: CanvasSceneNode[];
  nodesMap: Map<string, CanvasSceneNode>;
  parentById: Map<string, string>;
}

const ROOT_SCOPE: SceneScopeContext = {
  pageId: null,
  layoutId: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isCanonicalNode(value: unknown): value is CanonicalNode {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { id?: unknown; type?: unknown };
  return typeof candidate.id === "string" && typeof candidate.type === "string";
}

function withDisplayNoneStyle(
  props: Record<string, unknown>,
): Record<string, unknown> {
  const style = isRecord(props.style) ? props.style : {};
  return {
    ...props,
    style: {
      ...style,
      display: "none",
    },
  };
}

function readDescendantChildren(override: unknown): CanonicalNode[] {
  if (!override || typeof override !== "object") return [];
  if (isCanonicalNode(override)) return [override];

  const children = (override as { children?: unknown }).children;
  if (!Array.isArray(children)) return [];
  return children.filter(isCanonicalNode);
}

function getRefDescendantChildren(node: CanonicalNode): CanonicalNode[][] {
  if (node.type !== "ref") return [];
  const metadata = node.metadata as SceneScopeMetadata | undefined;
  if (metadata?.type !== "page" && metadata?.type !== "legacy-page") return [];

  const descendants = (node as RefNode).descendants ?? {};
  return Object.values(descendants)
    .map(readDescendantChildren)
    .filter((children) => children.length > 0);
}

/**
 * ADR-147 Layer 3: 문서 전체를 id→node 로 평탄화. data-bound projection 행이
 * resolved origin(template ref 의 master) style 을 참조하기 위한 lookup.
 */
function flattenDocumentNodes(
  nodes: readonly CanonicalNode[],
  map: Map<string, CanonicalNode> = new Map(),
): Map<string, CanonicalNode> {
  for (const node of nodes) {
    map.set(node.id, node);
    if (Array.isArray(node.children)) flattenDocumentNodes(node.children, map);
  }
  return map;
}

function isPagePlaceholderNode(node: CanonicalNode): boolean {
  const metadata = node.metadata as SceneScopeMetadata | undefined;
  const isPageMeta =
    metadata?.type === "page" || metadata?.type === "legacy-page";
  const isBoundRef =
    node.type === "ref" && typeof metadata?.layoutId === "string";
  return isPageMeta && !isBoundRef;
}

function getNodeScope(
  node: CanonicalNode,
  scope: SceneScopeContext,
): SceneScopeContext {
  const metadata = node.metadata as SceneScopeMetadata | undefined;
  const metadataType = metadata?.type;

  if (metadataType === "legacy-slot-hoisted") {
    return scope;
  }

  if (isPagePlaceholderNode(node)) {
    return {
      pageId: typeof metadata?.pageId === "string" ? metadata.pageId : node.id,
      layoutId: null,
    };
  }

  if (
    node.type === "ref" &&
    typeof metadata?.layoutId === "string" &&
    (metadata?.type === "page" || metadata?.type === "legacy-page")
  ) {
    return {
      pageId: typeof metadata?.pageId === "string" ? metadata.pageId : node.id,
      layoutId: null,
    };
  }

  if (
    node.type === "frame" &&
    node.reusable !== true &&
    scope.pageId === null
  ) {
    return {
      pageId: node.id,
      layoutId: null,
    };
  }

  if (node.type === "frame" && node.reusable === true) {
    const metadataLayoutId = metadata?.layoutId;
    const layoutId =
      normalizeFrameLayoutId(
        typeof metadataLayoutId === "string" ? metadataLayoutId : null,
      ) ?? node.id;
    return {
      pageId: null,
      layoutId,
    };
  }

  return scope;
}

function toCanvasSceneNode(
  node: CanonicalNode,
  parentId: string | null,
  scope: SceneScopeContext,
  includeReusableFrames: boolean,
): CanvasSceneNode | null {
  const metadata = node.metadata as SceneScopeMetadata | undefined;
  const isLegacySlotHoisted = metadata?.type === "legacy-slot-hoisted";
  const isRenderableRef = node.type === "ref" && !isPagePlaceholderNode(node);
  const isReusableFrame =
    node.type === "frame" && node.reusable === true && includeReusableFrames;
  if (
    !node.props &&
    !isLegacySlotHoisted &&
    !isRenderableRef &&
    !isReusableFrame
  ) {
    return null;
  }

  let props = { ...(node.props ?? {}) };
  if (isLegacySlotHoisted && typeof metadata?.slotName === "string") {
    props.name ??= metadata.slotName;
  }
  if (isListBoxTemplateAnchor(node)) {
    props = withDisplayNoneStyle(props);
  }

  const customId = readLegacyMetadataCustomId(metadata);
  // fills: canonical 1차 필드 우선, 1차 필드 도입(2026-07-15) 전 구 문서는
  // metadata.legacyProps.fills 격리 보존분 fallback (canonicalElementsView 동일 규칙).
  const legacyPropsFills = (
    node.metadata as { legacyProps?: { fills?: unknown } } | undefined
  )?.legacyProps?.fills;
  const nodeFills = (
    Array.isArray(node.fills) && node.fills.length > 0
      ? node.fills
      : Array.isArray(legacyPropsFills) && legacyPropsFills.length > 0
        ? legacyPropsFills
        : undefined
  ) as FillItem[] | undefined;
  const sceneNode: CanvasSceneNode = {
    id: node.id,
    type: isLegacySlotHoisted ? "Slot" : node.type,
    props,
    parentId,
    pageId: scope.pageId,
    layoutId: scope.layoutId,
    parent_id: parentId,
    page_id: scope.pageId,
    ...(customId ? { customId } : {}),
    ...(node.name !== undefined ? { name: node.name } : {}),
    ...(node.name !== undefined ? { componentName: node.name } : {}),
    ...(node.metadata ? { metadata: node.metadata } : {}),
    ...(nodeFills ? { fills: nodeFills } : {}),
    sourceNode: node,
  };

  if (node.reusable === true) sceneNode.reusable = true;
  if (node.slot === false || Array.isArray(node.slot)) {
    sceneNode.slot = node.slot;
  }
  // ADR-154: 반응형 override 를 scene node 로 전달 (resolve 소비 경로).
  if (node.responsive) sceneNode.responsive = node.responsive;
  if (node.type === "ref") {
    const refNode = node as RefNode;
    sceneNode.ref = refNode.ref;
    if (isRecord(refNode.descendants)) {
      sceneNode.descendants = refNode.descendants;
    }
  }

  return sceneNode;
}

function addSceneNode(
  node: CanvasSceneNode,
  graph: Pick<CanvasSceneGraph, "childrenByParent" | "nodes" | "nodesMap"> & {
    parentById: Map<string, string>;
  },
): void {
  graph.nodes.push(node);
  graph.nodesMap.set(node.id, node);
  if (!node.parentId) return;

  graph.parentById.set(node.id, node.parentId);
  const children = graph.childrenByParent.get(node.parentId);
  if (children) {
    children.push(node);
  } else {
    graph.childrenByParent.set(node.parentId, [node]);
  }
}

export function getListBoxTemplateAnchor(
  children: readonly CanonicalNode[] | undefined,
): CanonicalNode | null {
  const anchor = children?.find(
    (child) => isListBoxTemplateAnchor(child) || child.type === "ref",
  );
  return anchor ?? null;
}

function getTemplateOriginId(anchor: CanonicalNode | null): string | null {
  if (!anchor) return null;
  if (anchor.type === "ref") return (anchor as RefNode).ref;
  const metadata = anchor.metadata as SceneScopeMetadata | undefined;
  return typeof metadata?.originRef === "string" ? metadata.originRef : null;
}

/**
 * 행 projection 의 template origin id 를 해석한다 (Option B — anchor-less 정합).
 *
 * 우선순위:
 *   1. in-instance template anchor (아직 migration 되지 않은 legacy instance) — 그 ref/originRef.
 *   2. anchor-less: ListBox instance 가 ref(component-listbox) 면 master component 의
 *      slot[0] = default ListBoxItem origin 에서 해석 (component 정의의 slot 에서 행 template 해석).
 *   3. 안전망: 표준 default origin 상수.
 *
 * **Why**: ADR-146 in-instance anchor 를 제거(Option B)해도 data-bound 행이 Components 페이지의
 *   origin ListBoxItem style(height/padding 등)을 동일하게 상속하도록 단일 진입점을 유지한다.
 */
export function resolveListBoxTemplateOriginId(
  sourceNode: CanonicalNode,
  templateAnchor: CanonicalNode | null,
  getDocumentNodesById: () => Map<string, CanonicalNode>,
): string | null {
  const anchorOriginId = getTemplateOriginId(templateAnchor);
  if (anchorOriginId) return anchorOriginId;

  if (sourceNode.type === "ref") {
    const masterId = (sourceNode as RefNode).ref;
    const slot = getDocumentNodesById().get(masterId)?.slot;
    if (Array.isArray(slot) && typeof slot[0] === "string") return slot[0];
  }

  return LISTBOX_ITEM_DEFAULT_ORIGIN_ID;
}

function isListBoxSceneSource(
  listBoxSceneNode: CanvasSceneNode,
  sourceNode: CanonicalNode,
): boolean {
  if (listBoxSceneNode.type === "ListBox") return true;
  if (sourceNode.type !== "ref") return false;
  const refNode = sourceNode as RefNode;
  return (
    refNode.ref === LISTBOX_ORIGIN_ID ||
    listBoxSceneNode.ref === LISTBOX_ORIGIN_ID ||
    listBoxSceneNode.componentName === "ListBox" ||
    listBoxSceneNode.name === "ListBox"
  );
}

function isListBoxRowSelected(
  props: Record<string, unknown>,
  itemKey: string,
  rowIndex: number,
): boolean {
  const selectedKeys = props.selectedKeys;
  if (Array.isArray(selectedKeys)) {
    return selectedKeys.includes(itemKey);
  }
  if (props.selectedKey === itemKey) return true;

  const selectedIndices = props.selectedIndices;
  if (Array.isArray(selectedIndices)) {
    return selectedIndices.includes(rowIndex);
  }
  return props.selectedIndex === rowIndex;
}

/**
 * data-bound ListBox 의 projection 결정(gating)을 단일 소스로 계산.
 *
 * visit 의 anchor suppression 과 appendListBoxRowProjection 이 **동일 판정**을 공유해야
 * (data-bound + rows>0) anchor 제외와 행 projection 이 lockstep 으로 동작한다. 두 곳이
 * 따로 판정하면 anchor 만 사라지고 행은 안 그려지는(빈 ListBox) drift 가 생긴다.
 */
function resolveDataBoundListBoxProjection(
  listBoxSceneNode: CanvasSceneNode,
  sourceNode: CanonicalNode,
  options: BuildCanvasSceneGraphOptions,
): {
  rows: ListBoxProjectionRow[];
  templateAnchor: CanonicalNode | null;
  sourceNode: CanonicalNode;
  /** ADR-150 A2: 가상화 window 해석(BuilderCanvas 주입). null=legacy 정적 cap. */
  windowResolution: CollectionWindowResolution | null;
} | null {
  if (!isListBoxSceneSource(listBoxSceneNode, sourceNode)) return null;

  const dataBinding = getElementDataBinding(sourceNode);
  const mode = detectListBoxAuthoringMode({
    children: sourceNode.children?.map((child) => ({
      id: child.id,
      ref: child.type === "ref" ? (child as RefNode).ref : undefined,
      type: child.type,
    })),
    dataBinding,
    props: listBoxSceneNode.props,
  });
  if (mode.mode !== "data-bound") return null;

  // ADR-150 A2: BuilderCanvas 가 이 owner 를 가상화 대상으로 판정했으면 window 슬라이스,
  //   아니면 undefined → getListBoxProjectionRows default(정적 cap) 로 legacy 투영.
  const windowResolution =
    options.collectionWindows?.get(listBoxSceneNode.id) ?? null;
  const rows = getListBoxProjectionRows(
    {
      collections: options.collections,
      dataBinding,
      props: listBoxSceneNode.props,
    },
    windowResolution?.window,
  );
  if (rows.length === 0) return null;

  return {
    rows,
    templateAnchor: getListBoxTemplateAnchor(sourceNode.children),
    sourceNode,
    windowResolution,
  };
}

function appendListBoxRowProjection(
  listBoxSceneNode: CanvasSceneNode,
  projection: {
    rows: ListBoxProjectionRow[];
    templateAnchor: CanonicalNode | null;
    sourceNode: CanonicalNode;
    windowResolution: CollectionWindowResolution | null;
  },
  scope: SceneScopeContext,
  graph: Pick<CanvasSceneGraph, "childrenByParent" | "nodes" | "nodesMap"> & {
    parentById: Map<string, string>;
  },
  getDocumentNodesById: () => Map<string, CanonicalNode>,
): void {
  const props = listBoxSceneNode.props;
  const { rows, templateAnchor, sourceNode } = projection;
  const templateAnchorId = templateAnchor?.id ?? null;
  const templateOriginId = resolveListBoxTemplateOriginId(
    sourceNode,
    templateAnchor,
    getDocumentNodesById,
  );
  // ADR-147 Layer 3: projected 행 style = resolved origin(template ref master) style ◁ anchor override.
  //   사용자가 Components 페이지의 origin ListBoxItem 에 준 style(height/padding 등)이 instance 행에
  //   반영되어야 한다. anchor 는 raw ref(style 없음)일 수 있으므로 origin master 의 props.style 을 base 로,
  //   anchor 자체 override(있으면)를 위에 merge 한다. width 는 항상 100% (행 폭 고정).
  const templateOriginNode = templateOriginId
    ? getDocumentNodesById().get(templateOriginId)
    : undefined;
  const originStyle =
    (templateOriginNode?.props?.style as Record<string, unknown> | undefined) ??
    {};
  const anchorStyle =
    (templateAnchor?.props?.style as Record<string, unknown> | undefined) ?? {};
  const templateAnchorStyle = { ...originStyle, ...anchorStyle };
  // ADR-148 Phase 0 — slot 구성 소비: origin(또는 anchor 가 자식을 보유하면 anchor)의
  //   slot 조합 자식(metadata.slotRole)에서 구성(존재·순서)과 slot 자식 style 을 추출해
  //   projected row 의 `_slots` 로 주입한다. listbox_item escape(Skia)와 DOM emit 이
  //   이를 소비 — origin 에서 slot 자식을 지우거나 스타일을 바꾸면 instance 행이 따라간다
  //   (구성·스타일 SSOT = origin 문서의 자식 구성, Decision 3). null(slot 자식 없음)이면
  //   미주입 → consumer 는 legacy flat-props 동작(BC).
  const slotComposition = resolveSlotComposition(
    templateAnchor?.children?.length
      ? templateAnchor.children
      : templateOriginNode?.children,
  );
  if (slotComposition) {
    // 컨테이너 layout(utils.ts §1.55b listbox 분기)이 행 높이(description 유무)를 같은
    //   구성으로 gating 하도록 owner ListBox scene props 에도 주입 (Layer D 대칭).
    (listBoxSceneNode.props as Record<string, unknown>)._slots =
      slotComposition;
  }
  const rowsGroupId = toListBoxRowsGroupProjectionId(listBoxSceneNode.id);
  const rowsGroup: CanvasSceneNode = {
    id: rowsGroupId,
    type: "Rows",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 0,
        width: "100%",
      },
    },
    parentId: listBoxSceneNode.id,
    pageId: scope.pageId,
    layoutId: scope.layoutId,
    parent_id: listBoxSceneNode.id,
    page_id: scope.pageId,
    projection: {
      kind: "listbox-rows",
      listBoxId: listBoxSceneNode.id,
      templateAnchorId,
      templateOriginId,
    },
    sourceNode: templateAnchor ?? sourceNode,
  };
  addSceneNode(rowsGroup, graph);

  // ADR-150 A2 (ListBox 가상화): window 활성 시 leading/trailing spacer 로 window 밖 행
  //   높이를 채운다 — window 행이 절대 위치(startIndex*rowHeight)에 오도록 밀어내고, 총
  //   content height = totalRows*rowHeight 를 flex column 자식 합으로 보존(스크롤바 정확).
  //   spacer 는 fills 없는 layout-only Box (비-hit/비-시각). window 없으면(legacy cap) 미삽입.
  const { windowResolution } = projection;
  const rowHeight = windowResolution?.rowHeight ?? 0;
  const leadRows = windowResolution
    ? Math.max(0, windowResolution.window.startIndex)
    : 0;
  const trailRows = windowResolution
    ? Math.max(0, windowResolution.totalRows - windowResolution.window.endIndex)
    : 0;
  const createSpacerNode = (
    position: "lead" | "trail",
    height: number,
  ): CanvasSceneNode => ({
    id: toListBoxSpacerProjectionId(listBoxSceneNode.id, position),
    type: "Box",
    props: {
      style: { width: "100%", height, flexShrink: 0 },
    },
    parentId: rowsGroupId,
    pageId: scope.pageId,
    layoutId: scope.layoutId,
    parent_id: rowsGroupId,
    page_id: scope.pageId,
    projection: {
      kind: "listbox-spacer",
      listBoxId: listBoxSceneNode.id,
      position,
    },
    sourceNode: templateAnchor ?? sourceNode,
  });
  if (leadRows > 0 && rowHeight > 0) {
    addSceneNode(createSpacerNode("lead", leadRows * rowHeight), graph);
  }

  for (const row of rows) {
    const projectionId = toListBoxRowProjectionId(
      listBoxSceneNode.id,
      row.itemKey,
    );
    const rowProps: Record<string, unknown> = {
      children: row.label,
      description: row.description ?? "",
      textValue: row.label,
      // ADR-147: anchor layout style overlay. width 는 항상 100% (list 행 폭 고정).
      style: { ...templateAnchorStyle, width: "100%" },
      _isSelected: isListBoxRowSelected(props, row.itemKey, row.rowIndex),
    };
    if (row.value) rowProps.value = row.value;
    if (row.icon) rowProps.icon = row.icon; // ADR-147: icon slot
    if (row.isDisabled) rowProps.isDisabled = true;
    // ADR-148 Phase 0: slot 구성(존재·순서·slot 자식 style) — escape/DOM emit 소비.
    if (slotComposition) rowProps._slots = slotComposition;

    addSceneNode(
      {
        id: projectionId,
        type: "ListBoxItem",
        props: rowProps,
        parentId: rowsGroupId,
        pageId: scope.pageId,
        layoutId: scope.layoutId,
        parent_id: rowsGroupId,
        page_id: scope.pageId,
        projection: {
          kind: "listbox-row",
          listBoxId: listBoxSceneNode.id,
          itemKey: row.itemKey,
          rowIndex: row.rowIndex,
          templateAnchorId,
          templateOriginId,
        },
        // ADR-147 (이중 렌더 방지): projection 행은 render.shapes 로 데이터를 자체 렌더한다.
        //   canonical `ref` 를 두면 resolveCanonicalRefTree 가 origin(component-listbox-item-*)
        //   의 composed children({label}/{description} placeholder)을 행마다 확장하여
        //   데이터 위에 겹쳐 그린다. origin 참조는 projection.templateOriginId 로 보존.
        sourceNode: templateAnchor ?? sourceNode,
      },
      graph,
    );
  }

  if (trailRows > 0 && rowHeight > 0) {
    addSceneNode(createSpacerNode("trail", trailRows * rowHeight), graph);
  }
}

// ---------------------------------------------------------------------------
// ADR-912 단계 4 C1 — GridList projection (origin/anchor 없는 단순 경로)
// ---------------------------------------------------------------------------

/**
 * GridList scene node 판정 — GridList 컴포넌트(또는 그 ref instance).
 * GridList 는 factory children:[] + anchor-less 단일 origin(ADR-148 Phase 4 —
 * ensureGridListTemplateOrigins 리터럴 참조)이므로 ListBox 보다 단순
 * (authoring mode / template anchor 개념 없음).
 */
function isGridListSceneSource(
  gridListSceneNode: CanvasSceneNode,
  sourceNode: CanonicalNode,
): boolean {
  if (gridListSceneNode.type === "GridList") return true;
  if (sourceNode.type === "ref") return false;
  return (
    gridListSceneNode.componentName === "GridList" ||
    gridListSceneNode.name === "GridList"
  );
}

/**
 * data-bound GridList 의 projection rows 계산 (gating). GridList 는 section 지원(props.items
 * StoredGridListEntry[] = section + item 혼합)이나 1차 C1 발효는 **flat item row** 만 projection
 * 한다(section header projected node 는 후행 — getFlatProjectionRows kind:'item' 만). rows 0개면
 * null → 발효 전 standalone render.shapes 유지(회귀 0).
 */
function resolveDataBoundGridListProjection(
  gridListSceneNode: CanvasSceneNode,
  sourceNode: CanonicalNode,
  options: BuildCanvasSceneGraphOptions,
): { rows: ListBoxProjectionRow[]; sourceNode: CanonicalNode } | null {
  if (!isGridListSceneSource(gridListSceneNode, sourceNode)) return null;

  const dataBinding = getElementDataBinding(sourceNode);
  const rows = getListBoxProjectionRows({
    collections: options.collections,
    dataBinding,
    props: gridListSceneNode.props,
  });
  if (rows.length === 0) return null;

  return { rows, sourceNode };
}

/**
 * GridList projected rows-group + 카드(GridListItem) projected node 생성.
 *
 * ListBox 대비 단순: template anchor 없음(templateAnchorId = null) — origin 은 anchor-less
 * 단일(`component-gridlist-item-default`, ADR-148 Phase 4)로 리터럴 해석해 slot 구성(`_slots`)
 * 과 origin style 을 카드에 주입한다. projected GridListItem 은 row 데이터(label/description/
 * value)를 props 로 받아 `gridlist_card` escape 가 카드를 자체 렌더. rowsGroup 은 GridList 의
 * layout(grid/stack) + columns 를 flex 로 반영하여 카드가 grid 배치되게 한다(배치는 layout 엔진 담당).
 */
function appendGridListRowProjection(
  gridListSceneNode: CanvasSceneNode,
  projection: { rows: ListBoxProjectionRow[]; sourceNode: CanonicalNode },
  scope: SceneScopeContext,
  graph: Pick<CanvasSceneGraph, "childrenByParent" | "nodes" | "nodesMap"> & {
    parentById: Map<string, string>;
  },
  getDocumentNodesById: () => Map<string, CanonicalNode>,
): void {
  const props = gridListSceneNode.props;
  const { rows, sourceNode } = projection;
  const layout = (props.layout as string) ?? "stack";
  const numCols =
    layout === "grid" ? Math.max(1, Number(props.columns) || 2) : 1;
  const gap = typeof props.gap === "number" ? (props.gap as number) : 12;

  // ADR-148 Phase 4 — ADR-147 모델 복제 (appendListBoxRowProjection 동형): Components
  //   페이지의 GridListItem 기본 origin 에서 slot 구성(존재·순서·slot 자식 style)과
  //   origin style 을 해석해 projected 카드에 주입한다. GridList 는 anchor-less 단일
  //   origin (master slot[] 참조 체계 없음 — 리터럴 id). origin 미존재/slot 자식 없음
  //   = legacy 문서 → 미주입, consumer 는 기존 flat-props 동작(BC).
  const templateOriginNode = getDocumentNodesById().get(
    GRIDLIST_ITEM_DEFAULT_ORIGIN_ID,
  );
  const templateOriginId = templateOriginNode ? templateOriginNode.id : null;
  const originStyle =
    (templateOriginNode?.props?.style as Record<string, unknown> | undefined) ??
    {};
  const slotComposition = resolveSlotComposition(templateOriginNode?.children);
  if (slotComposition) {
    // 컨테이너 layout(utils.ts §1.55c gridlist 분기)이 카드 높이(description 유무)를
    //   같은 구성으로 gating 하도록 owner GridList scene props 에도 주입 (Layer D 대칭).
    (gridListSceneNode.props as Record<string, unknown>)._slots =
      slotComposition;
  }

  const rowsGroupId = toCollectionRowsGroupProjectionId(
    "gridlist",
    gridListSceneNode.id,
  );
  const rowsGroup: CanvasSceneNode = {
    id: rowsGroupId,
    type: "Rows",
    props: {
      style: {
        display: "flex",
        flexDirection: layout === "grid" ? "row" : "column",
        flexWrap: layout === "grid" ? "wrap" : "nowrap",
        rowGap: gap,
        columnGap: gap,
        width: "100%",
      },
    },
    parentId: gridListSceneNode.id,
    pageId: scope.pageId,
    layoutId: scope.layoutId,
    parent_id: gridListSceneNode.id,
    page_id: scope.pageId,
    projection: {
      kind: "gridlist-rows",
      listBoxId: gridListSceneNode.id,
      templateAnchorId: null,
      templateOriginId,
    },
    sourceNode,
  };
  addSceneNode(rowsGroup, graph);

  // grid 모드 카드 폭: (100% - gap*(numCols-1)) / numCols. stack 은 100%.
  const cardWidthStyle =
    layout === "grid" && numCols > 1
      ? `calc((100% - ${gap * (numCols - 1)}px) / ${numCols})`
      : "100%";

  for (const row of rows) {
    const projectionId = toCollectionRowProjectionId(
      "gridlist",
      gridListSceneNode.id,
      row.itemKey,
    );
    const rowProps: Record<string, unknown> = {
      children: row.label,
      description: row.description ?? "",
      textValue: row.label,
      // ADR-148 Phase 4: origin style overlay (ListBox templateAnchorStyle 동형).
      //   카드 폭은 layout(stack|grid) 산식이 항상 우선.
      style: { ...originStyle, width: cardWidthStyle },
      _isSelected: isListBoxRowSelected(props, row.itemKey, row.rowIndex),
    };
    if (row.value) rowProps.value = row.value;
    if (row.isDisabled) rowProps.isDisabled = true;
    // ADR-148 Phase 4: slot 구성(존재·순서·slot 자식 style) — gridlist_card escape/DOM emit 소비.
    if (slotComposition) rowProps._slots = slotComposition;

    addSceneNode(
      {
        id: projectionId,
        type: "GridListItem",
        props: rowProps,
        parentId: rowsGroupId,
        pageId: scope.pageId,
        layoutId: scope.layoutId,
        parent_id: rowsGroupId,
        page_id: scope.pageId,
        projection: {
          kind: "gridlist-row",
          listBoxId: gridListSceneNode.id,
          itemKey: row.itemKey,
          rowIndex: row.rowIndex,
          templateAnchorId: null,
          templateOriginId,
        },
        sourceNode,
      },
      graph,
    );
  }
}

// ── Table 2D projection (ADR-912 단계 4 C1, 사용자 결정 "행 단위 셀 노드") ──────────────
//
// GridList(row 1단) 대비 cell 차원 추가: RowsGroup → Row[i] → Cell[i][j]. header 행 1개 +
// data 행 N개(window). Row 는 bg(striped/selected)+divider self-render(TableRow.spec), Cell 은
// text-only(TableCell.spec). 배치(컬럼 폭 누적)는 Taffy flex row 가 담당.

function isTableSceneSource(
  tableSceneNode: CanvasSceneNode,
  sourceNode: CanonicalNode,
): boolean {
  if (tableSceneNode.type === "Table") return true;
  if (sourceNode.type === "ref") return false;
  return (
    tableSceneNode.componentName === "Table" || tableSceneNode.name === "Table"
  );
}

/**
 * data-bound Table 의 projection rows + columns 계산 (gating).
 *
 * getTableProjectionRows(collections/dataBinding/props.rows) → header 1행 + data N행(cells 차원).
 * 빈 데이터 Table (dataBinding/props.rows 모두 없음) 은 data 0행 → null 반환 → standalone
 * render.shapes 유지 = 빈 테이블. reference 정합 (2026-06-22, 샘플 fallback 제거). 실데이터
 * (dataBinding/collections) 있으면 data N행으로 projection active.
 */
function resolveDataBoundTableProjection(
  tableSceneNode: CanvasSceneNode,
  sourceNode: CanonicalNode,
  options: BuildCanvasSceneGraphOptions,
): {
  columns: TableColumnDef[];
  rows: TableProjectionRow[];
  sourceNode: CanonicalNode;
} | null {
  if (!isTableSceneSource(tableSceneNode, sourceNode)) return null;

  const dataBinding = getElementDataBinding(sourceNode);
  const { columns, rows } = getTableProjectionRows({
    collections: options.collections,
    dataBinding,
    props: tableSceneNode.props,
  });
  // data 행(header 제외)이 하나도 없으면 projection 의미 없음 → standalone 유지.
  // (빈 데이터 Table 의 정상 경로 — 샘플 fallback 제거 후 실제 작동, 2026-06-22)
  if (rows.filter((r) => r.kind === "data").length === 0) return null;

  return { columns, rows, sourceNode };
}

/** Table size prop → TableRow/TableCell size (sm/md/lg). 기본 md. */
function readTableSize(props: Record<string, unknown>): "sm" | "md" | "lg" {
  const size = props.size;
  return size === "sm" || size === "lg" ? size : "md";
}

/**
 * Table projected 2D tree 생성: RowsGroup → Row[i] → Cell[i][j].
 *
 * - rowsGroup: 세로 stack(flex column) — header 행 + data 행을 위→아래로.
 * - Row: 가로 flex row(TableRow.spec containerStyles) — bg/divider self-render + 셀 자식 배치.
 * - Cell: text-only(TableCell.spec) — 컬럼 폭 고정(flex-basis). striped 는 row 의 _striped 로 전파.
 */
function appendTableRowProjection(
  tableSceneNode: CanvasSceneNode,
  projection: {
    columns: TableColumnDef[];
    rows: TableProjectionRow[];
    sourceNode: CanonicalNode;
  },
  scope: SceneScopeContext,
  graph: Pick<CanvasSceneGraph, "childrenByParent" | "nodes" | "nodesMap"> & {
    parentById: Map<string, string>;
  },
): void {
  const { columns, rows, sourceNode } = projection;
  const props = tableSceneNode.props;
  const size = readTableSize(props);
  const totalWidth = columns.reduce((sum, col) => sum + col.width, 0) || 360;
  const variant = props.variant;
  const isStripedVariant = variant === "striped";

  const rowsGroupId = toCollectionRowsGroupProjectionId(
    "table",
    tableSceneNode.id,
  );
  const rowsGroup: CanvasSceneNode = {
    id: rowsGroupId,
    type: "Rows",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: totalWidth,
      },
    },
    parentId: tableSceneNode.id,
    pageId: scope.pageId,
    layoutId: scope.layoutId,
    parent_id: tableSceneNode.id,
    page_id: scope.pageId,
    projection: {
      kind: "table-rows",
      listBoxId: tableSceneNode.id,
      templateAnchorId: null,
      templateOriginId: null,
    },
    sourceNode,
  };
  addSceneNode(rowsGroup, graph);

  for (const row of rows) {
    const isHeader = row.kind === "header";
    // striped: data 행 중 홀수(rowIndex 1,3,...)에 _striped (Table.spec: !isEven → rowIndex%2!==0).
    const striped = isStripedVariant && !isHeader && row.rowIndex % 2 !== 0;

    const rowId = toCollectionRowProjectionId(
      "table",
      tableSceneNode.id,
      row.rowKey,
    );
    // ADR-912 Pattern B (TableRow catalog cutover, 2026-06-13): 행 배경 분기(selected/striped/
    //   header/기본)를 projection 이 계산해 style.backgroundColor 보편 D3 데이터로 주입한다.
    //   buildCatalogShapes 는 행 종류를 모른 채 style.backgroundColor 우선 경로로 box 를 그린다
    //   (컴포넌트 식별 분기 0, ADR-142 §3).
    //   selected 배경 = {color.accent} (ADR-909 후속 2026-06-22): reference
    //   (react-aria-starter Table.css [data-selected] = --highlight-background filled accent)
    //   + design.md:314 정본. 이전 {color.accent-subtle} 는 --highlight-overlay 계보 오차용
    //   (reference 선택행 미사용) → filled accent 로 정정. 셀 전경은 {color.on-accent}(아래 cell
    //   projection) 로 contrast 확보 — CSS Table.css --tbl-selected-bg/color 와 D3 symmetric.
    //   striped·header={color.layer-2} / 기본={color.base}.
    const rowBg = row.isSelected
      ? "{color.accent}"
      : isHeader || striped
        ? "{color.layer-2}"
        : "{color.base}";
    addSceneNode(
      {
        id: rowId,
        type: "TableRow",
        props: {
          size,
          // _rowWidth: table_row_divider skiaPrimitive 가 하단 line 폭에 사용(전체 컬럼 합).
          _rowWidth: totalWidth,
          // ADR-912 cutover: 셀 가로 배치(display:flex/row)를 projection 이 직접 주입. 이전엔
          //   TableRowSpec.containerStyles → resolveContainerStylesFallback 경유였으나 spec body
          //   삭제 대비 render-space 명시 주입(ADR-135 정합).
          style: {
            width: totalWidth,
            backgroundColor: rowBg,
            display: "flex",
            flexDirection: "row",
          },
        },
        parentId: rowsGroupId,
        pageId: scope.pageId,
        layoutId: scope.layoutId,
        parent_id: rowsGroupId,
        page_id: scope.pageId,
        projection: {
          kind: "table-row",
          listBoxId: tableSceneNode.id,
          itemKey: row.rowKey,
          rowIndex: row.rowIndex,
          isHeader,
          templateAnchorId: null,
          templateOriginId: null,
        },
        sourceNode,
      },
      graph,
    );

    for (const col of columns) {
      const cellText = isHeader ? col.label : (row.cells[col.id] ?? "");
      const cellId = toCollectionCellProjectionId(
        "table",
        tableSceneNode.id,
        row.rowKey,
        col.id,
      );
      addSceneNode(
        {
          id: cellId,
          type: "TableCell",
          props: {
            size,
            children: cellText,
            // ADR-912 Pattern B (TableCell catalog cutover, 2026-06-13): header/data 굵기 분기를
            //   projection 이 style.fontWeight 보편 D3 데이터로 주입(header 600 / data 400).
            //   buildCatalogShapes 는 셀 종류를 모른 채 style.fontWeight 우선 경로로 그린다
            //   (컴포넌트 식별 분기 0, ADR-142 §3). 정렬은 left 기본(spec _align ?? "left" 동형) —
            //   명시 정렬 필요 시 style.textAlign 주입(현재 모든 컬럼 left). 컬럼 폭 내 ellipsis 는
            //   style.width(노드 clip)로 처리(spec maxWidth = columnWidth - paddingX*2 동형 근사).
            //   selected 행 셀 전경 = {color.on-accent} (ADR-909 후속 2026-06-22): filled accent
            //   배경(rowBg {color.accent}) 위 흰 전경 contrast. CSS Table.css [data-selected]
            //   color: var(--tbl-selected-color=--fg-on-accent) 와 D3 symmetric. 미선택 셀은
            //   color 미주입 → catalog TableCell colors.text({color.neutral}) 유지.
            style: {
              width: col.width,
              flexGrow: 0,
              flexShrink: 0,
              fontWeight: isHeader ? 600 : 400,
              textAlign: "left",
              ...(row.isSelected ? { color: "{color.on-accent}" } : {}),
            },
          },
          parentId: rowId,
          pageId: scope.pageId,
          layoutId: scope.layoutId,
          parent_id: rowId,
          page_id: scope.pageId,
          projection: {
            kind: "table-cell",
            listBoxId: tableSceneNode.id,
            itemKey: row.rowKey,
            rowIndex: row.rowIndex,
            columnId: col.id,
            isHeader,
            templateAnchorId: null,
            templateOriginId: null,
          },
          sourceNode,
        },
        graph,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// ADR-912 영역 B (A) — TagGroup chip projection (wrap-flow row family)
// ---------------------------------------------------------------------------
//
// GridList(1단 row, origin/anchor 없음, factory children:[]) 와 동형이되 2점 차이:
//   1) **owner = TagList scene node** (TagGroup 이 아님). TagGroup factory 가 Label + TagList
//      중간 컨테이너를 만들고 items/variant/size/allowsRemoving/maxRows 를 TagList 로 propagate
//      (TagGroup.spec propagation, allowsRemoving 은 override:true 로 토글 즉시 반영). chip 좌표계 =
//      TagList node — projection 을 TagList 에 붙인다.
//   2) **rowsGroup = flexWrap:"wrap" row** (세로 stack 아닌 가로 wrap-flow). 수동 wrap 시뮬레이션
//      (구 TagList.spec render.shapes 라인 299-333) 폐기 — chip width:fit-content + Taffy
//      flex-wrap 이 행 배치를 담당(GridList grid 모드의 flexWrap 패턴과 동형).
//   3) chip 의 remove(X)는 chip 본체(Tag)가 catalog cutover 후 **trailing_icon**(buildCatalogShapes
//      가 rule.trailingIcon{name:"x"} 를 text 우측에 icon_font glyph 로 덧그림, props.allowsRemoving
//      조건). X = line 이 아니라 Lucide "x" glyph(SelectIcon/SearchField clear 동일 데이터, DOM Button
//      slot=remove 와 시각 대칭). chip 에 allowsRemoving 전달(아래) → buildCatalogShapes 조건부 렌더.
//      독립 hit/remove mutation 은 후속(현 slice 시각 대칭 — chip select redirect 까지).

function isTagListSceneSource(
  tagListSceneNode: CanvasSceneNode,
  sourceNode: CanonicalNode,
): boolean {
  if (tagListSceneNode.type === "TagList") return true;
  if (sourceNode.type === "ref") return false;
  return (
    tagListSceneNode.componentName === "TagList" ||
    tagListSceneNode.name === "TagList"
  );
}

/**
 * owner TagGroup lookup — TagList sourceNode 를 자식으로 갖는 TagGroup 노드의 props 를 역추적.
 * findOwnerTabsProps 대칭 (Tab 선례).
 */
function findOwnerTagGroupProps(
  tagListSourceId: string,
  getDocumentNodesById: () => Map<string, CanonicalNode>,
): Record<string, unknown> | null {
  for (const node of getDocumentNodesById().values()) {
    if (node.type !== "TagGroup") continue;
    const children = node.children;
    if (
      Array.isArray(children) &&
      children.some((c) => c.id === tagListSourceId)
    ) {
      return (node.props ?? null) as Record<string, unknown> | null;
    }
  }
  return null;
}

/**
 * data-bound TagList 의 projection rows 계산 (gating). items 는 TagGroup.props.items 가
 * propagation 경유로 TagList.props.items 에 전파되어 있다(TagGroup.spec propagation). dataBinding
 * (api/collection) 도 동일 getFlatProjectionRows 3경로로 흡수. rows 0개면 null → 발효 전
 * standalone render.shapes 유지(회귀 0). chip 1개 = 1 row.
 *
 * **owner-first fallback**: propagation rule `{ parentProp:"items", childPath:"TagList",
 * override:true }` 는 부모 TagGroup.items 를 정본으로 두고 자식 TagList.items 를 덮어쓴다.
 * 하지만 Inspector ItemsManager 의 "Add Tag"(store.addItem)는 TagGroup.props.items 만 갱신하고
 * propagation 을 트리거하지 않아 TagList.props.items 가 stale(factory 초기값) 로 남는다. DOM 은
 * TagGroup.props.items 를 직접 소비해 즉시 반영되지만, Skia 는 stale TagList.items 를 읽어 새 chip
 * 이 누락됐다. dataBinding 이 없을 때 owner TagGroup.items 를 우선 사용해 override 정본을 Skia 시점에
 * 방어적으로 복원(Tab 의 owner fallback 대칭, 단 Tab 은 `!hasItems` 조건이고 Tag 는 override:true
 * 정본이라 owner 를 항상 우선). owner 미발견 시 기존 TagList.props 로 회귀.
 */
function resolveDataBoundTagProjection(
  tagListSceneNode: CanvasSceneNode,
  sourceNode: CanonicalNode,
  options: BuildCanvasSceneGraphOptions,
  getDocumentNodesById: () => Map<string, CanonicalNode>,
): { rows: ListBoxProjectionRow[]; sourceNode: CanonicalNode } | null {
  if (!isTagListSceneSource(tagListSceneNode, sourceNode)) return null;

  const dataBinding = getElementDataBinding(sourceNode);

  // owner-first: dataBinding 없을 때만 owner TagGroup.items 로 stale TagList.items 를 대체.
  //   dataBinding(collection/api) 이 있으면 그 경로가 items 보다 우선하므로 owner 조회 skip.
  let resolvedProps = tagListSceneNode.props;
  if (!dataBinding) {
    const ownerProps = findOwnerTagGroupProps(
      sourceNode.id,
      getDocumentNodesById,
    );
    if (ownerProps && Array.isArray(ownerProps.items)) {
      // TagList.props 우선 + owner TagGroup.items 로 override(정본). variant/size/allowsRemoving 등
      //   나머지 chip 속성은 기존 TagList.props 를 존중(propagation 정상 동작 시 이미 채워짐).
      resolvedProps = { ...tagListSceneNode.props, items: ownerProps.items };
    }
  }

  const rows = getListBoxProjectionRows({
    collections: options.collections,
    dataBinding,
    props: resolvedProps,
  });
  if (rows.length === 0) return null;

  return { rows, sourceNode };
}

/**
 * TagGroup chip projected tree 생성: RowsGroup(flex wrap row) → Tag chip[i] (+ remove cell).
 *
 * - rowsGroup: 가로 flex row + flexWrap:wrap → chip 들이 컨테이너 폭에서 자동 줄바꿈(Taffy 위임,
 *   수동 wrap 계산 없음). gap = chip 간격(size 토큰 gap, propagation 으로 TagList 좌표계).
 * - chip(Tag): width:fit-content → 라벨 폭 + padding 만큼만. catalog cutover 후 buildCatalogShapes
 *   가 box+text generic 렌더(_isSelected → selected variant). allowsRemoving=true 시 chip 에
 *   allowsRemoving 전달 → buildCatalogShapes 가 rule.trailingIcon{name:"x"} 를 text 우측에
 *   icon_font glyph 로 덧그림(remove X). X = line 아니라 Lucide "x" glyph. 단일클릭은 owner
 *   (TagGroup) select redirect, remove mutation 은 후속(proof scope).
 */
function appendTagRowProjection(
  tagListSceneNode: CanvasSceneNode,
  projection: { rows: ListBoxProjectionRow[]; sourceNode: CanonicalNode },
  scope: SceneScopeContext,
  graph: Pick<CanvasSceneGraph, "childrenByParent" | "nodes" | "nodesMap"> & {
    parentById: Map<string, string>;
  },
): void {
  const props = tagListSceneNode.props;
  const { rows, sourceNode } = projection;
  const allowsRemoving = Boolean(props.allowsRemoving);
  const variant = props.variant;
  const size = props.size;
  // ADR-907 Layer D: chip 간 gap 정본 = TagList catalog rule(sm/md=4, lg=6). 이전 `props.gap ?? 4`
  //   하드코딩은 catalog 를 무시해 lg 에서 layout height 계산(resolveTagChipMetric=6)과 배치(4)가
  //   비대칭이었다. 사용자 명시 props.gap 은 존중, 없으면 size 별 catalog gap read-through.
  const gap =
    typeof props.gap === "number"
      ? (props.gap as number)
      : resolveTagListGap(typeof size === "string" ? size : "md");

  const rowsGroupId = toCollectionRowsGroupProjectionId(
    "tag",
    tagListSceneNode.id,
  );
  const rowsGroup: CanvasSceneNode = {
    id: rowsGroupId,
    type: "Rows",
    props: {
      style: {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        rowGap: gap,
        columnGap: gap,
        width: "100%",
        alignItems: "flex-start",
        // alignContent:flex-start — flex-wrap 다중 행을 컨테이너 상단에 붙인다. 미설정 시 Taffy
        //   기본(stretch/분산)이 컨테이너 height > 행 총합일 때 chip 행 사이를 벌려 세로 gap 발산
        //   (maxRows gap 버그 근본, 2026-07-02). height 를 RowsGroup 실측으로 맞춰도 이 분산이
        //   남으므로 flex-start 로 명시 고정. CSS(TagGroup.css .react-aria-TagList)도 동일 상단 정렬.
        alignContent: "flex-start",
      },
    },
    parentId: tagListSceneNode.id,
    pageId: scope.pageId,
    layoutId: scope.layoutId,
    parent_id: tagListSceneNode.id,
    page_id: scope.pageId,
    projection: {
      kind: "tag-rows",
      listBoxId: tagListSceneNode.id,
      templateAnchorId: null,
      templateOriginId: null,
    },
    sourceNode,
  };
  addSceneNode(rowsGroup, graph);

  for (const row of rows) {
    const chipId = toCollectionRowProjectionId(
      "tag",
      tagListSceneNode.id,
      row.itemKey,
    );
    const chipProps: Record<string, unknown> = {
      children: row.label,
      // chip 폭 = 라벨 + padding (+ allowsRemoving 시 trailing X) — Tag rule(catalog cutover) inline-flex.
      //   wrap-flow 에서 각 chip 이 fit-content 로 자연 폭을 갖고 Taffy flexWrap 이 행 배치.
      style: { width: "fit-content" },
      _isSelected: isListBoxRowSelected(props, row.itemKey, row.rowIndex),
    };
    if (variant) chipProps.variant = variant;
    if (size) chipProps.size = size;
    if (row.isDisabled) chipProps.isDisabled = true;
    // ADR-912 영역 B (A) — Tag catalog cutover (2026-06-12): X(remove)는 chip 본체가 line×2 로
    //   직접 그리던 것(Tag.spec)을 폐기하고 **trailing_icon(icon_font "x" Lucide glyph)**으로 그린다
    //   — X = line 이 아니라 icon 데이터(SelectIcon/SearchField clear 와 동일 Lucide "x"), DOM Button
    //   slot=remove ✕ 와 시각 대칭. buildCatalogShapes 가 text 우측에 trailing X 를 덧그린다
    //   (TreeItem leading_icon 의 trailing 변형). allowsRemoving 데이터로 조건부(rule.trailingIcon
    //   정적, allowsRemoving=false 면 skip). 독립 hit/remove mutation 은 후속(현 slice 는 시각 대칭).
    if (allowsRemoving) chipProps.allowsRemoving = true;

    addSceneNode(
      {
        id: chipId,
        type: "Tag",
        props: chipProps,
        parentId: rowsGroupId,
        pageId: scope.pageId,
        layoutId: scope.layoutId,
        parent_id: rowsGroupId,
        page_id: scope.pageId,
        projection: {
          kind: "tag-row",
          listBoxId: tagListSceneNode.id,
          itemKey: row.itemKey,
          rowIndex: row.rowIndex,
          templateAnchorId: null,
          templateOriginId: null,
        },
        sourceNode,
      },
      graph,
    );
  }

  // maxRows "Show all" chip — RSP 표준(지정 행 초과 tag 접기 + 펼치기 트리거).
  //   maxRows 설정 시 항상 emit 하되, 실제 표시(접힘 발생) 여부는 render 게이트가 폭 기반
  //   wrap sim(shouldShowAll)으로 판정해 조건부 skip 한다(projection 은 폭 미보유). rowIndex 는
  //   전체 item 뒤(rows.length) — render 게이트의 `rowIndex >= visibleItemCount` skip 대상이
  //   아니도록 `_isShowAll` 마커로 제외. 시각(투명 배경 + accent 텍스트)은 buildCatalogShapes
  //   Tag 분기가 `_isShowAll` 로 분기.
  if (typeof props.maxRows === "number" && props.maxRows > 0) {
    const showAllId = toCollectionRowProjectionId(
      "tag",
      tagListSceneNode.id,
      "__show_all__",
    );
    addSceneNode(
      {
        id: showAllId,
        type: "Tag",
        props: {
          // CSS(TagGroup.tsx)는 "Show all (N)" — 전체 tag 수 표기. rows = 전체 items 기반.
          children: `Show all (${rows.length})`,
          style: { width: "fit-content" },
          _isShowAll: true,
          ...(size ? { size } : {}),
        },
        parentId: rowsGroupId,
        pageId: scope.pageId,
        layoutId: scope.layoutId,
        parent_id: rowsGroupId,
        page_id: scope.pageId,
        projection: {
          kind: "tag-row",
          listBoxId: tagListSceneNode.id,
          itemKey: "__show_all__",
          rowIndex: rows.length,
          templateAnchorId: null,
          templateOriginId: null,
        },
        sourceNode,
      },
      graph,
    );
  }
}

// ---------------------------------------------------------------------------
// ADR-912 영역 B (A) — Tab row projection (TabList 1단 row family)
// ---------------------------------------------------------------------------
//
// TagGroup chip 선례와 동형이되 3점 차이:
//   1) **owner = TabList scene node**. Tabs factory 가 TabList 중간 컨테이너를 만들고
//      items/selectedKey/showIndicator/variant/size 를 TabList 로 propagate (Tabs.spec
//      propagation, ADR-912 단계 1-2). tab 좌표계 = TabList node — projection 을 TabList 에 붙인다.
//   2) **rowsGroup = 한 줄 flex row** (Tag 의 wrap-flow 아님). orientation="vertical" 이면 column.
//      이전 구현(implicitStyles virtual Tab, layout-synthetic 경로)을 render-space projection 으로
//      이전 — TabList.spec.render.shapes 의 구분선(line)은 유지, tab 본체만 projection.
//   3) chip(Tab) 본체는 Tab.spec.render.shapes 가 text + (selected && showIndicator 시) indicator
//      rect 를 그린다. _isSelected(isListBoxRowSelected, selectedKey 단일) + _showIndicator 전달.

function isTabListSceneSource(
  tabListSceneNode: CanvasSceneNode,
  sourceNode: CanonicalNode,
): boolean {
  if (tabListSceneNode.type === "TabList") return true;
  if (sourceNode.type === "ref") return false;
  return (
    tabListSceneNode.componentName === "TabList" ||
    tabListSceneNode.name === "TabList"
  );
}

/**
 * pre-propagation 기존 문서 호환 fallback — owner Tabs 의 props 를 찾는다.
 *
 * Tabs.spec propagation(ADR-912 단계 1-2) 도입 **전** 생성된 기존 문서는 factory 시점
 * applyFactoryPropagation 을 못 받아 TabList.props.items 가 비어있다(신규 Tabs 는 채워짐).
 * 그 경우 owner Tabs(TabList 를 자식으로 갖는 노드)의 props 를 document map 에서 1회 역추적해
 * items/selectedKey/showIndicator/variant/size 를 보충한다. **primary 는 어디까지나 TabList.props**
 * (projector invariant) — 본 함수는 props.items 가 빈 fallback 경로에서만 호출(owner-lookup primary
 * 패턴 확산 아님, 사용자 결정 2026-06-06).
 */
function findOwnerTabsProps(
  tabListSourceId: string,
  getDocumentNodesById: () => Map<string, CanonicalNode>,
): Record<string, unknown> | null {
  for (const node of getDocumentNodesById().values()) {
    if (node.type !== "Tabs") continue;
    const children = node.children;
    if (
      Array.isArray(children) &&
      children.some((c) => c.id === tabListSourceId)
    ) {
      return (node.props ?? null) as Record<string, unknown> | null;
    }
  }
  return null;
}

/**
 * data-bound TabList 의 projection rows 계산 (gating). items 는 Tabs.props.items 가
 * propagation 경유로 TabList.props.items 에 전파되어 있다(Tabs.spec propagation, ADR-912
 * 단계 1-2). Tag/ListBox 와 동일 getListBoxProjectionRows 로 흡수 ({id,title} → {itemKey,label}).
 * rows 0개면 null → 발효 전 standalone(빈 TabList) 유지(회귀 0). tab 1개 = 1 row.
 *
 * **호환 fallback**: TabList.props.items 가 비면(pre-propagation 기존 문서) owner Tabs.props 를
 * 역추적해 합성 props(TabList.props 우선 + owner Tabs props 보충)로 rows/selected 를 계산한다.
 * 둘 다 있으면 TabList.props 만 사용(duplicate 방지) — propagation 이 정상 동작한 신규 문서.
 */
function resolveDataBoundTabProjection(
  tabListSceneNode: CanvasSceneNode,
  sourceNode: CanonicalNode,
  getDocumentNodesById: () => Map<string, CanonicalNode>,
): {
  rows: ListBoxProjectionRow[];
  sourceNode: CanonicalNode;
  resolvedProps: Record<string, unknown>;
} | null {
  if (!isTabListSceneSource(tabListSceneNode, sourceNode)) return null;

  // Tab 은 dataBinding 없이 items SSOT 만 (Tabs.props.items → propagation → TabList.props.items).
  const tabListProps = tabListSceneNode.props;
  let resolvedProps = tabListProps;

  // 호환 fallback: propagation 전 문서는 TabList.props.items 가 비어있음 → owner Tabs 보충.
  const hasItems =
    Array.isArray(tabListProps.items) && tabListProps.items.length > 0;
  if (!hasItems) {
    const ownerProps = findOwnerTabsProps(sourceNode.id, getDocumentNodesById);
    if (ownerProps) {
      // TabList.props 우선 + owner Tabs props 보충(items/selectedKey/showIndicator/variant/size).
      resolvedProps = { ...ownerProps, ...tabListProps };
    }
  }

  const rows = getListBoxProjectionRows({ props: resolvedProps });
  if (rows.length === 0) return null;

  return { rows, sourceNode, resolvedProps };
}

/**
 * TabList tab projected tree 생성: RowsGroup(flex row) → Tab[i].
 *
 * - rowsGroup: orientation 에 따라 flex row(horizontal) 또는 column(vertical). gap=0(Tabs.spec gap).
 * - tab(Tab): width:fit-content → 라벨 폭 + padding. Tab.spec.render.shapes 가 text + indicator
 *   self-render (_isSelected → selected variant + _showIndicator → indicator rect).
 * - 단일클릭은 owner(Tabs) select redirect (resolveCanvasInteractionTarget), selection update 는
 *   후속(proof scope — Tag 선례와 동일). projection id 는 비영속.
 */
function appendTabRowProjection(
  tabListSceneNode: CanvasSceneNode,
  projection: {
    rows: ListBoxProjectionRow[];
    sourceNode: CanonicalNode;
    resolvedProps: Record<string, unknown>;
  },
  scope: SceneScopeContext,
  graph: Pick<CanvasSceneGraph, "childrenByParent" | "nodes" | "nodesMap"> & {
    parentById: Map<string, string>;
  },
): void {
  // resolvedProps = TabList.props 우선 + (pre-propagation 문서면) owner Tabs props 보충.
  //   orientation/variant/size/showIndicator/selectedKey 모두 동일 소스에서 읽어 일관성 유지.
  const { rows, sourceNode, resolvedProps: props } = projection;
  const isVertical = props.orientation === "vertical";
  const variant = props.variant;
  const size = props.size;
  const showIndicator = props.showIndicator !== false;
  // ADR-912 영역 B (A): Tab selected 판정은 selectedKey ?? defaultSelectedKey (단일 선택).
  //   isListBoxRowSelected 는 selectedKey 만 보고 defaultSelectedKey 를 모르므로(ListBox/Tag 공용),
  //   Tab 전용으로 defaultSelectedKey fallback 을 추가한다(이전 buildSpecNodeData:1095 virtual Tab
  //   로직 동형). 미적용 시 defaultSelectedKey 만 있는 Tabs 의 selected indicator 가 사라진다.
  const selectedKey =
    (props.selectedKey as string | undefined) ??
    (props.defaultSelectedKey as string | undefined);

  const rowsGroupId = toCollectionRowsGroupProjectionId(
    "tab",
    tabListSceneNode.id,
  );
  const rowsGroup: CanvasSceneNode = {
    id: rowsGroupId,
    type: "Rows",
    props: {
      style: {
        display: "flex",
        flexDirection: isVertical ? "column" : "row",
        width: "100%",
        alignItems: isVertical ? "flex-start" : "stretch",
      },
    },
    parentId: tabListSceneNode.id,
    pageId: scope.pageId,
    layoutId: scope.layoutId,
    parent_id: tabListSceneNode.id,
    page_id: scope.pageId,
    projection: {
      kind: "tab-rows",
      listBoxId: tabListSceneNode.id,
      templateAnchorId: null,
      templateOriginId: null,
    },
    sourceNode,
  };
  addSceneNode(rowsGroup, graph);

  for (const row of rows) {
    const tabId = toCollectionRowProjectionId(
      "tab",
      tabListSceneNode.id,
      row.itemKey,
    );
    const tabProps: Record<string, unknown> = {
      // Tab.spec.render.shapes 는 props.title 을 텍스트 소스로 읽는다(children 아님) —
      //   virtual Tab(이전 layout-synthetic)도 title 을 넣었다. children 은 호환용 동시 제공.
      title: row.label,
      children: row.label,
      // tab 폭 = 라벨 + padding — Tab.spec containerStyles. 한 줄 row 에서 각 tab fit-content.
      style: { width: "fit-content" },
      // ADR-912 영역 B (A): Tab 단일 선택 — selectedKey ?? defaultSelectedKey === itemKey.
      _isSelected: selectedKey != null && selectedKey === row.itemKey,
      _showIndicator: showIndicator,
      // tab 본체가 owner Tabs 의 item 식별 (선택 redirect / write-target 라우팅용).
      tabId: row.itemKey,
    };
    if (variant) tabProps.variant = variant;
    if (size) tabProps.size = size;
    if (row.isDisabled) tabProps.isDisabled = true;

    addSceneNode(
      {
        id: tabId,
        type: "Tab",
        props: tabProps,
        parentId: rowsGroupId,
        pageId: scope.pageId,
        layoutId: scope.layoutId,
        parent_id: rowsGroupId,
        page_id: scope.pageId,
        projection: {
          kind: "tab-row",
          listBoxId: tabListSceneNode.id,
          itemKey: row.itemKey,
          rowIndex: row.rowIndex,
          templateAnchorId: null,
          templateOriginId: null,
        },
        sourceNode,
      },
      graph,
    );
  }
}

// ---------------------------------------------------------------------------
// ADR-912 영역 B (A) — Breadcrumb row projection (Breadcrumbs 1단 직접 family)
// ---------------------------------------------------------------------------
//
// Tag/Tab chip 선례와 동형이되 3점 차이:
//   1) **owner = Breadcrumbs scene node 자체** (중간 컨테이너 없음). Tag/Tab 은 TagList/TabList
//      중간 컨테이너로 propagation 했지만, Breadcrumbs→Breadcrumb 은 1단 직접 구조라 propagation
//      불요 — projection 이 Breadcrumbs.props.items 를 직접 읽는다.
//   2) **rowsGroup = 한 줄 flex row nowrap** (Tag 의 wrap-flow 아님, Breadcrumbs.spec:54 nowrap).
//   3) crumb(Breadcrumb) 본체는 **Breadcrumb.spec.render.shapes** 가 그린다 (generic box+text 아님)
//      — separator(!isLast 시 emit) + isLast 강조(weight 600 + accent) 로직 보존. projection 은
//      crumb 노드에 children/_isLast/_separator 만 주입하고, spec 이 시각 책임.

function isBreadcrumbsSceneSource(
  breadcrumbsSceneNode: CanvasSceneNode,
  sourceNode: CanonicalNode,
): boolean {
  if (breadcrumbsSceneNode.type === "Breadcrumbs") return true;
  if (sourceNode.type === "ref") return false;
  return (
    breadcrumbsSceneNode.componentName === "Breadcrumbs" ||
    breadcrumbsSceneNode.name === "Breadcrumbs"
  );
}

/**
 * data-bound Breadcrumbs 의 projection rows 계산 (gating). items 는 Breadcrumbs.props.items
 * (StoredBreadcrumbItem[]) SSOT — 중간 컨테이너 없이 직접. dataBinding(api/collection)도 동일
 * getFlatProjectionRows 3경로로 흡수. rows 0개면 null → 발효 전 standalone(빈 nav) 유지(회귀 0).
 * crumb 1개 = 1 row.
 */
function resolveDataBoundBreadcrumbProjection(
  breadcrumbsSceneNode: CanvasSceneNode,
  sourceNode: CanonicalNode,
  options: BuildCanvasSceneGraphOptions,
): { rows: ListBoxProjectionRow[]; sourceNode: CanonicalNode } | null {
  if (!isBreadcrumbsSceneSource(breadcrumbsSceneNode, sourceNode)) return null;

  const dataBinding = getElementDataBinding(sourceNode);
  const rows = getListBoxProjectionRows({
    collections: options.collections,
    dataBinding,
    props: breadcrumbsSceneNode.props,
  });
  if (rows.length === 0) return null;

  return { rows, sourceNode };
}

/**
 * Breadcrumbs crumb projected tree 생성: RowsGroup(flex row nowrap) → Breadcrumb crumb[i].
 *
 * - rowsGroup: 가로 flex row nowrap (Breadcrumbs.spec:54). gap=0 (separator 가 crumb 노드 내부에
 *   afterPadX 로 흡수되므로 row gap 불요).
 * - crumb(Breadcrumb): width:fit-content → 라벨 폭 + separator 폭. Breadcrumb.spec.render.shapes
 *   가 crumb text + (!isLast 시) separator text self-render. children(라벨) + _isLast(마지막만 true,
 *   weight 600 + accent 강조) + _separator(부모 separator prop, 기본 "›") 주입.
 * - 단일클릭은 owner(Breadcrumbs) select redirect (resolveCanvasInteractionTarget), projection id 는
 *   비영속 (Tag/Tab 선례 동일).
 */
function appendBreadcrumbRowProjection(
  breadcrumbsSceneNode: CanvasSceneNode,
  projection: { rows: ListBoxProjectionRow[]; sourceNode: CanonicalNode },
  scope: SceneScopeContext,
  graph: Pick<CanvasSceneGraph, "childrenByParent" | "nodes" | "nodesMap"> & {
    parentById: Map<string, string>;
  },
): void {
  const props = breadcrumbsSceneNode.props;
  const { rows, sourceNode } = projection;
  const size = props.size;
  const separator = typeof props.separator === "string" ? props.separator : "›";
  const lastIndex = rows.length - 1;

  const rowsGroupId = toCollectionRowsGroupProjectionId(
    "breadcrumb",
    breadcrumbsSceneNode.id,
  );
  const rowsGroup: CanvasSceneNode = {
    id: rowsGroupId,
    type: "Rows",
    props: {
      style: {
        display: "flex",
        flexDirection: "row",
        flexWrap: "nowrap",
        alignItems: "center",
        width: "100%",
      },
    },
    parentId: breadcrumbsSceneNode.id,
    pageId: scope.pageId,
    layoutId: scope.layoutId,
    parent_id: breadcrumbsSceneNode.id,
    page_id: scope.pageId,
    projection: {
      kind: "breadcrumb-rows",
      listBoxId: breadcrumbsSceneNode.id,
      templateAnchorId: null,
      templateOriginId: null,
    },
    sourceNode,
  };
  addSceneNode(rowsGroup, graph);

  for (const row of rows) {
    const crumbId = toCollectionRowProjectionId(
      "breadcrumb",
      breadcrumbsSceneNode.id,
      row.itemKey,
    );
    const isLast = row.rowIndex === lastIndex;
    const crumbProps: Record<string, unknown> = {
      // Breadcrumb.spec.render.shapes 는 props.children(또는 label/title)을 텍스트 소스로 읽는다.
      children: row.label,
      // crumb 폭 = 라벨 + separator(separator 는 Breadcrumb.spec 이 crumb 노드 내부에 그림).
      style: { width: "fit-content" },
      // 마지막 crumb 만 강조(weight 600 + accent) + separator 미생성 (Breadcrumb.spec:131/175).
      _isLast: isLast,
      _separator: separator,
      // owner(Breadcrumbs) 의 item 식별 (선택 redirect / write-target 라우팅용).
      breadcrumbItemKey: row.itemKey,
    };
    if (size) crumbProps.size = size;
    if (row.isDisabled) crumbProps.isDisabled = true;

    addSceneNode(
      {
        id: crumbId,
        type: "Breadcrumb",
        props: crumbProps,
        parentId: rowsGroupId,
        pageId: scope.pageId,
        layoutId: scope.layoutId,
        parent_id: rowsGroupId,
        page_id: scope.pageId,
        projection: {
          kind: "breadcrumb-row",
          listBoxId: breadcrumbsSceneNode.id,
          itemKey: row.itemKey,
          rowIndex: row.rowIndex,
          templateAnchorId: null,
          templateOriginId: null,
        },
        sourceNode,
      },
      graph,
    );
  }
}

export function buildCanvasSceneGraph(
  doc: CompositionDocument,
  options: BuildCanvasSceneGraphOptions = {},
): CanvasSceneGraph {
  const nodes: CanvasSceneNode[] = [];
  const nodesMap = new Map<string, CanvasSceneNode>();
  const childrenByParent = new Map<string, CanvasSceneNode[]>();
  const parentById = new Map<string, string>();
  const { includeReusableFrames = false } = options;
  const graph = { childrenByParent, nodes, nodesMap, parentById };
  // ADR-147 Layer 3: origin(template ref master) style lookup 용 문서 평탄화.
  //   data-bound ListBox(+origin id) 가 실제 projection 될 때만 1회 build (lazy) —
  //   data-bound ListBox 없는 페이지는 전체 트리 walk 자체를 skip.
  let documentNodesById: Map<string, CanonicalNode> | null = null;
  const getDocumentNodesById = (): Map<string, CanonicalNode> => {
    if (documentNodesById === null) {
      documentNodesById = flattenDocumentNodes(doc.children);
    }
    return documentNodesById;
  };

  function visit(
    node: CanonicalNode,
    parentSceneId: string | null,
    scope: SceneScopeContext,
  ): void {
    const nextScope = getNodeScope(node, scope);
    const sceneNode = toCanvasSceneNode(
      node,
      parentSceneId,
      nextScope,
      includeReusableFrames,
    );
    const nextParentId = sceneNode?.id ?? parentSceneId;

    if (sceneNode) {
      // ADR-148 Phase 0: ListBoxItem 자체(주로 Components 페이지 origin)의 slot 조합
      //   자식 구성을 자기 scene props 에 주입 — 아래 suppression 으로 자식 노드는 scene
      //   에서 빠지므로, `listbox_item` escape 가 origin 자체 렌더에서도 구성(존재/순서/
      //   스타일)을 따르게 한다 (origin 편집 → Components 페이지 즉시 반영).
      if (node.type === "ListBoxItem" && node.children?.length) {
        const ownSlotComposition = resolveSlotComposition(node.children);
        if (ownSlotComposition) {
          (sceneNode.props as Record<string, unknown>)._slots =
            ownSlotComposition;
        }
      }
      addSceneNode(sceneNode, graph);
    }

    // ADR-147 (이중 렌더 방지): data-bound ListBox 는 projection 이 행을 렌더하므로
    //   template anchor(및 origin composed children placeholder)는 가시 scene 에서 제외.
    //   동일 projection 판정을 suppression 과 append 가 공유한다.
    const listBoxProjection = sceneNode
      ? resolveDataBoundListBoxProjection(sceneNode, node, options)
      : null;
    const suppressedAnchorId = listBoxProjection?.templateAnchor?.id ?? null;

    // ADR-912 단계 4 C1: data-bound GridList projection (origin/anchor 없음 → suppression no-op).
    //   GridList factory children:[] 이라 가시 scene 에서 제외할 자식 없음 — append 만.
    const gridListProjection = sceneNode
      ? resolveDataBoundGridListProjection(sceneNode, node, options)
      : null;

    // ADR-912 단계 4 C1: data-bound Table 2D projection (RowsGroup→Row→Cell).
    //   Table factory children:[] (GridList 동형) → suppression 불필요, append 만.
    const tableProjection = sceneNode
      ? resolveDataBoundTableProjection(sceneNode, node, options)
      : null;

    // ADR-912 영역 B (A): TagGroup chip projection (owner=TagList scene node, wrap-flow row).
    //   TagList factory children:[] (items propagation) → suppression 불필요, append 만.
    const tagProjection = sceneNode
      ? resolveDataBoundTagProjection(
          sceneNode,
          node,
          options,
          getDocumentNodesById,
        )
      : null;

    // ADR-912 영역 B (A): TabList tab projection (owner=TabList scene node, 한 줄 flex row).
    //   TabList factory props:{} (items propagation) → suppression 불필요, append 만.
    //   이전 implicitStyles virtual Tab(layout-synthetic) 을 render-space projection 으로 이전.
    //   getDocumentNodesById 는 pre-propagation 기존 문서 호환 fallback(owner Tabs lookup) 용.
    const tabProjection = sceneNode
      ? resolveDataBoundTabProjection(sceneNode, node, getDocumentNodesById)
      : null;

    // ADR-912 영역 B (A): Breadcrumbs crumb projection (owner=Breadcrumbs scene node 자체,
    //   중간 컨테이너 없음 — 1단 직접). 신규 Breadcrumbs factory 는 children:[] (items SSOT)
    //   지만, **pre-migration 기존 문서는 자식 Breadcrumb element 를 보유**한다. items 가 있어
    //   projection 이 active 면 legacy 자식 Breadcrumb element 를 visit 에서 제외해야 이중 렌더
    //   (legacy 자식 + projection crumb)를 막는다. DOM(renderBreadcrumbs `hasItems ? null
    //   : children`)과 대칭.
    const breadcrumbProjection = sceneNode
      ? resolveDataBoundBreadcrumbProjection(sceneNode, node, options)
      : null;
    const suppressBreadcrumbChildren =
      breadcrumbProjection != null && node.type === "Breadcrumbs";

    node.children?.forEach((child) => {
      if (suppressedAnchorId && child.id === suppressedAnchorId) return;
      // ADR-912 영역 B (A): items projection active 면 legacy 자식 Breadcrumb element 제외
      //   (이중 렌더 차단). non-Breadcrumb 자식(혹시 잔존)은 보존.
      if (suppressBreadcrumbChildren && child.type === "Breadcrumb") {
        return;
      }
      // ADR-148 Phase 0 (구 ADR-147): ListBoxItem 의 slot 조합 자식(Icon/Label/Description)은
      //   독립 scene 노드로 세우지 않는다 — 구성·스타일이 projection 의 `_slots` 로 접혀
      //   `listbox_item` skiaPrimitive escape(단일 replace paint)와 DOM emit 이 소비하므로,
      //   가시 scene 에 그대로 두면 세로 stacked 이중 렌더가 된다. (구 주석의 "spec
      //   render.shapes 단일 렌더러" 는 ADR-912 가 물리 삭제한 경로 참조라 정정 — 2026-07-17)
      //
      // 단, reusable origin(Components 페이지)은 접지 않는다 (2026-07-17): slot 자식이
      //   scene/interaction node 로 서야 더블클릭 drill/선택/편집이 가능하다 (Card origin ·
      //   DOM renderer children-first 와 동형 authoring 표면). 이중 렌더는 escape 의
      //   `_hasChildren` shell gating 이 차단 (buildSpecNodeData 가 자식 실재 시만 주입).
      if (
        (node.type === "ListBoxItem" ||
          node.type === "GridListItem" ||
          node.type === "MenuItem") &&
        node.reusable !== true &&
        getSlotRole(child) != null
      ) {
        // ADR-148 Phase 4: GridListItem/MenuItem origin 의 slot 조합 자식도 동일 접힘 —
        //   gridlist_card escape / DOM emit 이 `_slots` 로 소비 (독립 scene 노드 금지).
        return;
      }
      visit(child, nextParentId, nextScope);
    });
    getRefDescendantChildren(node).forEach((children) => {
      children.forEach((child) => {
        visit(child, nextParentId, nextScope);
      });
    });
    if (sceneNode && listBoxProjection) {
      appendListBoxRowProjection(
        sceneNode,
        listBoxProjection,
        nextScope,
        graph,
        getDocumentNodesById,
      );
    }
    if (sceneNode && gridListProjection) {
      appendGridListRowProjection(
        sceneNode,
        gridListProjection,
        nextScope,
        graph,
        getDocumentNodesById,
      );
    }
    if (sceneNode && tableProjection) {
      appendTableRowProjection(sceneNode, tableProjection, nextScope, graph);
    }
    if (sceneNode && tagProjection) {
      appendTagRowProjection(sceneNode, tagProjection, nextScope, graph);
    }
    if (sceneNode && tabProjection) {
      appendTabRowProjection(sceneNode, tabProjection, nextScope, graph);
    }
    if (sceneNode && breadcrumbProjection) {
      appendBreadcrumbRowProjection(
        sceneNode,
        breadcrumbProjection,
        nextScope,
        graph,
      );
    }
  }

  doc.children.forEach((child) => {
    visit(child, null, ROOT_SCOPE);
  });

  return {
    childrenByParent,
    nodes,
    nodesMap,
    parentById,
  };
}

export function buildCanvasScenePageIndex(
  graph: CanvasSceneGraph,
): PageElementIndex {
  const elementsByPage = new Map<string, Set<string>>();
  const rootsByPage = new Map<string, string[]>();

  for (const node of graph.nodes) {
    if (!node.pageId) continue;

    let elements = elementsByPage.get(node.pageId);
    if (!elements) {
      elements = new Set();
      elementsByPage.set(node.pageId, elements);
    }
    elements.add(node.id);

    const parent = node.parentId ? graph.nodesMap.get(node.parentId) : null;
    const parentIsBody = parent?.type.toLowerCase() === "body";
    if (!node.parentId || parentIsBody) {
      let roots = rootsByPage.get(node.pageId);
      if (!roots) {
        roots = [];
        rootsByPage.set(node.pageId, roots);
      }
      if (!roots.includes(node.id)) roots.push(node.id);
    }
  }

  return {
    elementsByPage,
    rootsByPage,
  };
}
